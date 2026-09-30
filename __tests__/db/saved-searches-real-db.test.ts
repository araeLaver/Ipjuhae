import { afterAll, beforeAll, expect, it, vi, describe } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => auth.user }))
const url = process.env.SAVED_SEARCH_TEST_DATABASE_URL
const schema = `qa_saved_search_${randomUUID().replaceAll('-', '')}`
let db: typeof import('@/lib/db')
let api: typeof import('@/app/api/saved-searches/route')
let alerts: typeof import('@/lib/saved-search-alerts')
let admin: Client
const tenant = randomUUID(), other = randomUUID(), landlord = randomUUID()
const request = (method: string, body: unknown) => new Request('http://localhost/api/saved-searches', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const filters = { q: '합정', region: '서울', propertyType: 'oneroom', sort: 'created_at' }
let searchId = ''
let newProperty = ''
let initialized = false

describe.skipIf(!url)('saved search actual PostgreSQL, isolated schema', () => {
  beforeAll(async () => {
    if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('Local database required')
    vi.stubEnv('DATABASE_URL', url)
    vi.stubEnv('DB_SCHEMA', schema)
    vi.stubEnv('SAVED_SEARCH_ALERTS_ENABLED', 'true')
    admin = new Client({ connectionString: url })
    await admin.connect()
    await admin.query(`CREATE SCHEMA ${schema}`)
    initialized = true
    await admin.query(`SET search_path TO ${schema}, public`)
    await admin.query('CREATE TABLE users (id UUID PRIMARY KEY, deleted_at TIMESTAMPTZ)')
    await admin.query(readFileSync('db/migration-005-properties.sql', 'utf8'))
    await admin.query(readFileSync('db/migration-009-notifications.sql', 'utf8'))
    await admin.query(readFileSync('db/migration-046-saved-searches.sql', 'utf8'))
    // Migration replay must be safe.
    await admin.query(readFileSync('db/migration-046-saved-searches.sql', 'utf8'))
    await admin.query('INSERT INTO users (id) VALUES ($1), ($2), ($3)', [tenant, other, landlord])
    db = await import('@/lib/db')
    api = await import('@/app/api/saved-searches/route')
    alerts = await import('@/lib/saved-search-alerts')
  })
  afterAll(async () => {
    if (db) await db.default.end()
    if (initialized) await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    if (admin) await admin.end()
    vi.unstubAllEnvs()
  })
  it('unauthenticated and malformed input cannot create searches', async () => {
    auth.user = null
    expect((await api.POST(request('POST', { filters }))).status).toBe(401)
    auth.user = { id: tenant }
    expect((await api.POST(request('POST', { filters: { ...filters, propertyType: 'invalid' } }))).status).toBe(400)
  })
  it('concurrent identical saves produce one row and private ownership is enforced', async () => {
    auth.user = { id: tenant }
    const responses = await Promise.all([api.POST(request('POST', { filters, alertsEnabled: true })), api.POST(request('POST', { filters, alertsEnabled: true }))])
    expect(responses.map(r => r.status).sort()).toEqual([200, 201])
    const saved = await (await api.GET()).json()
    expect(saved.searches).toHaveLength(1)
    searchId = saved.searches[0].id
    auth.user = { id: other }
    expect((await (await api.GET()).json()).searches).toHaveLength(0)
    expect((await api.PATCH(request('PATCH', { id: searchId, alertsEnabled: false }))).status).toBe(404)
    expect((await api.DELETE(request('DELETE', { id: searchId }))).status).toBe(404)
  })
  it('only new available matching properties generate one notification across concurrent dispatchers', async () => {
    await db.query("UPDATE saved_searches SET alerts_since = NOW() - INTERVAL '1 hour', last_checked_at = NOW() - INTERVAL '2 minutes'")
    await db.query(`INSERT INTO properties (landlord_id, title, address, region, deposit, monthly_rent, property_type, created_at) VALUES ($1, '합정 오래된 매물', '합정', '서울', 0, 500000, 'oneroom', NOW() - INTERVAL '1 day')`, [landlord])
    const rows = await db.query<{ id: string }>(`INSERT INTO properties (landlord_id, title, address, region, deposit, monthly_rent, property_type) VALUES ($1, '합정 신규 매물', '합정', '서울', 0, 500000, 'oneroom') RETURNING id`, [landlord])
    newProperty = rows[0].id
    await db.query(`INSERT INTO properties (landlord_id, title, address, region, deposit, monthly_rent, property_type, status) VALUES ($1, '합정 비공개', '합정', '서울', 0, 500000, 'oneroom', 'hidden'), ($1, '다른 조건', '부산', '부산', 0, 500000, 'villa', 'available')`, [landlord])
    await Promise.all([alerts.dispatchSavedSearchAlerts(), alerts.dispatchSavedSearchAlerts()])
    const notifications = await db.query<{ metadata: { propertyIds: string[] }; link: string; user_id: string }>('SELECT * FROM notifications')
    expect(notifications).toHaveLength(1)
    expect(notifications[0].user_id).toBe(tenant)
    expect(notifications[0].metadata.propertyIds).toEqual([newProperty])
    expect(notifications[0].link).toContain('type=oneroom')
    await db.query("UPDATE saved_searches SET last_checked_at = NOW() - INTERVAL '2 minutes'")
    await alerts.dispatchSavedSearchAlerts()
    expect(await db.query('SELECT * FROM notifications')).toHaveLength(1)
  })
  it('notification insertion failure rolls back delivery records and permits retry', async () => {
    await db.query(`INSERT INTO properties (landlord_id, title, address, region, deposit, monthly_rent, property_type) VALUES ($1, '합정 재시도 매물', '합정', '서울', 0, 500000, 'oneroom')`, [landlord])
    await db.query("UPDATE saved_searches SET last_checked_at = NOW() - INTERVAL '2 minutes'")
    await db.query("CREATE FUNCTION reject_notification() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$ LANGUAGE plpgsql")
    await db.query('CREATE TRIGGER fail_notification BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_notification()')
    await expect(alerts.dispatchSavedSearchAlerts()).rejects.toThrow('test failure')
    expect(await db.query('SELECT * FROM saved_search_deliveries')).toHaveLength(1)
    await db.query('DROP TRIGGER fail_notification ON notifications')
    await alerts.dispatchSavedSearchAlerts()
    expect(await db.query('SELECT * FROM notifications')).toHaveLength(2)
  })
  it('disabled searches stop alerts; enabling starts from now; deletion cascades deduplication records', async () => {
    auth.user = { id: tenant }
    expect((await api.PATCH(request('PATCH', { id: searchId, alertsEnabled: false }))).status).toBe(200)
    await db.query(`INSERT INTO properties (landlord_id, title, address, region, deposit, monthly_rent, property_type) VALUES ($1, '합정 알림 해제 중', '합정', '서울', 0, 500000, 'oneroom')`, [landlord])
    await db.query("UPDATE saved_searches SET last_checked_at = NOW() - INTERVAL '2 minutes'")
    expect((await alerts.dispatchSavedSearchAlerts()).checked).toBe(0)
    expect((await api.PATCH(request('PATCH', { id: searchId, alertsEnabled: true }))).status).toBe(200)
    await alerts.dispatchSavedSearchAlerts()
    expect(await db.query('SELECT * FROM notifications')).toHaveLength(2)
    expect((await api.DELETE(request('DELETE', { id: searchId }))).status).toBe(200)
    expect(await db.query('SELECT * FROM saved_search_deliveries')).toHaveLength(0)
  })
  it('concurrent unique saves respect the account cap', async () => {
    auth.user = { id: tenant }
    const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => api.POST(request('POST', { filters: { ...filters, q: `검색${i}` } }))))
    expect(responses.filter(r => r.status === 201)).toHaveLength(10)
    expect(responses.filter(r => r.status === 409)).toHaveLength(2)
    vi.stubEnv('SAVED_SEARCH_ALERTS_ENABLED', 'false')
    expect((await api.PATCH(request('PATCH', { id: searchId, alertsEnabled: true }))).status).toBe(503)
  })
})

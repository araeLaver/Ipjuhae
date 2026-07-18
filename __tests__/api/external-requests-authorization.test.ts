import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/compliance-gates', () => ({
  requireApprovedComplianceGate: vi.fn(),
  isComplianceGateError: vi.fn(() => false),
}))

vi.mock('@/lib/trust-engine', () => ({
  trustDigest: vi.fn(() => 'request-digest'),
}))

import { POST } from '@/app/api/v1/external-requests/route'
import { getCurrentUser } from '@/lib/auth'
import { requireApprovedComplianceGate } from '@/lib/compliance-gates'
import { transaction } from '@/lib/db'

const userId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const consentId = '33333333-3333-4333-8333-333333333333'
const externalRequestId = '44444444-4444-4444-8444-444444444444'

function request(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/v1/external-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sourceCode: 'codef',
      subjectType: 'tenant',
      subjectId: userId,
      purpose: 'external_verification',
      consentId,
      requestedFields: ['employment'],
      ...overrides,
    }),
  })
}

function createClient(options: {
  consentPurpose?: string
  consentUserId?: string
  consentAllowedFields?: unknown
  sourceAllowedFields?: unknown
} = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('FROM trust_source_registry')) {
      return {
        rows: [{
          id: '55555555-5555-4555-8555-555555555555',
          status: 'active',
          allowed_fields: options.sourceAllowedFields ?? ['employment', 'income'],
          source_type: 'partner_api',
          automation_level: 'automatic',
          legal_basis: 'User-requested verification',
          terms_reviewed_at: new Date('2026-07-17T00:00:00.000Z'),
          retention_days: 30,
        }],
      }
    }
    if (sql.includes('FROM data_consents')) {
      return {
        rows: [{
          user_id: options.consentUserId ?? userId,
          status: 'active',
          purpose: options.consentPurpose ?? 'external_verification',
          target_role: 'tenant',
          allowed_fields: options.consentAllowedFields ?? { employment: true },
          expires_at: null,
        }],
      }
    }
    if (sql.includes('INSERT INTO trust_external_requests')) {
      return { rows: [{ id: externalRequestId }] }
    }
    if (sql.includes('INSERT INTO trust_outbox_events')) {
      return { rows: [] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  })
  return { query }
}

function expectNoQueueWrites(client: ReturnType<typeof createClient>) {
  const statements = client.query.mock.calls.map(([sql]) => String(sql))
  expect(statements.some((sql) => sql.includes('INSERT INTO trust_external_requests'))).toBe(false)
  expect(statements.some((sql) => sql.includes('INSERT INTO trust_outbox_events'))).toBe(false)
}

describe('external request authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      email: 'tenant@example.com',
      user_type: 'tenant',
    } as never)
    vi.mocked(requireApprovedComplianceGate).mockResolvedValue()
  })

  it('rejects a consent issued for a different purpose without queueing work', async () => {
    const client = createClient({ consentPurpose: 'tenant_profile_view' })
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.code).toBe('TRUST_EXTERNAL_CONSENT_INVALID')
    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('external_data_access', client)
    expectNoQueueWrites(client)
  })

  it('rejects another user as the subject before queue or outbox work', async () => {
    const response = await POST(request({ subjectId: otherUserId }))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.code).toBe('TRUST_EXTERNAL_SUBJECT_FORBIDDEN')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects property requests until a dedicated ownership policy exists', async () => {
    const response = await POST(request({ subjectType: 'property' }))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.code).toBe('TRUST_EXTERNAL_SUBJECT_FORBIDDEN')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects fields not explicitly allowed by the active consent', async () => {
    const client = createClient({
      consentAllowedFields: { employment: true, income: false },
    })
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const response = await POST(request({ requestedFields: ['employment', 'income'] }))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.code).toBe('TRUST_EXTERNAL_FIELD_FORBIDDEN')
    expectNoQueueWrites(client)
  })

  it('treats an empty source allowlist as deny-all', async () => {
    const client = createClient({ sourceAllowedFields: [] })
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.code).toBe('TRUST_EXTERNAL_FIELD_FORBIDDEN')
    expectNoQueueWrites(client)
  })

  it('queues only a self request covered by the dedicated consent fields', async () => {
    const client = createClient()
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const response = await POST(request())
    const payload = await response.json()
    const statements = client.query.mock.calls.map(([sql]) => String(sql))

    expect(response.status).toBe(202)
    expect(payload.request.id).toBe(externalRequestId)
    expect(statements.some((sql) => sql.includes('INSERT INTO trust_external_requests'))).toBe(true)
    expect(statements.some((sql) => sql.includes('INSERT INTO trust_outbox_events'))).toBe(true)
  })
})

/**
 * trust 계열 route happy path를 **실제 Postgres에** 태우는 하네스.
 *
 * 왜 따로 있나:
 *   `__tests__/api/**`의 route 테스트는 `vi.mock('@/lib/db')`로 DB를 통째로 mock한다.
 *   그래서 SQL 문자열은 한 번도 실행되지 않고, 컬럼명/테이블명 불일치는 전부 통과한다.
 *   탈퇴 라우트에서 같은 유형의 결함이 세 번 났다(account-delete 회귀 이력).
 *   여기서는 `lib/db`를 mock하지 않는다. 실제 SQL이 실제 스키마에 부딪힌다.
 *
 * mock하는 것은 `next/headers` 하나뿐이다(요청 쿠키 주입용).
 * 인증 자체는 실제 JWT 검증 + 실제 `SELECT * FROM users` 경로를 그대로 탄다.
 *
 * 실행:
 *   DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db" DB_SCHEMA=ipjuhae npm run test:db
 *
 * 절차·전제는 docs/LOCAL_DB_SETUP.md. 운영 DB에는 절대 돌지 않는다(아래 가드).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

const authState = vi.hoisted(() => ({ token: null as string | null }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'auth_token' && authState.token ? { value: authState.token } : undefined,
  }),
  headers: async () => new Headers(),
}))

import { query, queryOne } from '@/lib/db'
import pool from '@/lib/db'
import { generateToken } from '@/lib/auth'
import { GET as getConsents, POST as postConsent, DELETE as deleteConsent } from '@/app/api/consent/route'
import { GET as getConsentEvents } from '@/app/api/consent/events/route'
import { GET as getAccessLogs } from '@/app/api/access-logs/route'
import {
  GET as getDisputes,
  POST as postDispute,
  PATCH as patchDispute,
} from '@/app/api/references/[id]/disputes/route'
import { GET as getTrustReport } from '@/app/api/v1/trust/report/route'
import { isLocalDatabaseHost } from '@/lib/db-ssl.mjs'

/** 운영 DB 보호: 로컬 host가 아니면 아무것도 하지 않는다. */
function assertLocalDatabase(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL이 없습니다. docs/LOCAL_DB_SETUP.md 참고: DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db"'
    )
  }
  const host = new URL(url).hostname
  if (!isLocalDatabaseHost(host)) {
    throw new Error(`로컬 DB에서만 실행합니다(host=${host}).`)
  }
  return url
}

const suffix = randomUUID().slice(0, 8)
const tenantEmail = `qa-dbsmoke-tenant-${suffix}@example.invalid`
const adminEmail = `qa-dbsmoke-admin-${suffix}@example.invalid`

let tenantId = ''
let adminId = ''
let referenceId = ''
let responseId = ''
let accessLogId = ''

function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function actAs(userId: string, userType: string) {
  authState.token = generateToken(userId, userType)
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, any>
}

beforeAll(async () => {
  assertLocalDatabase()

  const migrations = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM _migrations')
  expect(Number(migrations?.count ?? 0)).toBeGreaterThanOrEqual(49)

  const [tenant] = await query<{ id: string }>(
    `INSERT INTO users (email, name, user_type) VALUES ($1, $2, 'tenant') RETURNING id`,
    [tenantEmail, 'QA 스모크 세입자']
  )
  tenantId = tenant.id

  const [admin] = await query<{ id: string }>(
    `INSERT INTO users (email, name, user_type) VALUES ($1, $2, 'admin') RETURNING id`,
    [adminEmail, 'QA 스모크 운영자']
  )
  adminId = admin.id

  const [reference] = await query<{ id: string }>(
    `INSERT INTO landlord_references (user_id, landlord_name, landlord_phone, status, completed_at)
     VALUES ($1, 'QA 스모크 임대인', '010-0000-0000', 'completed', NOW())
     RETURNING id`,
    [tenantId]
  )
  referenceId = reference.id

  const [response] = await query<{ id: string }>(
    `INSERT INTO reference_responses
       (reference_id, rent_payment, property_condition, neighbor_issues, checkout_condition, would_recommend, comment)
     VALUES ($1, 5, 4, 5, 4, TRUE, 'QA 스모크 응답')
     RETURNING id`,
    [referenceId]
  )
  responseId = response.id

  const [log] = await query<{ id: string }>(
    `INSERT INTO access_audit_logs
       (actor_user_id, actor_role, target_type, target_id, target_user_id, purpose, fields_viewed)
     VALUES ($1, 'landlord', 'tenant_profile', $2, $2, 'qa_db_smoke', ARRAY['basic_profile'])
     RETURNING id`,
    [adminId, tenantId]
  )
  accessLogId = log.id
})

afterAll(async () => {
  if (accessLogId) await query('DELETE FROM access_audit_logs WHERE id = $1', [accessLogId])
  if (responseId) await query('DELETE FROM reference_disputes WHERE reference_response_id = $1', [responseId])
  if (responseId) await query('DELETE FROM reference_responses WHERE id = $1', [responseId])
  if (referenceId) await query('DELETE FROM landlord_references WHERE id = $1', [referenceId])
  if (tenantId) {
    await query('DELETE FROM consent_events WHERE user_id = $1', [tenantId])
    await query('DELETE FROM data_consents WHERE user_id = $1', [tenantId])
    await query('DELETE FROM api_idempotency_requests WHERE actor_user_id = $1', [tenantId])
  }
  if (adminId) await query('DELETE FROM api_idempotency_requests WHERE actor_user_id = $1', [adminId])
  if (tenantId) await query('DELETE FROM users WHERE id = $1', [tenantId])
  if (adminId) await query('DELETE FROM users WHERE id = $1', [adminId])
  await pool.end()
})

describe('consent happy path (실제 DB)', () => {
  it('동의 등록 → 조회 → 이벤트 조회 → 철회가 실제 SQL로 통과한다', async () => {
    actAs(tenantId, 'tenant')

    const created = await postConsent(
      jsonRequest('http://localhost:3000/api/consent', 'POST', {
        targetRole: 'landlord',
        purpose: 'tenant_profile_view',
        allowedFields: { basic_profile: true, trust_score: true },
      })
    )
    const createdBody = await readJson(created)
    expect(created.status, JSON.stringify(createdBody)).toBe(201)
    expect(createdBody.consent.user_id).toBe(tenantId)
    expect(createdBody.consent.status).toBe('active')
    expect(createdBody.consent.allowed_fields.basic_profile).toBe(true)

    const listed = await getConsents(jsonRequest('http://localhost:3000/api/consent', 'GET'))
    const listedBody = await readJson(listed)
    expect(listed.status, JSON.stringify(listedBody)).toBe(200)
    expect(listedBody.consents.some((row: any) => row.id === createdBody.consent.id)).toBe(true)

    const events = await getConsentEvents(jsonRequest('http://localhost:3000/api/consent/events', 'GET'))
    const eventsBody = await readJson(events)
    expect(events.status, JSON.stringify(eventsBody)).toBe(200)

    const revoked = await deleteConsent(
      jsonRequest('http://localhost:3000/api/consent', 'DELETE', {
        targetRole: 'landlord',
        purpose: 'tenant_profile_view',
        reason: 'QA 스모크 철회',
      })
    )
    const revokedBody = await readJson(revoked)
    expect(revoked.status, JSON.stringify(revokedBody)).toBe(200)

    const stored = await queryOne<{ status: string; revoke_reason: string }>(
      'SELECT status, revoke_reason FROM data_consents WHERE id = $1',
      [createdBody.consent.id]
    )
    expect(stored?.status).toBe('revoked')
    expect(stored?.revoke_reason).toBe('QA 스모크 철회')
  })

  it('Idempotency-Key 재전송이 같은 동의 1건만 남긴다', async () => {
    actAs(tenantId, 'tenant')
    const key = `qa-db-smoke-${randomUUID()}`
    const payload = {
      targetRole: 'broker',
      purpose: 'property_view',
      allowedFields: { basic_profile: true },
    }

    const first = await postConsent(
      jsonRequest('http://localhost:3000/api/consent', 'POST', payload, { 'Idempotency-Key': key })
    )
    const firstBody = await readJson(first)
    expect(first.status, JSON.stringify(firstBody)).toBe(201)

    const second = await postConsent(
      jsonRequest('http://localhost:3000/api/consent', 'POST', payload, { 'Idempotency-Key': key })
    )
    const secondBody = await readJson(second)
    expect(secondBody.consent.id).toBe(firstBody.consent.id)

    const rows = await query<{ id: string }>(
      `SELECT id FROM data_consents WHERE user_id = $1 AND target_role = 'broker' AND purpose = 'property_view'`,
      [tenantId]
    )
    expect(rows).toHaveLength(1)
  })
})

describe('access log happy path (실제 DB)', () => {
  it('본인 관련 로그만 조회되고 페이지네이션 SQL이 실행된다', async () => {
    actAs(tenantId, 'tenant')

    const response = await getAccessLogs(
      jsonRequest('http://localhost:3000/api/access-logs?targetType=tenant_profile&limit=10', 'GET')
    )
    const body = await readJson(response)
    expect(response.status, JSON.stringify(body)).toBe(200)
    expect(body.logs.some((row: any) => row.id === accessLogId)).toBe(true)
    expect(body.pagination.total).toBeGreaterThanOrEqual(1)
    expect(body.filters.targetType).toBe('tenant_profile')
  })

  it('다른 사용자는 남의 로그를 보지 못한다', async () => {
    actAs(adminId, 'admin')
    const asAdmin = await getAccessLogs(
      jsonRequest(`http://localhost:3000/api/access-logs?actorUserId=${adminId}`, 'GET')
    )
    expect(asAdmin.status).toBe(200)

    const otherTenant = await queryOne<{ id: string }>(
      `INSERT INTO users (email, name, user_type) VALUES ($1, 'QA 타인', 'tenant') RETURNING id`,
      [`qa-dbsmoke-other-${suffix}@example.invalid`]
    )
    try {
      actAs(otherTenant!.id, 'tenant')
      const response = await getAccessLogs(jsonRequest('http://localhost:3000/api/access-logs', 'GET'))
      const body = await readJson(response)
      expect(response.status).toBe(200)
      expect(body.logs.some((row: any) => row.id === accessLogId)).toBe(false)
    } finally {
      await query('DELETE FROM users WHERE id = $1', [otherTenant!.id])
    }
  })
})

describe('reference dispute happy path (실제 DB)', () => {
  it('이의제기 등록 → 조회 → 운영자 상태 전이가 실제 SQL로 통과한다', async () => {
    actAs(tenantId, 'tenant')
    const params = { params: Promise.resolve({ id: referenceId }) }

    const created = await postDispute(
      jsonRequest(`http://localhost:3000/api/references/${referenceId}/disputes`, 'POST', {
        reason: 'QA 스모크 사유',
        detail: 'QA 스모크 상세 내용입니다.',
      }),
      params
    )
    const createdBody = await readJson(created)
    expect(created.status, JSON.stringify(createdBody)).toBe(201)
    expect(createdBody.dispute.status).toBe('pending')
    expect(createdBody.dispute.reference_response_id).toBe(responseId)

    const listed = await getDisputes(
      jsonRequest(`http://localhost:3000/api/references/${referenceId}/disputes`, 'GET'),
      { params: Promise.resolve({ id: referenceId }) }
    )
    const listedBody = await readJson(listed)
    expect(listed.status, JSON.stringify(listedBody)).toBe(200)
    expect(listedBody.disputes).toHaveLength(1)

    actAs(adminId, 'admin')
    const reviewed = await patchDispute(
      jsonRequest(`http://localhost:3000/api/references/${referenceId}/disputes`, 'PATCH', {
        status: 'reviewing',
        reviewComment: 'QA 스모크 검토 시작',
      }),
      { params: Promise.resolve({ id: referenceId }) }
    )
    const reviewedBody = await readJson(reviewed)
    expect(reviewed.status, JSON.stringify(reviewedBody)).toBe(200)
    expect(reviewedBody.dispute.status).toBe('reviewing')
    expect(reviewedBody.dispute.reviewed_by).toBe(adminId)
  })
})

describe('trust report happy path (실제 DB)', () => {
  it('trust_* 테이블 7종 조회가 컬럼 오류 없이 끝난다', async () => {
    actAs(tenantId, 'tenant')
    const response = await getTrustReport(jsonRequest('http://localhost:3000/api/v1/trust/report', 'GET'))
    const body = await readJson(response)
    expect(response.status, JSON.stringify(body)).toBe(200)
    for (const key of ['scores', 'facts', 'transactions', 'reviews', 'disclosures', 'audit']) {
      expect(Array.isArray(body[key]), `${key}는 배열이어야 한다`).toBe(true)
    }
  })
})

describe('인증 가드 (실제 DB)', () => {
  it('토큰 없으면 401이고, 삭제된 사용자의 토큰도 401이다', async () => {
    authState.token = null
    const anonymous = await getConsents(jsonRequest('http://localhost:3000/api/consent', 'GET'))
    expect(anonymous.status).toBe(401)

    const ghost = await queryOne<{ id: string }>(
      `INSERT INTO users (email, name, user_type, deleted_at)
       VALUES ($1, 'QA 탈퇴자', 'tenant', NOW()) RETURNING id`,
      [`qa-dbsmoke-deleted-${suffix}@example.invalid`]
    )
    try {
      actAs(ghost!.id, 'tenant')
      const response = await getConsents(jsonRequest('http://localhost:3000/api/consent', 'GET'))
      expect(response.status).toBe(401)
    } finally {
      await query('DELETE FROM users WHERE id = $1', [ghost!.id])
    }
  })
})

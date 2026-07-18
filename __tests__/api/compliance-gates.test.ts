import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({
  getAdminUser: vi.fn(),
  logAdminAction: vi.fn(),
}))

vi.mock('@/lib/contract-trust', () => ({
  listAllContractReports: vi.fn(),
}))

vi.mock('@/lib/trust-engine', () => ({
  calculateTrustScore: vi.fn(),
  generateTransactionRecommendations: vi.fn(),
  trustDigest: vi.fn(() => 'digest'),
}))

import { PATCH as patchTrustProduct } from '@/app/api/v1/admin/trust-product/route'
import { POST as createExternalRequest } from '@/app/api/v1/external-requests/route'
import { POST as calculateScore } from '@/app/api/v1/scores/[subjectType]/[subjectId]/route'
import { getAdminUser } from '@/lib/admin'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne, transaction } from '@/lib/db'
import { calculateTrustScore } from '@/lib/trust-engine'

const userId = '11111111-1111-4111-8111-111111111111'

function jsonRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('compliance gate API boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      user_type: 'tenant',
    } as never)
  })

  it('blocks score calculation before the trust engine or idempotency storage runs', async () => {
    vi.mocked(queryOne).mockResolvedValue({
      gate_key: 'automated_scoring',
      status: 'blocked',
      approval_reference: null,
      approved_by: null,
      approved_at: null,
    })

    const response = (await calculateScore(
      jsonRequest('http://localhost/api/v1/scores/tenant/' + userId, {}),
      { params: Promise.resolve({ subjectType: 'tenant', subjectId: userId }) },
    ))!
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
    expect(calculateTrustScore).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('blocks an external request before source, consent, outbox, or idempotency work', async () => {
    vi.mocked(queryOne).mockResolvedValue({
      gate_key: 'external_data_access',
      status: 'pending',
      approval_reference: null,
      approved_by: null,
      approved_at: null,
    })

    const response = await createExternalRequest(
      jsonRequest('http://localhost/api/v1/external-requests', {
        sourceCode: 'codef',
        subjectType: 'tenant',
        subjectId: userId,
        purpose: 'employment_verification',
        consentId: '22222222-2222-4222-8222-222222222222',
        requestedFields: ['employment'],
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
    expect(queryOne).toHaveBeenCalledTimes(1)
    expect(query).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('requires a nonblank approval reference at the admin API boundary', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({
      id: userId,
      email: 'admin@example.com',
      name: 'Admin',
      user_type: 'admin',
    } as never)

    const response = await patchTrustProduct(
      jsonRequest('http://localhost/api/v1/admin/trust-product', {
        resource: 'compliance_gate',
        id: 'automated_scoring',
        status: 'approved',
        approvalReference: '   ',
        notes: null,
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.code).toBe('COMPLIANCE_GATE_APPROVAL_REFERENCE_REQUIRED')
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('records an approved gate transition in the same transaction', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({
      id: userId,
      email: 'admin@example.com',
      name: 'Admin',
      user_type: 'admin',
    } as never)
    const previous = {
      gate_key: 'automated_scoring',
      status: 'blocked',
      approval_reference: null,
      approved_by: null,
      approved_at: null,
    }
    const approved = {
      ...previous,
      status: 'approved',
      approval_reference: 'LEGAL-2026-0042',
      approved_by: userId,
      approved_at: new Date('2026-07-17T00:00:00.000Z'),
    }
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [previous] })
        .mockResolvedValueOnce({ rows: [approved] }),
    }
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const response = await patchTrustProduct(
      jsonRequest('http://localhost/api/v1/admin/trust-product', {
        resource: 'compliance_gate',
        id: 'automated_scoring',
        status: 'approved',
        approvalReference: 'LEGAL-2026-0042',
        notes: 'Legal and regression review completed',
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.compliance_gate.status).toBe('approved')
    expect(client.query).toHaveBeenCalledTimes(3)
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("set_config('app.compliance_actor_id'"),
      [userId],
    )
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FOR UPDATE'),
      ['automated_scoring'],
    )
  })
})

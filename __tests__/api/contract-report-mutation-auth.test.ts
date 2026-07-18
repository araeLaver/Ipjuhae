import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/contract-trust', () => ({
  createTrustCard: vi.fn(),
  getContractReport: vi.fn(),
  listTrustCards: vi.fn(),
  preflightTrustCardCreation: vi.fn(),
  transitionContractReport: vi.fn(),
  updateContractReportItem: vi.fn(),
}))

vi.mock('@/lib/idempotency', () => ({
  withIdempotency: vi.fn(),
}))

import { POST as createTrustCardRoute } from '@/app/api/v1/trust-cards/route'
import { PATCH as transitionContractReportRoute } from '@/app/api/v1/contract-reports/[id]/route'
import { PATCH as updateContractReportItemRoute } from '@/app/api/v1/contract-reports/[id]/items/[itemId]/route'
import { getAdminUser } from '@/lib/admin'
import { getCurrentUser } from '@/lib/auth'
import {
  createTrustCard,
  preflightTrustCardCreation,
  transitionContractReport,
  updateContractReportItem,
} from '@/lib/contract-trust'
import { ComplianceGateError } from '@/lib/compliance-gates'
import { withIdempotency } from '@/lib/idempotency'

const userId = '11111111-1111-4111-8111-111111111111'
const reportId = '22222222-2222-4222-8222-222222222222'
const itemId = '33333333-3333-4333-8333-333333333333'

const trustCardInput = {
  reportId,
  subjectType: 'combined',
  title: 'Approved contract facts',
  audienceRole: 'private_recipient',
  purpose: 'Contract review',
  fieldKeys: ['identity_check'],
  expiresAt: '2026-07-24T00:00:00.000Z',
}

function trustCardRequest() {
  return new Request('http://localhost/api/v1/trust-cards', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'trust-card-test-key',
    },
    body: JSON.stringify(trustCardInput),
  })
}

function transitionRequest(status = 'in_review') {
  return new Request(`http://localhost/api/v1/contract-reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

function itemRequest() {
  return new Request(
    `http://localhost/api/v1/contract-reports/${reportId}/items/${itemId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        verificationStatus: 'VERIFIED',
        reviewState: 'approved',
      }),
    },
  )
}

function blockedGate() {
  return new ComplianceGateError('b2b_api', 'COMPLIANCE_GATE_NOT_APPROVED')
}

describe('Trust Card mutation authorization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      user_type: 'tenant',
    } as never)
    vi.mocked(getAdminUser).mockResolvedValue(null as never)
    vi.mocked(preflightTrustCardCreation).mockResolvedValue()
    vi.mocked(withIdempotency).mockImplementation(async (options) => options.handler())
  })

  it('runs preflight before idempotency and marks 503 responses as non-cacheable', async () => {
    vi.mocked(createTrustCard).mockResolvedValue({
      card: { id: 'card-1' },
      share_token: 'one-time-token',
    } as never)

    const request = trustCardRequest()
    const response = await createTrustCardRoute(request)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.share_token).toBe('one-time-token')
    expect(preflightTrustCardCreation).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ reportId }),
    )
    expect(
      vi.mocked(preflightTrustCardCreation).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(withIdempotency).mock.invocationCallOrder[0],
    )
    expect(withIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        request,
        namespace: 'trust-card-create',
        key: 'trust-card-test-key',
        actorUserId: userId,
        nonCacheableStatuses: [503],
      }),
    )
    const idempotencyOptions = vi.mocked(withIdempotency).mock.calls[0]?.[0]
    await expect(idempotencyOptions?.request.clone().json()).resolves.toMatchObject({
      reportId,
      fieldKeys: ['identity_check'],
    })
  })

  it('returns 503 without reserving idempotency or creating a card when preflight blocks compliance', async () => {
    vi.mocked(preflightTrustCardCreation).mockRejectedValueOnce(blockedGate())

    const response = await createTrustCardRoute(trustCardRequest())
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
    expect(withIdempotency).not.toHaveBeenCalled()
    expect(createTrustCard).not.toHaveBeenCalled()
  })

  it('maps a preflight mutation denial to 403 without entering idempotency', async () => {
    vi.mocked(preflightTrustCardCreation).mockRejectedValueOnce(
      new Error('CONTRACT_REPORT_MUTATION_DENIED'),
    )

    const response = await createTrustCardRoute(trustCardRequest())
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.code).toBe('CONTRACT_REPORT_MUTATION_DENIED')
    expect(withIdempotency).not.toHaveBeenCalled()
    expect(createTrustCard).not.toHaveBeenCalled()
  })

  it('maps a mutation-time authorization race to 403', async () => {
    vi.mocked(createTrustCard).mockRejectedValueOnce(
      new Error('CONTRACT_REPORT_MUTATION_DENIED'),
    )

    const response = await createTrustCardRoute(trustCardRequest())
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.code).toBe('CONTRACT_REPORT_MUTATION_DENIED')
    expect(withIdempotency).toHaveBeenCalledOnce()
    expect(createTrustCard).toHaveBeenCalledOnce()
  })

  it('maps an internal compliance recheck race to a retryable 503', async () => {
    vi.mocked(createTrustCard).mockRejectedValueOnce(blockedGate())

    const response = await createTrustCardRoute(trustCardRequest())
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
    expect(withIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ nonCacheableStatuses: [503] }),
    )
    expect(createTrustCard).toHaveBeenCalledOnce()
  })
})

describe('contract report mutation error mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      user_type: 'tenant',
    } as never)
    vi.mocked(getAdminUser).mockResolvedValue(null as never)
  })

  it.each([
    {
      label: 'mutation denial',
      error: () => new Error('CONTRACT_REPORT_MUTATION_DENIED'),
      status: 403,
      code: 'CONTRACT_REPORT_MUTATION_DENIED',
    },
    {
      label: 'invalid transition',
      error: () => new Error('CONTRACT_REPORT_INVALID_TRANSITION'),
      status: 409,
      code: 'CONTRACT_REPORT_INVALID_TRANSITION',
    },
    {
      label: 'blocked compliance gate',
      error: blockedGate,
      status: 503,
      code: 'COMPLIANCE_GATE_NOT_APPROVED',
    },
  ])('maps report transition $label to $status', async ({ error, status, code }) => {
    vi.mocked(transitionContractReport).mockRejectedValueOnce(error())

    const response = await transitionContractReportRoute(
      transitionRequest(),
      { params: Promise.resolve({ id: reportId }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(status)
    expect(payload.code).toBe(code)
  })

  it.each([
    {
      label: 'mutation denial',
      error: () => new Error('CONTRACT_REPORT_MUTATION_DENIED'),
      status: 403,
      code: 'CONTRACT_REPORT_MUTATION_DENIED',
    },
    {
      label: 'locked item',
      error: () => new Error('CONTRACT_REPORT_ITEM_LOCKED'),
      status: 409,
      code: 'CONTRACT_REPORT_ITEM_LOCKED',
    },
    {
      label: 'blocked compliance gate',
      error: blockedGate,
      status: 503,
      code: 'COMPLIANCE_GATE_NOT_APPROVED',
    },
  ])('maps report item $label to $status', async ({ error, status, code }) => {
    vi.mocked(updateContractReportItem).mockRejectedValueOnce(error())

    const response = await updateContractReportItemRoute(
      itemRequest(),
      { params: Promise.resolve({ id: reportId, itemId }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(status)
    expect(payload.code).toBe(code)
  })
})

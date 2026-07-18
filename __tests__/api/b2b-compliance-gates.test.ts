import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/contract-trust', () => ({
  addOrganizationMember: vi.fn(),
  createContractReport: vi.fn(),
  createOrganization: vi.fn(),
  listAiProcessingRuns: vi.fn(),
  listContractReports: vi.fn(),
  listOrganizations: vi.fn(),
  recordAiProcessingRun: vi.fn(),
}))

vi.mock('@/lib/idempotency', () => ({
  withIdempotency: vi.fn(),
}))

vi.mock('@/lib/compliance-gates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/compliance-gates')>()
  return {
    ...actual,
    requireApprovedComplianceGate: vi.fn(),
  }
})

import {
  GET as listContractReportsRoute,
  POST as createContractReportRoute,
} from '@/app/api/v1/contract-reports/route'
import {
  GET as listOrganizationsRoute,
  POST as createOrganizationRoute,
} from '@/app/api/v1/organizations/route'
import { POST as addOrganizationMemberRoute } from '@/app/api/v1/organizations/[id]/members/route'
import { POST as recordAiProcessingRunRoute } from '@/app/api/v1/ai-processing-runs/route'
import { getCurrentUser } from '@/lib/auth'
import {
  addOrganizationMember,
  createContractReport,
  createOrganization,
  listContractReports,
  listOrganizations,
  recordAiProcessingRun,
} from '@/lib/contract-trust'
import {
  ComplianceGateError,
  requireApprovedComplianceGate,
} from '@/lib/compliance-gates'
import { withIdempotency } from '@/lib/idempotency'

const userId = '11111111-1111-4111-8111-111111111111'
const organizationId = '22222222-2222-4222-8222-222222222222'
const memberId = '33333333-3333-4333-8333-333333333333'

function jsonRequest(path: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'test-key',
    },
    body: JSON.stringify(body),
  })
}

function blockedGate() {
  return new ComplianceGateError('b2b_api', 'COMPLIANCE_GATE_NOT_APPROVED')
}

describe('B2B compliance gate API boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      user_type: 'tenant',
    } as never)
    vi.mocked(withIdempotency).mockImplementation(async (options) => options.handler())
  })

  it('blocks organization creation before idempotency or domain writes', async () => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValueOnce(blockedGate())

    const response = await createOrganizationRoute(
      jsonRequest('/api/v1/organizations', {
        name: 'Safe Realty',
        organizationType: 'broker_office',
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
    expect(withIdempotency).not.toHaveBeenCalled()
    expect(createOrganization).not.toHaveBeenCalled()
  })

  it('blocks member addition before the organization mutation', async () => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValueOnce(blockedGate())

    const response = await addOrganizationMemberRoute(
      jsonRequest(`/api/v1/organizations/${organizationId}/members`, {
        userId: memberId,
        memberRole: 'member',
      }),
      { params: Promise.resolve({ id: organizationId }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
    expect(addOrganizationMember).not.toHaveBeenCalled()
  })

  it('blocks an organization-scoped report before idempotency or report creation', async () => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValueOnce(blockedGate())

    const response = await createContractReportRoute(
      jsonRequest('/api/v1/contract-reports', {
        organizationId,
        requesterRole: 'tenant',
        title: 'Organization report',
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
    expect(withIdempotency).not.toHaveBeenCalled()
    expect(createContractReport).not.toHaveBeenCalled()
  })

  it('blocks an organization-scoped AI run before idempotency or domain writes', async () => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValueOnce(blockedGate())

    const response = await recordAiProcessingRunRoute(
      jsonRequest('/api/v1/ai-processing-runs', {
        organizationId,
        purpose: 'Document extraction audit',
        provider: 'internal',
        modelName: 'review-model',
        inputHash: 'a'.repeat(64),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
    expect(withIdempotency).not.toHaveBeenCalled()
    expect(recordAiProcessingRun).not.toHaveBeenCalled()
  })

  it('allows a personal report without consulting the B2B gate', async () => {
    vi.mocked(createContractReport).mockResolvedValue({ id: 'report-1' } as never)
    vi.mocked(withIdempotency).mockImplementationOnce(async (options) => {
      await expect(options.request.clone().json()).resolves.toMatchObject({
        requesterRole: 'tenant',
        title: 'Personal report',
      })
      return options.handler()
    })

    const response = await createContractReportRoute(
      jsonRequest('/api/v1/contract-reports', {
        requesterRole: 'tenant',
        title: 'Personal report',
      }),
    )

    expect(response.status).toBe(201)
    expect(requireApprovedComplianceGate).not.toHaveBeenCalled()
    expect(withIdempotency).toHaveBeenCalledOnce()
    expect(createContractReport).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        requesterRole: 'tenant',
        title: 'Personal report',
      }),
    )
    expect(vi.mocked(createContractReport).mock.calls[0]?.[1]).not.toHaveProperty('organizationId')
  })

  it('maps a domain recheck failure to a safe 503 response', async () => {
    vi.mocked(requireApprovedComplianceGate).mockResolvedValueOnce()
    vi.mocked(createOrganization).mockRejectedValueOnce(blockedGate())

    const response = await createOrganizationRoute(
      jsonRequest('/api/v1/organizations', {
        name: 'Safe Realty',
        organizationType: 'broker_office',
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.code).toBe('COMPLIANCE_GATE_NOT_APPROVED')
  })

  it('keeps organization and contract-report reads available', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([])
    vi.mocked(listContractReports).mockResolvedValue([])

    const organizationResponse = await listOrganizationsRoute(
      new Request('http://localhost/api/v1/organizations'),
    )
    const reportResponse = await listContractReportsRoute(
      new Request('http://localhost/api/v1/contract-reports'),
    )

    expect(organizationResponse.status).toBe(200)
    expect(reportResponse.status).toBe(200)
    expect(requireApprovedComplianceGate).not.toHaveBeenCalled()
  })
})

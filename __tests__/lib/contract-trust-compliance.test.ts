import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/compliance-gates', () => ({
  requireApprovedComplianceGate: vi.fn(),
}))

import {
  addOrganizationMember,
  createContractReport,
  createOrganization,
  recordAiProcessingRun,
} from '@/lib/contract-trust'
import { requireApprovedComplianceGate } from '@/lib/compliance-gates'
import { queryOne, transaction } from '@/lib/db'

const actorId = '11111111-1111-4111-8111-111111111111'
const organizationId = '22222222-2222-4222-8222-222222222222'

function blockedGate() {
  return new Error('COMPLIANCE_GATE_NOT_APPROVED')
}

describe('contract trust B2B compliance boundaries', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it.each([
    [
      'organization creation',
      () => createOrganization(actorId, {
        name: 'Safe Realty',
        organizationType: 'broker_office',
      }),
    ],
    [
      'organization member mutation',
      () => addOrganizationMember(
        actorId,
        organizationId,
        '33333333-3333-4333-8333-333333333333',
        'member',
      ),
    ],
    [
      'organization report creation',
      () => createContractReport(actorId, {
        organizationId,
        requesterRole: 'tenant',
        title: 'Organization report',
      }),
    ],
    [
      'organization AI processing record',
      () => recordAiProcessingRun(actorId, {
        organizationId,
        purpose: 'Document extraction audit',
        provider: 'internal',
        modelName: 'review-model',
        inputHash: 'a'.repeat(64),
      }),
    ],
  ])('blocks %s before opening a write transaction', async (_label, operation) => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValueOnce(blockedGate())

    await expect(operation()).rejects.toThrow('COMPLIANCE_GATE_NOT_APPROVED')

    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('b2b_api')
    expect(transaction).not.toHaveBeenCalled()
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('keeps a personal report outside the B2B gate', async () => {
    vi.mocked(transaction).mockResolvedValueOnce({ id: 'report-1' })

    await expect(createContractReport(actorId, {
      requesterRole: 'tenant',
      title: 'Personal report',
    })).resolves.toEqual({ id: 'report-1' })

    expect(requireApprovedComplianceGate).not.toHaveBeenCalled()
    expect(transaction).toHaveBeenCalledOnce()
  })

  it('keeps a personal AI processing record outside the B2B gate', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'run-1' })

    await expect(recordAiProcessingRun(actorId, {
      purpose: 'Personal document audit',
      provider: 'internal',
      modelName: 'review-model',
      inputHash: 'b'.repeat(64),
    })).resolves.toEqual({ id: 'run-1' })

    expect(requireApprovedComplianceGate).not.toHaveBeenCalled()
    expect(queryOne).toHaveBeenCalledOnce()
  })

  it('rechecks the B2B gate and active membership before an organization AI insert', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM trust_organization_memberships')) {
          return { rows: [{ '?column?': 1 }], rowCount: 1 }
        }
        if (sql.includes('INSERT INTO ai_processing_runs')) {
          return { rows: [{ id: 'run-1' }], rowCount: 1 }
        }
        throw new Error(`Unexpected query: ${sql}`)
      }),
    }
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    await expect(recordAiProcessingRun(actorId, {
      organizationId,
      purpose: 'Document extraction audit',
      provider: 'internal',
      modelName: 'review-model',
      inputHash: 'c'.repeat(64),
    })).resolves.toEqual({ id: 'run-1' })

    expect(requireApprovedComplianceGate).toHaveBeenNthCalledWith(1, 'b2b_api')
    expect(requireApprovedComplianceGate).toHaveBeenNthCalledWith(2, 'b2b_api', client)
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FOR SHARE'),
      [organizationId, actorId],
    )
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO ai_processing_runs'),
      expect.any(Array),
    )
  })

  it('does not insert an organization AI record for a non-member', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM trust_organization_memberships')) {
          return { rows: [], rowCount: 0 }
        }
        throw new Error(`Unexpected query: ${sql}`)
      }),
    }
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    await expect(recordAiProcessingRun(actorId, {
      organizationId,
      purpose: 'Document extraction audit',
      provider: 'internal',
      modelName: 'review-model',
      inputHash: 'd'.repeat(64),
    })).rejects.toThrow('AI_RUN_ORGANIZATION_ACCESS_DENIED')

    expect(client.query).toHaveBeenCalledOnce()
    expect(String(client.query.mock.calls[0]?.[0])).not.toContain(
      'INSERT INTO ai_processing_runs',
    )
  })
})

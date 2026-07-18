import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  queryOne: vi.fn(),
}))

import {
  ComplianceGateError,
  requireApprovedComplianceGate,
} from '@/lib/compliance-gates'
import { queryOne } from '@/lib/db'

const approvedGate = {
  gate_key: 'automated_scoring',
  status: 'approved',
  approval_reference: 'LEGAL-2026-0042',
  approved_by: '11111111-1111-4111-8111-111111111111',
  approved_at: new Date('2026-07-17T00:00:00.000Z'),
}

describe('requireApprovedComplianceGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows a fully evidenced approval', async () => {
    vi.mocked(queryOne).mockResolvedValue(approvedGate)

    await expect(
      requireApprovedComplianceGate('automated_scoring'),
    ).resolves.toBeUndefined()

    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE gate_key = $1'),
      ['automated_scoring'],
    )
  })

  it('locks the gate row when checking inside a write transaction', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [approvedGate] }),
    }

    await expect(
      requireApprovedComplianceGate('automated_scoring', client as never),
    ).resolves.toBeUndefined()

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR SHARE'),
      ['automated_scoring'],
    )
    expect(queryOne).not.toHaveBeenCalled()
  })

  it.each(['pending', 'blocked'])(
    'rejects a %s gate as not approved',
    async (status) => {
      vi.mocked(queryOne).mockResolvedValue({ ...approvedGate, status })

      await expect(
        requireApprovedComplianceGate('automated_scoring'),
      ).rejects.toMatchObject({
        code: 'COMPLIANCE_GATE_NOT_APPROVED',
        gateKey: 'automated_scoring',
      })
    },
  )

  it('fails closed when the gate row is missing', async () => {
    vi.mocked(queryOne).mockResolvedValue(null)

    await expect(
      requireApprovedComplianceGate('external_data_access'),
    ).rejects.toMatchObject({
      code: 'COMPLIANCE_GATE_UNAVAILABLE',
      gateKey: 'external_data_access',
    })
  })

  it('fails closed when the database cannot verify the gate', async () => {
    vi.mocked(queryOne).mockRejectedValue(new Error('database unavailable'))

    await expect(
      requireApprovedComplianceGate('external_data_access'),
    ).rejects.toBeInstanceOf(ComplianceGateError)
    await expect(
      requireApprovedComplianceGate('external_data_access'),
    ).rejects.toMatchObject({
      code: 'COMPLIANCE_GATE_UNAVAILABLE',
    })
  })

  it.each([
    { approval_reference: null },
    { approval_reference: '   ' },
    { approved_by: null },
    { approved_at: null },
    { status: 'unexpected' },
  ])('rejects incomplete or invalid approval metadata: %o', async (override) => {
    vi.mocked(queryOne).mockResolvedValue({ ...approvedGate, ...override })

    await expect(
      requireApprovedComplianceGate('automated_scoring'),
    ).rejects.toMatchObject({
      code: 'COMPLIANCE_GATE_UNAVAILABLE',
    })
  })
})

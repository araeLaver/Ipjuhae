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
  createTrustCard,
  preflightTrustCardCreation,
  transitionContractReport,
  updateContractReportItem,
} from '@/lib/contract-trust'
import { requireApprovedComplianceGate } from '@/lib/compliance-gates'
import { transaction } from '@/lib/db'

const actorId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const reportId = '33333333-3333-4333-8333-333333333333'
const organizationId = '44444444-4444-4444-8444-444444444444'
const itemId = '55555555-5555-4555-8555-555555555555'

const itemInput = {
  verificationStatus: 'VERIFIED' as const,
  publicValue: { verified: true },
  reviewState: 'approved' as const,
}

const cardInput = {
  reportId,
  subjectType: 'tenant' as const,
  subjectId: actorId,
  title: 'Tenant identity',
  audienceRole: 'landlord' as const,
  purpose: 'Contract review',
  fieldKeys: ['identity_check'],
  expiresAt: '2026-08-01T00:00:00.000Z',
}

interface ClientOptions {
  ownerId?: string
  organization?: boolean
  status?: string
  memberRole?: string | null
  organizationStatus?: string
  pendingItems?: number
  approvedFields?: string[]
}

function createClient(options: ClientOptions = {}) {
  const report = {
    id: reportId,
    owner_id: options.ownerId ?? actorId,
    organization_id: options.organization === false ? null : organizationId,
    status: options.status ?? 'draft',
  }

  return {
    query: vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT * FROM contract_check_reports')) {
        return { rows: [report], rowCount: 1 }
      }
      if (sql.includes('FROM trust_organization_memberships')) {
        const role = options.memberRole === undefined ? 'owner' : options.memberRole
        return role
          ? { rows: [{ member_role: role }], rowCount: 1 }
          : { rows: [], rowCount: 0 }
      }
      if (sql.includes('SELECT status FROM trust_organizations')) {
        return {
          rows: [{ status: options.organizationStatus ?? 'active' }],
          rowCount: 1,
        }
      }
      if (sql.includes('COUNT(*)::int AS count')) {
        return { rows: [{ count: options.pendingItems ?? 0 }], rowCount: 1 }
      }
      if (sql.includes('SELECT DISTINCT item_key')) {
        return {
          rows: (options.approvedFields ?? ['identity_check']).map((item_key) => ({ item_key })),
          rowCount: (options.approvedFields ?? ['identity_check']).length,
        }
      }
      if (sql.trimStart().startsWith('UPDATE contract_check_items')) {
        return { rows: [{ id: itemId, report_id: reportId }], rowCount: 1 }
      }
      if (sql.includes('UPDATE contract_check_reports SET status = $2')) {
        return { rows: [{ ...report, status: 'updated' }], rowCount: 1 }
      }
      if (sql.includes("UPDATE contract_check_reports SET status = 'shared'")) {
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes('UPDATE contract_check_reports SET updated_at')) {
        return { rows: [], rowCount: 1 }
      }
      if (sql.trimStart().startsWith('UPDATE trust_cards')) {
        return { rows: [], rowCount: 1 }
      }
      if (sql.trimStart().startsWith('INSERT INTO trust_cards')) {
        return { rows: [{ id: 'card-1', report_id: reportId }], rowCount: 1 }
      }
      throw new Error(`Unexpected query: ${sql}`)
    }),
  }
}

function useClient(client: ReturnType<typeof createClient>) {
  vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))
}

function writeCalls(client: ReturnType<typeof createClient>) {
  return client.query.mock.calls.filter(([sql]) =>
    /^(INSERT|UPDATE|DELETE)\b/.test(String(sql).trimStart()),
  )
}

describe('contract report mutation authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it.each([
    ['item update', (client: ReturnType<typeof createClient>) => {
      useClient(client)
      return updateContractReportItem(actorId, reportId, itemId, itemInput)
    }],
    ['status transition', (client: ReturnType<typeof createClient>) => {
      useClient(client)
      return transitionContractReport(actorId, reportId, 'in_review')
    }],
    ['Trust Card issue', (client: ReturnType<typeof createClient>) => {
      useClient(client)
      return createTrustCard(actorId, cardInput)
    }],
  ])('keeps a personal report participant read-only for %s', async (_label, operation) => {
    const client = createClient({
      ownerId: otherUserId,
      organization: false,
      status: 'ready',
    })

    await expect(operation(client)).rejects.toThrow('CONTRACT_REPORT_NOT_FOUND')

    expect(writeCalls(client)).toHaveLength(0)
    expect(requireApprovedComplianceGate).not.toHaveBeenCalled()
  })

  it.each([
    ['item update', () => updateContractReportItem(actorId, reportId, itemId, itemInput)],
    ['status transition', () => transitionContractReport(actorId, reportId, 'in_review')],
    ['Trust Card issue', () => createTrustCard(actorId, cardInput)],
  ])('does not grant organization mutation authority to a member who created the report: %s', async (
    _label,
    operation,
  ) => {
    const client = createClient({ ownerId: actorId, memberRole: 'member', status: 'ready' })
    useClient(client)

    await expect(operation()).rejects.toThrow('CONTRACT_REPORT_MUTATION_DENIED')

    expect(writeCalls(client)).toHaveLength(0)
    expect(requireApprovedComplianceGate).not.toHaveBeenCalled()
  })

  it('allows an organization reviewer to update draft items but not transition or issue cards', async () => {
    const client = createClient({ memberRole: 'reviewer' })
    useClient(client)

    await expect(
      updateContractReportItem(actorId, reportId, itemId, itemInput),
    ).resolves.toMatchObject({ id: itemId })

    const writesAfterItemUpdate = writeCalls(client).length
    expect(writesAfterItemUpdate).toBe(2)
    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('b2b_api', client)
    const itemWrite = client.query.mock.calls.find(([sql]) =>
      String(sql).trimStart().startsWith('UPDATE contract_check_items'),
    )
    expect(itemWrite?.[1]?.[12]).toBe('pending')

    await expect(
      transitionContractReport(actorId, reportId, 'in_review'),
    ).rejects.toThrow('CONTRACT_REPORT_MUTATION_DENIED')
    await expect(createTrustCard(actorId, cardInput)).rejects.toThrow(
      'CONTRACT_REPORT_MUTATION_DENIED',
    )

    expect(writeCalls(client)).toHaveLength(writesAfterItemUpdate)
  })

  it.each([
    ['item update', () => updateContractReportItem(actorId, reportId, itemId, itemInput)],
    ['status transition', () => transitionContractReport(actorId, reportId, 'in_review')],
    ['Trust Card issue', () => createTrustCard(actorId, cardInput)],
  ])('rechecks the B2B gate inside the mutation transaction before %s writes', async (
    _label,
    operation,
  ) => {
    const client = createClient({ memberRole: 'owner', status: 'ready' })
    useClient(client)
    vi.mocked(requireApprovedComplianceGate).mockRejectedValueOnce(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
    )

    await expect(operation()).rejects.toThrow('COMPLIANCE_GATE_NOT_APPROVED')

    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('b2b_api', client)
    expect(writeCalls(client)).toHaveLength(0)
  })

  it('keeps personal report mutations outside the B2B gate', async () => {
    const itemClient = createClient({ organization: false })
    useClient(itemClient)
    await updateContractReportItem(actorId, reportId, itemId, itemInput)

    const transitionClient = createClient({ organization: false })
    useClient(transitionClient)
    await transitionContractReport(actorId, reportId, 'in_review')

    const cardClient = createClient({ organization: false, status: 'ready' })
    useClient(cardClient)
    await createTrustCard(actorId, cardInput)

    expect(requireApprovedComplianceGate).not.toHaveBeenCalled()
    expect(writeCalls(itemClient)).toHaveLength(2)
    expect(writeCalls(transitionClient)).toHaveLength(1)
    expect(writeCalls(cardClient)).toHaveLength(2)
  })

  it('locks ready or shared report items against later mutation', async () => {
    const client = createClient({ organization: false, status: 'ready' })
    useClient(client)

    await expect(
      updateContractReportItem(actorId, reportId, itemId, itemInput),
    ).rejects.toThrow('CONTRACT_REPORT_ITEM_LOCKED')

    expect(writeCalls(client)).toHaveLength(0)
  })

  it.each([
    ['ready', 'shared'],
    ['shared', 'ready'],
  ])('rejects generic %s to %s transitions so card state cannot be bypassed', async (
    current,
    next,
  ) => {
    const client = createClient({ organization: false, status: current })
    useClient(client)

    await expect(
      transitionContractReport(actorId, reportId, next),
    ).rejects.toThrow('CONTRACT_REPORT_INVALID_TRANSITION')

    expect(writeCalls(client)).toHaveLength(0)
  })

  it.each(['revoked', 'expired'])(
    'allows %s while the organization is inactive and cascades the restrictive state to issued cards',
    async (nextStatus) => {
      const client = createClient({
        memberRole: 'owner',
        organizationStatus: 'suspended',
        status: 'shared',
      })
      useClient(client)

      await expect(
        transitionContractReport(actorId, reportId, nextStatus),
      ).resolves.toMatchObject({ status: 'updated' })

      expect(requireApprovedComplianceGate).not.toHaveBeenCalled()
      expect(writeCalls(client)).toHaveLength(2)
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trust_cards'),
        [reportId, nextStatus],
      )
    },
  )

  it('issues a Trust Card and moves a ready report to shared in one transaction', async () => {
    const client = createClient({ memberRole: 'owner', status: 'ready' })
    useClient(client)

    const result = await createTrustCard(actorId, {
      ...cardInput,
      fieldKeys: ['identity_check', 'identity_check'],
    })

    expect(result.card).toMatchObject({ id: 'card-1' })
    expect(result.share_token).toEqual(expect.any(String))
    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('b2b_api', client)
    expect(writeCalls(client)).toHaveLength(2)
    const cardInsert = client.query.mock.calls.find(([sql]) =>
      String(sql).trimStart().startsWith('INSERT INTO trust_cards'),
    )
    expect(cardInsert?.[1]?.[7]).toEqual(['identity_check'])
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE contract_check_reports SET status = 'shared'"),
      [reportId],
    )
  })

  it('preflights current role, gate, status, and approved fields without writing', async () => {
    const client = createClient({ memberRole: 'admin', status: 'ready' })
    useClient(client)

    await expect(
      preflightTrustCardCreation(actorId, cardInput),
    ).resolves.toBeUndefined()

    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('b2b_api', client)
    expect(writeCalls(client)).toHaveLength(0)
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR SHARE'),
      [reportId],
    )
  })
})

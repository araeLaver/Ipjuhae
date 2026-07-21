import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/compliance-gates', () => ({
  requireApprovedComplianceGate: vi.fn(),
  isComplianceGateError: vi.fn(() => false),
}))

import {
  calculateGraphTrust,
  calculateTrustScore,
  createExtractionJob,
  generateTransactionRecommendations,
  getTrustReport,
  runTrustMaintenance,
  submitBilateralReference,
} from '@/lib/trust-engine'
import { query, queryOne, transaction } from '@/lib/db'
import {
  isComplianceGateError,
  requireApprovedComplianceGate,
} from '@/lib/compliance-gates'

describe('trust engine compliance boundaries', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(isComplianceGateError).mockReturnValue(false)
  })

  it('checks automated scoring approval before reading or writing score data', async () => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValue(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
    )

    await expect(
      calculateTrustScore(
        'tenant',
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toThrow('COMPLIANCE_GATE_NOT_APPROVED')

    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('automated_scoring')
    expect(queryOne).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('checks the same gate before reading a transaction or generating recommendations', async () => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValue(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
    )

    await expect(
      generateTransactionRecommendations(
        '22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toThrow('COMPLIANCE_GATE_NOT_APPROVED')

    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('automated_scoring')
    expect(queryOne).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('checks automated scoring approval before reading graph edges', async () => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValue(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
    )

    await expect(
      calculateGraphTrust('11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow('COMPLIANCE_GATE_NOT_APPROVED')

    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('automated_scoring')
    expect(query).not.toHaveBeenCalled()
  })

  it('checks production OCR approval before opening a non-manual extraction transaction', async () => {
    vi.mocked(requireApprovedComplianceGate).mockRejectedValue(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
    )

    await expect(createExtractionJob({
      subjectType: 'tenant',
      subjectId: '11111111-1111-4111-8111-111111111111',
      sourceCode: 'ocr_partner',
      storageRef: 'document:test',
      inputChecksum: 'a'.repeat(64),
      documentType: 'employment',
      engineVersion: 'partner-ocr-1.0',
    }, '11111111-1111-4111-8111-111111111111')).rejects.toThrow(
      'COMPLIANCE_GATE_NOT_APPROVED',
    )

    expect(requireApprovedComplianceGate).toHaveBeenCalledWith('production_ocr')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('keeps the trust report available with a null graph when scoring is deferred', async () => {
    const gateError = Object.assign(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
      { code: 'COMPLIANCE_GATE_NOT_APPROVED' },
    )
    vi.mocked(requireApprovedComplianceGate).mockRejectedValue(gateError)
    vi.mocked(isComplianceGateError).mockImplementation(
      (error) => error === gateError,
    )
    vi.mocked(query).mockResolvedValue([])

    const report = await getTrustReport(
      '11111111-1111-4111-8111-111111111111',
    )

    expect(report).toMatchObject({
      scores: [],
      facts: [],
      graph: null,
      scoringDeferred: true,
      graphDeferred: true,
      deferredCode: 'COMPLIANCE_GATE_NOT_APPROVED',
    })
  })

  it('publishes bilateral references but skips automated risk and graph writes when deferred', async () => {
    const gateError = Object.assign(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
      { code: 'COMPLIANCE_GATE_NOT_APPROVED' },
    )
    vi.mocked(requireApprovedComplianceGate).mockRejectedValue(gateError)
    vi.mocked(isComplianceGateError).mockImplementation(
      (error) => error === gateError,
    )

    const firstSubmission = {
      id: '44444444-4444-4444-8444-444444444444',
      responder_id: '11111111-1111-4111-8111-111111111111',
      subject_id: '22222222-2222-4222-8222-222222222222',
      rating: 90,
      reveal_after: new Date(Date.now() + 60_000),
      shared_identifier_hash: null,
    }
    const secondSubmission = {
      id: '55555555-5555-4555-8555-555555555555',
      responder_id: '22222222-2222-4222-8222-222222222222',
      subject_id: '11111111-1111-4111-8111-111111111111',
      rating: 88,
      reveal_after: new Date(Date.now() + 60_000),
      shared_identifier_hash: null,
    }
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM trust_tenancy_relationships')) {
          return {
            rows: [{
              id: '33333333-3333-4333-8333-333333333333',
              tenant_id: firstSubmission.responder_id,
              landlord_id: secondSubmission.responder_id,
            }],
          }
        }
        if (sql.includes('INSERT INTO trust_reference_submissions')) {
          return { rows: [firstSubmission] }
        }
        if (sql.includes('SELECT * FROM trust_reference_submissions')) {
          return { rows: [firstSubmission, secondSubmission] }
        }
        if (
          sql.includes('UPDATE trust_reference_submissions') ||
          sql.includes('INSERT INTO trust_outbox_events') ||
          sql.includes('INSERT INTO trust_audit_events') ||
          sql.startsWith('SAVEPOINT ') ||
          sql.startsWith('ROLLBACK TO SAVEPOINT ') ||
          sql.startsWith('RELEASE SAVEPOINT ')
        ) {
          return { rows: [] }
        }
        throw new Error(`Unexpected query: ${sql}`)
      }),
    }
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const result = await submitBilateralReference(
      '66666666-6666-4666-8666-666666666666',
      firstSubmission.responder_id,
      { communication: true },
      90,
      null,
      null,
    )
    const statements = client.query.mock.calls.map(([sql]) => String(sql))

    expect(result).toMatchObject({
      revealState: 'PUBLISHED',
      bothSubmitted: true,
      scoringDeferred: true,
      scoringDeferredCode: 'COMPLIANCE_GATE_NOT_APPROVED',
    })
    expect(statements.some((sql) => sql.includes("SET reveal_state = 'PUBLISHED'"))).toBe(true)
    expect(statements.some((sql) => sql.includes('INSERT INTO trust_graph_edges'))).toBe(false)
    expect(statements.some((sql) => sql.includes('INSERT INTO trust_risk_signals'))).toBe(false)
    expect(statements.some((sql) => sql.includes('INSERT INTO trust_outbox_events'))).toBe(true)
    expect(statements.some((sql) => sql.startsWith('ROLLBACK TO SAVEPOINT '))).toBe(true)
  })

  it('releases due references but skips graph activation when scoring is deferred', async () => {
    const gateError = Object.assign(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
      { code: 'COMPLIANCE_GATE_NOT_APPROVED' },
    )
    vi.mocked(requireApprovedComplianceGate).mockRejectedValue(gateError)
    vi.mocked(isComplianceGateError).mockImplementation(
      (error) => error === gateError,
    )
    vi.mocked(query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const dueReference = {
      id: '77777777-7777-4777-8777-777777777777',
      relationship_id: '33333333-3333-4333-8333-333333333333',
      responder_id: '11111111-1111-4111-8111-111111111111',
      subject_id: '22222222-2222-4222-8222-222222222222',
      rating: 90,
    }
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('UPDATE trust_reference_submissions')) {
          return { rows: [dueReference], rowCount: 1 }
        }
        if (sql.includes('LEFT JOIN trust_graph_edges')) {
          if (sql.includes('pending_count')) {
            return { rows: [{ pending_count: 1 }] }
          }
          return { rows: [dueReference] }
        }
        if (sql.includes("stage = 'S7'")) {
          return { rows: [] }
        }
        if (
          sql.includes('INSERT INTO trust_outbox_events') ||
          sql.startsWith('SAVEPOINT ') ||
          sql.startsWith('ROLLBACK TO SAVEPOINT ') ||
          sql.startsWith('RELEASE SAVEPOINT ')
        ) {
          return { rows: [] }
        }
        throw new Error(`Unexpected query: ${sql}`)
      }),
    }
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const result = await runTrustMaintenance()
    const statements = client.query.mock.calls.map(([sql]) => String(sql))

    expect(result).toMatchObject({
      releasedReferences: 1,
      referenceScoringPending: 1,
      referenceScoringDeferred: true,
      referenceScoringDeferredCode: 'COMPLIANCE_GATE_NOT_APPROVED',
    })
    expect(statements.some((sql) => sql.includes("SET reveal_state = 'PUBLISHED'"))).toBe(true)
    expect(statements.some((sql) => sql.includes('INSERT INTO trust_graph_edges'))).toBe(false)
    expect(statements.some((sql) => sql.includes('INSERT INTO trust_outbox_events'))).toBe(true)
    expect(statements.some((sql) => sql.startsWith('ROLLBACK TO SAVEPOINT '))).toBe(true)
  })

  it('backfills published references after automated scoring is approved', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const deferredReference = {
      id: '88888888-8888-4888-8888-888888888888',
      relationship_id: '33333333-3333-4333-8333-333333333333',
      responder_id: '11111111-1111-4111-8111-111111111111',
      subject_id: '22222222-2222-4222-8222-222222222222',
      rating: 90,
      shared_identifier_hash: null,
    }
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('UPDATE trust_reference_submissions')) {
          return { rows: [deferredReference], rowCount: 1 }
        }
        if (sql.includes('LEFT JOIN trust_graph_edges')) {
          if (sql.includes('pending_count')) {
            return { rows: [{ pending_count: 0 }] }
          }
          return { rows: [deferredReference] }
        }
        if (sql.includes("stage = 'S7'")) {
          return { rows: [] }
        }
        if (sql.includes('FROM trust_reference_submissions') && sql.includes('reveal_state')) {
          return { rows: [deferredReference] }
        }
        if (
          sql.includes('COUNT(*)::int AS count FROM trust_reference_submissions') ||
          sql.includes('COUNT(*)::int AS count FROM trust_graph_edges')
        ) {
          return { rows: [{ count: 0 }] }
        }
        if (sql.includes('INSERT INTO trust_graph_edges')) {
          return { rows: [{ id: '99999999-9999-4999-8999-999999999999' }] }
        }
        if (
          sql.includes('INSERT INTO trust_outbox_events') ||
          sql.startsWith('SAVEPOINT ') ||
          sql.startsWith('RELEASE SAVEPOINT ')
        ) {
          return { rows: [] }
        }
        throw new Error(`Unexpected query: ${sql}`)
      }),
    }
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const result = await runTrustMaintenance()
    const statements = client.query.mock.calls.map(([sql]) => String(sql))

    expect(result).toMatchObject({
      releasedReferences: 1,
      referenceEdgesBackfilled: 1,
      referenceScoringPending: 0,
      referenceScoringDeferred: false,
    })
    expect(requireApprovedComplianceGate).toHaveBeenCalledWith(
      'automated_scoring',
      client,
    )
    expect(statements.filter((sql) => sql.includes('INSERT INTO trust_graph_edges'))).toHaveLength(1)
  })

  it('auto-settles overdue S7 transactions with no dispute and grants fallback second assessment', async () => {
    vi.mocked(query).mockResolvedValue([])

    const dueTransaction = {
      id: '99999999-9999-4999-8999-999999999999',
      stage: 'S7',
      status: 'active',
      landlord_id: '11111111-1111-4111-8111-111111111111',
      tenant_id: '22222222-2222-4222-8222-222222222222',
      realtor_id: null,
      property_id: '33333333-3333-4333-8333-333333333333',
      evaluation_flags: {},
      dispute_meta: {
        disputed: false,
        deposit_return_due_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
    }

    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('UPDATE trust_evidence_nodes')) {
          return { rows: [] }
        }
        if (sql.includes('UPDATE trust_disclosure_packages') && sql.includes("state = 'EXPIRED'")) {
          return { rows: [] }
        }
        if (sql.includes('UPDATE trust_reference_submissions')) {
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('LEFT JOIN trust_graph_edges')) {
          if (sql.includes('pending_count')) {
            return { rows: [{ pending_count: 0 }] }
          }
          return { rows: [] }
        }
        if (sql.includes('SELECT * FROM trust_reference_submissions') && sql.includes('reveal_state')) {
          return { rows: [] }
        }
        if (sql.includes('SELECT * FROM trust_transaction_contexts')) {
          return { rows: [dueTransaction] }
        }
        if (sql.includes('UPDATE trust_transaction_contexts') && sql.includes("SET stage = 'S8'")) {
          return { rows: [{ id: dueTransaction.id }] }
        }
        if (
          sql.includes('UPDATE trust_derived_nodes') ||
          sql.includes('INSERT INTO trust_outbox_events') ||
          sql.includes('INSERT INTO trust_retention_actions')
        ) {
          return { rows: [] }
        }
        throw new Error(`Unexpected query: ${sql}`)
      }),
    }
    vi.mocked(transaction).mockImplementation(async (handler) => handler(client as never))

    const result = await runTrustMaintenance()

    expect(result).toMatchObject({
      autoSettledTransactions: 1,
      releasedReferences: 0,
      referenceScoringPending: 0,
      expiredEvidence: 0,
      expiredDisclosures: 0,
    })
    const statements = client.query.mock.calls.map(([sql]) => String(sql))
    expect(statements.some((sql) => sql.includes("stage = 'S7'"))).toBe(true)
    expect(statements.some((sql) => sql.includes("SET stage = 'S8'"))).toBe(true)
    const calls = client.query.mock.calls as unknown as Array<[string, unknown[]]>
    const hasAutoSettledEvent = calls
      .filter((call) => call[0]?.includes('INSERT INTO trust_outbox_events'))
      .some((call) => Array.isArray(call[1]) && call[1][2] === 'TransactionAutoSettled')
    expect(hasAutoSettledEvent).toBe(true)
  })
})

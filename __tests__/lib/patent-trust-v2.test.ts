import { describe, it, expect } from 'vitest'
import {
  REPRESENTATION_BIT,
  buildContractPinSnapshot,
  buildDerivedReproductionHash,
  buildWorkDedupKey,
  canApplyExpectedVersionUpdate,
  canExecuteSelectiveRecomputation,
  classifyDerivedNodeOnInvalidation,
  encryptDisclosurePayload,
  rekeyReducedDisclosurePackage,
  selectMinimumDisclosureCombination,
  signDisclosureAccessToken,
  topologicalSortDerivedNodes,
  traverseImpactSubgraph,
  verifyAndOpenDisclosurePackage,
  verifyAtomicContractSign,
  type StoredDisclosureRecord,
} from '@/lib/patent-trust-v2'

const MASTER_KEY = 'patent-v2-master-secret-key-for-unit-tests-only-32b'
const SIGNING_KEY = 'patent-v2-signing-secret-key-for-unit-tests-only-32b'

describe('Patent V2 Core Engine (PD-261178TP1 Claims 1–8)', () => {
  it('Claim 1(c) & 3: selects minimum-cost representation set within bitmask & consent with deterministic tie-breaking', () => {
    const selection = selectMinimumDisclosureCombination({
      requiredPredicates: ['income_ok', 'employment_ok'],
      allowedBitmask: REPRESENTATION_BIT.BOOLEAN | REPRESENTATION_BIT.RANGE,
      consentedFactKeys: new Set(['income', 'employment']),
      candidates: [
        { id: 'c-inc-raw', factKey: 'income', representation: 'raw', cost: 1, satisfiesPredicates: ['income_ok'], value: 78000000 },
        { id: 'c-inc-range', factKey: 'income', representation: 'range', cost: 3, satisfiesPredicates: ['income_ok'], value: '70M-80M' },
        { id: 'c-inc-bool-b', factKey: 'income', representation: 'boolean', cost: 1, satisfiesPredicates: ['income_ok'], value: true },
        { id: 'c-inc-bool-a', factKey: 'income', representation: 'boolean', cost: 1, satisfiesPredicates: ['income_ok'], value: true },
        { id: 'c-emp-bool', factKey: 'employment', representation: 'boolean', cost: 1, satisfiesPredicates: ['employment_ok'], value: true },
      ],
    })

    expect(selection).not.toBeNull()
    // RAW is excluded by bitmask even though cost=1; equal-cost boolean ties break to c-inc-bool-a
    expect(selection!.totalCost).toBe(2)
    expect(selection!.selected.map((c) => c.id)).toEqual(['c-emp-bool', 'c-inc-bool-a'])
  })

  it('Claim 1(c) & 2: encrypts payload with per-package AES-256-GCM key, validates epoch-bound token, denies revoked/stale tokens, and re-keys REDUCED packages', () => {
    const encrypted = encryptDisclosurePayload({ employment_verified: true, income_band: '3x+' }, MASTER_KEY)
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString()
    const record: StoredDisclosureRecord = {
      id: 'pkg-1',
      recipientId: 'landlord-1',
      transactionId: 'tx-1',
      purpose: 'pre_contract_review',
      state: 'ISSUED',
      expiresAt,
      accessEpoch: 1,
      encrypted,
    }

    const tokenV1 = signDisclosureAccessToken(
      {
        packageId: record.id,
        recipientId: record.recipientId,
        transactionId: record.transactionId,
        purpose: record.purpose,
        expiresAt,
        accessEpoch: 1,
      },
      SIGNING_KEY
    )

    // Active token succeeds and decrypts exact payload
    const ok = verifyAndOpenDisclosurePackage({
      record,
      accessToken: tokenV1,
      signingKey: SIGNING_KEY,
      masterSecret: MASTER_KEY,
    })
    expect(ok).toEqual({ allowed: true, payload: { employment_verified: true, income_band: '3x+' } })

    // Instant revocation blocks subsequent reads immediately
    const revokedRes = verifyAndOpenDisclosurePackage({
      record: { ...record, state: 'REVOKED', accessEpoch: 2, encrypted: { ...encrypted, contentKeyStatus: 'DESTROYED' } },
      accessToken: tokenV1,
      signingKey: SIGNING_KEY,
      masterSecret: MASTER_KEY,
    })
    expect(revokedRes).toEqual({ allowed: false, reason: 'REVOKED' })

    // REDUCED re-keying bumps access_epoch, rotates content key, invalidates v1 token, and allows v2 token
    const rekeyed = rekeyReducedDisclosurePackage({
      previous: record,
      narrowedPayload: { employment_verified: true },
      masterSecret: MASTER_KEY,
      signingKey: SIGNING_KEY,
    })
    expect(rekeyed.destroyedPreviousKeyStatus).toBe('DESTROYED')
    expect(rekeyed.updatedRecord.accessEpoch).toBe(2)

    const staleTokenCheck = verifyAndOpenDisclosurePackage({
      record: rekeyed.updatedRecord,
      accessToken: tokenV1,
      signingKey: SIGNING_KEY,
      masterSecret: MASTER_KEY,
    })
    expect(staleTokenCheck).toEqual({ allowed: false, reason: 'EPOCH_MISMATCH' })

    const newTokenCheck = verifyAndOpenDisclosurePackage({
      record: rekeyed.updatedRecord,
      accessToken: rekeyed.newAccessToken,
      signingKey: SIGNING_KEY,
      masterSecret: MASTER_KEY,
    })
    expect(newTokenCheck).toEqual({ allowed: true, payload: { employment_verified: true } })
  })

  it('Claim 1(d) & 1(i): pins contract conditions + epoch vector and atomically reverts S3 → S2 if any evidence epoch drifts', () => {
    const pinned = buildContractPinSnapshot(
      { depositManwon: 30000, monthlyRentManwon: 0, moveInDate: '2026-12-15' },
      [
        { nodeId: 'fact-b', nodeVersion: 2, invalidationEpoch: 0 },
        { nodeId: 'fact-a', nodeVersion: 1, invalidationEpoch: 3 },
      ]
    )

    // Deterministic sorting by nodeId
    expect(pinned.evidenceVersionVector.map((v) => v.nodeId)).toEqual(['fact-a', 'fact-b'])
    expect(pinned.epochVector).toEqual([3, 0])

    // Matching hashes + live epochs allow transition to S4
    const allow = verifyAtomicContractSign({
      pinned,
      signRequest: { conditionHash: pinned.conditionHash, evidenceSetHash: pinned.evidenceSetHash },
      liveEpochsByNodeId: { 'fact-a': 3, 'fact-b': 0 },
    })
    expect(allow).toEqual({ allowed: true, nextStage: 'S4' })

    // Single fact invalidation_epoch bump blocks S4 and reverts to S2 (negotiation)
    const drifted = verifyAtomicContractSign({
      pinned,
      signRequest: { conditionHash: pinned.conditionHash, evidenceSetHash: pinned.evidenceSetHash },
      liveEpochsByNodeId: { 'fact-a': 4, 'fact-b': 0 },
    })
    expect(drifted).toEqual({
      allowed: false,
      revertToStage: 'S2',
      reason: 'EVIDENCE_EPOCH_DRIFT',
      driftedNodeIds: ['fact-a'],
    })
  })

  it('Claim 1(e)-(h), 4 & 5: traverses diamond DAG with visited set, gates recomputation behind revocation barrier, topologically sorts derived nodes, and guards versioned work', () => {
    const edges = [
      { fromKey: 'fact:1:v1', toKey: 'derived:score:v1', dependencyType: 'required' as const },
      { fromKey: 'fact:1:v1', toKey: 'derived:disc:v1', dependencyType: 'disclosure_control' as const },
      { fromKey: 'derived:score:v1', toKey: 'derived:reco:v1', dependencyType: 'required' as const },
      { fromKey: 'derived:score:v1', toKey: 'derived:disc:v1', dependencyType: 'required' as const },
    ]

    const { impactedKeys, impactedEdges } = traverseImpactSubgraph('fact:1:v1', edges)
    expect(impactedKeys).toHaveLength(3)
    expect(new Set(impactedKeys)).toEqual(new Set(['derived:score:v1', 'derived:disc:v1', 'derived:reco:v1']))

    // Claim 1(f) conditional node status
    expect(
      classifyDerivedNodeOnInvalidation(
        [{ inputKey: 'fact:1:v1', dependencyType: 'required', isValid: false }],
        true
      )
    ).toBe('SUSPENDED')
    expect(
      classifyDerivedNodeOnInvalidation(
        [
          { inputKey: 'fact:1:v1', dependencyType: 'required', isValid: true },
          { inputKey: 'fact:2:v1', dependencyType: 'optional', isValid: false },
        ],
        true
      )
    ).toBe('RECHECK_REQUIRED')

    // Claim 1(g)-(h) revocation barrier strictly blocks recomputation until completed
    expect(canExecuteSelectiveRecomputation({ expectedCount: 2, revokedCount: 1, status: 'PENDING' })).toBe(false)
    expect(canExecuteSelectiveRecomputation({ expectedCount: 2, revokedCount: 2, status: 'COMPLETED' })).toBe(true)

    // Claim 1(h) topological order puts score before reco & disc
    const order = topologicalSortDerivedNodes(impactedKeys, impactedEdges)
    expect(order[0]).toBe('derived:score:v1')
    expect(order.slice(1).sort()).toEqual(['derived:disc:v1', 'derived:reco:v1'])

    const reproHash = buildDerivedReproductionHash({
      evidenceVersionVector: [{ nodeId: 'fact-1', nodeVersion: 2 }],
      policyVersion: 'policy-v2',
      modelVersion: 'model-v2',
      codeVersion: 'sha-abc123',
    })
    expect(reproHash).toHaveLength(64)

    // Claim 5 dedup key + expected version guard
    expect(
      buildWorkDedupKey({
        eventId: 'evt-9',
        targetNodeId: 'derived-1',
        expectedNodeVersion: 2,
        workType: 'revoke',
      })
    ).toBe('revoke:evt-9:derived-1:v2')
    expect(canApplyExpectedVersionUpdate(2, 2)).toBe(true)
    expect(canApplyExpectedVersionUpdate(3, 2)).toBe(false)
  })
})

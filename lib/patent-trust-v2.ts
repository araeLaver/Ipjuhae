/**
 * Patent V2 Core Engine (PD-261178TP1 Claims 1–8)
 *
 * Implements the deterministic, cryptographically verifiable primitives for:
 * - Claim 1(c) & Claim 3: Minimum-cost representation selection with bitmask filtering & deterministic tie-breaking
 * - Claim 1(c) & Claim 2: Per-package AES-256-GCM content key encryption, access-epoch-bound HMAC tokens, and REDUCED re-keying
 * - Claim 1(d) & Claim 1(i): Contract-pending condition hash, canonical evidence version vector, and atomic signature precondition check
 * - Claim 1(e), 1(f), 1(g), 1(h) & Claim 4: Visited-set reverse-adjacency impact BFS, conditional suspension, revocation barrier gating, and Kahn topological sort
 * - Claim 5: Idempotent work deduplication key and expected-version optimistic update guard
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

// ─── Canonical Hashing ───────────────────────────────────────────────────────

export function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalizeValue(item)])
    )
  }
  return value
}

export function canonicalSha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalizeValue(value)))
    .digest('hex')
}

// ─── Claim 1(c) & Claim 3: Minimum-Cost Representation Selector ──────────────

export const REPRESENTATION_BIT = {
  RAW: 1 << 0,     // 1: 원래값
  RANGE: 1 << 1,   // 2: 구간값
  BOOLEAN: 1 << 2, // 4: 기준충족 참/거짓값
} as const

export type DisclosureRepresentation = 'raw' | 'range' | 'boolean'

export function representationToBit(rep: DisclosureRepresentation): number {
  if (rep === 'raw') return REPRESENTATION_BIT.RAW
  if (rep === 'range') return REPRESENTATION_BIT.RANGE
  return REPRESENTATION_BIT.BOOLEAN
}

export interface RepresentationCandidate {
  id: string
  factKey: string
  representation: DisclosureRepresentation
  /** Lower cost = less privacy exposure (e.g., boolean=1, range=3, raw=10) */
  cost: number
  /** Predicate IDs satisfied when this candidate is included */
  satisfiesPredicates: string[]
  /** Transformed minimal claim value */
  value: unknown
}

export interface MinimumDisclosureSelection {
  selected: RepresentationCandidate[]
  totalCost: number
  satisfiedPredicates: string[]
}

/**
 * Selects a subset of representation candidates permitted by `allowedBitmask` and
 * `consentedFactKeys` that satisfies ALL `requiredPredicates` with the lowest
 * sum of disclosure cost. Equal-cost ties are broken deterministically by
 * lexicographical ordering of sorted candidate IDs (Claim 3).
 */
export function selectMinimumDisclosureCombination(params: {
  candidates: RepresentationCandidate[]
  requiredPredicates: string[]
  allowedBitmask: number
  consentedFactKeys?: ReadonlySet<string>
}): MinimumDisclosureSelection | null {
  const { candidates, requiredPredicates, allowedBitmask, consentedFactKeys } = params
  const required = [...new Set(requiredPredicates)].sort()

  const permitted = candidates
    .filter((candidate) => {
      const bitAllowed = (allowedBitmask & representationToBit(candidate.representation)) !== 0
      const consentAllowed = !consentedFactKeys || consentedFactKeys.has(candidate.factKey)
      return bitAllowed && consentAllowed && candidate.cost >= 0
    })
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))

  if (required.length === 0) {
    return { selected: [], totalCost: 0, satisfiedPredicates: [] }
  }

  // Group permitted candidates by factKey so at most one representation per fact is picked.
  const byFact = new Map<string, RepresentationCandidate[]>()
  for (const c of permitted) {
    const list = byFact.get(c.factKey) ?? []
    list.push(c)
    byFact.set(c.factKey, list)
  }

  const factGroups = [...byFact.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, list]) => list)

  const requiredSet = new Set(required)
  let best: { items: RepresentationCandidate[]; cost: number; key: string } | null = null

  function search(
    groupIdx: number,
    chosen: RepresentationCandidate[],
    currentCost: number,
    covered: Set<string>
  ) {
    // Prune branches that cannot beat current best cost
    if (best && currentCost > best.cost) return

    if (covered.size === requiredSet.size) {
      const sortedItems = [...chosen].sort((a, b) => a.id.localeCompare(b.id))
      const tieKey = sortedItems.map((c) => c.id).join('|')
      if (
        !best ||
        currentCost < best.cost ||
        (currentCost === best.cost && tieKey.localeCompare(best.key) < 0)
      ) {
        best = { items: sortedItems, cost: currentCost, key: tieKey }
      }
      return
    }

    if (groupIdx >= factGroups.length) return

    const group = factGroups[groupIdx]
    // Option A: pick one representation from this fact group (if it helps cover something)
    for (const candidate of group) {
      const newlyCovered = candidate.satisfiesPredicates.filter(
        (p) => requiredSet.has(p) && !covered.has(p)
      )
      if (newlyCovered.length === 0) continue

      for (const p of newlyCovered) covered.add(p)
      chosen.push(candidate)
      search(groupIdx + 1, chosen, currentCost + candidate.cost, covered)
      chosen.pop()
      for (const p of newlyCovered) covered.delete(p)
    }

    // Option B: skip this fact group
    search(groupIdx + 1, chosen, currentCost, covered)
  }

  search(0, [], 0, new Set<string>())

  if (!best) return null
  const winner = best as { items: RepresentationCandidate[]; cost: number; key: string }
  return {
    selected: winner.items,
    totalCost: winner.cost,
    satisfiedPredicates: required,
  }
}

// ─── Claim 1(c) & Claim 2: Content-Key Encryption & Epoch-Bound Access Token ─

export interface EncryptedDisclosurePayload {
  encryptedPayload: string
  iv: string
  authTag: string
  wrappedContentKey: string
  contentKeyStatus: 'ACTIVE' | 'DESTROYED' | 'ROTATED'
}

export interface AccessTokenClaims {
  packageId: string
  recipientId: string
  transactionId: string
  purpose: string
  expiresAt: string
  accessEpoch: number
}

function deriveMasterAesKey(masterSecret: string): Buffer {
  if (!masterSecret || masterSecret.length < 16) {
    throw new Error('DISCLOSURE_MASTER_KEY_TOO_SHORT')
  }
  return createHash('sha256').update(masterSecret).digest()
}

export function encryptDisclosurePayload(
  payload: Record<string, unknown>,
  masterSecret: string
): EncryptedDisclosurePayload {
  const masterKey = deriveMasterAesKey(masterSecret)
  const contentKey = randomBytes(32)

  // Encrypt payload with fresh per-package AES-256-GCM content key
  const payloadIv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', contentKey, payloadIv)
  const plaintext = Buffer.from(JSON.stringify(canonicalizeValue(payload)), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Wrap per-package content key with master AES-256-GCM key
  const wrapIv = randomBytes(12)
  const wrapCipher = createCipheriv('aes-256-gcm', masterKey, wrapIv)
  const wrappedBytes = Buffer.concat([wrapCipher.update(contentKey), wrapCipher.final()])
  const wrapTag = wrapCipher.getAuthTag()
  const wrappedContentKey = `${wrapIv.toString('base64url')}.${wrapTag.toString('base64url')}.${wrappedBytes.toString('base64url')}`

  return {
    encryptedPayload: ciphertext.toString('base64url'),
    iv: payloadIv.toString('base64url'),
    authTag: authTag.toString('base64url'),
    wrappedContentKey,
    contentKeyStatus: 'ACTIVE',
  }
}

export function decryptDisclosurePayload(
  encrypted: EncryptedDisclosurePayload,
  masterSecret: string
): Record<string, unknown> {
  if (encrypted.contentKeyStatus !== 'ACTIVE') {
    throw new Error('DISCLOSURE_CONTENT_KEY_UNAVAILABLE')
  }
  const masterKey = deriveMasterAesKey(masterSecret)
  const [wrapIvB64, wrapTagB64, wrappedB64] = encrypted.wrappedContentKey.split('.')
  if (!wrapIvB64 || !wrapTagB64 || !wrappedB64) {
    throw new Error('DISCLOSURE_WRAPPED_KEY_INVALID')
  }

  const unwrapDecipher = createDecipheriv(
    'aes-256-gcm',
    masterKey,
    Buffer.from(wrapIvB64, 'base64url')
  )
  unwrapDecipher.setAuthTag(Buffer.from(wrapTagB64, 'base64url'))
  const contentKey = Buffer.concat([
    unwrapDecipher.update(Buffer.from(wrappedB64, 'base64url')),
    unwrapDecipher.final(),
  ])

  const payloadDecipher = createDecipheriv(
    'aes-256-gcm',
    contentKey,
    Buffer.from(encrypted.iv, 'base64url')
  )
  payloadDecipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64url'))
  const plaintext = Buffer.concat([
    payloadDecipher.update(Buffer.from(encrypted.encryptedPayload, 'base64url')),
    payloadDecipher.final(),
  ])

  return JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>
}

export function signDisclosureAccessToken(claims: AccessTokenClaims, signingKey: string): string {
  const encodedClaims = Buffer.from(JSON.stringify(canonicalizeValue(claims)), 'utf8').toString('base64url')
  const sig = createHmac('sha256', signingKey).update(encodedClaims).digest('base64url')
  return `${encodedClaims}.${sig}`
}

export function verifyDisclosureAccessToken(
  token: string,
  signingKey: string
): AccessTokenClaims | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encodedClaims, providedSig] = parts
  const expectedSig = createHmac('sha256', signingKey).update(encodedClaims).digest('base64url')
  const a = Buffer.from(providedSig, 'utf8')
  const b = Buffer.from(expectedSig, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'))
    if (
      typeof parsed?.packageId !== 'string' ||
      typeof parsed?.recipientId !== 'string' ||
      typeof parsed?.transactionId !== 'string' ||
      typeof parsed?.purpose !== 'string' ||
      typeof parsed?.expiresAt !== 'string' ||
      typeof parsed?.accessEpoch !== 'number'
    ) {
      return null
    }
    return parsed as AccessTokenClaims
  } catch {
    return null
  }
}

export interface StoredDisclosureRecord {
  id: string
  recipientId: string
  transactionId: string
  purpose: string
  state: 'ISSUED' | 'REDUCED' | 'REVOKED' | 'EXPIRED' | string
  expiresAt: string
  accessEpoch: number
  encrypted: EncryptedDisclosurePayload
}

export type DisclosureAccessResult =
  | { allowed: true; payload: Record<string, unknown> }
  | {
      allowed: false
      reason:
        | 'INVALID_TOKEN'
        | 'REVOKED'
        | 'REDUCED_REISSUE_REQUIRED'
        | 'EXPIRED'
        | 'EPOCH_MISMATCH'
        | 'KEY_UNAVAILABLE'
        | 'RECIPIENT_MISMATCH'
        | 'TRANSACTION_MISMATCH'
        | 'PURPOSE_MISMATCH'
    }

/**
 * Claim 2 server-side per-access check: verifies signature, recipient, transaction,
 * purpose, expiry, state, content-key status, and access_epoch before decrypting.
 */
export function verifyAndOpenDisclosurePackage(params: {
  record: StoredDisclosureRecord
  accessToken: string
  signingKey: string
  masterSecret: string
  now?: Date
}): DisclosureAccessResult {
  const { record, accessToken, signingKey, masterSecret, now = new Date() } = params
  const claims = verifyDisclosureAccessToken(accessToken, signingKey)
  if (!claims || claims.packageId !== record.id) {
    return { allowed: false, reason: 'INVALID_TOKEN' }
  }
  if (record.state === 'REVOKED') return { allowed: false, reason: 'REVOKED' }
  if (record.state === 'REDUCED') return { allowed: false, reason: 'REDUCED_REISSUE_REQUIRED' }
  if (record.state !== 'ISSUED') return { allowed: false, reason: 'REVOKED' }
  if (claims.accessEpoch !== record.accessEpoch) return { allowed: false, reason: 'EPOCH_MISMATCH' }
  if (claims.recipientId !== record.recipientId) return { allowed: false, reason: 'RECIPIENT_MISMATCH' }
  if (claims.transactionId !== record.transactionId) return { allowed: false, reason: 'TRANSACTION_MISMATCH' }
  if (claims.purpose !== record.purpose) return { allowed: false, reason: 'PURPOSE_MISMATCH' }

  const recordExp = new Date(record.expiresAt).getTime()
  const tokenExp = new Date(claims.expiresAt).getTime()
  if (Number.isNaN(recordExp) || Number.isNaN(tokenExp) || recordExp <= now.getTime() || tokenExp <= now.getTime()) {
    return { allowed: false, reason: 'EXPIRED' }
  }
  if (record.encrypted.contentKeyStatus !== 'ACTIVE') {
    return { allowed: false, reason: 'KEY_UNAVAILABLE' }
  }

  const payload = decryptDisclosurePayload(record.encrypted, masterSecret)
  return { allowed: true, payload }
}

/**
 * Claim 2 REDUCED re-keying: discards the prior content key, bumps access_epoch,
 * encrypts the narrowed minimum-sufficient fact set with a fresh content key,
 * and issues a fresh access token bound to the bumped access_epoch.
 */
export function rekeyReducedDisclosurePackage(params: {
  previous: StoredDisclosureRecord
  narrowedPayload: Record<string, unknown>
  masterSecret: string
  signingKey: string
}): {
  updatedRecord: StoredDisclosureRecord
  newAccessToken: string
  destroyedPreviousKeyStatus: 'DESTROYED'
} {
  const { previous, narrowedPayload, masterSecret, signingKey } = params
  const nextEpoch = previous.accessEpoch + 1
  const freshEncrypted = encryptDisclosurePayload(narrowedPayload, masterSecret)
  const updatedRecord: StoredDisclosureRecord = {
    ...previous,
    state: 'ISSUED',
    accessEpoch: nextEpoch,
    encrypted: freshEncrypted,
  }
  const newAccessToken = signDisclosureAccessToken(
    {
      packageId: updatedRecord.id,
      recipientId: updatedRecord.recipientId,
      transactionId: updatedRecord.transactionId,
      purpose: updatedRecord.purpose,
      expiresAt: updatedRecord.expiresAt,
      accessEpoch: nextEpoch,
    },
    signingKey
  )
  return {
    updatedRecord,
    newAccessToken,
    destroyedPreviousKeyStatus: 'DESTROYED',
  }
}

// ─── Claim 1(d) & 1(i): Contract Pinning & Atomic Signature Precondition ─────

export interface PinnedInputNode {
  nodeId: string
  nodeVersion: number
  invalidationEpoch: number
}

export interface ContractPinSnapshot {
  conditionHash: string
  evidenceVersionVector: Array<{ nodeId: string; nodeVersion: number }>
  evidenceSetHash: string
  epochVector: number[]
}

export function buildContractPinSnapshot(
  agreedConditions: Record<string, unknown>,
  inputNodes: PinnedInputNode[]
): ContractPinSnapshot {
  const sorted = [...inputNodes].sort(
    (a, b) => a.nodeId.localeCompare(b.nodeId) || a.nodeVersion - b.nodeVersion
  )
  const evidenceVersionVector = sorted.map((n) => ({
    nodeId: n.nodeId,
    nodeVersion: n.nodeVersion,
  }))
  const epochVector = sorted.map((n) => n.invalidationEpoch)
  return {
    conditionHash: canonicalSha256(agreedConditions),
    evidenceVersionVector,
    evidenceSetHash: canonicalSha256(evidenceVersionVector),
    epochVector,
  }
}

export type AtomicSignCheckResult =
  | { allowed: true; nextStage: 'S4' }
  | {
      allowed: false
      revertToStage: 'S2'
      reason: 'CONDITION_HASH_MISMATCH' | 'EVIDENCE_SET_HASH_MISMATCH' | 'EVIDENCE_EPOCH_DRIFT'
      driftedNodeIds: string[]
    }

/**
 * Claim 1(i) atomic comparison at e-signature transition:
 * Verifies conditionHash, evidenceSetHash, AND every pinned invalidation_epoch
 * against live node epochs. Any mismatch blocks S4 completion and reverts S3 → S2.
 */
export function verifyAtomicContractSign(params: {
  pinned: ContractPinSnapshot
  signRequest: { conditionHash: string; evidenceSetHash: string }
  liveEpochsByNodeId: Record<string, number>
}): AtomicSignCheckResult {
  const { pinned, signRequest, liveEpochsByNodeId } = params

  if (signRequest.conditionHash !== pinned.conditionHash) {
    return {
      allowed: false,
      revertToStage: 'S2',
      reason: 'CONDITION_HASH_MISMATCH',
      driftedNodeIds: [],
    }
  }

  if (signRequest.evidenceSetHash !== pinned.evidenceSetHash) {
    return {
      allowed: false,
      revertToStage: 'S2',
      reason: 'EVIDENCE_SET_HASH_MISMATCH',
      driftedNodeIds: [],
    }
  }

  const driftedNodeIds: string[] = []
  for (let i = 0; i < pinned.evidenceVersionVector.length; i++) {
    const { nodeId } = pinned.evidenceVersionVector[i]
    const pinnedEpoch = pinned.epochVector[i]
    const liveEpoch = liveEpochsByNodeId[nodeId]
    if (typeof liveEpoch !== 'number' || liveEpoch !== pinnedEpoch) {
      driftedNodeIds.push(nodeId)
    }
  }

  if (driftedNodeIds.length > 0) {
    return {
      allowed: false,
      revertToStage: 'S2',
      reason: 'EVIDENCE_EPOCH_DRIFT',
      driftedNodeIds,
    }
  }

  return { allowed: true, nextStage: 'S4' }
}

// ─── Claim 1(e)-(h), 4 & 5: Impact Subgraph, Suspension, Barrier & TopoSort ──

export interface VersionedDependencyEdge {
  fromKey: string // e.g. "fact:<uuid>:v1"
  toKey: string   // e.g. "derived:<uuid>:v1"
  dependencyType: 'required' | 'optional' | 'explanation' | 'disclosure_control'
}

/**
 * Claim 1(e) & Claim 4: Range-indexed reverse-adjacency BFS with visited set
 * (never re-expands an already visited node).
 */
export function traverseImpactSubgraph(
  startKey: string,
  edges: VersionedDependencyEdge[]
): { impactedKeys: string[]; impactedEdges: VersionedDependencyEdge[] } {
  const reverseAdj = new Map<string, VersionedDependencyEdge[]>()
  for (const edge of edges) {
    const list = reverseAdj.get(edge.fromKey) ?? []
    list.push(edge)
    reverseAdj.set(edge.fromKey, list)
  }

  const visited = new Set<string>([startKey])
  const queue: string[] = [startKey]
  const impactedKeys: string[] = []
  const impactedEdges: VersionedDependencyEdge[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    const outgoing = reverseAdj.get(current) ?? []
    for (const edge of outgoing) {
      impactedEdges.push(edge)
      if (!visited.has(edge.toKey)) {
        visited.add(edge.toKey)
        impactedKeys.push(edge.toKey)
        queue.push(edge.toKey)
      }
    }
  }

  return { impactedKeys, impactedEdges }
}

export interface DerivedNodeInputStatus {
  inputKey: string
  dependencyType: 'required' | 'optional' | 'explanation' | 'disclosure_control'
  isValid: boolean
  hasValidReplacement?: boolean
}

/**
 * Claim 1(f): Required invalidated input without replacement -> SUSPENDED;
 * optional-only invalidated input with fallback output function -> RECHECK_REQUIRED.
 */
export function classifyDerivedNodeOnInvalidation(
  inputs: DerivedNodeInputStatus[],
  hasFallbackOutput: boolean
): 'SUSPENDED' | 'RECHECK_REQUIRED' | 'UNCHANGED' {
  const missingRequired = inputs.some(
    (input) =>
      (input.dependencyType === 'required' || input.dependencyType === 'disclosure_control') &&
      !input.isValid &&
      !input.hasValidReplacement
  )
  if (missingRequired) return 'SUSPENDED'

  const missingOptional = inputs.some(
    (input) =>
      (input.dependencyType === 'optional' || input.dependencyType === 'explanation') &&
      !input.isValid &&
      !input.hasValidReplacement
  )
  if (missingOptional) {
    return hasFallbackOutput ? 'RECHECK_REQUIRED' : 'SUSPENDED'
  }
  return 'UNCHANGED'
}

export interface RevocationBarrierState {
  expectedCount: number
  revokedCount: number
  status: 'PENDING' | 'COMPLETED'
}

/**
 * Claim 1(g) & 1(h): Recomputation MUST NOT execute until revocation barrier is COMPLETED
 * and every impacted disclosure package has been confirmed revoked.
 */
export function canExecuteSelectiveRecomputation(barrier: RevocationBarrierState): boolean {
  return barrier.status === 'COMPLETED' && barrier.revokedCount === barrier.expectedCount
}

/**
 * Claim 1(h): Kahn's topological sort over impacted derived nodes using input in-degrees.
 */
export function topologicalSortDerivedNodes(
  nodeKeys: string[],
  edges: VersionedDependencyEdge[]
): string[] {
  const nodeSet = new Set(nodeKeys)
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const key of nodeSet) {
    inDegree.set(key, 0)
    adj.set(key, [])
  }

  for (const edge of edges) {
    if (!nodeSet.has(edge.fromKey) || !nodeSet.has(edge.toKey)) continue
    adj.get(edge.fromKey)!.push(edge.toKey)
    inDegree.set(edge.toKey, (inDegree.get(edge.toKey) ?? 0) + 1)
  }

  const ready = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([key]) => key)
    .sort()

  const order: string[] = []
  while (ready.length > 0) {
    const current = ready.shift()!
    order.push(current)
    for (const neighbor of adj.get(current) ?? []) {
      const nextDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, nextDeg)
      if (nextDeg === 0) {
        ready.push(neighbor)
        ready.sort()
      }
    }
  }

  if (order.length !== nodeSet.size) {
    throw new Error('DEPENDENCY_GRAPH_CYCLE_DETECTED')
  }
  return order
}

export function buildDerivedReproductionHash(params: {
  evidenceVersionVector: Array<{ nodeId: string; nodeVersion: number }>
  policyVersion: string
  modelVersion: string
  codeVersion: string
}): string {
  const sortedVector = [...params.evidenceVersionVector].sort(
    (a, b) => a.nodeId.localeCompare(b.nodeId) || a.nodeVersion - b.nodeVersion
  )
  return canonicalSha256({
    evidenceVersionVector: sortedVector,
    policyVersion: params.policyVersion,
    modelVersion: params.modelVersion,
    codeVersion: params.codeVersion,
  })
}

/**
 * Claim 5: Deterministic idempotent work deduplication key and expected-version CAS guard.
 */
export function buildWorkDedupKey(params: {
  eventId: string
  targetNodeId: string
  expectedNodeVersion: number
  workType: 'invalidate' | 'revoke' | 'recompute' | 'notify'
}): string {
  return `${params.workType}:${params.eventId}:${params.targetNodeId}:v${params.expectedNodeVersion}`
}

export function canApplyExpectedVersionUpdate(
  currentVersion: number,
  expectedVersion: number
): boolean {
  return currentVersion === expectedVersion
}

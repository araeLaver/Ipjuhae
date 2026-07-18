import { createHash, createHmac, randomBytes } from 'crypto'
import type { PoolClient } from 'pg'
import { query, queryOne, transaction } from '@/lib/db'
import { canTransitionTransaction } from '@/lib/trust-policy'
import {
  isComplianceGateError,
  requireApprovedComplianceGate,
} from '@/lib/compliance-gates'

export type TrustSubjectType = 'tenant' | 'landlord' | 'property'
export type TransactionStage = 'pre_application' | 'application' | 'negotiation' | 'contract' | 'completed' | 'cancelled'

interface RequestTrace {
  requestId?: string | null
  traceId?: string | null
  ip?: string | null
}

interface EvidenceInput {
  subjectType: TrustSubjectType
  subjectId: string
  propertyId?: string | null
  sourceCode: string
  fieldName: string
  normalizedValue: unknown
  objectHash?: string | null
  storageRef?: string | null
  issuedAt?: string | null
  validUntil?: string | null
  consentId?: string | null
  extractionConfidence?: number | null
  humanReviewed?: boolean
  reasonCodes?: string[]
  metadata?: Record<string, unknown>
  deferCascade?: boolean
}

interface ScoreRule {
  field: string
  weight: number
  reason: string
}

interface FactRow {
  id: string
  evidence_id: string
  field_name: string
  normalized_value: unknown
  value_digest: string
  quality: string | number
  valid_until: Date | string | null
  reason_codes: string[]
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

export function trustDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

function truthyFact(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') {
    return ['true', 'verified', 'confirmed', 'matched', 'safe', 'eligible', 'completed', 'reliable'].includes(value.toLowerCase())
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Boolean(record.verified ?? record.confirmed ?? record.matched ?? record.safe ?? record.eligible ?? record.value)
  }
  return false
}

function numericFact(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (value && typeof value === 'object') {
    return numericFact((value as Record<string, unknown>).value)
  }
  return null
}

async function emitOutbox(
  client: PoolClient,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>,
  trace: RequestTrace,
) {
  await client.query(
    `INSERT INTO trust_outbox_events
      (aggregate_type, aggregate_id, event_type, payload, request_id, trace_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [aggregateType, aggregateId, eventType, JSON.stringify(payload), trace.requestId ?? null, trace.traceId ?? null]
  )
}

async function appendAudit(
  client: PoolClient,
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  purpose: string,
  result: string,
  fields: string[],
  trace: RequestTrace,
  metadata: Record<string, unknown> = {},
) {
  const ipHash = trace.ip ? trustDigest(trace.ip) : null
  await client.query(
    `INSERT INTO trust_audit_events
      (actor_id, action, target_type, target_id, purpose, result, fields, request_id, trace_id, ip_hash, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [actorId, action, targetType, targetId, purpose, result, fields, trace.requestId ?? null, trace.traceId ?? null, ipHash, JSON.stringify(metadata)]
  )
}

export async function createEvidenceFact(input: EvidenceInput, actorId: string, trace: RequestTrace = {}) {
  const created = await transaction(async (client) => {
    const sourceResult = await client.query(
      `SELECT id, reliability, status
         FROM trust_source_registry
        WHERE code = $1`,
      [input.sourceCode]
    )
    const source = sourceResult.rows[0]
    if (!source || source.status !== 'active') throw new Error('TRUST_SOURCE_UNAVAILABLE')

    const objectHash = input.objectHash || trustDigest({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      sourceCode: input.sourceCode,
      fieldName: input.fieldName,
      normalizedValue: input.normalizedValue,
      issuedAt: input.issuedAt ?? null,
    })
    const extractionConfidence = input.extractionConfidence ?? 1
    const reviewFactor = input.humanReviewed ? 1 : 0.85
    const quality = Math.max(0, Math.min(1, Number(source.reliability) * extractionConfidence * reviewFactor))

    const evidenceResult = await client.query(
      `INSERT INTO trust_evidence_nodes
        (owner_user_id, subject_type, subject_id, property_id, source_id, object_hash, storage_ref,
         issued_at, valid_until, consent_id, extraction_confidence, human_reviewed, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (subject_type, subject_id, object_hash)
       DO UPDATE SET observed_at = NOW(), metadata = trust_evidence_nodes.metadata || EXCLUDED.metadata
       RETURNING *`,
      [actorId, input.subjectType, input.subjectId, input.propertyId ?? null, source.id, objectHash,
       input.storageRef ?? null, input.issuedAt ?? null, input.validUntil ?? null, input.consentId ?? null,
       extractionConfidence, input.humanReviewed ?? false, JSON.stringify(input.metadata ?? {})]
    )
    const evidence = evidenceResult.rows[0]

    const previousResult = await client.query(
      `SELECT * FROM trust_fact_nodes
        WHERE subject_type = $1 AND subject_id = $2 AND field_name = $3
          AND status IN ('ACTIVE', 'CONFIRMED', 'REVISED')
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [input.subjectType, input.subjectId, input.fieldName]
    )
    const previous = previousResult.rows[0]
    const nextValueDigest = trustDigest(input.normalizedValue)
    if (previous?.value_digest === nextValueDigest) {
      return { evidence, fact: previous, supersededFactId: null, unchanged: true }
    }
    if (previous) {
      await client.query(`UPDATE trust_fact_nodes SET status = 'SUPERSEDED', updated_at = NOW() WHERE id = $1`, [previous.id])
    }

    const valueDigest = nextValueDigest
    const factResult = await client.query(
      `INSERT INTO trust_fact_nodes
        (evidence_id, subject_type, subject_id, property_id, field_name, normalized_value, value_digest,
         quality, status, reason_codes, valid_until, supersedes_id, reviewer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, $10, $11, $12)
       RETURNING *`,
      [evidence.id, input.subjectType, input.subjectId, input.propertyId ?? null, input.fieldName,
       JSON.stringify(input.normalizedValue), valueDigest, quality, input.reasonCodes ?? [],
       input.validUntil ?? null, previous?.id ?? null, input.humanReviewed ? actorId : null]
    )
    const fact = factResult.rows[0]

    await client.query(
      `INSERT INTO trust_dependency_edges
        (from_node_type, from_node_id, to_node_type, to_node_id, dependency_type)
       VALUES ('evidence', $1, 'fact', $2, 'required')
       ON CONFLICT DO NOTHING`,
      [evidence.id, fact.id]
    )

    await emitOutbox(client, 'fact', fact.id, 'FactCreated', {
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      field_name: input.fieldName,
      supersedes_id: previous?.id ?? null,
    }, trace)
    await appendAudit(client, actorId, 'fact.create', 'fact', fact.id, 'verification', 'allowed', [input.fieldName], trace, {
      source_code: input.sourceCode,
      quality,
    })

    return { evidence, fact, supersededFactId: previous?.id ?? null }
  })

  if (created.supersededFactId && !input.deferCascade) {
    const cascade = await cascadeTrustChange(
      'fact',
      created.supersededFactId,
      'source_updated',
      actorId,
      `fact_superseded:${input.fieldName}`,
      trace,
    )
    return { ...created, cascade }
  }

  return created
}

export async function calculateTrustScore(
  subjectType: TrustSubjectType,
  subjectId: string,
  actorId: string | null,
  trace: RequestTrace = {},
) {
  await requireApprovedComplianceGate('automated_scoring')

  const model = await queryOne<{ id: string; version: string; ruleset: { rules: ScoreRule[] } }>(
    `SELECT id, version, ruleset FROM trust_score_models
      WHERE subject_type = $1 AND status = 'active'
        AND effective_from <= NOW() AND (effective_until IS NULL OR effective_until > NOW())`,
    [subjectType]
  )
  if (!model) throw new Error('TRUST_MODEL_NOT_FOUND')

  const facts = await query<FactRow>(
    `SELECT id, evidence_id, field_name, normalized_value, value_digest, quality, valid_until, reason_codes
       FROM trust_fact_nodes
      WHERE subject_type = $1 AND subject_id = $2
        AND status IN ('ACTIVE', 'CONFIRMED', 'REVISED')
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY created_at DESC`,
    [subjectType, subjectId]
  )
  const latestByField = new Map<string, FactRow>()
  for (const fact of facts) if (!latestByField.has(fact.field_name)) latestByField.set(fact.field_name, fact)

  const rules = model.ruleset.rules
  const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0) || 1
  const components = rules.map((rule) => {
    const fact = latestByField.get(rule.field)
    const satisfied = fact ? truthyFact(fact.normalized_value) : false
    const confidence = fact ? Number(fact.quality) : 0
    return {
      rule,
      fact,
      contribution: satisfied ? rule.weight : 0,
      confidence,
      satisfied,
    }
  })
  const matched = components.filter((component) => component.fact)
  const rawScore = components.reduce((sum, component) => sum + component.contribution, 0) / totalWeight * 100
  const score = matched.length === 0 ? 50 : Math.round(rawScore * 100) / 100
  const confidence = matched.length === 0
    ? 0.15
    : Math.max(0, Math.min(1, matched.reduce((sum, item) => sum + item.confidence * item.rule.weight, 0) / totalWeight))
  const band = score >= 80 ? 'strong' : score >= 60 ? 'good' : score >= 40 ? 'review' : 'weak'
  const reasonCodes = components.filter((item) => item.satisfied).map((item) => item.rule.reason)
  const missingFields = components.filter((item) => !item.fact).map((item) => item.rule.field)
  const inputDigest = trustDigest(components.map((item) => ({
    fact_id: item.fact?.id ?? null,
    digest: item.fact?.value_digest ?? null,
    weight: item.rule.weight,
  })))

  return transaction(async (client) => {
    await requireApprovedComplianceGate('automated_scoring', client)

    const previousResult = await client.query(
      `SELECT sr.id, sr.derived_node_id
         FROM trust_score_runs sr
        WHERE sr.subject_type = $1 AND sr.subject_id = $2 AND sr.status = 'PUBLISHED'
        ORDER BY sr.created_at DESC LIMIT 1 FOR UPDATE`,
      [subjectType, subjectId]
    )
    const previous = previousResult.rows[0]
    if (previous) {
      await client.query(`UPDATE trust_score_runs SET status = 'SUPERSEDED' WHERE id = $1`, [previous.id])
      await client.query(`UPDATE trust_derived_nodes SET state = 'SUPERSEDED' WHERE id = $1`, [previous.derived_node_id])
    }

    const snapshot = { subject_type: subjectType, subject_id: subjectId, score, band, confidence, reason_codes: reasonCodes, missing_fields: missingFields }
    const derivedResult = await client.query(
      `INSERT INTO trust_derived_nodes
        (object_type, subject_type, subject_id, state, output_snapshot, reproduction_hash, model_version, supersedes_id)
       VALUES ('evaluation', $1, $2, 'PUBLISHED', $3, $4, $5, $6) RETURNING *`,
      [subjectType, subjectId, JSON.stringify(snapshot), trustDigest({ inputDigest, model: model.version, snapshot }), model.version, previous?.derived_node_id ?? null]
    )
    const derived = derivedResult.rows[0]
    const runResult = await client.query(
      `INSERT INTO trust_score_runs
        (derived_node_id, subject_type, subject_id, model_id, model_version, score, band, confidence,
         reason_codes, missing_fields, input_digest)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [derived.id, subjectType, subjectId, model.id, model.version, score, band, confidence, reasonCodes, missingFields, inputDigest]
    )
    const scoreRun = runResult.rows[0]

    for (const component of components) {
      await client.query(
        `INSERT INTO trust_score_components
          (score_run_id, fact_id, feature, input_value, weight, contribution, confidence, reason_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [scoreRun.id, component.fact?.id ?? null, component.rule.field,
         component.fact ? JSON.stringify(component.fact.normalized_value) : null,
         component.rule.weight, component.contribution, component.confidence,
         component.satisfied ? component.rule.reason : `${component.rule.field.toUpperCase()}_MISSING`]
      )
      if (component.fact) {
        await client.query(
          `INSERT INTO trust_dependency_edges
            (from_node_type, from_node_id, to_node_type, to_node_id, dependency_type, created_by_run)
           VALUES ('fact', $1, 'derived', $2, 'required', $3)
           ON CONFLICT DO NOTHING`,
          [component.fact.id, derived.id, scoreRun.id]
        )
      }
    }

    if (subjectType !== 'property') {
      await client.query(`UPDATE profiles SET trust_score = $1, updated_at = NOW() WHERE user_id = $2`, [Math.round(score), subjectId])
    }
    await emitOutbox(client, 'score_run', scoreRun.id, 'ScoreCalculated', snapshot, trace)
    await appendAudit(client, actorId, 'score.calculate', 'score_run', scoreRun.id, 'trust_evaluation', 'allowed', reasonCodes, trace, { model_version: model.version })
    return { ...scoreRun, components: components.map((item) => ({ feature: item.rule.field, contribution: item.contribution, confidence: item.confidence })) }
  })
}

interface DisclosureInput {
  subjectType: TrustSubjectType
  subjectId: string
  recipientId: string
  recipientRole: 'tenant' | 'landlord' | 'broker'
  transactionId: string
  purpose: string
  consentId: string
  conditions?: Record<string, unknown>
}

function disclosureClaim(value: unknown, representation: string, conditionValue: unknown): unknown {
  if (representation === 'boolean') return truthyFact(value)
  if (representation === 'positive') return (numericFact(value) ?? 0) > 0
  if (representation === 'threshold') {
    const actual = numericFact(value)
    const threshold = numericFact(conditionValue)
    return actual !== null && threshold !== null ? actual >= threshold : false
  }
  if (representation === 'band') {
    const actual = numericFact(value)
    if (actual === null) return null
    return actual >= 80 ? 'A' : actual >= 60 ? 'B' : actual >= 40 ? 'C' : 'D'
  }
  return null
}

export async function createDisclosurePackage(input: DisclosureInput, actorId: string, trace: RequestTrace = {}) {
  const signingKey = process.env.DISCLOSURE_SIGNING_KEY
  if (!signingKey || signingKey.length < 32) throw new Error('DISCLOSURE_SIGNING_KEY_NOT_CONFIGURED')

  const context = await queryOne<Record<string, unknown>>(`SELECT * FROM trust_transaction_contexts WHERE id = $1`, [input.transactionId])
  if (!context) throw new Error('TRUST_TRANSACTION_NOT_FOUND')
  const participants = [context.landlord_id, context.tenant_id, context.realtor_id].filter(Boolean)
  if (!participants.includes(input.recipientId)) throw new Error('DISCLOSURE_RECIPIENT_NOT_PARTICIPANT')

  const policy = await queryOne<{ id: string; version: string; claim_rules: { claims: Array<{ fact: string; claim: string; representation: string; condition?: string }> }; ttl_minutes: number }>(
    `SELECT id, version, claim_rules, ttl_minutes
       FROM trust_disclosure_policies
      WHERE subject_type = $1 AND recipient_role = $2 AND transaction_stage = $3 AND purpose = $4 AND status = 'active'
      ORDER BY created_at DESC LIMIT 1`,
    [input.subjectType, input.recipientRole, context.stage, input.purpose]
  )
  if (!policy) throw new Error('DISCLOSURE_POLICY_NOT_FOUND')

  const consent = await queryOne<{ id: string; user_id: string; allowed_fields: Record<string, unknown> }>(
    `SELECT id, user_id, allowed_fields FROM data_consents
      WHERE id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())`,
    [input.consentId]
  )
  if (!consent) throw new Error('DISCLOSURE_CONSENT_INVALID')
  const ownerId = input.subjectType === 'property'
    ? await queryOne<{ landlord_id: string }>('SELECT landlord_id FROM properties WHERE id = $1', [input.subjectId]).then((row) => row?.landlord_id)
    : input.subjectId
  if (!ownerId || consent.user_id !== ownerId) throw new Error('DISCLOSURE_CONSENT_SUBJECT_MISMATCH')

  const facts = await query<FactRow>(
    `SELECT id, evidence_id, field_name, normalized_value, value_digest, quality, valid_until, reason_codes
       FROM trust_fact_nodes
      WHERE subject_type = $1 AND subject_id = $2
        AND status IN ('ACTIVE', 'CONFIRMED', 'REVISED')
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY created_at DESC`,
    [input.subjectType, input.subjectId]
  )
  const latest = new Map<string, FactRow>()
  for (const fact of facts) if (!latest.has(fact.field_name)) latest.set(fact.field_name, fact)

  const claims: Record<string, unknown> = {}
  const usedFacts: FactRow[] = []
  for (const rule of policy.claim_rules.claims) {
    const fact = latest.get(rule.fact)
    if (!fact) continue
    const consentAllows = consent.allowed_fields.all === true
      || consent.allowed_fields.verification === true
      || consent.allowed_fields[rule.fact] === true
    if (!consentAllows) continue
    claims[rule.claim] = disclosureClaim(
      fact.normalized_value,
      rule.representation,
      rule.condition ? input.conditions?.[rule.condition] : null,
    )
    usedFacts.push(fact)
  }
  if (Object.keys(claims).length === 0) throw new Error('DISCLOSURE_HAS_NO_PERMITTED_CLAIMS')

  const nonce = randomBytes(24).toString('hex')
  const rawRevocationHandle = randomBytes(32).toString('hex')
  const revocationHandle = trustDigest(rawRevocationHandle)
  const expiresAt = new Date(Date.now() + policy.ttl_minutes * 60_000)
  for (const fact of usedFacts) {
    if (fact.valid_until) {
      const factExpiry = new Date(fact.valid_until)
      if (factExpiry < expiresAt) expiresAt.setTime(factExpiry.getTime())
    }
  }
  const envelope = {
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    recipient_id: input.recipientId,
    transaction_id: input.transactionId,
    purpose: input.purpose,
    policy_version: policy.version,
    claims,
    evidence_digests: usedFacts.map((fact) => fact.value_digest),
    nonce,
    expires_at: expiresAt.toISOString(),
    revocation_handle: revocationHandle,
  }
  const signature = createHmac('sha256', signingKey).update(JSON.stringify(canonicalize(envelope))).digest('hex')

  return transaction(async (client) => {
    const derivedResult = await client.query(
      `INSERT INTO trust_derived_nodes
        (object_type, subject_type, subject_id, transaction_id, output_snapshot, reproduction_hash, policy_version)
       VALUES ('disclosure', $1, $2, $3, $4, $5, $6) RETURNING *`,
      [input.subjectType, input.subjectId, input.transactionId, JSON.stringify(envelope), trustDigest(envelope), policy.version]
    )
    const derived = derivedResult.rows[0]
    const packageResult = await client.query(
      `INSERT INTO trust_disclosure_packages
        (derived_node_id, subject_type, subject_id, recipient_id, transaction_id, consent_id, policy_id,
         policy_version, claims, evidence_digests, nonce, signature, revocation_handle, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [derived.id, input.subjectType, input.subjectId, input.recipientId, input.transactionId, input.consentId,
       policy.id, policy.version, JSON.stringify(claims), usedFacts.map((fact) => fact.value_digest), nonce,
       signature, revocationHandle, expiresAt]
    )
    for (const fact of usedFacts) {
      await client.query(
        `INSERT INTO trust_dependency_edges
          (from_node_type, from_node_id, to_node_type, to_node_id, dependency_type)
         VALUES ('fact', $1, 'derived', $2, 'disclosure_control') ON CONFLICT DO NOTHING`,
        [fact.id, derived.id]
      )
    }
    const disclosure = packageResult.rows[0]
    await emitOutbox(client, 'disclosure', disclosure.id, 'DisclosureDecided', { disclosure_id: disclosure.id, recipient_id: input.recipientId, claims: Object.keys(claims) }, trace)
    await appendAudit(client, actorId, 'disclosure.issue', 'disclosure', disclosure.id, input.purpose, 'allowed', Object.keys(claims), trace, { transaction_id: input.transactionId, policy_version: policy.version })
    return disclosure
  })
}

export async function cascadeTrustChange(
  nodeType: 'evidence' | 'fact',
  nodeId: string,
  changeType: 'expired' | 'corrected' | 'source_updated' | 'rights_changed' | 'disputed' | 'review_accepted' | 'review_rejected',
  actorId: string | null,
  reason: string,
  trace: RequestTrace = {},
) {
  const result = await transaction(async (client) => {
    const eventResult = await client.query(
      `INSERT INTO trust_change_events (node_type, node_id, change_type, actor_user_id, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nodeType, nodeId, changeType, actorId, reason]
    )
    const event = eventResult.rows[0]
    const impactResult = await client.query(
      `WITH RECURSIVE impacted(node_type, node_id, depth) AS (
         SELECT to_node_type, to_node_id, 1
           FROM trust_dependency_edges
          WHERE from_node_type = $1 AND from_node_id = $2
         UNION
         SELECT edge.to_node_type, edge.to_node_id, impacted.depth + 1
           FROM trust_dependency_edges edge
           JOIN impacted ON edge.from_node_type = impacted.node_type AND edge.from_node_id = impacted.node_id
          WHERE impacted.depth < 20
       )
       SELECT DISTINCT node_type, node_id, depth FROM impacted ORDER BY depth, node_id`,
      [nodeType, nodeId]
    )
    const affected = impactResult.rows
    const derivedIds = affected.filter((item) => item.node_type === 'derived').map((item) => item.node_id)
    if (derivedIds.length > 0) {
      await client.query(`UPDATE trust_derived_nodes SET state = 'SUSPENDED' WHERE id = ANY($1::uuid[]) AND state NOT IN ('SUPERSEDED', 'REVOKED')`, [derivedIds])
      await client.query(`UPDATE trust_score_runs SET status = 'SUSPENDED' WHERE derived_node_id = ANY($1::uuid[]) AND status = 'PUBLISHED'`, [derivedIds])
      await client.query(`UPDATE trust_disclosure_packages SET state = 'REVOKED', revoked_at = NOW(), revoke_reason = $2 WHERE derived_node_id = ANY($1::uuid[]) AND state = 'ISSUED'`, [derivedIds, reason])
      await client.query(`UPDATE trust_condition_recommendations SET status = 'HIDDEN' WHERE derived_node_id = ANY($1::uuid[]) AND status = 'VISIBLE'`, [derivedIds])
    }
    const jobResult = await client.query(
      `INSERT INTO trust_impact_jobs (change_event_id, affected_nodes, processing_order, status, started_at)
       VALUES ($1, $2, $3, 'processing', NOW()) RETURNING *`,
      [event.id, JSON.stringify(affected), JSON.stringify(affected)]
    )
    await emitOutbox(client, nodeType, nodeId, 'TrustDependencyInvalidated', { change_event_id: event.id, affected }, trace)
    await appendAudit(client, actorId, 'dependency.invalidate', nodeType, nodeId, 'correction', 'allowed', [], trace, { change_type: changeType, affected_count: affected.length })
    return { event, job: jobResult.rows[0], derivedIds }
  })

  const affectedEvaluations = result.derivedIds.length === 0 ? [] : await query<{ subject_type: TrustSubjectType; subject_id: string }>(
    `SELECT DISTINCT subject_type, subject_id FROM trust_derived_nodes
      WHERE id = ANY($1::uuid[]) AND object_type = 'evaluation' AND subject_type IS NOT NULL AND subject_id IS NOT NULL`,
    [result.derivedIds]
  )
  const recalculated: string[] = []
  let recalculationDeferred: string | null = null
  for (const evaluation of affectedEvaluations) {
    try {
      const run = await calculateTrustScore(evaluation.subject_type, evaluation.subject_id, actorId, trace)
      recalculated.push(run.id)
    } catch (error) {
      if (!isComplianceGateError(error)) throw error
      recalculationDeferred = error.code
      break
    }
  }
  await query(
    `UPDATE trust_impact_jobs SET status = 'completed', completed_at = NOW(), affected_nodes = affected_nodes || $2::jsonb WHERE id = $1`,
    [result.job.id, JSON.stringify([{
      recalculated_score_runs: recalculated,
      recalculation_deferred: recalculationDeferred,
    }])]
  )
  return {
    changeEvent: result.event,
    impactJobId: result.job.id,
    affectedCount: result.derivedIds.length,
    recalculated,
    recalculationDeferred,
  }
}

export async function requestFactCorrection(
  factId: string,
  requesterId: string,
  reason: string,
  proposedValue: unknown,
  evidenceIds: string[],
  trace: RequestTrace = {},
) {
  const fact = await queryOne<Record<string, unknown>>(`SELECT * FROM trust_fact_nodes WHERE id = $1`, [factId])
  if (!fact) throw new Error('TRUST_FACT_NOT_FOUND')
  if (fact.subject_id !== requesterId) throw new Error('TRUST_CORRECTION_FORBIDDEN')

  const task = await transaction(async (client) => {
    await client.query(`UPDATE trust_fact_nodes SET status = 'DISPUTED', updated_at = NOW() WHERE id = $1`, [factId])
    const result = await client.query(
      `INSERT INTO trust_review_tasks
        (target_type, target_id, requester_id, review_type, reason, proposed_value, evidence_ids, original_snapshot)
       VALUES ('fact', $1, $2, 'correction', $3, $4, $5, $6) RETURNING *`,
      [factId, requesterId, reason, JSON.stringify(proposedValue), evidenceIds, JSON.stringify(fact)]
    )
    await emitOutbox(client, 'review_task', result.rows[0].id, 'CorrectionRequested', { fact_id: factId, requester_id: requesterId }, trace)
    return result.rows[0]
  })
  const cascade = await cascadeTrustChange('fact', factId, 'disputed', requesterId, reason, trace)
  return { task, cascade }
}

export async function decideFactCorrection(
  taskId: string,
  adminId: string,
  decision: 'accepted' | 'partially_accepted' | 'rejected',
  decisionReason: string,
  correctedValue: unknown,
  trace: RequestTrace = {},
) {
  const task = await queryOne<Record<string, unknown>>(`SELECT * FROM trust_review_tasks WHERE id = $1`, [taskId])
  if (!task || task.status === 'completed') throw new Error('TRUST_REVIEW_TASK_NOT_FOUND')
  const fact = await queryOne<Record<string, unknown>>(`SELECT * FROM trust_fact_nodes WHERE id = $1`, [task.target_id])
  if (!fact) throw new Error('TRUST_FACT_NOT_FOUND')

  if (decision === 'rejected') {
    await transaction(async (client) => {
      await client.query(`UPDATE trust_fact_nodes SET status = 'CONFIRMED', reviewer_id = $2, updated_at = NOW() WHERE id = $1`, [fact.id, adminId])
      await client.query(`UPDATE trust_review_tasks SET status = 'completed', decision = $2, decision_reason = $3, assigned_to = $4, decided_at = NOW(), updated_at = NOW() WHERE id = $1`, [taskId, decision, decisionReason, adminId])
      await emitOutbox(client, 'review_task', taskId, 'CorrectionRejected', { fact_id: fact.id }, trace)
    })
    return cascadeTrustChange('fact', String(fact.id), 'review_rejected', adminId, decisionReason, trace)
  }

  const source = await queryOne<{ code: string }>(
    `SELECT source.code FROM trust_evidence_nodes evidence
      JOIN trust_source_registry source ON source.id = evidence.source_id
      WHERE evidence.id = $1`,
    [fact.evidence_id]
  )
  const created = await createEvidenceFact({
    subjectType: fact.subject_type as TrustSubjectType,
    subjectId: String(fact.subject_id),
    propertyId: fact.property_id ? String(fact.property_id) : null,
    sourceCode: source?.code ?? 'human_review',
    fieldName: String(fact.field_name),
    normalizedValue: correctedValue,
    humanReviewed: true,
    reasonCodes: ['HUMAN_REVIEWED', decision === 'accepted' ? 'CORRECTION_ACCEPTED' : 'CORRECTION_PARTIAL'],
    metadata: { correction_task_id: taskId },
    deferCascade: true,
  }, adminId, trace)
  await query(`UPDATE trust_review_tasks SET status = 'completed', decision = $2, decision_reason = $3, assigned_to = $4, decided_at = NOW(), updated_at = NOW() WHERE id = $1`, [taskId, decision, decisionReason, adminId])
  const cascade = await cascadeTrustChange('fact', String(fact.id), 'review_accepted', adminId, decisionReason, trace)
  return { created, cascade }
}

interface TransactionInput {
  propertyId?: string | null
  landlordId?: string | null
  tenantId?: string | null
  realtorId?: string | null
  stage?: TransactionStage
  requirements?: Record<string, unknown>
  terms?: Record<string, unknown>
}

export async function createTrustTransaction(input: TransactionInput, actorId: string, trace: RequestTrace = {}) {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO trust_transaction_contexts
        (property_id, landlord_id, tenant_id, realtor_id, stage, requirements, terms, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [input.propertyId ?? null, input.landlordId ?? null, input.tenantId ?? null, input.realtorId ?? null,
       input.stage ?? 'pre_application', JSON.stringify(input.requirements ?? {}), JSON.stringify(input.terms ?? {}), actorId]
    )
    const context = result.rows[0]
    await emitOutbox(client, 'transaction', context.id, 'TransactionContextCreated', { stage: context.stage }, trace)
    await appendAudit(client, actorId, 'transaction.create', 'transaction', context.id, 'lease', 'allowed', [], trace)
    return context
  })
}

export async function recordContractOutcome(
  transactionId: string,
  actorId: string,
  outcome: 'completed' | 'cancelled' | 'defaulted' | 'disputed' | 'renewed',
  terms: Record<string, unknown>,
  evidenceIds: string[],
  occurredAt: string,
  trace: RequestTrace = {},
) {
  return transaction(async (client) => {
    const contextResult = await client.query(`SELECT * FROM trust_transaction_contexts WHERE id = $1 FOR UPDATE`, [transactionId])
    const context = contextResult.rows[0]
    if (!context) throw new Error('TRUST_TRANSACTION_NOT_FOUND')
    if (![context.landlord_id, context.tenant_id, context.realtor_id].includes(actorId)) throw new Error('TRUST_TRANSACTION_FORBIDDEN')
    const contractHash = trustDigest({ transactionId, terms, evidenceIds, occurredAt, landlordId: context.landlord_id, tenantId: context.tenant_id })
    const result = await client.query(
      `INSERT INTO trust_contract_outcomes
        (transaction_id, recorded_by, outcome, contract_hash, terms_snapshot, evidence_ids, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (transaction_id) DO UPDATE SET outcome = EXCLUDED.outcome, terms_snapshot = EXCLUDED.terms_snapshot, evidence_ids = EXCLUDED.evidence_ids
       RETURNING *`,
      [transactionId, actorId, outcome, contractHash, JSON.stringify(terms), evidenceIds, occurredAt]
    )
    const completed = outcome === 'completed' || outcome === 'renewed'
    await client.query(
      `UPDATE trust_transaction_contexts
          SET stage = $2, status = $3, terms = $4, terms_evidence_hash = $5, updated_at = NOW()
        WHERE id = $1`,
      [transactionId, completed ? 'completed' : context.stage, completed ? 'completed' : outcome === 'cancelled' ? 'cancelled' : 'disputed', JSON.stringify(terms), contractHash]
    )
    if (completed && context.landlord_id && context.tenant_id) {
      await client.query(
        `INSERT INTO trust_tenancy_relationships
          (transaction_id, landlord_id, tenant_id, property_id, contract_hash, verification_status, ended_at)
         VALUES ($1, $2, $3, $4, $5, 'verified', $6)
         ON CONFLICT (transaction_id) DO UPDATE SET verification_status = 'verified', contract_hash = EXCLUDED.contract_hash
         RETURNING id`,
        [transactionId, context.landlord_id, context.tenant_id, context.property_id, contractHash, occurredAt]
      )
    }
    await emitOutbox(client, 'transaction', transactionId, 'ContractOutcomeRecorded', { outcome, contract_hash: contractHash }, trace)
    await appendAudit(client, actorId, 'contract.outcome', 'transaction', transactionId, 'contract_feedback', 'allowed', ['outcome', 'terms'], trace)
    return result.rows[0]
  })
}

interface GraphReferenceSubmission {
  id: string
  responder_id: string
  subject_id: string
  rating: number | string
  shared_identifier_hash: string | null
}

async function deferredAutomatedScoringCode(
  client: PoolClient,
): Promise<string | null> {
  const savepoint = 'automated_scoring_gate_check'
  await client.query(`SAVEPOINT ${savepoint}`)
  try {
    await requireApprovedComplianceGate('automated_scoring', client)
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    await client.query(`RELEASE SAVEPOINT ${savepoint}`)
    if (!isComplianceGateError(error)) throw error
    return error.code
  }
  await client.query(`RELEASE SAVEPOINT ${savepoint}`)
  return null
}

async function upsertReferenceGraphEdges(
  client: PoolClient,
  relationshipId: string,
  all: GraphReferenceSubmission[],
  candidates: GraphReferenceSubmission[] = all,
): Promise<number> {
  let created = 0
  for (const item of candidates) {
    const recentResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM trust_reference_submissions WHERE responder_id = $1 AND submitted_at > NOW() - INTERVAL '24 hours'`,
      [item.responder_id]
    )
    const pairResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM trust_graph_edges WHERE from_user_id = $1 AND to_user_id = $2`,
      [item.responder_id, item.subject_id]
    )
    let risk = 0
    const signals: Array<{ type: string; value: number; threshold: number }> = []
    if (Number(recentResult.rows[0]?.count ?? 0) > 5) {
      risk += 0.35
      signals.push({ type: 'TIME_BURST', value: Number(recentResult.rows[0].count), threshold: 5 })
    }
    if (Number(pairResult.rows[0]?.count ?? 0) > 0) {
      risk += 0.25
      signals.push({ type: 'REPEATED_PAIR', value: Number(pairResult.rows[0].count), threshold: 1 })
    }
    if (
      item.shared_identifier_hash &&
      all.some((other) =>
        other.id !== item.id &&
        other.shared_identifier_hash === item.shared_identifier_hash
      )
    ) {
      risk += 0.5
      signals.push({ type: 'SHARED_IDENTIFIER', value: 1, threshold: 1 })
    }
    if (
      (Number(item.rating) >= 95 || Number(item.rating) <= 5) &&
      all.every((other) => Number(other.rating) >= 95 || Number(other.rating) <= 5)
    ) {
      risk += 0.2
      signals.push({ type: 'RECIPROCAL_EXTREME', value: Number(item.rating), threshold: 95 })
    }
    risk = Math.min(1, risk)
    const state = risk >= 0.7 ? 'QUARANTINED' : 'ACTIVE'
    const edgeResult = await client.query(
      `INSERT INTO trust_graph_edges
        (relationship_id, reference_submission_id, from_user_id, to_user_id, trust_value, risk_score, state, current_weight)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (reference_submission_id) DO UPDATE SET trust_value = EXCLUDED.trust_value,
         risk_score = EXCLUDED.risk_score, state = EXCLUDED.state, current_weight = EXCLUDED.current_weight, updated_at = NOW()
       RETURNING id`,
      [
        relationshipId,
        item.id,
        item.responder_id,
        item.subject_id,
        item.rating,
        risk,
        state,
        state === 'ACTIVE' ? 1 : 0,
      ]
    )
    for (const signal of signals) {
      await client.query(
        `INSERT INTO trust_risk_signals (edge_id, relationship_id, signal_type, signal_value, threshold)
         VALUES ($1, $2, $3, $4, $5)`,
        [edgeResult.rows[0].id, relationshipId, signal.type, signal.value, signal.threshold]
      )
    }
    created++
  }
  return created
}

export async function submitBilateralReference(
  transactionId: string,
  responderId: string,
  answers: Record<string, unknown>,
  rating: number,
  comment: string | null,
  sharedIdentifier: string | null,
  trace: RequestTrace = {},
) {
  return transaction(async (client) => {
    const relationshipResult = await client.query(
      `SELECT * FROM trust_tenancy_relationships WHERE transaction_id = $1 AND verification_status = 'verified' FOR UPDATE`,
      [transactionId]
    )
    const relationship = relationshipResult.rows[0]
    if (!relationship) throw new Error('TRUST_RELATIONSHIP_NOT_VERIFIED')
    const responderRole = responderId === relationship.tenant_id ? 'tenant' : responderId === relationship.landlord_id ? 'landlord' : null
    if (!responderRole) throw new Error('TRUST_REFERENCE_FORBIDDEN')
    const subjectId = responderRole === 'tenant' ? relationship.landlord_id : relationship.tenant_id
    const revealAfter = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const submissionResult = await client.query(
      `INSERT INTO trust_reference_submissions
        (relationship_id, responder_id, subject_id, responder_role, structured_answers, rating,
         comment_digest, shared_identifier_hash, reveal_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (relationship_id, responder_id) DO UPDATE
         SET structured_answers = EXCLUDED.structured_answers, rating = EXCLUDED.rating,
             comment_digest = EXCLUDED.comment_digest, shared_identifier_hash = EXCLUDED.shared_identifier_hash,
             submitted_at = NOW()
       RETURNING *`,
      [relationship.id, responderId, subjectId, responderRole, JSON.stringify(answers), rating,
       comment ? trustDigest(comment) : null, sharedIdentifier ? trustDigest(sharedIdentifier) : null, revealAfter]
    )
    const submission = submissionResult.rows[0]
    const allResult = await client.query(`SELECT * FROM trust_reference_submissions WHERE relationship_id = $1 ORDER BY submitted_at`, [relationship.id])
    const all = allResult.rows
    const reveal = all.length >= 2 || all.some((item) => new Date(item.reveal_after).getTime() <= Date.now())
    let scoringDeferredCode: string | null = null
    if (reveal) {
      await client.query(`UPDATE trust_reference_submissions SET reveal_state = 'PUBLISHED', revealed_at = NOW() WHERE relationship_id = $1 AND reveal_state = 'SEALED'`, [relationship.id])
      scoringDeferredCode = await deferredAutomatedScoringCode(client)
      if (!scoringDeferredCode) {
        await upsertReferenceGraphEdges(
          client,
          relationship.id,
          all as GraphReferenceSubmission[],
        )
      }
    }
    await emitOutbox(client, 'reference_submission', submission.id, 'BilateralReferenceSubmitted', {
      relationship_id: relationship.id,
      reveal_state: reveal ? 'PUBLISHED' : 'SEALED',
      scoring_deferred: Boolean(scoringDeferredCode),
      ...(scoringDeferredCode ? { scoring_deferred_code: scoringDeferredCode } : {}),
    }, trace)
    await appendAudit(
      client,
      responderId,
      'reference.submit_blind',
      'relationship',
      relationship.id,
      'bilateral_reference',
      'allowed',
      Object.keys(answers),
      trace,
      {
        scoring_deferred: Boolean(scoringDeferredCode),
        ...(scoringDeferredCode ? { scoring_deferred_code: scoringDeferredCode } : {}),
      },
    )
    return {
      submissionId: submission.id,
      revealState: reveal ? 'PUBLISHED' : 'SEALED',
      bothSubmitted: all.length >= 2,
      scoringDeferred: Boolean(scoringDeferredCode),
      ...(scoringDeferredCode ? { scoringDeferredCode } : {}),
    }
  })
}

export async function calculateGraphTrust(userId: string) {
  await requireApprovedComplianceGate('automated_scoring')

  const edges = await query<{ trust_value: string | number; current_weight: string | number; activated_at: Date | string }>(
    `SELECT trust_value, current_weight, activated_at FROM trust_graph_edges
      WHERE to_user_id = $1 AND state = 'ACTIVE' AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  )
  if (edges.length === 0) return { trustValue: 50, confidence: 0.15, evidenceCount: 0, interval: [25, 75] }
  let weighted = 0
  let totalWeight = 0
  for (const edge of edges) {
    const ageDays = Math.max(0, (Date.now() - new Date(edge.activated_at).getTime()) / 86_400_000)
    const decay = Math.exp(-ageDays / 730)
    const weight = Number(edge.current_weight) * decay
    weighted += Number(edge.trust_value) * weight
    totalWeight += weight
  }
  const trustValue = totalWeight ? weighted / totalWeight : 50
  const confidence = Math.min(0.95, 0.15 + Math.sqrt(edges.length) * 0.18)
  const margin = 25 * (1 - confidence)
  return {
    trustValue: Math.round(trustValue * 100) / 100,
    confidence: Math.round(confidence * 1000) / 1000,
    evidenceCount: edges.length,
    interval: [Math.max(0, trustValue - margin), Math.min(100, trustValue + margin)].map((value) => Math.round(value * 100) / 100),
  }
}

export async function generateTransactionRecommendations(transactionId: string, actorId: string, trace: RequestTrace = {}) {
  await requireApprovedComplianceGate('automated_scoring')

  const context = await queryOne<Record<string, unknown>>(`SELECT * FROM trust_transaction_contexts WHERE id = $1`, [transactionId])
  if (!context) throw new Error('TRUST_TRANSACTION_NOT_FOUND')
  if (![context.landlord_id, context.tenant_id, context.realtor_id].includes(actorId)) throw new Error('TRUST_TRANSACTION_FORBIDDEN')

  const subjects = [
    { type: 'tenant' as TrustSubjectType, id: context.tenant_id as string | null },
    { type: 'landlord' as TrustSubjectType, id: context.landlord_id as string | null },
    { type: 'property' as TrustSubjectType, id: context.property_id as string | null },
  ].filter((subject): subject is { type: TrustSubjectType; id: string } => Boolean(subject.id))
  const scores: Array<{ type: TrustSubjectType; id: string; score: number; confidence: number; derivedNodeId: string }> = []
  for (const subject of subjects) {
    let run = await queryOne<{ score: string | number; confidence: string | number; derived_node_id: string }>(
      `SELECT score, confidence, derived_node_id FROM trust_score_runs
        WHERE subject_type = $1 AND subject_id = $2 AND status = 'PUBLISHED'
        ORDER BY created_at DESC LIMIT 1`,
      [subject.type, subject.id]
    )
    if (!run) run = await calculateTrustScore(subject.type, subject.id, actorId, trace)
    if (!run) throw new Error('TRUST_SCORE_RUN_NOT_CREATED')
    scores.push({ type: subject.type, id: subject.id, score: Number(run.score), confidence: Number(run.confidence), derivedNodeId: run.derived_node_id })
  }

  const mismatchVector: Record<string, unknown> = {}
  const recommendations: Array<{ type: string; value: Record<string, unknown>; reasonCodes: string[]; dependencies: string[] }> = []
  for (const score of scores) {
    if (score.confidence < 0.6) {
      mismatchVector[`${score.type}_confidence`] = score.confidence
      recommendations.push({ type: 'additional_evidence', value: { subject_type: score.type, action: 'request_current_evidence' }, reasonCodes: ['LOW_DATA_CONFIDENCE'], dependencies: [score.derivedNodeId] })
    }
    if (score.type === 'property' && score.score < 65) {
      mismatchVector.property_safety = score.score
      recommendations.push({ type: 'insurance_check', value: { action: 'verify_guarantee_eligibility' }, reasonCodes: ['PROPERTY_SAFETY_REVIEW'], dependencies: [score.derivedNodeId] })
      recommendations.push({ type: 'deposit_review', value: { action: 'review_deposit_exposure' }, reasonCodes: ['DEPOSIT_RISK_REVIEW'], dependencies: [score.derivedNodeId] })
    }
    if (score.score < 50) {
      mismatchVector[`${score.type}_trust`] = score.score
      recommendations.push({ type: 'human_review', value: { subject_type: score.type, action: 'manual_assessment' }, reasonCodes: ['TRUST_REVIEW_REQUIRED'], dependencies: [score.derivedNodeId] })
    }
  }
  if (recommendations.length === 0) {
    recommendations.push({ type: 'standard_checklist', value: { action: 'continue_with_standard_contract_checks' }, reasonCodes: ['NO_HIGH_RISK_SIGNAL'], dependencies: scores.map((score) => score.derivedNodeId) })
  }
  const evidenceHash = trustDigest({ transactionId, scores, mismatchVector, recommendations })

  return transaction(async (client) => {
    await requireApprovedComplianceGate('automated_scoring', client)

    const runResult = await client.query(
      `INSERT INTO trust_match_runs (transaction_id, model_version, mismatch_vector, result_snapshot, evidence_hash)
       VALUES ($1, 'condition-engine-1.0', $2, $3, $4) RETURNING *`,
      [transactionId, JSON.stringify(mismatchVector), JSON.stringify(recommendations), evidenceHash]
    )
    const matchRun = runResult.rows[0]
    const created = []
    for (const recommendation of recommendations) {
      const snapshot = { type: recommendation.type, value: recommendation.value, reason_codes: recommendation.reasonCodes }
      const derivedResult = await client.query(
        `INSERT INTO trust_derived_nodes
          (object_type, transaction_id, output_snapshot, reproduction_hash, model_version)
         VALUES ('recommendation', $1, $2, $3, 'condition-engine-1.0') RETURNING id`,
        [transactionId, JSON.stringify(snapshot), trustDigest({ evidenceHash, snapshot })]
      )
      const derivedId = derivedResult.rows[0].id
      const itemResult = await client.query(
        `INSERT INTO trust_condition_recommendations
          (match_run_id, derived_node_id, transaction_id, recommendation_type, value, reason_codes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [matchRun.id, derivedId, transactionId, recommendation.type, JSON.stringify(recommendation.value), recommendation.reasonCodes]
      )
      for (const dependency of recommendation.dependencies) {
        await client.query(
          `INSERT INTO trust_dependency_edges
            (from_node_type, from_node_id, to_node_type, to_node_id, dependency_type, created_by_run)
           VALUES ('derived', $1, 'derived', $2, 'required', $3) ON CONFLICT DO NOTHING`,
          [dependency, derivedId, matchRun.id]
        )
      }
      created.push(itemResult.rows[0])
    }
    await emitOutbox(client, 'match_run', matchRun.id, 'ConditionRecommendationsGenerated', { transaction_id: transactionId, count: created.length }, trace)
    return { matchRun, recommendations: created, mismatchVector }
  })
}

export async function getTrustReport(userId: string) {
  const graphResultPromise = calculateGraphTrust(userId)
    .then((graph) => ({ graph, deferredCode: null as string | null }))
    .catch((error: unknown) => {
      if (!isComplianceGateError(error)) throw error
      return { graph: null, deferredCode: error.code }
    })
  const [scores, facts, transactions, reviews, disclosures, audit, graphResult] = await Promise.all([
    query(`SELECT subject_type, subject_id, score, band, confidence, model_version, reason_codes, missing_fields, created_at FROM trust_score_runs WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]),
    query(`SELECT id, field_name, status, quality, reason_codes, valid_until, created_at FROM trust_fact_nodes WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]),
    query(`SELECT * FROM trust_transaction_contexts WHERE landlord_id = $1 OR tenant_id = $1 OR realtor_id = $1 ORDER BY created_at DESC LIMIT 30`, [userId]),
    query(`SELECT id, target_type, target_id, review_type, reason, status, decision, created_at FROM trust_review_tasks WHERE requester_id = $1 ORDER BY created_at DESC LIMIT 30`, [userId]),
    query(`SELECT id, subject_type, subject_id, recipient_id, transaction_id, policy_version, claims, state, expires_at, created_at FROM trust_disclosure_packages WHERE subject_id = $1 OR recipient_id = $1 ORDER BY created_at DESC LIMIT 30`, [userId]),
    query(`SELECT action, target_type, target_id, purpose, result, fields, occurred_at FROM trust_audit_events WHERE actor_id = $1 OR target_id = $1 ORDER BY occurred_at DESC LIMIT 50`, [userId]),
    graphResultPromise,
  ])
  return {
    scores,
    facts,
    transactions,
    reviews,
    disclosures,
    audit,
    graph: graphResult.graph,
    scoringDeferred: Boolean(graphResult.deferredCode),
    graphDeferred: Boolean(graphResult.deferredCode),
    deferredCode: graphResult.deferredCode,
  }
}

interface ExtractionJobInput {
  documentId?: string | null
  subjectType: TrustSubjectType
  subjectId: string
  propertyId?: string | null
  sourceCode: string
  consentId?: string | null
  storageRef: string
  inputChecksum: string
  documentType: string
  engineVersion?: string
  metadata?: Record<string, unknown>
}

export async function createExtractionJob(input: ExtractionJobInput, actorId: string, trace: RequestTrace = {}) {
  const engineVersion = input.engineVersion?.trim() || 'manual-review-1.0'
  const usesProductionOcr = engineVersion !== 'manual-review-1.0'
  if (usesProductionOcr) {
    await requireApprovedComplianceGate('production_ocr')
  }

  return transaction(async (client) => {
    if (usesProductionOcr) {
      await requireApprovedComplianceGate('production_ocr', client)
    }
    const sourceResult = await client.query(`SELECT id, status FROM trust_source_registry WHERE code = $1`, [input.sourceCode])
    const source = sourceResult.rows[0]
    if (!source || source.status !== 'active') throw new Error('TRUST_SOURCE_UNAVAILABLE')
    const result = await client.query(
      `INSERT INTO trust_extraction_jobs
        (document_id, owner_user_id, subject_type, subject_id, property_id, source_id, consent_id,
         storage_ref, input_checksum, document_type, engine_version, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (owner_user_id, input_checksum, document_type)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [input.documentId ?? null, actorId, input.subjectType, input.subjectId, input.propertyId ?? null,
       source.id, input.consentId ?? null, input.storageRef, input.inputChecksum, input.documentType,
       engineVersion, JSON.stringify(input.metadata ?? {})]
    )
    const job = result.rows[0]
    await emitOutbox(client, 'extraction_job', job.id, 'DocumentUploaded', { document_type: input.documentType, source_code: input.sourceCode }, trace)
    await appendAudit(client, actorId, 'extraction.request', 'extraction_job', job.id, 'document_verification', 'allowed', [], trace)
    return job
  })
}

interface ExtractedFieldInput {
  fieldName: string
  rawValue?: unknown
  normalizedValue: unknown
  confidence: number
  pageRef?: string | null
  reasonCodes?: string[]
}

export async function completeExtractionJob(
  jobId: string,
  reviewerId: string,
  fields: ExtractedFieldInput[],
  trace: RequestTrace = {},
) {
  const job = await queryOne<Record<string, unknown> & { source_code: string }>(
    `SELECT job.*, source.code AS source_code
       FROM trust_extraction_jobs job
       JOIN trust_source_registry source ON source.id = job.source_id
      WHERE job.id = $1`,
    [jobId]
  )
  if (!job) throw new Error('TRUST_EXTRACTION_JOB_NOT_FOUND')
  if (job.status === 'completed') throw new Error('TRUST_EXTRACTION_ALREADY_COMPLETED')
  await query(`UPDATE trust_extraction_jobs SET status = 'extracting', attempt = attempt + 1, started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1`, [jobId])

  const facts: Array<{ id: string } & Record<string, unknown>> = []
  try {
    for (const field of fields) {
      await query(
        `INSERT INTO trust_extracted_fields
          (extraction_job_id, field_name, raw_value, normalized_value, confidence, page_ref, status, reviewer_id, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'accepted', $7, NOW())
         ON CONFLICT (extraction_job_id, field_name) DO UPDATE
           SET raw_value = EXCLUDED.raw_value, normalized_value = EXCLUDED.normalized_value,
               confidence = EXCLUDED.confidence, page_ref = EXCLUDED.page_ref,
               status = 'accepted', reviewer_id = EXCLUDED.reviewer_id, reviewed_at = NOW()`,
        [jobId, field.fieldName, JSON.stringify(field.rawValue ?? null), JSON.stringify(field.normalizedValue), field.confidence, field.pageRef ?? null, reviewerId]
      )
      const created = await createEvidenceFact({
        subjectType: job.subject_type as TrustSubjectType,
        subjectId: String(job.subject_id),
        propertyId: job.property_id ? String(job.property_id) : null,
        sourceCode: job.source_code,
        fieldName: field.fieldName,
        normalizedValue: field.normalizedValue,
        objectHash: trustDigest({ input_checksum: job.input_checksum, field: field.fieldName, value: field.normalizedValue }),
        storageRef: String(job.storage_ref),
        consentId: job.consent_id ? String(job.consent_id) : null,
        extractionConfidence: field.confidence,
        humanReviewed: true,
        reasonCodes: [...(field.reasonCodes ?? []), 'HUMAN_REVIEWED'],
        metadata: { extraction_job_id: jobId, page_ref: field.pageRef ?? null },
      }, reviewerId, trace)
      facts.push(created.fact)
    }
    await query(`UPDATE trust_extraction_jobs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [jobId])
    await transaction(async (client) => {
      await emitOutbox(client, 'extraction_job', jobId, 'DocumentExtracted', { fact_ids: facts.map((fact) => fact.id) }, trace)
    })
    return { jobId, facts }
  } catch (error) {
    await query(`UPDATE trust_extraction_jobs SET status = 'failed', error_code = 'EXTRACTION_FINALIZE_FAILED', error_detail = $2, updated_at = NOW() WHERE id = $1`, [jobId, error instanceof Error ? error.message : 'unknown'])
    throw error
  }
}

export async function updateTrustTransaction(
  transactionId: string,
  actorId: string,
  nextStage: TransactionStage,
  requirements: Record<string, unknown> | undefined,
  terms: Record<string, unknown> | undefined,
  trace: RequestTrace = {},
) {
  return transaction(async (client) => {
    const result = await client.query(`SELECT * FROM trust_transaction_contexts WHERE id = $1 FOR UPDATE`, [transactionId])
    const context = result.rows[0]
    if (!context) throw new Error('TRUST_TRANSACTION_NOT_FOUND')
    if (![context.landlord_id, context.tenant_id, context.realtor_id].includes(actorId)) throw new Error('TRUST_TRANSACTION_FORBIDDEN')
    if (!canTransitionTransaction(context.stage, nextStage)) throw new Error('TRUST_TRANSACTION_STAGE_INVALID')

    const updatedResult = await client.query(
      `UPDATE trust_transaction_contexts
          SET stage = $2,
              status = CASE WHEN $2 = 'cancelled' THEN 'cancelled' WHEN $2 = 'completed' THEN 'completed' ELSE status END,
              requirements = COALESCE($3::jsonb, requirements),
              terms = COALESCE($4::jsonb, terms),
              updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [transactionId, nextStage, requirements ? JSON.stringify(requirements) : null, terms ? JSON.stringify(terms) : null]
    )
    const packagesResult = await client.query(
      `UPDATE trust_disclosure_packages
          SET state = 'REVOKED', revoked_at = NOW(), revoke_reason = 'transaction_stage_changed'
        WHERE transaction_id = $1 AND state = 'ISSUED'
        RETURNING id, derived_node_id`,
      [transactionId]
    )
    for (const item of packagesResult.rows) {
      await client.query(`UPDATE trust_derived_nodes SET state = 'REVOKED' WHERE id = $1`, [item.derived_node_id])
      await emitOutbox(client, 'disclosure', item.id, 'DisclosureRevoked', { reason: 'transaction_stage_changed', previous_stage: context.stage, next_stage: nextStage }, trace)
    }
    await emitOutbox(client, 'transaction', transactionId, 'TransactionStageChanged', { previous_stage: context.stage, next_stage: nextStage, revoked_disclosures: packagesResult.rowCount }, trace)
    await appendAudit(client, actorId, 'transaction.stage', 'transaction', transactionId, 'lease_progress', 'allowed', ['stage'], trace, { previous_stage: context.stage, next_stage: nextStage })
    return { transaction: updatedResult.rows[0], revokedDisclosures: packagesResult.rowCount }
  })
}

export async function revokeDisclosurePackage(disclosureId: string, actorId: string, reason: string, trace: RequestTrace = {}) {
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT package.*, consent.user_id AS subject_owner_id
         FROM trust_disclosure_packages package
         JOIN data_consents consent ON consent.id = package.consent_id
        WHERE package.id = $1 FOR UPDATE`,
      [disclosureId]
    )
    const disclosure = result.rows[0]
    if (!disclosure) throw new Error('DISCLOSURE_NOT_FOUND')
    if (![disclosure.recipient_id, disclosure.subject_owner_id].includes(actorId)) throw new Error('DISCLOSURE_REVOKE_FORBIDDEN')
    await client.query(`UPDATE trust_disclosure_packages SET state = 'REVOKED', revoked_at = NOW(), revoke_reason = $2 WHERE id = $1`, [disclosureId, reason])
    await client.query(`UPDATE trust_derived_nodes SET state = 'REVOKED' WHERE id = $1`, [disclosure.derived_node_id])
    await emitOutbox(client, 'disclosure', disclosureId, 'DisclosureRevoked', { reason, transaction_id: disclosure.transaction_id }, trace)
    await appendAudit(client, actorId, 'disclosure.revoke', 'disclosure', disclosureId, 'privacy_control', 'allowed', [], trace, { reason })
    return { id: disclosureId, state: 'REVOKED' }
  })
}

export async function runTrustMaintenance(trace: RequestTrace = {}) {
  const expiredEvidence = await query<{ id: string }>(
    `UPDATE trust_evidence_nodes SET state = 'EXPIRED', updated_at = NOW()
      WHERE id IN (
        SELECT id FROM trust_evidence_nodes WHERE state = 'VALID' AND valid_until <= NOW() ORDER BY valid_until LIMIT 50
      ) RETURNING id`
  )
  const cascades = []
  for (const evidence of expiredEvidence) {
    cascades.push(await cascadeTrustChange('evidence', evidence.id, 'expired', null, 'evidence_expired', trace))
  }

  const expiredDisclosures = await query<{ id: string; derived_node_id: string }>(
    `UPDATE trust_disclosure_packages SET state = 'EXPIRED', revoked_at = NOW(), revoke_reason = 'expired'
      WHERE state = 'ISSUED' AND expires_at <= NOW()
      RETURNING id, derived_node_id`
  )
  if (expiredDisclosures.length > 0) {
    await query(`UPDATE trust_derived_nodes SET state = 'REVOKED' WHERE id = ANY($1::uuid[])`, [expiredDisclosures.map((item) => item.derived_node_id)])
  }

  const releasedReferenceResult = await transaction(async (client) => {
    const due = await client.query(
      `UPDATE trust_reference_submissions SET reveal_state = 'PUBLISHED', revealed_at = NOW()
        WHERE reveal_state = 'SEALED' AND reveal_after <= NOW()
        RETURNING *`
    )
    const missingEdgesResult = await client.query<GraphReferenceSubmission & { relationship_id: string }>(
      `SELECT submission.*
         FROM trust_reference_submissions submission
         LEFT JOIN trust_graph_edges edge
           ON edge.reference_submission_id = submission.id
        WHERE submission.reveal_state = 'PUBLISHED'
          AND edge.id IS NULL
        ORDER BY submission.submitted_at, submission.id
        LIMIT 100
        FOR UPDATE OF submission SKIP LOCKED`
    )
    let scoringDeferredCode: string | null = null
    let referenceEdgesBackfilled = 0
    if (missingEdgesResult.rows.length > 0) {
      scoringDeferredCode = await deferredAutomatedScoringCode(client)
      if (!scoringDeferredCode) {
        const candidatesByRelationship = new Map<string, GraphReferenceSubmission[]>()
        for (const item of missingEdgesResult.rows) {
          const candidates = candidatesByRelationship.get(item.relationship_id) ?? []
          candidates.push(item)
          candidatesByRelationship.set(item.relationship_id, candidates)
        }
        for (const [relationshipId, candidates] of candidatesByRelationship) {
          const allResult = await client.query<GraphReferenceSubmission>(
            `SELECT id, responder_id, subject_id, rating, shared_identifier_hash
               FROM trust_reference_submissions
              WHERE relationship_id = $1
                AND reveal_state = 'PUBLISHED'
              ORDER BY submitted_at, id`,
            [relationshipId],
          )
          referenceEdgesBackfilled += await upsertReferenceGraphEdges(
            client,
            relationshipId,
            allResult.rows,
            candidates,
          )
        }
      }
    }
    const backfillCandidateIds = new Set(
      missingEdgesResult.rows.map((item) => item.id),
    )
    for (const item of due.rows) {
      const backfillPending =
        !scoringDeferredCode && !backfillCandidateIds.has(item.id)
      const itemDeferredCode = scoringDeferredCode
        ?? (backfillPending ? 'SCORING_BACKFILL_PENDING' : null)
      await emitOutbox(client, 'reference_submission', item.id, 'BilateralReferenceReleased', {
        reason: 'reveal_deadline',
        scoring_deferred: Boolean(itemDeferredCode),
        ...(itemDeferredCode ? { scoring_deferred_code: itemDeferredCode } : {}),
      }, trace)
    }
    const pendingResult = await client.query<{ pending_count: number | string }>(
      `SELECT COUNT(*)::int AS pending_count
         FROM trust_reference_submissions submission
         LEFT JOIN trust_graph_edges edge
           ON edge.reference_submission_id = submission.id
        WHERE submission.reveal_state = 'PUBLISHED'
          AND edge.id IS NULL`
    )
    const referenceScoringPending = Number(
      pendingResult.rows[0]?.pending_count ?? 0,
    )
    return {
      count: due.rowCount ?? 0,
      scoringDeferredCode,
      referenceEdgesBackfilled,
      referenceScoringPending,
    }
  })

  const retentionQueued = await query(
    `INSERT INTO trust_retention_actions (target_type, target_id, policy_code, action, scheduled_at)
     SELECT 'evidence', evidence.id, 'source-retention-v1', 'storage_delete', NOW()
       FROM trust_evidence_nodes evidence
       JOIN trust_source_registry source ON source.id = evidence.source_id
      WHERE evidence.state IN ('EXPIRED', 'REPLACED', 'DELETED')
        AND evidence.updated_at + make_interval(days => source.retention_days) <= NOW()
     ON CONFLICT DO NOTHING
     RETURNING id`
  )

  return {
    expiredEvidence: expiredEvidence.length,
    cascades: cascades.length,
    expiredDisclosures: expiredDisclosures.length,
    releasedReferences: releasedReferenceResult.count,
    referenceEdgesBackfilled: releasedReferenceResult.referenceEdgesBackfilled,
    referenceScoringPending: releasedReferenceResult.referenceScoringPending,
    referenceScoringDeferred: Boolean(
      releasedReferenceResult.scoringDeferredCode ||
      releasedReferenceResult.referenceScoringPending > 0
    ),
    ...(releasedReferenceResult.scoringDeferredCode
      ? { referenceScoringDeferredCode: releasedReferenceResult.scoringDeferredCode }
      : {}),
    retentionQueued: retentionQueued.length,
  }
}

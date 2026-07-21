export interface VerificationSourceCandidate {
  code: string
  status: string
  allowed_fields: string[]
  reliability: number | string
  estimated_cost: number | string
  expected_latency_ms: number
  privacy_risk: number | string
}

export interface VerificationPathWeights {
  reliability?: number
  cost?: number
  latency?: number
  privacy?: number
}

export function rankVerificationSources(
  sources: VerificationSourceCandidate[],
  requiredFields: string[],
  maxPrivacyRisk = 1,
  weights: VerificationPathWeights = {},
) {
  const factor = {
    reliability: weights.reliability ?? 0.45,
    cost: weights.cost ?? 0.15,
    latency: weights.latency ?? 0.15,
    privacy: weights.privacy ?? 0.25,
  }
  const active = sources.filter((source) => {
    const privacyRisk = Number(source.privacy_risk)
    const coversFields = source.allowed_fields.length === 0
      || requiredFields.every((field) => source.allowed_fields.includes(field))
    return source.status === 'active' && privacyRisk <= maxPrivacyRisk && coversFields
  })
  const maxCost = Math.max(...active.map((source) => Number(source.estimated_cost)), 1)
  const maxLatency = Math.max(...active.map((source) => source.expected_latency_ms), 1)

  return active.map((source) => {
    const reliability = Number(source.reliability)
    const privacyRisk = Number(source.privacy_risk)
    const normalizedCost = Number(source.estimated_cost) / maxCost
    const normalizedLatency = source.expected_latency_ms / maxLatency
    const utility = reliability * factor.reliability
      + (1 - normalizedCost) * factor.cost
      + (1 - normalizedLatency) * factor.latency
      + (1 - privacyRisk) * factor.privacy
    return {
      ...source,
      utility: Math.round(utility * 10_000) / 10_000,
      reasonCodes: [
        reliability >= 0.8 ? 'HIGH_SOURCE_RELIABILITY' : 'STANDARD_SOURCE_RELIABILITY',
        privacyRisk <= 0.3 ? 'LOW_PRIVACY_EXPOSURE' : 'PRIVACY_REVIEW_REQUIRED',
        normalizedCost <= 0.5 ? 'LOWER_RELATIVE_COST' : 'HIGHER_RELATIVE_COST',
      ],
    }
  }).sort((a, b) => b.utility - a.utility || a.code.localeCompare(b.code))
}

const TRANSACTION_TRANSITIONS: Record<string, string[]> = {
  S0: ['S1'],
  S1: ['S2', 'S0'],
  S2: ['S3', 'S0'],
  S3: ['S4', 'S0'],
  S4: ['S5', 'S0'],
  S5: ['S6', 'S0'],
  S6: ['S7', 'S0'],
  S7: ['S8', 'S0'],
  S8: [],
}

export type TransactionStage = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8'
export type TransactionStageInput = TransactionStage
  | 'pre_application'
  | 'application'
  | 'negotiation'
  | 'contract'
  | 'completed'
  | 'cancelled'

const LEGACY_STAGE_MAP: Record<string, TransactionStage> = {
  pre_application: 'S0',
  application: 'S1',
  negotiation: 'S2',
  contract: 'S3',
  completed: 'S8',
  cancelled: 'S0',
}

const REVERSE_LEGACY_STAGE_MAP: Record<TransactionStage, string> = {
  S0: 'pre_application',
  S1: 'application',
  S2: 'negotiation',
  S3: 'contract',
  S4: 'contract',
  S5: 'contract',
  S6: 'contract',
  S7: 'completed',
  S8: 'completed',
}

function getNormalizedTransactionStageOrNull(stage: string): TransactionStage | null {
  if (isTransactionStage(stage)) return stage
  const mapped = LEGACY_STAGE_MAP[stage]
  return mapped ?? null
}

function isTransactionStage(stage: string): stage is TransactionStage {
  return ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].includes(stage)
}

export function normalizeTransactionStage(stage: string): TransactionStage {
  const normalized = getNormalizedTransactionStageOrNull(stage)
  if (!normalized) {
    throw new Error(`TRUST_TRANSACTION_STAGE_INVALID:${stage}`)
  }
  return normalized
}

export function normalizeTransactionStageCandidates(stage: string): string[] {
  const normalized = getNormalizedTransactionStageOrNull(stage)
  if (!normalized) return [stage]
  const legacy = REVERSE_LEGACY_STAGE_MAP[normalized]
  return legacy ? [normalized, legacy] : [normalized]
}

export function isRollbackStage(from: string, to: string): boolean {
  const normalizedFrom = getNormalizedTransactionStageOrNull(from)
  const normalizedTo = getNormalizedTransactionStageOrNull(to)
  if (!normalizedFrom || !normalizedTo) return false
  return normalizedTo === 'S0' && normalizedFrom !== 'S0'
}

export function isTransactionStageInput(stage: string): stage is TransactionStageInput {
  return isTransactionStage(stage) || Object.keys(LEGACY_STAGE_MAP).includes(stage)
}

export function canTransitionTransaction(current: string, next: string): boolean {
  const normalizedCurrent = getNormalizedTransactionStageOrNull(current)
  const normalizedNext = getNormalizedTransactionStageOrNull(next)
  if (!normalizedCurrent || !normalizedNext) return false
  if (normalizedCurrent === normalizedNext) return true
  return (TRANSACTION_TRANSITIONS[normalizedCurrent] ?? []).includes(normalizedNext)
}

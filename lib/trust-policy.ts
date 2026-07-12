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
  pre_application: ['application', 'cancelled'],
  application: ['negotiation', 'cancelled'],
  negotiation: ['contract', 'cancelled'],
  contract: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function canTransitionTransaction(current: string, next: string): boolean {
  return TRANSACTION_TRANSITIONS[current]?.includes(next) ?? false
}


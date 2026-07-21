import { describe, expect, it } from 'vitest'
import {
  canTransitionTransaction,
  normalizeTransactionStage,
  rankVerificationSources,
} from '../trust-policy'

describe('trust policy', () => {
  it('allows only forward transaction transitions and cancellation', () => {
    expect(canTransitionTransaction('pre_application', 'application')).toBe(true)
    expect(canTransitionTransaction('S0', 'S1')).toBe(true)
    expect(canTransitionTransaction('application', 'S4')).toBe(false)
    expect(canTransitionTransaction('completed', 'cancelled')).toBe(false)
  })

  it('normalizes legacy and machine stages safely', () => {
    expect(normalizeTransactionStage('pre_application')).toBe('S0')
    expect(normalizeTransactionStage('S5')).toBe('S5')
    expect(() => normalizeTransactionStage('invalid')).toThrowError('TRUST_TRANSACTION_STAGE_INVALID')
  })

  it('excludes sources that exceed privacy limits or cannot provide requested fields', () => {
    const ranked = rankVerificationSources([
      { code: 'safe', status: 'active', allowed_fields: ['employment'], reliability: 0.9, estimated_cost: 100, expected_latency_ms: 500, privacy_risk: 0.2 },
      { code: 'risky', status: 'active', allowed_fields: ['employment'], reliability: 0.99, estimated_cost: 10, expected_latency_ms: 50, privacy_risk: 0.9 },
      { code: 'wrong-field', status: 'active', allowed_fields: ['credit'], reliability: 1, estimated_cost: 0, expected_latency_ms: 0, privacy_risk: 0 },
    ], ['employment'], 0.5)
    expect(ranked.map((source) => source.code)).toEqual(['safe'])
  })

  it('prefers reliable low-exposure sources when costs are comparable', () => {
    const ranked = rankVerificationSources([
      { code: 'manual', status: 'active', allowed_fields: [], reliability: 0.7, estimated_cost: 100, expected_latency_ms: 1000, privacy_risk: 0.3 },
      { code: 'official', status: 'active', allowed_fields: [], reliability: 0.95, estimated_cost: 100, expected_latency_ms: 1000, privacy_risk: 0.1 },
    ], ['owner_matched'])
    expect(ranked[0].code).toBe('official')
    expect(ranked[0].utility).toBeGreaterThan(ranked[1].utility)
  })
})

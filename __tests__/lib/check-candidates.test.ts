import { describe, expect, it } from 'vitest'
import { CHECKLIST, decodeCandidates, encodeCandidates, type CheckCandidate } from '@/lib/check-candidates'
const candidate: CheckCandidate = { id: 'local-1', label: '후보 1', savedAt: '2026-10-09T00:00:00Z', input: { marketPriceManwon: 40000, depositManwon: 30000, mortgageMaxManwon: 0, priorDepositsManwon: 0 }, checked: CHECKLIST.map(() => false) }
describe('local candidate persistence', () => {
  it('round-trips only allowed fields and preserves checklist', () => {
    const value = { ...candidate, checked: [true, false, false, false], extra: 'discard' }
    expect(decodeCandidates(encodeCandidates([value]))).toEqual([{ ...candidate, checked: value.checked }])
    expect(decodeCandidates(null)).toEqual([])
  })
  it.each(['{', JSON.stringify({ version: 2, items: [] }), JSON.stringify({ version: 1, items: [null] }), JSON.stringify({ version: 1, items: [{ ...candidate, input: { ...candidate.input, marketPriceManwon: 0 } }] }), JSON.stringify({ version: 1, items: [{ ...candidate, checked: ['yes'] }] })])('rejects corrupt/unknown data without replacing it', raw => {
    expect(() => decodeCandidates(raw)).toThrow()
  })
  it('rejects duplicate ids and more than five homes', () => {
    expect(() => encodeCandidates([candidate, candidate])).toThrow()
    expect(() => encodeCandidates(Array.from({ length: 6 }, (_, i) => ({ ...candidate, id: String(i) })))).toThrow()
  })
})

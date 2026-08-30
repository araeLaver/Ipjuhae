import { describe, expect, it } from 'vitest'
import { SAMPLE_COMPLEXES, SAMPLE_SOURCE_AS_OF, SAMPLE_TRANSACTIONS } from '@/fixtures/rental-risk-sample'
import { createRentalRiskBrief, evaluateMatchingQuality, matchComplex } from '@/lib/rental-risk'

const baseInput = {
  address: '서울 강남구 대치동 316',
  complexName: '은마아파트',
  areaM2: 84.43,
  depositManwon: 56500,
  monthlyRentManwon: 0,
}

describe('rental risk brief', () => {
  it('creates a reproducible exact-match brief with five user metrics', () => {
    const brief = createRentalRiskBrief({
      input: baseInput,
      complexes: SAMPLE_COMPLEXES,
      transactions: SAMPLE_TRANSACTIONS,
      sourceAsOf: SAMPLE_SOURCE_AS_OF,
    })

    expect(brief.match).toMatchObject({ complexId: '11680-0001', grade: 'exact' })
    expect(brief.comparison).toMatchObject({ scope: 'complex_area', periodMonths: 12, sampleCount: 12 })
    expect(brief.metrics.pricePosition.depositPercentile).toBeGreaterThanOrEqual(40)
    expect(brief.metrics.pricePosition.depositPercentile).toBeLessThanOrEqual(60)
    expect(Object.keys(brief.metrics)).toHaveLength(5)
    expect(brief.limitations[0]).toContain('사기')
  })

  it('matches normalized road address and historical alias', () => {
    const match = matchComplex({ ...baseInput, address: '서울 강남구 삼성로 212', complexName: '대치 은마아파트' }, SAMPLE_COMPLEXES)
    expect(match).toMatchObject({ grade: 'alias', complex: { complexId: '11680-0001' } })
  })

  it('returns safe signals instead of a risk verdict for an ambiguous sparse input', () => {
    const brief = createRentalRiskBrief({
      input: { ...baseInput, address: '서울 강남구 없는로 1', complexName: '미확인 단지', depositManwon: 90000 },
      complexes: SAMPLE_COMPLEXES,
      transactions: SAMPLE_TRANSACTIONS,
      sourceAsOf: SAMPLE_SOURCE_AS_OF,
    })
    expect(brief.match.grade).toBe('insufficient')
    expect(brief.signals).toContain('주소·단지 자동 매칭 불충분: 단지 선택 확인 필요')
    expect(JSON.stringify(brief)).not.toContain('사기 위험')
  })

  it('computes explicit precision and coverage Go criteria', () => {
    const quality = evaluateMatchingQuality([
      { expectedComplexId: 'a', matchedComplexId: 'a' },
      { expectedComplexId: 'b', matchedComplexId: 'b' },
      { expectedComplexId: null, matchedComplexId: null },
    ])
    expect(quality).toEqual({ precision: 1, coverage: 1, go: true })
  })
})

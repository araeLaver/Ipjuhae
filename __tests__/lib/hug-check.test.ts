import { describe, expect, it } from 'vitest'
import { calculateHugEligibility } from '@/lib/hug-check'

describe('calculateHugEligibility', () => {
  it('공시가격 126% 룰 안쪽이고 선순위 없으면 가입 가능성 높음(likely)을 반환한다', () => {
    const res = calculateHugEligibility({
      basis: 'official_price',
      region: 'metro',
      basePriceManwon: 20000, // 인정주택가격 28,000 / 126% 한도 25,200
      depositManwon: 20000,
      seniorDebtManwon: 0,
    })
    expect(res.verdict).toBe('likely')
    expect(res.recognizedHousePriceManwon).toBe(28000)
    expect(res.maxTotalLimitManwon).toBe(25200)
    expect(res.maxEligibleDepositManwon).toBe(25200)
    expect(res.officialPriceMultiple).toBeCloseTo(1.0)
  })

  it('공시가격 126% 한도를 넘으면 한도 초과(ineligible)와 안전 최대 보증금을 반환한다', () => {
    const res = calculateHugEligibility({
      basis: 'official_price',
      region: 'metro',
      basePriceManwon: 20000, // 126% 한도 25,200
      depositManwon: 26000,
      seniorDebtManwon: 2000,
    })
    expect(res.verdict).toBe('ineligible')
    expect(res.maxEligibleDepositManwon).toBe(23200)
    expect(res.reasons.some((r) => r.includes('126%'))).toBe(true)
  })

  it('비수도권 5억원 한도를 초과하면 ineligible을 반환한다', () => {
    const res = calculateHugEligibility({
      basis: 'market_price',
      region: 'non_metro',
      basePriceManwon: 80000,
      depositManwon: 55000,
      seniorDebtManwon: 0,
    })
    expect(res.verdict).toBe('ineligible')
    expect(res.regionCapManwon).toBe(50000)
    expect(res.maxEligibleDepositManwon).toBe(50000)
  })
})

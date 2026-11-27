import { describe, it, expect } from 'vitest'
import { parseRegistryText as webParseRegistry } from '@/lib/registry-parser'
import { parseRegistryText as mobileParseRegistry } from '@/mobile/src/lib/registryParser'
import { calculateHugEligibility as webHug } from '@/lib/hug-check'
import { calculateHugEligibility as mobileHug } from '@/mobile/src/lib/hugCheck'
import { buildSpecialTerms as webTerms } from '@/lib/special-terms'
import { buildSpecialTerms as mobileTerms } from '@/mobile/src/lib/specialTerms'

describe('Mobile growth tools parity with web', () => {
  it('parses registry mortgage & risk flags identically to web', () => {
    const sample = [
      '갑구 3번 압류 대한민국',
      '을구 1번 근저당권설정 채권최고액 금 120,000,000원',
      '을구 2번 근저당권말소 채권최고액 금 50,000,000원',
    ].join('\n')

    const web = webParseRegistry(sample)
    const mobile = mobileParseRegistry(sample)
    expect(mobile.mortgageMaxManwon).toBe(12000)
    expect(mobile.mortgageMaxManwon).toBe(web.mortgageMaxManwon)
    expect(mobile.flags.map((f) => f.code)).toEqual(web.flags.map((f) => f.code))
  })

  it('computes HUG 126% verdict identically to web', () => {
    const input = {
      basis: 'official_price' as const,
      basePriceManwon: 20000,
      depositManwon: 24000,
      seniorDebtManwon: 3000,
      region: 'metro' as const,
    }
    const web = webHug(input)
    const mobile = mobileHug(input)
    expect(mobile.verdict).toBe('ineligible')
    expect(mobile.verdict).toBe(web.verdict)
    expect(mobile.maxTotalLimitManwon).toBe(web.maxTotalLimitManwon)
    expect(mobile.maxEligibleDepositManwon).toBe(web.maxEligibleDepositManwon)
  })

  it('generates identical special terms and polite broker message', () => {
    const input = {
      hasMortgage: true,
      hasPriorTenants: true,
      needsJeonseLoan: true,
      needsInsurance: true,
      hasPet: false,
      needsRepairCheck: true,
    }
    const web = webTerms(input)
    const mobile = mobileTerms(input)
    expect(mobile.items.map((i) => i.id)).toEqual(web.items.map((i) => i.id))
    expect(mobile.politeMessage).toBe(web.politeMessage)
  })
})

import { describe, expect, it } from 'vitest'
import {
  normalizeAiRegistryPayload,
  parseKoreanAmountToManwon,
  parseRegistryText,
} from '@/lib/registry-parser'

describe('parseKoreanAmountToManwon', () => {
  it('한국어 금액 표기(원·만원·억원)를 만원 정수로 정확히 변환한다', () => {
    expect(parseKoreanAmountToManwon('금 180,000,000원')).toBe(18000)
    expect(parseKoreanAmountToManwon('금1억2,000만원')).toBe(12000)
    expect(parseKoreanAmountToManwon('2억원')).toBe(20000)
    expect(parseKoreanAmountToManwon('8,500만원')).toBe(8500)
    expect(parseKoreanAmountToManwon('')).toBeNull()
  })
})

describe('parseRegistryText', () => {
  it('을구 근저당 채권최고액 합계와 갑구·을구 핵심 위험 신호를 정확히 추출한다', () => {
    const sample = `
      [갑구]
      1 소유권이전 신탁등기 수탁자 한국토지신탁
      2 가압류 채권자 ○○캐피탈
      [을구]
      1 근저당권설정 채권최고액 금 120,000,000원
      2 근저당권설정 채권최고액 금 1억 2,000만원
      3 근저당권설정 채권최고액 금 50,000,000원 말소
    `
    const res = parseRegistryText(sample)
    expect(res.mortgageEntriesManwon).toEqual([12000, 12000])
    expect(res.mortgageMaxManwon).toBe(24000)
    expect(res.flags.map((f) => f.code)).toContain('trust')
    expect(res.flags.map((f) => f.code)).toContain('provisional_seizure')
    expect(res.notes.some((n) => n.includes('말소·해지'))).toBe(true)
  })

  it('AI 응답 JSON을 안전하게 정규화한다', () => {
    const normalized = normalizeAiRegistryPayload({
      mortgageEntriesManwon: [15000, 3000],
      flagCodes: ['auction', 'unknown_code', 'lease_registration'],
    })
    expect(normalized.mortgageMaxManwon).toBe(18000)
    expect(normalized.flags.map((f) => f.code)).toEqual(['auction', 'lease_registration'])
  })
})

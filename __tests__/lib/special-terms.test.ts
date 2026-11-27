import { describe, expect, it } from 'vitest'
import { buildSpecialTerms } from '@/lib/special-terms'

describe('buildSpecialTerms', () => {
  it('근저당·다가구·보증보험·전세대출 조건에 맞는 필수 특약과 요청 문자를 생성한다', () => {
    const bundle = buildSpecialTerms({
      hasMortgage: true,
      hasPriorTenants: true,
      needsJeonseLoan: true,
      needsInsurance: true,
      hasPet: true,
      needsRepairCheck: true,
    })
    const ids = bundle.items.map((i) => i.id)
    expect(ids).toEqual([
      'no-rights-change',
      'tax-clearance',
      'mortgage-release',
      'prior-tenants-disclosure',
      'hug-insurance',
      'jeonse-loan',
      'repair-and-wear',
      'pet-agreement',
    ])
    expect(bundle.contractText).toContain('근저당권 전액 말소')
    expect(bundle.politeMessage).toContain('안녕하세요!')
  })

  it('근저당과 선순위가 없으면 해당 특약은 제외한다', () => {
    const bundle = buildSpecialTerms({
      hasMortgage: false,
      hasPriorTenants: false,
      needsJeonseLoan: false,
      needsInsurance: true,
      hasPet: false,
      needsRepairCheck: false,
    })
    const ids = bundle.items.map((i) => i.id)
    expect(ids).not.toContain('mortgage-release')
    expect(ids).not.toContain('prior-tenants-disclosure')
    expect(ids).toContain('hug-insurance')
  })
})

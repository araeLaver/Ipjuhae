import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const targetFiles = [
  'app/profile/[id]/page.tsx',
  'app/profile/page.tsx',
  'app/profile/verification/page.tsx',
  'app/landlord/tenants/page.tsx',
  'components/landlord/TenantCard.tsx',
  'components/profile/trust-score-chart.tsx',
  'components/verification/verification-badge.tsx',
  'components/verification/verification-card.tsx',
  'components/verification/verification-card-with-upload.tsx',
  'app/api/verifications/credit/route.ts',
]

const trustCopyTargetFiles = [
  'app/layout.tsx',
  'app/verify-phone/layout.tsx',
  'app/reference/survey/layout.tsx',
  'app/reference/survey/[token]/page.tsx',
  'app/profile/reference/layout.tsx',
  'app/profile/layout.tsx',
  'app/landlord/tenants/[id]/page.tsx',
  'components/landlord/TenantSearchFilters.tsx',
  'components/landlord/tenant-filter.tsx',
  'components/landing/hero.tsx',
  'components/landing/features-section.tsx',
]

const disallowedPhrases = [
  '신용평가',
  '확정 승인',
  '중개 확정',
  '신용등급을 조회',
  '신용 등급:',
]

const legacyTrustScoreLabel = ['신뢰', '점수'].join('')
const legacySpacedTrustScoreLabel = ['신뢰', ' 점수'].join('')

describe('개인정보 및 신뢰지표 문구 회귀', () => {
  it('주요 프로필/검증 화면에 오해 소지가 큰 신용 확인 문구를 쓰지 않는다', () => {
    const violations = targetFiles.flatMap((file) => {
      const content = readFileSync(join(process.cwd(), file), 'utf8')
      return disallowedPhrases
        .filter((phrase) => content.includes(phrase))
        .map((phrase) => `${file}: ${phrase}`)
    })

    expect(violations).toEqual([])
  })

  it('공개 프로필 점수 카드는 완화된 라벨을 사용한다', () => {
    const content = readFileSync(join(process.cwd(), 'app/profile/[id]/page.tsx'), 'utf8')

    expect(content).toContain('<CardTitle className="text-base">프로필 요약 점수</CardTitle>')
    expect(content).not.toContain(`<CardTitle className="text-base">${legacyTrustScoreLabel}</CardTitle>`)
  })

  it('metadata와 부가 화면에도 기존 직접 점수 표현을 노출하지 않는다', () => {
    const violations = trustCopyTargetFiles.flatMap((file) => {
      const content = readFileSync(join(process.cwd(), file), 'utf8')
      return [legacyTrustScoreLabel, legacySpacedTrustScoreLabel]
        .filter((phrase) => content.includes(phrase))
        .map((phrase) => `${file}: ${phrase}`)
    })

    expect(violations).toEqual([])
  })
})

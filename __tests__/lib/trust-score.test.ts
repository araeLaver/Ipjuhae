import { describe, it, expect } from 'vitest'
import {
  calculateTrustScore,
  getTrustScoreLevel,
  getTrustScoreLabel,
  getTrustScoreColor,
} from '@/lib/trust-score'
import { Profile, Verification, ReferenceResponse } from '@/types/database'

describe('calculateTrustScore', () => {
  const mockDate = new Date()

  const baseProfile: Profile = {
    id: '1',
    user_id: 'user1',
    name: '홍길동',
    age_range: '30대',
    family_type: '1인',
    pets: ['없음'],
    smoking: false,
    stay_time: '저녁',
    duration: '1년',
    noise_level: '보통',
    bio: '안녕하세요',
    intro: '자기소개',
    trust_score: 0,
    is_complete: true,
    created_at: mockDate,
    updated_at: mockDate,
  }

  const baseVerification: Verification = {
    id: '1',
    user_id: 'user1',
    employment_verified: false,
    employment_company: null,
    employment_verified_at: null,
    income_verified: false,
    income_range: null,
    income_verified_at: null,
    credit_verified: false,
    credit_grade: null,
    credit_verified_at: null,
    created_at: mockDate,
    updated_at: mockDate,
  }

  const createReferenceResponse = (
    avgScore: number,
    wouldRecommend: boolean
  ): ReferenceResponse => ({
    id: '1',
    reference_id: 'ref1',
    rent_payment: avgScore,
    property_condition: avgScore,
    neighbor_issues: avgScore,
    checkout_condition: avgScore,
    would_recommend: wouldRecommend,
    comment: null,
    overall_rating: null,
    created_at: mockDate,
  })

  describe('프로필 점수 (20점)', () => {
    it('완성된 프로필은 20점', () => {
      const result = calculateTrustScore({ profile: baseProfile })
      expect(result.profile).toBe(20)
    })

    it('미완성 프로필은 0점', () => {
      const incompleteProfile = { ...baseProfile, is_complete: false }
      const result = calculateTrustScore({ profile: incompleteProfile })
      expect(result.profile).toBe(0)
    })

    it('프로필 없으면 0점', () => {
      const result = calculateTrustScore({})
      expect(result.profile).toBe(0)
    })
  })

  describe('재직 인증 점수 (25점)', () => {
    it('재직 인증 완료시 25점', () => {
      const verification = { ...baseVerification, employment_verified: true }
      const result = calculateTrustScore({ verification })
      expect(result.employment).toBe(25)
    })

    it('재직 인증 미완료시 0점', () => {
      const result = calculateTrustScore({ verification: baseVerification })
      expect(result.employment).toBe(0)
    })
  })

  describe('소득 인증 점수 (25점)', () => {
    it('소득 인증 완료시 25점', () => {
      const verification = { ...baseVerification, income_verified: true }
      const result = calculateTrustScore({ verification })
      expect(result.income).toBe(25)
    })

    it('소득 인증 미완료시 0점', () => {
      const result = calculateTrustScore({ verification: baseVerification })
      expect(result.income).toBe(0)
    })
  })

  describe('신용 인증 점수 (10-20점)', () => {
    it('신용 등급 1등급(최우량)은 20점', () => {
      const verification = {
        ...baseVerification,
        credit_verified: true,
        credit_grade: 1,
      }
      const result = calculateTrustScore({ verification })
      expect(result.credit).toBe(20)
    })

    it('신용 등급 2등급(양호)은 15점', () => {
      const verification = {
        ...baseVerification,
        credit_verified: true,
        credit_grade: 2,
      }
      const result = calculateTrustScore({ verification })
      expect(result.credit).toBe(15)
    })

    it('신용 등급 3등급(보통)은 10점', () => {
      const verification = {
        ...baseVerification,
        credit_verified: true,
        credit_grade: 3,
      }
      const result = calculateTrustScore({ verification })
      expect(result.credit).toBe(10)
    })

    it('신용 인증 미완료시 0점', () => {
      const result = calculateTrustScore({ verification: baseVerification })
      expect(result.credit).toBe(0)
    })

    it('신용 인증 완료했지만 등급 없으면 0점', () => {
      const verification = {
        ...baseVerification,
        credit_verified: true,
        credit_grade: null,
      }
      const result = calculateTrustScore({ verification })
      expect(result.credit).toBe(0)
    })
  })

  describe('레퍼런스 점수', () => {
    it('긍정적 레퍼런스(평균 3.5+, 추천)는 +30점', () => {
      const referenceResponses = [createReferenceResponse(4, true)]
      const result = calculateTrustScore({ referenceResponses })
      expect(result.reference).toBe(30)
    })

    it('부정적 레퍼런스(비추천)는 -20점', () => {
      const referenceResponses = [createReferenceResponse(4, false)]
      const result = calculateTrustScore({ referenceResponses })
      expect(result.reference).toBe(-20)
    })

    it('부정적 레퍼런스(평균 2.5 미만)는 -20점', () => {
      const referenceResponses = [createReferenceResponse(2, true)]
      const result = calculateTrustScore({ referenceResponses })
      expect(result.reference).toBe(-20)
    })

    it('중립적 레퍼런스(평균 2.5-3.5, 비추천 아님)는 0점', () => {
      const referenceResponses = [createReferenceResponse(3, true)]
      const result = calculateTrustScore({ referenceResponses })
      expect(result.reference).toBe(0)
    })

    it('복수 레퍼런스 점수 합산', () => {
      const referenceResponses = [
        createReferenceResponse(4, true), // +30
        createReferenceResponse(4, true), // +30
      ]
      const result = calculateTrustScore({ referenceResponses })
      expect(result.reference).toBe(60)
    })

    it('긍정/부정 레퍼런스 혼합', () => {
      const referenceResponses = [
        createReferenceResponse(4, true), // +30
        createReferenceResponse(2, false), // -20
      ]
      const result = calculateTrustScore({ referenceResponses })
      expect(result.reference).toBe(10)
    })
  })

  describe('총점 계산', () => {
    it('모든 항목 완료시 최대 점수', () => {
      const verification = {
        ...baseVerification,
        employment_verified: true,
        income_verified: true,
        credit_verified: true,
        credit_grade: 1,
      }
      const referenceResponses = [createReferenceResponse(4, true)]

      const result = calculateTrustScore({
        profile: baseProfile,
        verification,
        referenceResponses,
      })

      // 20 + 25 + 25 + 20 + 30 = 120
      expect(result.total).toBe(120)
    })

    it('아무 인증 없으면 0점', () => {
      const result = calculateTrustScore({})
      expect(result.total).toBe(0)
    })

    it('총점은 0 미만으로 내려가지 않음', () => {
      const referenceResponses = [
        createReferenceResponse(1, false), // -20
        createReferenceResponse(1, false), // -20
        createReferenceResponse(1, false), // -20
      ]
      const result = calculateTrustScore({ referenceResponses })
      expect(result.total).toBe(0)
      expect(result.reference).toBe(-60) // 내부적으로는 -60
    })
  })
})

describe('getTrustScoreLevel', () => {
  it('80점 이상은 excellent', () => {
    expect(getTrustScoreLevel(80)).toBe('excellent')
    expect(getTrustScoreLevel(100)).toBe('excellent')
  })

  it('50-79점은 good', () => {
    expect(getTrustScoreLevel(50)).toBe('good')
    expect(getTrustScoreLevel(79)).toBe('good')
  })

  it('20-49점은 fair', () => {
    expect(getTrustScoreLevel(20)).toBe('fair')
    expect(getTrustScoreLevel(49)).toBe('fair')
  })

  it('20점 미만은 low', () => {
    expect(getTrustScoreLevel(19)).toBe('low')
    expect(getTrustScoreLevel(0)).toBe('low')
  })
})

describe('getTrustScoreLabel', () => {
  it('excellent은 우수', () => {
    expect(getTrustScoreLabel(80)).toBe('우수')
  })

  it('good은 양호', () => {
    expect(getTrustScoreLabel(50)).toBe('양호')
  })

  it('fair는 보통', () => {
    expect(getTrustScoreLabel(20)).toBe('보통')
  })

  it('low는 시작', () => {
    expect(getTrustScoreLabel(0)).toBe('시작')
  })
})

describe('getTrustScoreColor', () => {
  it('excellent은 bg-green-500', () => {
    expect(getTrustScoreColor(80)).toBe('bg-green-500')
  })

  it('good은 bg-blue-500', () => {
    expect(getTrustScoreColor(50)).toBe('bg-blue-500')
  })

  it('fair는 bg-yellow-500', () => {
    expect(getTrustScoreColor(20)).toBe('bg-yellow-500')
  })

  it('low는 bg-gray-400', () => {
    expect(getTrustScoreColor(0)).toBe('bg-gray-400')
  })
})

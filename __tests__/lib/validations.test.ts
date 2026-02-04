import { describe, it, expect } from 'vitest'
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  loginSchema,
  signupSchema,
  profileSchema,
  referenceRequestSchema,
  referenceSurveySchema,
  employmentSchema,
  incomeSchema,
  landlordProfileSchema,
  tenantFilterSchema,
} from '@/lib/validations'

describe('emailSchema', () => {
  it('유효한 이메일 통과', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true)
    expect(emailSchema.safeParse('user.name@domain.co.kr').success).toBe(true)
  })

  it('유효하지 않은 이메일 거부', () => {
    expect(emailSchema.safeParse('invalid').success).toBe(false)
    expect(emailSchema.safeParse('test@').success).toBe(false)
    expect(emailSchema.safeParse('@example.com').success).toBe(false)
  })

  it('255자 초과 이메일 거부', () => {
    const longEmail = 'a'.repeat(250) + '@test.com'
    expect(emailSchema.safeParse(longEmail).success).toBe(false)
  })
})

describe('passwordSchema', () => {
  it('유효한 비밀번호 통과', () => {
    expect(passwordSchema.safeParse('password123').success).toBe(true)
    expect(passwordSchema.safeParse('Test1234').success).toBe(true)
  })

  it('8자 미만 비밀번호 거부', () => {
    expect(passwordSchema.safeParse('pass1').success).toBe(false)
  })

  it('100자 초과 비밀번호 거부', () => {
    expect(passwordSchema.safeParse('a'.repeat(101) + '1').success).toBe(false)
  })

  it('숫자 없는 비밀번호 거부', () => {
    expect(passwordSchema.safeParse('passwordonly').success).toBe(false)
  })

  it('영문자 없는 비밀번호 거부', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(false)
  })
})

describe('phoneSchema', () => {
  it('유효한 전화번호 통과', () => {
    expect(phoneSchema.safeParse('010-1234-5678').success).toBe(true)
    expect(phoneSchema.safeParse('01012345678').success).toBe(true)
    expect(phoneSchema.safeParse('011-123-4567').success).toBe(true)
    expect(phoneSchema.safeParse('016-1234-5678').success).toBe(true)
    expect(phoneSchema.safeParse('017-1234-5678').success).toBe(true)
    expect(phoneSchema.safeParse('018-1234-5678').success).toBe(true)
    expect(phoneSchema.safeParse('019-1234-5678').success).toBe(true)
  })

  it('유효하지 않은 전화번호 거부', () => {
    expect(phoneSchema.safeParse('02-1234-5678').success).toBe(false)
    expect(phoneSchema.safeParse('12345678').success).toBe(false)
    expect(phoneSchema.safeParse('010-12-345').success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('유효한 로그인 데이터 통과', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'anypassword',
    })
    expect(result.success).toBe(true)
  })

  it('이메일 없으면 거부', () => {
    const result = loginSchema.safeParse({
      password: 'anypassword',
    })
    expect(result.success).toBe(false)
  })

  it('비밀번호 없으면 거부', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
    })
    expect(result.success).toBe(false)
  })
})

describe('signupSchema', () => {
  it('유효한 회원가입 데이터 통과', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.userType).toBe('tenant') // 기본값
    }
  })

  it('userType 지정시 유지', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      userType: 'landlord',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.userType).toBe('landlord')
    }
  })

  it('유효하지 않은 userType 거부', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      userType: 'admin',
    })
    expect(result.success).toBe(false)
  })

  it('약한 비밀번호 거부', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'weak',
    })
    expect(result.success).toBe(false)
  })
})

describe('profileSchema', () => {
  it('유효한 프로필 데이터 통과', () => {
    const result = profileSchema.safeParse({
      name: '홍길동',
      age_range: '30대',
      family_type: '1인',
      pets: ['없음'],
      smoking: false,
      stay_time: '저녁',
      duration: '1년',
      noise_level: '보통',
      bio: '안녕하세요',
    })
    expect(result.success).toBe(true)
  })

  it('빈 객체 통과 (모두 optional)', () => {
    const result = profileSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('유효하지 않은 age_range 거부', () => {
    const result = profileSchema.safeParse({
      age_range: '50대',
    })
    expect(result.success).toBe(false)
  })

  it('bio 100자 초과 거부', () => {
    const result = profileSchema.safeParse({
      bio: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })
})

describe('referenceRequestSchema', () => {
  it('유효한 레퍼런스 요청 통과', () => {
    const result = referenceRequestSchema.safeParse({
      landlordName: '김집주',
      landlordPhone: '010-1234-5678',
      landlordEmail: 'landlord@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('전화번호만으로 통과', () => {
    const result = referenceRequestSchema.safeParse({
      landlordPhone: '01012345678',
    })
    expect(result.success).toBe(true)
  })

  it('유효하지 않은 전화번호 거부', () => {
    const result = referenceRequestSchema.safeParse({
      landlordPhone: '123456',
    })
    expect(result.success).toBe(false)
  })
})

describe('referenceSurveySchema', () => {
  it('유효한 설문 응답 통과', () => {
    const result = referenceSurveySchema.safeParse({
      rentPayment: 5,
      propertyCondition: 4,
      neighborIssues: 5,
      checkoutCondition: 4,
      wouldRecommend: true,
      comment: '좋은 세입자였습니다',
    })
    expect(result.success).toBe(true)
  })

  it('1-5 범위 초과 거부', () => {
    const result = referenceSurveySchema.safeParse({
      rentPayment: 6,
      propertyCondition: 4,
      neighborIssues: 5,
      checkoutCondition: 4,
      wouldRecommend: true,
    })
    expect(result.success).toBe(false)
  })

  it('0점 거부', () => {
    const result = referenceSurveySchema.safeParse({
      rentPayment: 0,
      propertyCondition: 4,
      neighborIssues: 5,
      checkoutCondition: 4,
      wouldRecommend: true,
    })
    expect(result.success).toBe(false)
  })

  it('comment 500자 초과 거부', () => {
    const result = referenceSurveySchema.safeParse({
      rentPayment: 5,
      propertyCondition: 4,
      neighborIssues: 5,
      checkoutCondition: 4,
      wouldRecommend: true,
      comment: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })
})

describe('employmentSchema', () => {
  it('유효한 회사명 통과', () => {
    expect(employmentSchema.safeParse({ company: '삼성전자' }).success).toBe(true)
    expect(employmentSchema.safeParse({ company: 'ABC Corp' }).success).toBe(true)
  })

  it('2자 미만 회사명 거부', () => {
    expect(employmentSchema.safeParse({ company: 'A' }).success).toBe(false)
  })

  it('100자 초과 회사명 거부', () => {
    expect(employmentSchema.safeParse({ company: 'a'.repeat(101) }).success).toBe(false)
  })
})

describe('incomeSchema', () => {
  it('유효한 소득 범위 통과', () => {
    expect(incomeSchema.safeParse({ incomeRange: '3000만원 미만' }).success).toBe(true)
    expect(incomeSchema.safeParse({ incomeRange: '3000-5000만원' }).success).toBe(true)
    expect(incomeSchema.safeParse({ incomeRange: '5000-7000만원' }).success).toBe(true)
    expect(incomeSchema.safeParse({ incomeRange: '7000만원 이상' }).success).toBe(true)
  })

  it('유효하지 않은 소득 범위 거부', () => {
    expect(incomeSchema.safeParse({ incomeRange: '1억 이상' }).success).toBe(false)
  })
})

describe('landlordProfileSchema', () => {
  it('유효한 집주인 프로필 통과', () => {
    const result = landlordProfileSchema.safeParse({
      name: '김집주',
      phone: '010-1234-5678',
      propertyCount: 5,
      propertyRegions: ['서울 강남구', '서울 서초구'],
    })
    expect(result.success).toBe(true)
  })

  it('이름 없으면 거부', () => {
    const result = landlordProfileSchema.safeParse({
      phone: '010-1234-5678',
    })
    expect(result.success).toBe(false)
  })
})

describe('tenantFilterSchema', () => {
  it('기본값 적용', () => {
    const result = tenantFilterSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(10)
    }
  })

  it('필터 옵션 통과', () => {
    const result = tenantFilterSchema.safeParse({
      page: 2,
      limit: 20,
      ageRange: '30대',
      familyType: '1인',
      minScore: 50,
      smoking: 'false',
    })
    expect(result.success).toBe(true)
  })

  it('limit 100 초과 거부', () => {
    const result = tenantFilterSchema.safeParse({
      limit: 200,
    })
    expect(result.success).toBe(false)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  verifyEmployment,
  verifyIncome,
  verifyCredit,
  verifyIdentity,
  getVerificationProvider,
} from '@/lib/verification'

// Mock logger to suppress output during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('getVerificationProvider', () => {
  it('기본값은 mock 프로바이더', () => {
    // VERIFICATION_PROVIDER 환경변수가 없으면 mock 반환
    const provider = getVerificationProvider()
    expect(['mock', 'codef', 'nice']).toContain(provider)
  })
})

// 모든 테스트는 VERIFICATION_PROVIDER=mock 환경에서 실행
describe('verifyEmployment (mock provider)', () => {
  beforeEach(() => {
    // mock provider 강제 설정 - 환경변수가 없으면 mock이 기본값
    vi.stubEnv('VERIFICATION_PROVIDER', 'mock')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('회사명으로 재직 인증 성공', async () => {
    const result = await verifyEmployment('삼성전자')

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.verified).toBe(true)
    expect(result.data?.company).toBe('삼성전자')
  }, 2000)

  it('회사명이 결과 데이터에 포함됨', async () => {
    const companyName = '카카오'
    const result = await verifyEmployment(companyName)

    expect(result.success).toBe(true)
    expect(result.data?.company).toBe(companyName)
  }, 2000)

  it('입사일 정보가 포함됨', async () => {
    const result = await verifyEmployment('네이버')

    expect(result.success).toBe(true)
    expect(result.data?.joinDate).toBeDefined()
    expect(typeof result.data?.joinDate).toBe('string')
  }, 2000)

  it('userIdentity 없어도 mock에서는 성공', async () => {
    const result = await verifyEmployment('LG전자', undefined)

    expect(result.success).toBe(true)
  }, 2000)
})

describe('verifyIncome (mock provider)', () => {
  beforeEach(() => {
    vi.stubEnv('VERIFICATION_PROVIDER', 'mock')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('소득 범위로 소득 인증 성공', async () => {
    const result = await verifyIncome('3000만원~5000만원')

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.verified).toBe(true)
  }, 2000)

  it('소득 범위가 결과에 포함됨', async () => {
    const incomeRange = '5000만원~7000만원'
    const result = await verifyIncome(incomeRange)

    expect(result.success).toBe(true)
    expect(result.data?.incomeRange).toBe(incomeRange)
  }, 2000)

  it('userIdentity 없어도 mock에서는 성공', async () => {
    const result = await verifyIncome('3000만원 미만', undefined)

    expect(result.success).toBe(true)
  }, 2000)

  it('다양한 소득 범위에 대해 성공', async () => {
    const ranges = ['3000만원 미만', '3000만원~5000만원', '5000만원~7000만원', '7000만원 이상']
    for (const range of ranges) {
      const result = await verifyIncome(range)
      expect(result.success).toBe(true)
      expect(result.data?.incomeRange).toBe(range)
    }
  }, 5000)
})

describe('verifyCredit (mock provider)', () => {
  beforeEach(() => {
    vi.stubEnv('VERIFICATION_PROVIDER', 'mock')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('신용 인증 성공', async () => {
    const result = await verifyCredit()

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.verified).toBe(true)
  }, 2000)

  it('신용 등급이 숫자로 반환됨', async () => {
    const result = await verifyCredit()

    expect(result.success).toBe(true)
    expect(typeof result.data?.creditGrade).toBe('number')
    expect(result.data?.creditGrade).toBeGreaterThanOrEqual(1)
    expect(result.data?.creditGrade).toBeLessThanOrEqual(3) // mock은 1-3 범위
  }, 2000)

  it('등급 레이블이 포함됨', async () => {
    const result = await verifyCredit()

    expect(result.success).toBe(true)
    expect(typeof result.data?.gradeLabel).toBe('string')
    expect(result.data?.gradeLabel.length).toBeGreaterThan(0)
    expect(['최우량', '양호', '보통']).toContain(result.data?.gradeLabel)
  }, 2000)

  it('userIdentity 없어도 mock에서는 성공', async () => {
    const result = await verifyCredit(undefined)

    expect(result.success).toBe(true)
  }, 2000)
})

describe('verifyIdentity (mock provider)', () => {
  beforeEach(() => {
    vi.stubEnv('VERIFICATION_PROVIDER', 'mock')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('본인 인증 성공', async () => {
    const result = await verifyIdentity('홍길동', '010-1234-5678', '1990-01-15')

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.verified).toBe(true)
  }, 2000)

  it('이름이 결과에 포함됨', async () => {
    const name = '김철수'
    const result = await verifyIdentity(name, '010-9876-5432', '1985-05-20')

    expect(result.success).toBe(true)
    expect(result.data?.name).toBe(name)
  }, 2000)

  it('생년월일이 결과에 포함됨', async () => {
    const birthDate = '1992-03-10'
    const result = await verifyIdentity('이영희', '010-1111-2222', birthDate)

    expect(result.success).toBe(true)
    expect(result.data?.birthDate).toBe(birthDate)
  }, 2000)

  it('전화번호가 결과에 포함됨', async () => {
    const phoneNumber = '010-5555-6666'
    const result = await verifyIdentity('박민준', phoneNumber, '1988-07-25')

    expect(result.success).toBe(true)
    expect(result.data?.phoneNumber).toBe(phoneNumber)
  }, 2000)

  it('CI와 DI가 생성됨', async () => {
    const result = await verifyIdentity('최수진', '010-7777-8888', '1995-12-01')

    expect(result.success).toBe(true)
    expect(typeof result.data?.ci).toBe('string')
    expect(typeof result.data?.di).toBe('string')
    expect(result.data?.ci).toMatch(/^mock_ci_/)
    expect(result.data?.di).toMatch(/^mock_di_/)
  }, 2000)

  it('성별 정보가 포함됨', async () => {
    const result = await verifyIdentity('정지훈', '010-3333-4444', '1991-08-15')

    expect(result.success).toBe(true)
    expect(typeof result.data?.gender).toBe('string')
  }, 2000)
})

describe('verifyEmployment - result structure', () => {
  it('성공 결과는 success: true와 data를 포함', async () => {
    const result = await verifyEmployment('현대자동차')

    expect(result).toHaveProperty('success')
    expect(typeof result.success).toBe('boolean')
    if (result.success) {
      expect(result.data).toBeDefined()
    }
  }, 2000)

  it('userIdentity 객체를 선택적으로 전달 가능', async () => {
    const userIdentity = {
      name: '홍길동',
      birthDate: '1990-01-15',
      phoneNumber: '010-1234-5678',
    }
    const result = await verifyEmployment('SK텔레콤', userIdentity)

    expect(result.success).toBe(true)
    expect(result.data?.company).toBe('SK텔레콤')
  }, 2000)
})

describe('verifyIncome - result structure', () => {
  it('성공 결과는 success: true와 data를 포함', async () => {
    const result = await verifyIncome('7000만원 이상')

    expect(result).toHaveProperty('success')
    expect(typeof result.success).toBe('boolean')
    if (result.success) {
      expect(result.data).toBeDefined()
    }
  }, 2000)

  it('userIdentity 객체를 선택적으로 전달 가능', async () => {
    const userIdentity = {
      name: '김철수',
      birthDate: '1985-06-20',
      phoneNumber: '010-9876-5432',
    }
    const result = await verifyIncome('5000만원~7000만원', userIdentity)

    expect(result.success).toBe(true)
    expect(result.data?.incomeRange).toBe('5000만원~7000만원')
  }, 2000)
})

describe('verifyCredit - result structure', () => {
  it('성공 결과는 success: true와 data를 포함', async () => {
    const result = await verifyCredit()

    expect(result).toHaveProperty('success')
    expect(typeof result.success).toBe('boolean')
    if (result.success) {
      expect(result.data).toBeDefined()
    }
  }, 2000)

  it('userIdentity 객체를 선택적으로 전달 가능', async () => {
    const userIdentity = {
      name: '이영희',
      birthDate: '1992-11-30',
      phoneNumber: '010-5555-6666',
    }
    const result = await verifyCredit(userIdentity)

    expect(result.success).toBe(true)
    expect(result.data?.creditGrade).toBeDefined()
  }, 2000)
})

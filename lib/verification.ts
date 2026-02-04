/**
 * 인증 API 연동 모듈
 *
 * 지원 프로바이더:
 * - mock: 개발/테스트용
 * - codef: CODEF API (재직/소득 인증)
 * - nice: NICE평가정보 (본인인증, 신용정보)
 *
 * 환경변수:
 * - VERIFICATION_PROVIDER: 'mock' | 'codef' | 'nice' (기본: mock)
 * - CODEF_CLIENT_ID: CODEF 클라이언트 ID
 * - CODEF_CLIENT_SECRET: CODEF 클라이언트 시크릿
 * - CODEF_PUBLIC_KEY: CODEF 공개키 (RSA 암호화용)
 * - NICE_CLIENT_ID: NICE 클라이언트 ID
 * - NICE_CLIENT_SECRET: NICE 클라이언트 시크릿
 */

import { logger } from './logger'
import crypto from 'crypto'

// 타입 정의
interface VerificationResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

interface EmploymentVerificationResult extends VerificationResult {
  data?: {
    company: string
    joinDate?: string
    department?: string
    verified: boolean
  }
}

interface IncomeVerificationResult extends VerificationResult {
  data?: {
    annualIncome?: number
    incomeRange: string
    verified: boolean
  }
}

interface CreditVerificationResult extends VerificationResult {
  data?: {
    creditScore?: number
    creditGrade: number // 1-10
    gradeLabel: string
    verified: boolean
  }
}

interface IdentityVerificationResult extends VerificationResult {
  data?: {
    name: string
    birthDate: string
    gender: string
    phoneNumber: string
    ci?: string // 연계정보(CI)
    di?: string // 중복가입확인정보(DI)
    verified: boolean
  }
}

type VerificationProvider = 'mock' | 'codef' | 'nice'

const VERIFICATION_PROVIDER = (process.env.VERIFICATION_PROVIDER as VerificationProvider) || 'mock'

// CODEF API 엔드포인트
const CODEF_API_BASE = process.env.CODEF_API_BASE || 'https://api.codef.io'
const CODEF_TOKEN_URL = `${CODEF_API_BASE}/oauth/token`

// CODEF 액세스 토큰 캐시
let codefTokenCache: { token: string; expiresAt: number } | null = null

/**
 * CODEF 액세스 토큰 발급
 */
async function getCodefToken(): Promise<string | null> {
  const clientId = process.env.CODEF_CLIENT_ID
  const clientSecret = process.env.CODEF_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    logger.error('CODEF 설정 누락')
    return null
  }

  // 캐시된 토큰이 유효하면 재사용
  if (codefTokenCache && Date.now() < codefTokenCache.expiresAt) {
    return codefTokenCache.token
  }

  try {
    const response = await fetch(CODEF_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'read',
      }),
    })

    const data = await response.json()

    if (data.access_token) {
      codefTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 만료 1분 전
      }
      return data.access_token
    }

    logger.error('CODEF 토큰 발급 실패', { error: data.error_description })
    return null
  } catch (error) {
    logger.error('CODEF 토큰 발급 오류', { error })
    return null
  }
}

/**
 * RSA 공개키로 데이터 암호화 (CODEF용)
 */
function encryptWithRSA(data: string): string {
  const publicKey = process.env.CODEF_PUBLIC_KEY
  if (!publicKey) {
    throw new Error('CODEF 공개키 누락')
  }

  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(data)
  )

  return encrypted.toString('base64')
}

// ============================================================
// Mock 구현 (개발/테스트용)
// ============================================================

async function mockEmploymentVerification(
  companyName: string
): Promise<EmploymentVerificationResult> {
  await new Promise(resolve => setTimeout(resolve, 500))
  logger.info('재직 인증 (Mock)', { company: companyName })

  return {
    success: true,
    data: {
      company: companyName,
      joinDate: '2022-03-01',
      department: '개발팀',
      verified: true,
    },
  }
}

async function mockIncomeVerification(
  incomeRange: string
): Promise<IncomeVerificationResult> {
  await new Promise(resolve => setTimeout(resolve, 500))
  logger.info('소득 인증 (Mock)', { incomeRange })

  return {
    success: true,
    data: {
      incomeRange,
      verified: true,
    },
  }
}

async function mockCreditVerification(): Promise<CreditVerificationResult> {
  await new Promise(resolve => setTimeout(resolve, 500))

  // 무작위 등급 (1-3: 높음, 4-6: 중간, 7-10: 낮음)
  const creditGrade = Math.floor(Math.random() * 3) + 1
  const gradeLabels: Record<number, string> = {
    1: '최우량',
    2: '양호',
    3: '보통',
  }

  logger.info('신용 인증 (Mock)', { creditGrade })

  return {
    success: true,
    data: {
      creditGrade,
      gradeLabel: gradeLabels[creditGrade] || '보통',
      verified: true,
    },
  }
}

async function mockIdentityVerification(
  name: string,
  phoneNumber: string,
  birthDate: string
): Promise<IdentityVerificationResult> {
  await new Promise(resolve => setTimeout(resolve, 500))
  logger.info('본인 인증 (Mock)', { name, phoneNumber: phoneNumber.slice(0, 7) + '****' })

  return {
    success: true,
    data: {
      name,
      birthDate,
      gender: 'M',
      phoneNumber,
      ci: `mock_ci_${Date.now()}`,
      di: `mock_di_${Date.now()}`,
      verified: true,
    },
  }
}

// ============================================================
// CODEF API 구현
// ============================================================

async function codefEmploymentVerification(
  companyName: string,
  userIdentity: { name: string; birthDate: string; phoneNumber: string }
): Promise<EmploymentVerificationResult> {
  const token = await getCodefToken()
  if (!token) {
    return { success: false, error: 'API 인증 실패' }
  }

  try {
    // 국민연금 가입내역 조회 API
    const response = await fetch(`${CODEF_API_BASE}/v1/kr/public/nt/national-pension/join-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        organization: '0002', // 국민연금공단
        loginType: '2', // 간편인증
        identity: encryptWithRSA(userIdentity.birthDate.replace(/-/g, '').slice(2)),
        userName: userIdentity.name,
        phoneNo: userIdentity.phoneNumber.replace(/-/g, ''),
      }),
    })

    const data = await response.json()

    if (data.result?.code === 'CF-00000') {
      const joinInfo = data.data?.resPensionJoinInfo?.[0]
      return {
        success: true,
        data: {
          company: joinInfo?.companyName || companyName,
          joinDate: joinInfo?.joinDate,
          verified: true,
        },
      }
    }

    logger.error('CODEF 재직 인증 실패', { code: data.result?.code, message: data.result?.message })
    return {
      success: false,
      error: data.result?.message || '재직 인증에 실패했습니다',
    }
  } catch (error) {
    logger.error('CODEF 재직 인증 오류', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '재직 인증 중 오류가 발생했습니다',
    }
  }
}

async function codefIncomeVerification(
  userIdentity: { name: string; birthDate: string; phoneNumber: string }
): Promise<IncomeVerificationResult> {
  const token = await getCodefToken()
  if (!token) {
    return { success: false, error: 'API 인증 실패' }
  }

  try {
    // 건강보험료 납부확인서 조회 (소득 추정)
    const response = await fetch(`${CODEF_API_BASE}/v1/kr/public/nh/health-insurance/payment-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        organization: '0011', // 국민건강보험공단
        loginType: '2',
        identity: encryptWithRSA(userIdentity.birthDate.replace(/-/g, '').slice(2)),
        userName: userIdentity.name,
        phoneNo: userIdentity.phoneNumber.replace(/-/g, ''),
      }),
    })

    const data = await response.json()

    if (data.result?.code === 'CF-00000') {
      // 건강보험료로 소득 추정 (간단한 계산)
      const monthlyPremium = parseInt(data.data?.resPremiumInfo?.premium || '0', 10)
      const estimatedAnnualIncome = monthlyPremium * 12 * 10 // 대략적인 추정

      let incomeRange: string
      if (estimatedAnnualIncome >= 100000000) incomeRange = '1억 이상'
      else if (estimatedAnnualIncome >= 70000000) incomeRange = '7000만원~1억'
      else if (estimatedAnnualIncome >= 50000000) incomeRange = '5000만원~7000만원'
      else if (estimatedAnnualIncome >= 30000000) incomeRange = '3000만원~5000만원'
      else incomeRange = '3000만원 미만'

      return {
        success: true,
        data: {
          annualIncome: estimatedAnnualIncome,
          incomeRange,
          verified: true,
        },
      }
    }

    logger.error('CODEF 소득 인증 실패', { code: data.result?.code })
    return {
      success: false,
      error: data.result?.message || '소득 인증에 실패했습니다',
    }
  } catch (error) {
    logger.error('CODEF 소득 인증 오류', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '소득 인증 중 오류가 발생했습니다',
    }
  }
}

async function codefCreditVerification(
  userIdentity: { name: string; birthDate: string; phoneNumber: string }
): Promise<CreditVerificationResult> {
  const token = await getCodefToken()
  if (!token) {
    return { success: false, error: 'API 인증 실패' }
  }

  try {
    // NICE 신용정보 조회
    const response = await fetch(`${CODEF_API_BASE}/v1/kr/credit/nice/credit-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        organization: '0001', // NICE
        loginType: '2',
        identity: encryptWithRSA(userIdentity.birthDate.replace(/-/g, '').slice(2)),
        userName: userIdentity.name,
        phoneNo: userIdentity.phoneNumber.replace(/-/g, ''),
      }),
    })

    const data = await response.json()

    if (data.result?.code === 'CF-00000') {
      const creditScore = parseInt(data.data?.creditScore || '0', 10)

      // NICE 점수 → 등급 변환 (1-10)
      let creditGrade: number
      if (creditScore >= 900) creditGrade = 1
      else if (creditScore >= 870) creditGrade = 2
      else if (creditScore >= 840) creditGrade = 3
      else if (creditScore >= 805) creditGrade = 4
      else if (creditScore >= 750) creditGrade = 5
      else if (creditScore >= 665) creditGrade = 6
      else if (creditScore >= 600) creditGrade = 7
      else if (creditScore >= 515) creditGrade = 8
      else if (creditScore >= 445) creditGrade = 9
      else creditGrade = 10

      const gradeLabels: Record<number, string> = {
        1: '최우량',
        2: '우량',
        3: '양호',
        4: '양호',
        5: '보통',
        6: '보통',
        7: '주의',
        8: '주의',
        9: '위험',
        10: '위험',
      }

      return {
        success: true,
        data: {
          creditScore,
          creditGrade,
          gradeLabel: gradeLabels[creditGrade],
          verified: true,
        },
      }
    }

    logger.error('CODEF 신용 인증 실패', { code: data.result?.code })
    return {
      success: false,
      error: data.result?.message || '신용 인증에 실패했습니다',
    }
  } catch (error) {
    logger.error('CODEF 신용 인증 오류', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '신용 인증 중 오류가 발생했습니다',
    }
  }
}

// ============================================================
// NICE 본인인증 구현
// ============================================================

async function niceIdentityVerification(
  name: string,
  phoneNumber: string,
  birthDate: string
): Promise<IdentityVerificationResult> {
  const clientId = process.env.NICE_CLIENT_ID
  const clientSecret = process.env.NICE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    logger.error('NICE 설정 누락')
    return { success: false, error: '본인인증 설정이 완료되지 않았습니다' }
  }

  try {
    // NICE 본인인증 API 호출
    // 실제 구현에서는 NICE 인증 팝업/리다이렉트 후 콜백 처리 필요
    const response = await fetch('https://nice.checkplus.co.kr/CheckPlusSafeModel/service.cb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        clientSecret,
        userName: name,
        userPhone: phoneNumber.replace(/-/g, ''),
        userBirth: birthDate.replace(/-/g, ''),
      }),
    })

    const data = await response.json()

    if (data.resultCode === '0000') {
      return {
        success: true,
        data: {
          name: data.name,
          birthDate: data.birthDate,
          gender: data.gender,
          phoneNumber: data.phoneNumber,
          ci: data.ci,
          di: data.di,
          verified: true,
        },
      }
    }

    logger.error('NICE 본인인증 실패', { code: data.resultCode })
    return {
      success: false,
      error: data.resultMessage || '본인인증에 실패했습니다',
    }
  } catch (error) {
    logger.error('NICE 본인인증 오류', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '본인인증 중 오류가 발생했습니다',
    }
  }
}

// ============================================================
// 외부 노출 함수 (프로바이더 자동 선택)
// ============================================================

/**
 * 재직 인증
 */
export async function verifyEmployment(
  companyName: string,
  userIdentity?: { name: string; birthDate: string; phoneNumber: string }
): Promise<EmploymentVerificationResult> {
  switch (VERIFICATION_PROVIDER) {
    case 'codef':
      if (!userIdentity) {
        return { success: false, error: '본인인증 정보가 필요합니다' }
      }
      return codefEmploymentVerification(companyName, userIdentity)
    default:
      return mockEmploymentVerification(companyName)
  }
}

/**
 * 소득 인증
 */
export async function verifyIncome(
  incomeRange: string,
  userIdentity?: { name: string; birthDate: string; phoneNumber: string }
): Promise<IncomeVerificationResult> {
  switch (VERIFICATION_PROVIDER) {
    case 'codef':
      if (!userIdentity) {
        return { success: false, error: '본인인증 정보가 필요합니다' }
      }
      return codefIncomeVerification(userIdentity)
    default:
      return mockIncomeVerification(incomeRange)
  }
}

/**
 * 신용 인증
 */
export async function verifyCredit(
  userIdentity?: { name: string; birthDate: string; phoneNumber: string }
): Promise<CreditVerificationResult> {
  switch (VERIFICATION_PROVIDER) {
    case 'codef':
      if (!userIdentity) {
        return { success: false, error: '본인인증 정보가 필요합니다' }
      }
      return codefCreditVerification(userIdentity)
    default:
      return mockCreditVerification()
  }
}

/**
 * 본인 인증
 */
export async function verifyIdentity(
  name: string,
  phoneNumber: string,
  birthDate: string
): Promise<IdentityVerificationResult> {
  switch (VERIFICATION_PROVIDER) {
    case 'nice':
      return niceIdentityVerification(name, phoneNumber, birthDate)
    default:
      return mockIdentityVerification(name, phoneNumber, birthDate)
  }
}

/**
 * 현재 프로바이더 확인
 */
export function getVerificationProvider(): VerificationProvider {
  return VERIFICATION_PROVIDER
}

export type AgeRange = '20대초반' | '20대후반' | '30대' | '40대이상'
export type FamilyType = '1인' | '커플' | '가족'
export type Pet = '없음' | '강아지' | '고양이' | '기타'
export type StayTime = '아침' | '저녁' | '주말만' | '거의없음'
export type Duration = '6개월' | '1년' | '2년' | '장기'
export type NoiseLevel = '조용' | '보통' | '활발'

export type AuthProvider = 'kakao' | 'naver' | 'google'
export type DocumentType = 'employment' | 'income' | 'credit'
export type DocumentStatus = 'pending' | 'processing' | 'approved' | 'rejected'

export interface User {
  id: string
  email: string
  password_hash: string | null
  name: string | null
  user_type: 'tenant' | 'landlord'
  auth_provider: AuthProvider | null
  auth_provider_id: string | null
  profile_image: string | null
  phone_number: string | null
  phone_verified: boolean
  terms_agreed_at: Date | null
  privacy_agreed_at: Date | null
  marketing_agreed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface PhoneVerification {
  id: string
  phone_number: string
  code: string
  verified: boolean
  expires_at: Date
  created_at: Date
}

export interface VerificationDocument {
  id: string
  user_id: string
  document_type: DocumentType
  file_name: string
  file_url: string | null
  status: DocumentStatus
  reject_reason: string | null
  created_at: Date
  updated_at: Date
}

export interface Profile {
  id: string
  user_id: string
  name: string
  age_range: AgeRange
  family_type: FamilyType
  pets: Pet[]
  smoking: boolean
  stay_time: StayTime | null
  duration: Duration | null
  noise_level: NoiseLevel | null
  bio: string | null
  intro: string | null
  trust_score: number
  is_complete: boolean
  created_at: Date
  updated_at: Date
}

// 사용자 타입
export type UserType = 'tenant' | 'landlord'

// 인증 정보
export interface Verification {
  id: string
  user_id: string
  employment_verified: boolean
  employment_company: string | null
  employment_verified_at: Date | null
  income_verified: boolean
  income_range: string | null
  income_verified_at: Date | null
  credit_verified: boolean
  credit_grade: number | null
  credit_verified_at: Date | null
  created_at: Date
  updated_at: Date
}

// 레퍼런스 상태
export type ReferenceStatus = 'pending' | 'sent' | 'completed' | 'expired'

// 집주인 레퍼런스
export interface LandlordReference {
  id: string
  user_id: string
  landlord_name: string | null
  landlord_phone: string
  landlord_email: string | null
  status: ReferenceStatus
  verification_token: string | null
  token_expires_at: Date | null
  request_sent_at: Date | null
  completed_at: Date | null
  created_at: Date
}

// 레퍼런스 설문 응답
export interface ReferenceResponse {
  id: string
  reference_id: string
  rent_payment: number
  property_condition: number
  neighbor_issues: number
  checkout_condition: number
  would_recommend: boolean
  comment: string | null
  overall_rating: string | null
  created_at: Date
}

// 집주인 프로필
export interface LandlordProfile {
  id: string
  user_id: string
  name: string
  phone: string | null
  property_count: number
  property_regions: string[]
  created_at: Date
  updated_at: Date
}

// 프로필 열람 기록
export interface ProfileView {
  id: string
  landlord_id: string
  profile_id: string
  viewed_at: Date
}

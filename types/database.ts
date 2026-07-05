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
  user_type: 'tenant' | 'landlord' | 'admin'
  auth_provider: AuthProvider | null
  auth_provider_id: string | null
  profile_image: string | null
  phone_number: string | null
  phone_verified: boolean
  terms_agreed_at: Date | null
  privacy_agreed_at: Date | null
  marketing_agreed_at: Date | null
  stripe_customer_id: string | null
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
  reference_score: number
  verification_score: number
  profile_score: number
  is_complete: boolean
  created_at: Date
  updated_at: Date
}

// 사용자 타입
export type UserType = 'tenant' | 'landlord' | 'admin'

export interface VerificationDocument {
  id: string
  user_id: string
  document_type: DocumentType
  file_name: string
  file_url: string | null
  status: DocumentStatus
  reject_reason: string | null
  reviewed_by: string | null
  reviewed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface AdminLog {
  id: string
  admin_id: string | null
  action: string
  target_type: 'user' | 'document' | 'profile'
  target_id: string
  detail: Record<string, unknown> | null
  created_at: Date
}

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
  // 특허 엔진: 기본 대상(요청 대상) 사용자
  subject_user_id: string
  landlord_name: string | null
  landlord_phone: string
  landlord_email: string | null
  status: ReferenceStatus
  verification_token: string | null
  token_expires_at: Date | null
  request_sent_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at?: Date | null
  subject_role?: 'tenant' | 'landlord' | null
  reference_role?: 'tenant' | 'landlord' | null
  target_property_id?: string | null
  reference_channel?: 'manual' | 'external' | 'ocr' | 'agent' | null
  consent_scope?: string[] | null
  disclosed_fields?: string[] | null
  evidence_record_id?: string | null
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

// 특허 기반 항목형 레퍼런스 항목
export type ReferenceItemCode =
  | 'rent_payment'
  | 'property_condition'
  | 'neighbor_issues'
  | 'checkout_condition'

export interface ReferenceResponseItem {
  id: string
  response_id: string
  item_code: ReferenceItemCode
  item_score: number
  item_comment: string | null
  submitted_at: Date
  updated_at: Date
}

export interface ReferenceDispute {
  id: string
  response_id: string
  response_item_id: string | null
  requester_user_id: string
  request_type: 'correction' | 'objection' | 'appeal'
  request_status: 'pending' | 'reviewing' | 'resolved' | 'rejected'
  request_reason: string
  requested_value: Record<string, unknown> | null
  resolution_note: string | null
  resolved_at: Date | null
  resolved_by: string | null
  created_at: Date
  updated_at: Date
}

export interface Consent {
  id: string
  owner_user_id: string
  viewer_user_id: string | null
  viewer_role: 'tenant' | 'landlord' | 'admin' | 'broker' | 'manager' | null
  resource_type:
    | 'profile'
    | 'reference'
    | 'property'
    | 'document'
    | 'trade_hint'
    | 'all'
  resource_id: string | null
  allowed_fields: string[]
  allowed_purposes: string[]
  can_view_contact: boolean
  valid_from: Date
  valid_until: Date | null
  revoked_at: Date | null
  metadata: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface EvidenceRecord {
  id: string
  owner_user_id: string
  uploader_user_id: string
  purpose: 'reference' | 'tenant_verification' | 'landlord_verification' | 'property_verification' | 'manual_check'
  target_type: 'profile' | 'reference' | 'property' | 'match' | 'document'
  target_id: string | null
  document_type: string
  file_name: string
  file_url: string
  file_hash: string | null
  extraction_status: 'raw_uploaded' | 'ocr_pending' | 'ocr_complete' | 'ocr_failed' | 'validated' | 'archived'
  extraction_payload: Record<string, unknown> | null
  validated_payload: Record<string, unknown> | null
  reviewed_at: Date | null
  reviewed_by: string | null
  reviewed_comment: string | null
  created_at: Date
  updated_at: Date
}

export interface ValidationValue {
  id: string
  owner_user_id: string
  subject_type: 'tenant' | 'landlord' | 'property' | 'reference'
  subject_id: string | null
  validation_key: string
  validation_score: number | null
  validation_numeric: string | null
  validation_text: string | null
  validation_flag: string | null
  status: 'valid' | 'needs_review' | 'disputed' | 'stale'
  source_evidence_id: string | null
  source_comment: string | null
  created_at: Date
  updated_at: Date
}

export interface AccessLog {
  id: string
  viewer_user_id: string
  owner_user_id: string
  target_type: 'profile' | 'reference' | 'document' | 'property' | 'trade_hint' | 'admin_check'
  target_id: string
  target_property_id: string | null
  allowed_fields: string[]
  purpose: string | null
  ip_address: string | null
  user_agent: string | null
  contract_stage: string | null
  result: string | null
  viewed_at: Date
}

export interface PropertySafetyScore {
  id: string
  property_id: string
  safety_score: number
  risk_flags: Record<string, unknown>[] | unknown
  safety_snapshot: Record<string, unknown>
  updated_at: Date
  expires_at: Date | null
}

export interface TradeConditionHint {
  id: string
  tenant_user_id: string
  landlord_user_id: string
  property_id: string | null
  hint_level: 'low' | 'normal' | 'high' | 'critical'
  required_documents: string[]
  adjustment_options: Record<string, unknown>
  safety_actions: string[]
  snapshot: Record<string, unknown>
  valid_until: Date | null
  created_at: Date
  updated_at: Date
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

// 매물 유형
export type PropertyType = 'apartment' | 'villa' | 'officetel' | 'oneroom' | 'house' | 'other'

// 매물 상태
export type PropertyStatus = 'available' | 'reserved' | 'rented' | 'hidden'

// 매물
export interface Property {
  id: string
  landlord_id: string
  title: string
  description: string | null
  address: string
  address_detail: string | null
  region: string | null
  deposit: number
  monthly_rent: number
  maintenance_fee: number
  property_type: PropertyType
  room_count: number
  bathroom_count: number
  floor: number | null
  total_floor: number | null
  area_sqm: number | null
  options: string[]
  status: PropertyStatus
  available_from: string | null
  view_count: number
  created_at: Date
  updated_at: Date
}

// 임차인 프로필 (MVP)
export interface TenantProfile {
  id: string
  user_id: string
  budget_min: number
  budget_max: number
  preferred_districts: string[]
  move_in_date: string
  has_pets: boolean
  workplace: string | null
  created_at: Date
  updated_at: Date
}

// 매물 이미지
export interface PropertyImage {
  id: string
  property_id: string
  image_url: string
  thumbnail_url: string | null
  sort_order: number
  is_main: boolean
  created_at: Date
}

import { z } from 'zod'

// ===== 공통 =====
export const emailSchema = z.string().email('유효한 이메일 형식이 아닙니다').max(255)

export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다')
  .max(100, '비밀번호는 100자 이하여야 합니다')
  .regex(/[a-zA-Z]/, '영문자를 포함해야 합니다')
  .regex(/[0-9]/, '숫자를 포함해야 합니다')

export const phoneSchema = z
  .string()
  .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, '유효한 전화번호 형식이 아닙니다')

// ===== Auth =====
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력해주세요'),
})

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  userType: z.enum(['tenant', 'landlord']).optional().default('tenant'),
})

// ===== Profile =====
export const AGE_RANGES = ['20대초반', '20대후반', '30대', '40대이상'] as const
export const FAMILY_TYPES = ['1인', '커플', '가족'] as const
export const PETS = ['없음', '강아지', '고양이', '기타'] as const
export const STAY_TIMES = ['아침', '저녁', '주말만', '거의없음'] as const
export const DURATIONS = ['6개월', '1년', '2년', '장기'] as const
export const NOISE_LEVELS = ['조용', '보통', '활발'] as const

export const profileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  age_range: z.enum(AGE_RANGES).optional(),
  family_type: z.enum(FAMILY_TYPES).optional(),
  pets: z.array(z.enum(PETS)).optional(),
  smoking: z.boolean().optional(),
  stay_time: z.enum(STAY_TIMES).optional().nullable(),
  duration: z.enum(DURATIONS).optional().nullable(),
  noise_level: z.enum(NOISE_LEVELS).optional().nullable(),
  bio: z.string().max(100, '한마디는 100자 이내로 입력해주세요').optional().nullable(),
  intro: z.string().max(500).optional().nullable(),
  is_complete: z.boolean().optional(),
})

// ===== Reference =====
export const referenceRequestSchema = z.object({
  landlordName: z.string().max(100).optional(),
  landlordPhone: phoneSchema,
  landlordEmail: z.string().email().max(255).optional().nullable(),
})

export const referenceSurveySchema = z.object({
  rentPayment: z.number().int().min(1).max(5),
  propertyCondition: z.number().int().min(1).max(5),
  neighborIssues: z.number().int().min(1).max(5),
  checkoutCondition: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean(),
  comment: z.string().max(500).optional().nullable(),
})

// ===== Verification =====
export const employmentSchema = z.object({
  company: z.string().min(2, '회사명은 2자 이상이어야 합니다').max(100),
})

export const VALID_INCOME_RANGES = ['3000만원 미만', '3000-5000만원', '5000-7000만원', '7000만원 이상'] as const

export const incomeSchema = z.object({
  incomeRange: z.enum(VALID_INCOME_RANGES),
})

// ===== Tenant Profile (임차인 프로필 MVP) =====
export const SEOUL_DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
  '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
  '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
] as const

export const tenantProfileSchema = z.object({
  budget_min: z.number({ required_error: '최소 예산을 입력해주세요' })
    .int('예산은 정수로 입력해주세요')
    .min(0, '예산은 0 이상이어야 합니다')
    .max(100000, '예산이 너무 큽니다'),
  budget_max: z.number({ required_error: '최대 예산을 입력해주세요' })
    .int('예산은 정수로 입력해주세요')
    .min(0, '예산은 0 이상이어야 합니다')
    .max(100000, '예산이 너무 큽니다'),
  preferred_districts: z.array(z.string().max(20))
    .min(1, '선호 지역을 최소 1개 선택해주세요')
    .max(5, '선호 지역은 최대 5개까지 선택 가능합니다'),
  move_in_date: z.string({ required_error: '입주 희망일을 입력해주세요' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)'),
  has_pets: z.boolean({ required_error: '반려동물 여부를 선택해주세요' }),
  workplace: z.string().max(100, '직장은 100자 이하로 입력해주세요').optional().nullable(),
}).refine((data) => data.budget_max >= data.budget_min, {
  message: '최대 예산은 최소 예산 이상이어야 합니다',
  path: ['budget_max'],
})

export type TenantProfileInput = z.infer<typeof tenantProfileSchema>

// ===== Landlord =====
export const landlordProfileSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  phone: phoneSchema.optional().nullable(),
  propertyCount: z.number().int().min(0).max(1000).optional(),
  propertyRegions: z.array(z.string().max(50)).max(20).optional(),
})

// Helper: URLSearchParams multi-value array → string[]
function parseStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === 'string' && v !== '')
  if (typeof val === 'string' && val !== '') return [val]
  return []
}

export const SORT_OPTIONS = ['trust_desc', 'created_desc', 'reference_desc', 'verified_desc'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

export const tenantFilterSchema = z.object({
  // cursor-based pagination
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(48).default(12),

  // array filters (multiselect)
  region: z.preprocess(parseStringArray, z.array(z.string())).optional(),
  family_type: z.preprocess(parseStringArray, z.array(z.enum(FAMILY_TYPES))).optional(),
  pets: z.preprocess(parseStringArray, z.array(z.enum(PETS))).optional(),
  noise_level: z.preprocess(parseStringArray, z.array(z.enum(NOISE_LEVELS))).optional(),
  duration: z.preprocess(parseStringArray, z.array(z.enum(DURATIONS))).optional(),
  verified: z.preprocess(parseStringArray, z.array(z.enum(['employment', 'income', 'credit']))).optional(),

  // scalar filters
  smoking: z.enum(['true', 'false']).optional(),
  has_reference: z.enum(['true', 'false']).optional(),
  trust_min: z.coerce.number().int().min(0).max(120).optional(),
  trust_max: z.coerce.number().int().min(0).max(120).optional(),

  // sort
  sort: z.enum(SORT_OPTIONS).optional().default('trust_desc'),

  // legacy page-based (kept for backward compat, ignored when cursor present)
  page: z.coerce.number().int().min(1).default(1),
})

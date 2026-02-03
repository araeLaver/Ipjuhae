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

// ===== Landlord =====
export const landlordProfileSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  phone: phoneSchema.optional().nullable(),
  propertyCount: z.number().int().min(0).max(1000).optional(),
  propertyRegions: z.array(z.string().max(50)).max(20).optional(),
})

export const tenantFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  ageRange: z.enum(AGE_RANGES).optional(),
  familyType: z.enum(FAMILY_TYPES).optional(),
  minScore: z.coerce.number().int().min(0).max(120).optional(),
  smoking: z.enum(['true', 'false']).optional(),
})

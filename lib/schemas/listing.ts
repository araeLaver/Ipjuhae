import { z } from 'zod'

export const createListingSchema = z.object({
  monthly_rent: z
    .number({ required_error: '월세를 입력해주세요' })
    .int('월세는 정수 만원 단위로 입력해주세요')
    .min(1, '월세는 1만원 이상이어야 합니다'),
  deposit: z
    .number({ required_error: '보증금을 입력해주세요' })
    .int('보증금은 정수 만원 단위로 입력해주세요')
    .min(0, '보증금은 0 이상이어야 합니다'),
  address: z
    .string({ required_error: '주소를 입력해주세요' })
    .min(1, '주소를 입력해주세요')
    .max(300, '주소는 300자 이내로 입력해주세요'),
  area_sqm: z
    .number()
    .positive('면적은 0보다 커야 합니다')
    .nullable()
    .optional(),
  floor: z
    .number()
    .int('층수는 정수여야 합니다')
    .nullable()
    .optional(),
  photo_urls: z
    .array(z.string().url('올바른 URL 형식이 아닙니다'))
    .max(5, '사진은 최대 5장까지 업로드할 수 있습니다')
    .optional()
    .default([]),
  available_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 이어야 합니다')
    .optional(),
})

export type CreateListingInput = z.infer<typeof createListingSchema>

export interface Listing {
  id: number
  landlord_id: number
  monthly_rent: number
  deposit: number
  address: string
  area_sqm: number | null
  floor: number | null
  photo_urls: string[]
  available_from: string | null
  created_at: string
  updated_at: string
}

import { z } from 'zod'

export const searchFiltersSchema = z.object({
  q: z.string().trim().max(100).default(''),
  region: z.string().trim().max(50).default(''),
  propertyType: z.enum(['', 'apartment', 'villa', 'officetel', 'oneroom', 'house', 'other']).default(''),
  sort: z.enum(['created_at', 'deposit', 'monthly_rent', 'view_count']).default('created_at'),
}).strict()

export type SearchFilters = z.infer<typeof searchFiltersSchema>
export interface SavedSearch extends SearchFilters {
  id: string
  alerts_enabled: boolean
  created_at: string
}

export function searchUrl(filters: SearchFilters): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.region) params.set('region', filters.region)
  if (filters.propertyType) params.set('type', filters.propertyType)
  params.set('sort', filters.sort)
  return `/properties?${params}`
}

export function searchLabel(filters: SearchFilters): string {
  const types: Record<string, string> = { apartment: '아파트', villa: '빌라', officetel: '오피스텔', oneroom: '원룸', house: '주택', other: '기타' }
  return [filters.q, filters.region, types[filters.propertyType]].filter(Boolean).join(' · ') || '전체 매물'
}

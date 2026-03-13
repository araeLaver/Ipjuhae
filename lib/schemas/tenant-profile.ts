import { z } from 'zod'

export const tenantProfileSchema = z.object({
  budget_min: z.number().min(0),
  budget_max: z.number().min(0),
  preferred_region: z.string().min(1),
  move_in_date: z.string().optional(),
  has_pets: z.boolean().default(false),
  job_title: z.string().optional(),
  company_name: z.string().optional(),
})

export type TenantProfileInput = z.infer<typeof tenantProfileSchema>

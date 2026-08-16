import { queryOne } from '@/lib/db'

export interface PlanLimits {
  maxProperties: number
  maxFeatured: number
  label: string
  price: number
}

export type PlanName = 'free' | 'basic' | 'pro'

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { maxProperties: 3, maxFeatured: 0, label: '무료', price: 0 },
  basic: { maxProperties: 10, maxFeatured: 2, label: '베이직', price: 19900 },
  pro: { maxProperties: 999, maxFeatured: 5, label: '프로', price: 49900 },
}

/** The landlord's currently active plan (defaults to 'free' when none is active). */
export async function resolveLandlordPlan(landlordId: string): Promise<PlanName> {
  const sub = await queryOne<{ plan: PlanName }>(
    `SELECT plan FROM landlord_subscriptions
      WHERE landlord_id = $1
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 1`,
    [landlordId]
  )
  return sub?.plan ?? 'free'
}

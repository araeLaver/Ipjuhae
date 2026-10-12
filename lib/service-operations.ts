import { query } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { billingReadiness } from '@/lib/billing'
import { getPolicyNewsStatus } from '@/lib/policy-news-store'
import { OPERATOR_REPLY_SQL } from '@/lib/community-answers'
import { logger } from '@/lib/logger'

export async function serviceOperations() {
  const safe = async <T>(name: string, task: () => Promise<T>) => {
    try {
      return { available: true as const, data: await task() }
    } catch (error) {
      logger.error(`Operations ${name} unavailable`, { error })
      return { available: false as const, data: null }
    }
  }
  const [activity, questions, subscriptions, policy, revenue] =
    await Promise.all([
      safe('activity', () =>
        query<{ event_name: string; count: string }>(
          `SELECT event_name, COUNT(*)::text AS count FROM analytics_events WHERE created_at >= NOW() - INTERVAL '7 days' AND event_name IN ('check_started','check_result_viewed','check_candidate_saved','check_comparison_viewed','check_next_action_clicked','check_summary_requested','check_backup_restored','check_link_copied') GROUP BY event_name`,
        ),
      ),
      safe('questions', () =>
        query<{ waiting: string; overdue: string; answered: string }>(
          `SELECT COUNT(*) FILTER (WHERE NOT has_reply)::text AS waiting, COUNT(*) FILTER (WHERE NOT has_reply AND created_at < NOW() - INTERVAL '24 hours')::text AS overdue, COUNT(*) FILTER (WHERE has_reply)::text AS answered FROM (SELECT p.created_at, ${OPERATOR_REPLY_SQL} AS has_reply FROM community_posts p LEFT JOIN users author ON author.id = p.author_id WHERE p.deleted_at IS NULL AND p.hidden_at IS NULL AND author.user_type IS DISTINCT FROM 'admin') q`,
        ),
      ),
      safe('subscriptions', () =>
        query<{ billed: string; unbilled: string }>(
          `SELECT COUNT(*) FILTER (WHERE payment_ref IS NOT NULL)::text AS billed, COUNT(*) FILTER (WHERE payment_ref IS NULL)::text AS unbilled FROM landlord_subscriptions WHERE is_active = true AND plan != 'free' AND (expires_at IS NULL OR expires_at > NOW())`,
        ),
      ),
      safe('policy', getPolicyNewsStatus),
      safe('revenue', async () => {
        if (!stripe) throw Error('PAYMENTS_UNAVAILABLE')
        if (
          process.env.NODE_ENV === 'production' &&
          !/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '')
        )
          throw Error('LIVE_BILLING_UNAVAILABLE')
        const now = new Date()
        const kst = new Date(now.getTime() + 9 * 3600000)
        const monthStart =
          Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600000
        const totals: Record<string, number> = {}
        let count = 0,
          cursor: string | undefined,
          partial = false
        for (let page = 0; page < 5; page++) {
          const invoices = await stripe.invoices.list(
            {
              status: 'paid',
              limit: 100,
              ...(cursor ? { starting_after: cursor } : {}),
            },
            { timeout: 5000, maxNetworkRetries: 0 },
          )
          const refs = invoices.data
            .map(
              (invoice) => invoice.parent?.subscription_details?.subscription,
            )
            .map((sub) => (typeof sub === 'string' ? sub : sub?.id))
            .filter((ref): ref is string => !!ref)
          const knownRows = refs.length
            ? await query<{ payment_ref: string }>(
                'SELECT DISTINCT payment_ref FROM landlord_subscriptions WHERE payment_ref = ANY($1::text[])',
                [refs],
              )
            : []
          const known = new Set(knownRows.map((row) => row.payment_ref))
          for (const invoice of invoices.data) {
            if (process.env.NODE_ENV === 'production' && !invoice.livemode)
              continue
            // Ignore other products in a shared billing account.
            const sub = invoice.parent?.subscription_details?.subscription
            const ref = typeof sub === 'string' ? sub : sub?.id
            if (!ref) continue
            if (!known.has(ref)) continue
            const paidAt = invoice.status_transitions.paid_at
            if (!paidAt || paidAt * 1000 < monthStart) continue
            totals[invoice.currency] =
              (totals[invoice.currency] || 0) + invoice.amount_paid
            count++
          }
          partial = invoices.has_more
          if (!partial || !invoices.data.length) break
          cursor = invoices.data[invoices.data.length - 1].id
        }
        return { totals, count, partial, month: kst.toISOString().slice(0, 7) }
      }),
    ])
  return {
    activity,
    questions,
    subscriptions,
    policy,
    revenue,
    billing: billingReadiness(),
    checkedAt: new Date().toISOString(),
  }
}

import pool, { queryOne } from './db'
import { collectPolicyNews, type PolicyNewsItem } from './policy-news'
import { logger } from './logger'

const HOUR = 60 * 60 * 1000
export const POLICY_NEWS_MAX_AGE = 24 * HOUR
const LOCK_ID = 47052026

interface State {
  items: PolicyNewsItem[]
  last_attempt_at: Date | null
  last_success_at: Date | null
  failed_windows: number
  last_error: string | null
}

export function policyStatus(state: State | null, now = new Date()) {
  const lastSuccess = state?.last_success_at ? new Date(state.last_success_at) : null
  return {
    status: lastSuccess && now.getTime() - lastSuccess.getTime() < POLICY_NEWS_MAX_AGE ? 'ok' : 'stale',
    lastSuccessAt: lastSuccess?.toISOString() ?? null,
    lastAttemptAt: state?.last_attempt_at ? new Date(state.last_attempt_at).toISOString() : null,
    failedWindows: state?.failed_windows ?? 0,
    lastError: state?.last_error ?? null,
    count: state?.items.length ?? 0,
  }
}

export async function getPolicyNewsStatus() {
  if (!process.env.PUBLIC_DATA_API_KEY) return { status: 'unconfigured', lastError: 'API_KEY_MISSING' }
  try {
    return policyStatus(await queryOne<State>('SELECT * FROM policy_news_state WHERE id = 1'))
  } catch {
    return { status: 'unavailable', lastError: 'STORE_UNAVAILABLE' }
  }
}

export async function readPolicyNews(limit = 5): Promise<PolicyNewsItem[]> {
  try {
    const state = await queryOne<State>('SELECT * FROM policy_news_state WHERE id = 1')
    return (state?.items ?? []).slice(0, limit)
  } catch {
    logger.error('policy_news_store_unavailable')
    return []
  }
}

export function mergePolicyNews(previous: PolicyNewsItem[], fresh: PolicyNewsItem[]) {
  const byId = new Map(previous.map(item => [item.id, item]))
  for (const item of fresh) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) => b.approvedAt.localeCompare(a.approvedAt)).slice(0, 100)
}

/** Session advisory lock prevents scheduler/manual/backup cron from collecting concurrently. */
export async function refreshPolicyNews() {
  const key = process.env.PUBLIC_DATA_API_KEY
  if (!key) throw new Error('POLICY_API_KEY_MISSING')
  const client = await pool.connect()
  let locked = false
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_ID])
    locked = lock.rows[0].locked
    if (!locked) return { skipped: true, reason: 'running' }
    const state = (await client.query<State>('SELECT * FROM policy_news_state WHERE id = 1')).rows[0]
    if (!state) throw new Error('POLICY_STORE_NOT_READY')
    const interval = state.last_error ? 15 * 60 * 1000 : HOUR
    if (state.last_attempt_at && Date.now() - new Date(state.last_attempt_at).getTime() < interval) {
      return { skipped: true, reason: 'not_due' }
    }
    await client.query('UPDATE policy_news_state SET last_attempt_at = now() WHERE id = 1')
    const result = await collectPolicyNews(key, new Date(), async (input, init) => {
      // Daily shared-store budget includes all workers and restarts; leave 100 calls for other uses.
      const budget = await client.query(`UPDATE policy_news_state SET
        api_calls = CASE WHEN api_day = (now() AT TIME ZONE 'Asia/Seoul')::date THEN api_calls + 1 ELSE 1 END,
        api_day = (now() AT TIME ZONE 'Asia/Seoul')::date
        WHERE id = 1 AND (api_day IS DISTINCT FROM (now() AT TIME ZONE 'Asia/Seoul')::date OR api_calls < 900)
        RETURNING api_calls`)
      if (!budget.rowCount) throw new Error('POLICY_DAILY_BUDGET')
      return fetch(input, init)
    })
    const complete = result.failedWindows === 0
    // A partial failure must never erase previously fetched stories.
    const items = complete ? result.items.slice(0, 100) : mergePolicyNews(state.items, result.items)
    await client.query(`UPDATE policy_news_state SET items = $1::jsonb,
      last_success_at = CASE WHEN $2 THEN now() ELSE last_success_at END,
      failed_windows = $3, last_error = $4, updated_at = now() WHERE id = 1`,
    [JSON.stringify(items), complete, result.failedWindows, complete ? null : 'UPSTREAM_PARTIAL_FAILURE'])
    const summary = { complete, count: items.length, failedWindows: result.failedWindows, checkedWindows: result.checkedWindows }
    if (complete) logger.info('policy_news_refresh_ok', summary)
    else logger.error('policy_news_refresh_incomplete', summary)
    return summary
  } catch {
    logger.error('policy_news_refresh_failed')
    throw new Error('POLICY_REFRESH_FAILED')
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID])
    } catch {
      // Destroy the session rather than returning a locked connection to the pool.
      client.release(true)
      throw new Error('POLICY_LOCK_RELEASE_FAILED')
    }
    client.release()
  }
}

/** Starts without visitors; checks due refreshes every 15 minutes, including after restart. */
export function startPolicyNewsScheduler() {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try { await refreshPolicyNews() } catch { logger.error('policy_news_scheduler_failed') }
    finally { running = false }
  }
  void tick()
  const timer = setInterval(() => { void tick() }, 15 * 60 * 1000)
  timer.unref()
  return () => clearInterval(timer)
}

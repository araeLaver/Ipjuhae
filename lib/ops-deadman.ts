import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { transaction } from './db'
import { sendResendEmail } from './email'

export const GRACE_MS = 300_000
export const INTERVAL_MS = 60_000
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000

export function heartbeatAuthorized(header: string | null): boolean {
  const secret = process.env.OPS_HEARTBEAT_SECRET
  if (!secret || secret.length < 32 || !header) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}

export function monitoringConfigured(): boolean {
  return process.env.OPS_DEADMAN_ENABLED === 'true'
    && (process.env.OPS_HEARTBEAT_SECRET?.length ?? 0) >= 32
    && Boolean(process.env.OPS_ALERT_EMAIL && process.env.RESEND_API_KEY && process.env.DATABASE_URL)
}

export async function receiveHeartbeat() {
  return transaction(async client => {
    await client.query(`INSERT INTO ops_deadman_state (id) VALUES (1) ON CONFLICT DO NOTHING`)
    const { rows } = await client.query(`UPDATE ops_deadman_state SET
      last_receive_gap_ms = EXTRACT(EPOCH FROM (clock_timestamp() - last_received_at)) * 1000,
      last_received_at = clock_timestamp() WHERE id = 1
      RETURNING last_received_at, last_receive_gap_ms`)
    console.info('[ops-deadman] heartbeat', JSON.stringify(rows[0]))
    return rows[0]
  })
}

// DB 시계와 행 잠금으로 여러 프로세스의 판정/핑 경쟁을 직렬화한다.
export async function evaluateDeadman() {
  const result = await transaction(async client => {
    await client.query(`INSERT INTO ops_deadman_state (id) VALUES (1) ON CONFLICT DO NOTHING`)
    const { rows } = await client.query(`SELECT * FROM ops_deadman_state WHERE id = 1 FOR UPDATE`)
    const state = rows[0]
    const { rows: clock } = await client.query(`SELECT clock_timestamp() AS now`)
    const now: Date = clock[0].now
    const age = now.getTime() - new Date(state.last_received_at ?? state.armed_at).getTime()
    const gap = state.last_evaluated_at ? now.getTime() - new Date(state.last_evaluated_at).getTime() : null
    const status = age >= GRACE_MS ? 'stale' : 'healthy'
    if (status !== state.status) {
      const kind = status === 'stale' ? 'stale' : 'recovered'
      const text = `호스트 워처 ${kind === 'stale' ? '핑 누락' : '수신 회복'}\n판정: ${now.toISOString()}\n마지막 수신: ${state.last_received_at ? new Date(state.last_received_at).toISOString() : '최초 핑 없음'}\n수신 경과(ms): ${age}\n판정 공백(ms): ${gap ?? '첫 판정'}\n명목 판정 지연: 6분 이내(운영 보장 아님)`
      // 수신자/본문을 저장해 재시도 시 같은 Idempotency-Key의 내용이 변하지 않게 한다.
      const payload = { to: process.env.OPS_ALERT_EMAIL!, from: process.env.EMAIL_FROM || 'noreply@ipjuhae.com', subject: `[입주해 운영] 워처 ${kind === 'stale' ? '핑 누락' : '회복'}`, text, html: `<pre>${text}</pre>` }
      await client.query(`INSERT INTO ops_deadman_events (id, kind, created_at, payload) VALUES ($1,$2,$3,$4)`, [randomUUID(), kind, now, JSON.stringify(payload)])
    }
    await client.query(`UPDATE ops_deadman_state SET status=$1, last_evaluated_at=$2,
      last_evaluation_gap_ms=$3::double precision, max_evaluation_gap_ms=GREATEST(max_evaluation_gap_ms,COALESCE($3::double precision,0)),
      evaluation_count=evaluation_count+1 WHERE id=1`, [status, now, gap])
    return { status, evaluatedAt: now.toISOString(), heartbeatAgeMs: age, evaluationGapMs: gap, detectionOverdueMs: Math.max(0, age - GRACE_MS) }
  })
  console.info('[ops-deadman] evaluation', JSON.stringify(result))
  return result
}

export async function dispatchDeadman() {
  // 별도 트랜잭션에서 시도 시각을 먼저 영속화한다. 발송 직후 프로세스 종료에도
  // 재시도 기간이 초기화되지 않는다. lease는 발송 timeout보다 길다.
  const event = await transaction(async client => {
    const { rows } = await client.query(`SELECT *, clock_timestamp() AS now FROM ops_deadman_events
      WHERE delivery_status='pending' ORDER BY created_at, id LIMIT 1 FOR UPDATE`)
    const row = rows[0]
    if (!row) return null
    if (row.last_attempt_at && row.now.getTime() - row.last_attempt_at.getTime() < INTERVAL_MS) return null
    if (row.first_attempt_at && row.now.getTime() - row.first_attempt_at.getTime() >= RETRY_WINDOW_MS) {
      await client.query(`UPDATE ops_deadman_events SET delivery_status='uncertain' WHERE id=$1`, [row.id])
      console.error('[ops-deadman] delivery_uncertain', row.id)
      return null
    }
    await client.query(`UPDATE ops_deadman_events SET first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),
      last_attempt_at=clock_timestamp(), attempts=attempts+1 WHERE id=$1`, [row.id])
    return row
  })
  if (!event) return
  const result = await sendResendEmail({ ...event.payload, idempotencyKey: `ops-deadman/${event.id}`, timeoutMs: 10_000 })
  if (!result.success) {
    console.error('[ops-deadman] delivery_retry', event.id)
    return
  }
  await transaction(async client => {
    await client.query(`UPDATE ops_deadman_events SET sent_at=clock_timestamp(), message_id=$2,
      delivery_status='sent' WHERE id=$1`, [event.id, result.messageId])
  })
  console.info('[ops-deadman] delivery_accepted', JSON.stringify({ eventId: event.id, messageId: result.messageId, eventToAcceptanceMs: Date.now() - event.created_at.getTime() }))
}

export function startDeadmanScheduler() {
  if (process.env.OPS_DEADMAN_ENABLED !== 'true') return () => {}
  let busy = false
  const tick = async () => {
    if (busy) { console.error('[ops-deadman] tick_overlap'); return }
    if (!monitoringConfigured()) { console.error('[ops-deadman] configuration_invalid'); return }
    busy = true
    try {
      await evaluateDeadman()
      await dispatchDeadman()
    } catch {
      // 접속 문자열/비밀값을 오류 로그에 포함하지 않는다. 다음 주기에 재시도한다.
      console.error('[ops-deadman] tick_failed')
    } finally { busy = false }
  }
  const timer = setInterval(() => { void tick() }, INTERVAL_MS)
  timer.unref()
  void tick()
  return () => clearInterval(timer)
}

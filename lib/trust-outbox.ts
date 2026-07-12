import { query, queryOne } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

interface OutboxEvent {
  id: string
  aggregate_type: string
  aggregate_id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
}

interface NotificationTemplate {
  title: string
  body: string
  link: string
}

function templateFor(event: OutboxEvent): NotificationTemplate | null {
  const templates: Record<string, NotificationTemplate> = {
    ScoreCalculated: { title: '신뢰 결과가 갱신됐습니다', body: '새 검증 근거가 반영된 신뢰 결과를 확인하세요.', link: '/trust-center' },
    DisclosureRevoked: { title: '정보 공개가 회수됐습니다', body: '동의·거래단계 또는 근거 상태 변경으로 공개 패키지가 회수됐습니다.', link: '/trust-center' },
    CorrectionRequested: { title: '정정 요청이 접수됐습니다', body: '검토 중에는 영향을 받는 결과의 사용이 제한됩니다.', link: '/trust-center' },
    BilateralReferenceReleased: { title: '양방향 레퍼런스가 공개됐습니다', body: '참조기간이 종료되어 제출된 레퍼런스가 공개 가능한 상태로 전환됐습니다.', link: '/trust-center' },
    ContractOutcomeRecorded: { title: '거래 결과가 기록됐습니다', body: '거래 결과가 신뢰 피드백 원장에 반영됐습니다.', link: '/trust-center' },
    TrustDependencyInvalidated: { title: '검증 결과를 재계산했습니다', body: '근거 상태 변경에 따라 영향을 받는 결과가 갱신됐습니다.', link: '/trust-center' },
  }
  return templates[event.event_type] ?? null
}

async function resolveRecipients(event: OutboxEvent): Promise<string[]> {
  if (event.event_type === 'ScoreCalculated') {
    const subjectId = event.payload.subject_id
    return typeof subjectId === 'string' ? [subjectId] : []
  }
  if (event.aggregate_type === 'disclosure') {
    const row = await queryOne<{ recipient_id: string; subject_owner_id: string }>(
      `SELECT package.recipient_id, consent.user_id AS subject_owner_id
         FROM trust_disclosure_packages package
         JOIN data_consents consent ON consent.id = package.consent_id
        WHERE package.id = $1`,
      [event.aggregate_id]
    )
    return row ? [...new Set([row.recipient_id, row.subject_owner_id])] : []
  }
  if (event.aggregate_type === 'reference_submission') {
    const row = await queryOne<{ responder_id: string; subject_id: string }>(
      `SELECT responder_id, subject_id FROM trust_reference_submissions WHERE id = $1`,
      [event.aggregate_id]
    )
    return row ? [row.responder_id, row.subject_id] : []
  }
  if (event.aggregate_type === 'transaction') {
    const row = await queryOne<{ landlord_id: string | null; tenant_id: string | null; realtor_id: string | null }>(
      `SELECT landlord_id, tenant_id, realtor_id FROM trust_transaction_contexts WHERE id = $1`,
      [event.aggregate_id]
    )
    return row ? [...new Set([row.landlord_id, row.tenant_id, row.realtor_id].filter((id): id is string => Boolean(id)))] : []
  }
  if (event.aggregate_type === 'review_task') {
    const row = await queryOne<{ requester_id: string | null }>(`SELECT requester_id FROM trust_review_tasks WHERE id = $1`, [event.aggregate_id])
    return row?.requester_id ? [row.requester_id] : []
  }
  return []
}

export async function dispatchTrustOutbox(limit = 50) {
  const events = await query<OutboxEvent>(
    `UPDATE trust_outbox_events
        SET attempts = attempts + 1,
            available_at = NOW() + INTERVAL '5 minutes'
      WHERE id IN (
        SELECT id FROM trust_outbox_events
         WHERE published_at IS NULL AND available_at <= NOW()
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING *`,
    [Math.min(Math.max(limit, 1), 100)]
  )
  let published = 0
  let failed = 0
  for (const event of events) {
    try {
      const template = templateFor(event)
      const recipients = template ? await resolveRecipients(event) : []
      for (const userId of recipients) {
        await createNotification({
          userId,
          type: 'admin_notice',
          ...template!,
          metadata: { trust_event_id: event.id, event_type: event.event_type },
        })
        await query(
          `INSERT INTO trust_delivery_receipts
            (event_id, target_type, target_id, recipient_id, channel, event_type, state, delivered_at)
           VALUES ($1, $2, $3, $4, 'in_app', $5, 'delivered', NOW())`,
          [event.id, event.aggregate_type, event.aggregate_id, userId, event.event_type]
        )
      }
      await query(`UPDATE trust_outbox_events SET published_at = NOW(), last_error = NULL WHERE id = $1`, [event.id])
      published++
    } catch (error) {
      await query(
        `UPDATE trust_outbox_events
            SET last_error = $2,
                available_at = NOW() + make_interval(mins => LEAST(60, GREATEST(1, attempts * attempts)))
          WHERE id = $1`,
        [event.id, error instanceof Error ? error.message : 'unknown']
      )
      failed++
    }
  }
  return { claimed: events.length, published, failed }
}


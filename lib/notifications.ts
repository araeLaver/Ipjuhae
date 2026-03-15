/**
 * 알림 생성 유틸리티
 * 새 메시지, 레퍼런스 이벤트, 인증 이벤트 등에서 호출하여 notifications 테이블에 INSERT
 * + 사용자 설정에 따라 이메일 발송
 */
import { query, queryOne } from './db'
import { sendEmail } from './email'
import { logger } from './logger'

export type NotificationType =
  | 'new_message'
  | 'reference_request'
  | 'reference_completed'
  | 'verification_approved'
  | 'verification_rejected'
  | 'trust_score_updated'
  | 'welcome'
  | 'admin_notice'

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
  metadata?: Record<string, unknown>
}

/** 이메일 발송이 가능한 알림 타입 */
const EMAIL_ELIGIBLE_TYPES: NotificationType[] = [
  'new_message',
  'reference_request',
  'reference_completed',
  'verification_approved',
  'verification_rejected',
]

/**
 * 사용자의 알림 이메일 수신 설정 확인
 */
async function isEmailEnabled(userId: string, type: NotificationType): Promise<boolean> {
  if (!EMAIL_ELIGIBLE_TYPES.includes(type)) return false
  const pref = await queryOne<{ email_enabled: boolean }>(
    'SELECT email_enabled FROM notification_preferences WHERE user_id = $1 AND notification_type = $2',
    [userId, type]
  )
  // 설정이 없으면 기본 활성화 (opt-out 방식)
  return pref ? pref.email_enabled : true
}

/**
 * 알림 이메일 HTML 생성
 */
function buildNotificationEmailHtml(title: string, body: string, link?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const fullLink = link ? `${baseUrl}${link}` : baseUrl
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">${title}</h2>
      <p>${body}</p>
      <a href="${fullLink}"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
        확인하기
      </a>
      <p style="margin-top: 24px; color: #999; font-size: 12px;">
        이메일 수신을 원치 않으시면 <a href="${baseUrl}/settings/notifications">알림 설정</a>에서 변경할 수 있습니다.
      </p>
    </div>
  `
}

/**
 * 단일 알림 생성 + 이메일 발송 (설정에 따라)
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const { userId, type, title, body, link, metadata } = input
  await query(
    `INSERT INTO notifications (user_id, type, title, body, link, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, body, link ?? null, JSON.stringify(metadata ?? {})]
  )

  // 이메일 발송 (비동기, 실패해도 알림 생성은 유지)
  try {
    const emailEnabled = await isEmailEnabled(userId, type)
    if (emailEnabled) {
      const user = await queryOne<{ email: string }>(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      )
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `[입주해] ${title}`,
          html: buildNotificationEmailHtml(title, body, link),
          text: `${title}\n\n${body}`,
        })
      }
    }
  } catch (err) {
    logger.error('알림 이메일 발송 실패', { userId, type, error: err })
  }
}

/**
 * 여러 사용자에게 동일 알림 일괄 생성 (bulk INSERT)
 */
export async function createBulkNotifications(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>
): Promise<void> {
  if (userIds.length === 0) return
  const { type, title, body, link, metadata } = input
  const metaJson = JSON.stringify(metadata ?? {})

  // VALUES ($1,$2,$3,$4,$5,$6), ($7,$8,$9,$10,$11,$12), ...
  const placeholders = userIds
    .map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`)
    .join(',')
  const values = userIds.flatMap((uid) => [uid, type, title, body, link ?? null, metaJson])

  await query(
    `INSERT INTO notifications (user_id, type, title, body, link, metadata) VALUES ${placeholders}`,
    values
  )
}

// ──────────────────────────────────────────────
// 도메인별 헬퍼 (API 라우트에서 직접 호출)
// ──────────────────────────────────────────────

/** 새 메시지 수신 알림 */
export async function notifyNewMessage(opts: {
  toUserId: string
  fromName: string
  conversationId: string
  preview: string
}): Promise<void> {
  await createNotification({
    userId: opts.toUserId,
    type: 'new_message',
    title: `${opts.fromName}님의 새 메시지`,
    body: opts.preview.slice(0, 80) + (opts.preview.length > 80 ? '…' : ''),
    link: `/messages/${opts.conversationId}`,
    metadata: { conversationId: opts.conversationId, fromName: opts.fromName },
  })
}

/** 레퍼런스 요청 받음 (집주인 → 세입자) */
export async function notifyReferenceRequest(opts: {
  toUserId: string
  tenantName: string
  referenceId: string
  token: string
}): Promise<void> {
  await createNotification({
    userId: opts.toUserId,
    type: 'reference_request',
    title: `${opts.tenantName}님의 레퍼런스 요청`,
    body: '이전 세입자의 레퍼런스를 작성해주세요.',
    link: `/reference/${opts.token}`,
    metadata: { referenceId: opts.referenceId },
  })
}

/** 레퍼런스 응답 완료 (세입자에게) */
export async function notifyReferenceCompleted(opts: {
  toUserId: string
  landlordName: string
  referenceId: string
}): Promise<void> {
  await createNotification({
    userId: opts.toUserId,
    type: 'reference_completed',
    title: '레퍼런스가 작성됐어요',
    body: `${opts.landlordName}님이 레퍼런스를 작성했습니다. 확인해보세요!`,
    link: '/profile',
    metadata: { referenceId: opts.referenceId },
  })
}

/** 서류 인증 승인 */
export async function notifyVerificationApproved(opts: {
  toUserId: string
  documentType: string
}): Promise<void> {
  const labels: Record<string, string> = {
    employment: '재직',
    income: '소득',
    credit: '신용',
  }
  const label = labels[opts.documentType] ?? opts.documentType
  await createNotification({
    userId: opts.toUserId,
    type: 'verification_approved',
    title: `${label} 인증이 완료됐어요`,
    body: '신뢰점수가 업데이트됩니다. 프로필을 확인해보세요.',
    link: '/profile',
    metadata: { documentType: opts.documentType },
  })
}

/** 서류 인증 거절 */
export async function notifyVerificationRejected(opts: {
  toUserId: string
  documentType: string
  reason?: string
}): Promise<void> {
  const labels: Record<string, string> = {
    employment: '재직',
    income: '소득',
    credit: '신용',
  }
  const label = labels[opts.documentType] ?? opts.documentType
  await createNotification({
    userId: opts.toUserId,
    type: 'verification_rejected',
    title: `${label} 서류 검토 결과`,
    body: opts.reason ?? '서류를 다시 확인하고 재업로드해주세요.',
    link: '/verify',
    metadata: { documentType: opts.documentType, reason: opts.reason },
  })
}

/** 신뢰점수 변경 */
export async function notifyTrustScoreUpdated(opts: {
  toUserId: string
  newScore: number
  delta: number
}): Promise<void> {
  const direction = opts.delta >= 0 ? `+${opts.delta}` : `${opts.delta}`
  await createNotification({
    userId: opts.toUserId,
    type: 'trust_score_updated',
    title: '신뢰점수가 업데이트됐어요',
    body: `현재 신뢰점수: ${opts.newScore}점 (${direction})`,
    link: '/profile',
    metadata: { newScore: opts.newScore, delta: opts.delta },
  })
}

/** 가입 환영 알림 */
export async function notifyWelcome(userId: string, name: string): Promise<void> {
  await createNotification({
    userId,
    type: 'welcome',
    title: `환영합니다, ${name}님! 🎉`,
    body: '렌트미에 오신 걸 환영해요. 프로필을 완성하고 신뢰점수를 올려보세요.',
    link: '/onboarding',
  })
}

/** 관리자 공지 (전체 발송은 createBulkNotifications 사용) */
export async function notifyAdminNotice(opts: {
  toUserId: string
  title: string
  body: string
  link?: string
}): Promise<void> {
  await createNotification({
    userId: opts.toUserId,
    type: 'admin_notice',
    title: opts.title,
    body: opts.body,
    link: opts.link,
  })
}

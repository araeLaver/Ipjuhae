/**
 * 이메일 발송 모듈
 *
 * 지원 프로바이더:
 * - mock: 개발/테스트용 (콘솔 출력)
 * - resend: Resend
 * - sendgrid: SendGrid
 *
 * 환경변수:
 * - EMAIL_PROVIDER: 'mock' | 'resend' | 'sendgrid' (기본: mock)
 */

import { logger } from './logger'

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

type EmailProvider = 'mock' | 'resend' | 'sendgrid'

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER as EmailProvider) || 'mock'
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@ipjuhae.com'

/**
 * Mock 이메일 발송 (개발용)
 */
async function sendMockEmail(options: EmailOptions): Promise<EmailResult> {
  logger.info('이메일 발송 (Mock)', { to: options.to, subject: options.subject })
  await new Promise(resolve => setTimeout(resolve, 100))
  return {
    success: true,
    messageId: `mock-${Date.now()}`,
  }
}

/**
 * Resend 이메일 발송
 * 문서: https://resend.com/docs/api-reference/emails/send-email
 */
async function sendResendEmail(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    logger.error('Resend API 키 누락')
    return { success: false, error: '이메일 설정이 완료되지 않았습니다' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    })

    const data = await response.json()

    if (data.id) {
      logger.info('Resend 이메일 발송 성공', { to: options.to, messageId: data.id })
      return {
        success: true,
        messageId: data.id,
      }
    } else {
      logger.error('Resend 이메일 발송 실패', { to: options.to, error: data.message })
      return {
        success: false,
        error: data.message || '이메일 발송 실패',
      }
    }
  } catch (error) {
    logger.error('Resend 이메일 발송 오류', { to: options.to, error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '이메일 발송 오류',
    }
  }
}

/**
 * SendGrid 이메일 발송
 * 문서: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
async function sendSendGridEmail(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY

  if (!apiKey) {
    logger.error('SendGrid API 키 누락')
    return { success: false, error: '이메일 설정이 완료되지 않았습니다' }
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: EMAIL_FROM },
        subject: options.subject,
        content: [
          { type: 'text/html', value: options.html },
          ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
        ],
      }),
    })

    if (response.status === 202) {
      const messageId = response.headers.get('x-message-id') || `sg-${Date.now()}`
      logger.info('SendGrid 이메일 발송 성공', { to: options.to, messageId })
      return {
        success: true,
        messageId,
      }
    } else {
      const data = await response.json()
      logger.error('SendGrid 이메일 발송 실패', { to: options.to, error: data.errors })
      return {
        success: false,
        error: data.errors?.[0]?.message || '이메일 발송 실패',
      }
    }
  } catch (error) {
    logger.error('SendGrid 이메일 발송 오류', { to: options.to, error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '이메일 발송 오류',
    }
  }
}

/**
 * 이메일 발송 (프로바이더 자동 선택)
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  switch (EMAIL_PROVIDER) {
    case 'resend':
      return sendResendEmail(options)
    case 'sendgrid':
      return sendSendGridEmail(options)
    default:
      return sendMockEmail(options)
  }
}

/**
 * 회원가입 환영 이메일
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<EmailResult> {
  return sendEmail({
    to: email,
    subject: '[입주해] 회원가입을 환영합니다!',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">입주해에 오신 것을 환영합니다!</h1>
        <p>안녕하세요, ${name || '회원'}님!</p>
        <p>입주해에 가입해 주셔서 감사합니다.</p>
        <p>지금 바로 프로필을 완성하고 신뢰점수를 높여보세요.</p>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/profile"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
          프로필 완성하기
        </a>
      </div>
    `,
    text: `입주해에 오신 것을 환영합니다! 지금 바로 프로필을 완성하세요: ${process.env.NEXT_PUBLIC_BASE_URL}/profile`,
  })
}

/**
 * 레퍼런스 요청 이메일
 */
export async function sendReferenceRequestEmail(
  landlordEmail: string,
  tenantName: string,
  surveyUrl: string
): Promise<EmailResult> {
  return sendEmail({
    to: landlordEmail,
    subject: `[입주해] ${tenantName}님이 레퍼런스를 요청했습니다`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">레퍼런스 요청</h1>
        <p>안녕하세요!</p>
        <p><strong>${tenantName}</strong>님이 귀하에게 레퍼런스를 요청했습니다.</p>
        <p>아래 버튼을 클릭하여 간단한 설문에 응해주세요.</p>
        <a href="${surveyUrl}"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
          설문 응답하기
        </a>
        <p style="margin-top: 24px; color: #666; font-size: 14px;">
          이 링크는 7일 후 만료됩니다.
        </p>
      </div>
    `,
    text: `${tenantName}님이 레퍼런스를 요청했습니다. 설문 응답: ${surveyUrl}`,
  })
}

/**
 * 서류 승인/반려 알림 이메일
 */
export async function sendDocumentStatusEmail(
  email: string,
  documentType: string,
  status: 'approved' | 'rejected',
  reason?: string
): Promise<EmailResult> {
  const typeLabel = {
    employment: '재직증명서',
    income: '소득증명서',
    credit: '신용정보',
  }[documentType] || documentType

  const isApproved = status === 'approved'

  return sendEmail({
    to: email,
    subject: `[입주해] ${typeLabel} 심사 ${isApproved ? '승인' : '반려'} 안내`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${isApproved ? '#16a34a' : '#dc2626'};">
          ${typeLabel} ${isApproved ? '승인 완료' : '반려'}
        </h1>
        <p>안녕하세요!</p>
        <p>제출하신 <strong>${typeLabel}</strong>가 ${isApproved ? '승인되었습니다.' : '반려되었습니다.'}</p>
        ${!isApproved && reason ? `<p style="color: #dc2626;"><strong>반려 사유:</strong> ${reason}</p>` : ''}
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/profile/verifications"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
          인증 현황 확인
        </a>
      </div>
    `,
    text: `${typeLabel} ${isApproved ? '승인 완료' : '반려'}${reason ? ` - 사유: ${reason}` : ''}`,
  })
}

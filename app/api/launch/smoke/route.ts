import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

interface CheckResult {
  ok: boolean
  message?: string
}

type CheckMap = Record<string, CheckResult>

function addCheck(checks: CheckMap, name: string, ok: boolean, message?: string) {
  checks[name] = { ok, ...(message ? { message } : {}) }
}

function requireHeader(request: NextRequest): string | null {
  const expectedToken = process.env.LAUNCH_SMOKE_TOKEN
  if (process.env.NODE_ENV === 'production' && !expectedToken) {
    return '운영 환경에서는 LAUNCH_SMOKE_TOKEN이 필요합니다'
  }

  if (!expectedToken) return null

  const token = request.headers.get('x-launch-smoke-token')
  if (!token || token !== expectedToken) {
    return '잘못되었거나 누락된 launch smoke 토큰입니다'
  }

  return null
}

function hasSmtpConfig(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  )
}

function isValidEmailConfig(): boolean {
  const provider = process.env.EMAIL_PROVIDER

  if (provider === 'resend') return !!process.env.RESEND_API_KEY
  if (provider === 'sendgrid') return !!process.env.SENDGRID_API_KEY

  return hasSmtpConfig()
}

export async function GET(request: NextRequest) {
  const authError = requireHeader(request)
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 403 })
  }

  const checks: CheckMap = {}

  const dbOk = await (async () => {
    try {
      await query('SELECT 1')
      return true
    } catch {
      return false
    }
  })()
  addCheck(checks, 'database', dbOk, dbOk ? undefined : 'DB 연결/쿼리 실패')

  const jwtOk = !!(
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
  )
  addCheck(checks, 'jwt_secret', jwtOk, jwtOk ? undefined : 'JWT_SECRET가 없거나 길이가 짧습니다')

  const smsProvider = process.env.SMS_PROVIDER
  const smsOk =
    smsProvider === 'nhn'
      ? !!(process.env.NHN_SMS_APP_KEY && process.env.NHN_SMS_SECRET_KEY && process.env.NHN_SMS_SENDER)
      : smsProvider === 'twilio'
        ? !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
        : false
  addCheck(checks, 'sms', smsOk, smsOk ? undefined : 'SMS_PROVIDER가 nhn/twilio가 아니거나 인증 정보가 부족합니다')

  const emailOk = isValidEmailConfig()
  addCheck(checks, 'email', emailOk, emailOk ? undefined : 'EMAIL_PROVIDER resend/sendgrid 또는 SMTP 설정이 부족합니다')

  const storageOk = process.env.STORAGE_PROVIDER === 's3'
    && !!(
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
    )
  addCheck(
    checks,
    'storage',
    storageOk,
    storageOk ? undefined : 'STORAGE_PROVIDER가 s3가 아니거나 S3 설정이 부족합니다'
  )

  const verificationProvider = process.env.VERIFICATION_PROVIDER
  const verificationOk =
    verificationProvider === 'codef'
      ? !!(
          process.env.CODEF_CLIENT_ID &&
          process.env.CODEF_CLIENT_SECRET &&
          process.env.CODEF_PUBLIC_KEY
        )
      : verificationProvider === 'nice'
        ? !!(
            process.env.NICE_CLIENT_ID &&
            process.env.NICE_CLIENT_SECRET
          )
        : false
  addCheck(
    checks,
    'verification',
    verificationOk,
    verificationOk ? undefined : 'VERIFICATION_PROVIDER가 codef/nice가 아니거나 인증 정보가 부족합니다'
  )

  const routeEnvOk =
    !!(
      process.env.DATABASE_URL &&
      process.env.DB_SCHEMA &&
      process.env.CRON_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL &&
      process.env.NEXT_PUBLIC_BASE_URL
    )
  addCheck(
    checks,
    'runtime_env',
    routeEnvOk,
    routeEnvOk ? undefined : '런타임 필수 env 중 일부가 누락되었습니다'
  )

  const allOk = Object.values(checks).every((check) => check.ok)
  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  )
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { NotificationType } from '@/lib/notifications'

interface PrefRow {
  notification_type: NotificationType
  email_enabled: boolean
}

const CONFIGURABLE_TYPES: NotificationType[] = [
  'new_message',
  'reference_request',
  'reference_completed',
  'verification_approved',
  'verification_rejected',
]

/**
 * GET /api/notifications/preferences
 * 알림 이메일 수신 설정 조회
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
  }

  const rows = await query<PrefRow>(
    'SELECT notification_type, email_enabled FROM notification_preferences WHERE user_id = $1',
    [payload.userId]
  )

  // 설정이 없는 타입은 기본 활성화
  const preferences: Record<string, boolean> = {}
  for (const type of CONFIGURABLE_TYPES) {
    const row = rows.find(r => r.notification_type === type)
    preferences[type] = row ? row.email_enabled : true
  }

  return NextResponse.json({ preferences })
}

/**
 * PUT /api/notifications/preferences
 * 알림 이메일 수신 설정 변경
 * Body: { preferences: { new_message: true, reference_request: false, ... } }
 */
export async function PUT(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
  }

  const body = await request.json()
  const prefs = body.preferences as Record<string, boolean> | undefined
  if (!prefs || typeof prefs !== 'object') {
    return NextResponse.json({ error: 'preferences 객체가 필요합니다' }, { status: 400 })
  }

  for (const [type, enabled] of Object.entries(prefs)) {
    if (!CONFIGURABLE_TYPES.includes(type as NotificationType)) continue
    if (typeof enabled !== 'boolean') continue

    await query(
      `INSERT INTO notification_preferences (user_id, notification_type, email_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, notification_type)
       DO UPDATE SET email_enabled = $3, updated_at = NOW()`,
      [payload.userId, type, enabled]
    )
  }

  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { NotificationType } from '@/lib/notifications'

interface PrefRow {
  notification_type: NotificationType
  email_enabled: boolean
}

interface MobilePrefRow {
  push_enabled: boolean
  message_enabled: boolean
  match_enabled: boolean
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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const rows = await query<PrefRow>(
    'SELECT notification_type, email_enabled FROM notification_preferences WHERE user_id = $1',
    [user.id]
  )
  const mobile = await queryOne<MobilePrefRow>(
    `SELECT push_enabled, message_enabled, match_enabled
     FROM mobile_notification_settings WHERE user_id = $1`,
    [user.id]
  )

  // 설정이 없는 타입은 기본 활성화
  const preferences: Record<string, boolean> = {}
  for (const type of CONFIGURABLE_TYPES) {
    const row = rows.find(r => r.notification_type === type)
    preferences[type] = row ? row.email_enabled : true
  }

  return NextResponse.json({
    preferences,
    mobile: {
      pushEnabled: mobile?.push_enabled ?? true,
      messageEnabled: mobile?.message_enabled ?? true,
      matchEnabled: mobile?.match_enabled ?? true,
    },
  })
}

/**
 * PUT /api/notifications/preferences
 * 알림 이메일 수신 설정 변경
 * Body: { preferences: { new_message: true, reference_request: false, ... } }
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const body = await request.json()
  const prefs = body.preferences as Record<string, boolean> | undefined
  const mobile = body.mobile as Record<string, unknown> | undefined
  if ((!prefs || typeof prefs !== 'object') && (!mobile || typeof mobile !== 'object')) {
    return NextResponse.json({ error: 'preferences 또는 mobile 객체가 필요합니다' }, { status: 400 })
  }

  for (const [type, enabled] of Object.entries(prefs ?? {})) {
    if (!CONFIGURABLE_TYPES.includes(type as NotificationType)) continue
    if (typeof enabled !== 'boolean') continue

    await query(
      `INSERT INTO notification_preferences (user_id, notification_type, email_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, notification_type)
       DO UPDATE SET email_enabled = $3, updated_at = NOW()`,
      [user.id, type, enabled]
    )
  }

  if (mobile) {
    const keys = ['pushEnabled', 'messageEnabled', 'matchEnabled'] as const
    if (keys.some(key => typeof mobile[key] !== 'boolean')) {
      return NextResponse.json({ error: 'mobile 설정은 boolean 값이어야 합니다' }, { status: 400 })
    }
    await query(
      `INSERT INTO mobile_notification_settings
         (user_id, push_enabled, message_enabled, match_enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         push_enabled = EXCLUDED.push_enabled,
         message_enabled = EXCLUDED.message_enabled,
         match_enabled = EXCLUDED.match_enabled,
         updated_at = NOW()`,
      [user.id, mobile.pushEnabled, mobile.messageEnabled, mobile.matchEnabled]
    )
  }

  return NextResponse.json({ success: true })
}

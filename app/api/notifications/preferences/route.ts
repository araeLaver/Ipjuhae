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
 * ?Œë¦¼ ?´ë©”???˜ì‹  ?¤ì • ì¡°íšŒ
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
  }

  const rows = await query<PrefRow>(
    'SELECT notification_type, email_enabled FROM notification_preferences WHERE user_id = $1',
    [payload.userId]
  )

  // ?¤ì •???†ëŠ” ?€?…ì? ê¸°ë³¸ ?œì„±??
  const preferences: Record<string, boolean> = {}
  for (const type of CONFIGURABLE_TYPES) {
    const row = rows.find(r => r.notification_type === type)
    preferences[type] = row ? row.email_enabled : true
  }

  return NextResponse.json({ preferences })
}

/**
 * PUT /api/notifications/preferences
 * ?Œë¦¼ ?´ë©”???˜ì‹  ?¤ì • ë³€ê²?
 * Body: { preferences: { new_message: true, reference_request: false, ... } }
 */
export async function PUT(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
  }

  const body = await request.json()
  const prefs = body.preferences as Record<string, boolean> | undefined
  if (!prefs || typeof prefs !== 'object') {
    return NextResponse.json({ error: 'preferences ê°ì²´ê°€ ?„ìš”?©ë‹ˆ?? }, { status: 400 })
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


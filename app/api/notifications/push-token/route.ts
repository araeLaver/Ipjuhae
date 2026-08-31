import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyTokenAllowed } from '@/lib/auth'
import { query } from '@/lib/db'

async function authenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  const payload = await verifyTokenAllowed(token)
  return payload?.userId ?? null
}

/** PUT /api/notifications/push-token — 현재 사용자의 Expo push token 등록/갱신 */
export async function PUT(request: Request) {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const token = body?.token
  const platform = body?.platform
  if (typeof token !== 'string' || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) {
    return NextResponse.json({ error: '유효한 Expo push token이 필요합니다' }, { status: 400 })
  }
  if (platform !== 'android' && platform !== 'ios') {
    return NextResponse.json({ error: 'platform은 android 또는 ios여야 합니다' }, { status: 400 })
  }

  await query(
    `INSERT INTO push_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token)
     DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()`,
    [userId, token, platform]
  )
  return NextResponse.json({ success: true })
}

/** DELETE /api/notifications/push-token — 로그아웃/비활성화 시 현재 사용자 token 해제 */
export async function DELETE(request: Request) {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token이 필요합니다' }, { status: 400 })
  await query('DELETE FROM push_tokens WHERE user_id = $1 AND token = $2', [userId, token])
  return new NextResponse(null, { status: 204 })
}

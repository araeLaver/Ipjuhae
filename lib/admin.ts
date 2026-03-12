import { cookies } from 'next/headers'
import { verifyToken } from './auth'
import { queryOne } from './db'
import { query } from './db'

interface AdminUser {
  id: string
  email: string
  name: string | null
  user_type: string
}

/**
 * Admin guard: 현재 요청이 admin user_type 토큰을 가지고 있는지 확인
 * 성공 시 user 반환, 실패 시 null 반환
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await queryOne<AdminUser>(
    'SELECT id, email, name, user_type FROM users WHERE id = $1',
    [payload.userId]
  )

  if (!user || user.user_type !== 'admin') return null
  return user
}

/**
 * Admin 액션 로그 기록
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: 'user' | 'document' | 'profile',
  targetId: string,
  detail?: Record<string, unknown>
): Promise<void> {
  await query(
    `INSERT INTO admin_logs (admin_id, action, target_type, target_id, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, targetType, targetId, detail ? JSON.stringify(detail) : null]
  )
}

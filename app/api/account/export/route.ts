import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getRequestContext } from '@/lib/request-context'

type Row = Record<string, unknown>

// GET /api/account/export — 개인정보 열람·이동 (PIPA right of access/portability).
// Returns the authenticated user's own personal data as a downloadable JSON.
export async function GET(request: Request) {
  const { requestId, traceId } = getRequestContext(request)
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', request_id: requestId, trace_id: traceId },
      { status: 401 }
    )
  }

  const uid = user.id
  try {
    const account = await queryOne<Row>('SELECT * FROM users WHERE id = $1', [uid]).catch(() => null)
    if (account) {
      delete account.password_hash
    }

    const [profile, tenantProfile, verifications, references, properties, favorites] = await Promise.all([
      queryOne<Row>('SELECT * FROM profiles WHERE user_id = $1', [uid]).catch(() => null),
      queryOne<Row>('SELECT * FROM tenant_profiles WHERE user_id = $1', [uid]).catch(() => null),
      query<Row>('SELECT * FROM verifications WHERE user_id = $1', [uid]).catch(() => []),
      query<Row>('SELECT * FROM landlord_references WHERE user_id = $1', [uid]).catch(() => []),
      query<Row>('SELECT * FROM properties WHERE landlord_id = $1', [uid]).catch(() => []),
      query<Row>('SELECT * FROM favorites WHERE user_id = $1', [uid]).catch(() => []),
    ])

    const payload = {
      exported_at: new Date().toISOString(),
      account,
      profile,
      tenant_profile: tenantProfile,
      verifications,
      landlord_references: references,
      properties,
      favorites,
    }

    const response = NextResponse.json(payload)
    response.headers.set('Content-Disposition', `attachment; filename="ipjuhae-my-data-${uid}.json"`)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    logger.error('데이터 내보내기 오류', { userId: uid, error })
    return NextResponse.json(
      { error: '데이터 내보내기 중 오류가 발생했습니다', request_id: requestId, trace_id: traceId },
      { status: 500 }
    )
  }
}

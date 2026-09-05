import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAdminUser } from '@/lib/admin'

interface WaitlistRow {
  id: string
  email: string
  user_type: string
  created_at: string
  invited_at: string | null
  signed_up_at: string | null
  utm_source: string | null
  referrer_host: string | null
}

/** 채널별 랜딩 방문 → 신청 전환 */
interface SourceRow {
  source: string
  visits: string
  signups: string
}

interface StatsRow {
  total: string
  invited: string
  signed_up: string
  pending: string
}

// GET /api/admin/waitlist — 대기자 목록 + 통계
export async function GET(request: Request) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // 'all' | 'pending' | 'invited' | 'signed_up'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    let whereClause = ''
    if (status === 'pending') whereClause = 'WHERE invited_at IS NULL'
    else if (status === 'invited') whereClause = 'WHERE invited_at IS NOT NULL AND signed_up_at IS NULL'
    else if (status === 'signed_up') whereClause = 'WHERE signed_up_at IS NOT NULL'

    const rows = await query<WaitlistRow>(
      `SELECT id, email, user_type, created_at, invited_at, signed_up_at,
              utm_source, referrer_host
       FROM waitlist ${whereClause}
       ORDER BY created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    const stats = await queryOne<StatsRow>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE invited_at IS NOT NULL)::text AS invited,
        COUNT(*) FILTER (WHERE signed_up_at IS NOT NULL)::text AS signed_up,
        COUNT(*) FILTER (WHERE invited_at IS NULL)::text AS pending
      FROM waitlist
    `)

    // 채널별 방문·신청. 방문은 랜딩(/) page_view 기준.
    const sources = await query<SourceRow>(`
      WITH visits AS (
        SELECT COALESCE(NULLIF(properties->>'utm_source', ''), 'direct') AS source,
               COUNT(*) AS visits
        FROM analytics_events
        WHERE event_name = 'page_view' AND properties->>'path' = '/'
        GROUP BY 1
      ),
      signups AS (
        SELECT COALESCE(NULLIF(utm_source, ''), 'direct') AS source,
               COUNT(*) AS signups
        FROM waitlist
        GROUP BY 1
      )
      SELECT COALESCE(v.source, s.source) AS source,
             COALESCE(v.visits, 0)::text AS visits,
             COALESCE(s.signups, 0)::text AS signups
      FROM visits v
      FULL OUTER JOIN signups s ON v.source = s.source
      ORDER BY COALESCE(v.visits, 0) DESC, COALESCE(s.signups, 0) DESC
    `)

    return NextResponse.json({
      waitlist: rows,
      sources: sources.map((r) => {
        const visits = parseInt(r.visits, 10)
        const signups = parseInt(r.signups, 10)
        return {
          source: r.source,
          visits,
          signups,
          conversionRate: visits > 0 ? Math.round((signups / visits) * 1000) / 10 : null,
        }
      }),
      stats: {
        total: parseInt(stats?.total ?? '0'),
        invited: parseInt(stats?.invited ?? '0'),
        signedUp: parseInt(stats?.signed_up ?? '0'),
        pending: parseInt(stats?.pending ?? '0'),
      },
    })
  } catch (error) {
    logger.error('[admin/waitlist GET]', { error })
    return NextResponse.json({ error: '조회 실패' }, { status: 500 })
  }
}

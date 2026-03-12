import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAdminUser } from '@/lib/admin'

interface DailySignupRow {
  date: string
  count: string
}

interface SummaryRow {
  total_users: string
  tenant_count: string
  landlord_count: string
  today_signups: string
  complete_profiles: string
  pending_docs: string
  total_references: string
  completed_references: string
}

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  try {
    const [summary] = await query<SummaryRow>(`
      SELECT
        COUNT(*)                                                        AS total_users,
        COUNT(*) FILTER (WHERE user_type = 'tenant')                   AS tenant_count,
        COUNT(*) FILTER (WHERE user_type = 'landlord')                 AS landlord_count,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)        AS today_signups,
        (SELECT COUNT(*) FROM profiles WHERE is_complete = TRUE)        AS complete_profiles,
        (SELECT COUNT(*) FROM verification_documents WHERE status = 'pending') AS pending_docs,
        (SELECT COUNT(*) FROM landlord_references)                      AS total_references,
        (SELECT COUNT(*) FROM landlord_references WHERE status = 'completed') AS completed_references
      FROM users
      WHERE user_type != 'admin'
    `)

    const dailySignups = await query<DailySignupRow>(`
      SELECT
        DATE(created_at)::text AS date,
        COUNT(*)::text         AS count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '14 days'
        AND user_type != 'admin'
      GROUP BY DATE(created_at)
      ORDER BY date
    `)

    return NextResponse.json({
      summary: {
        totalUsers: parseInt(summary?.total_users ?? '0'),
        tenantCount: parseInt(summary?.tenant_count ?? '0'),
        landlordCount: parseInt(summary?.landlord_count ?? '0'),
        todaySignups: parseInt(summary?.today_signups ?? '0'),
        completeProfiles: parseInt(summary?.complete_profiles ?? '0'),
        pendingDocs: parseInt(summary?.pending_docs ?? '0'),
        totalReferences: parseInt(summary?.total_references ?? '0'),
        completedReferences: parseInt(summary?.completed_references ?? '0'),
      },
      dailySignups: dailySignups.map(r => ({
        date: r.date,
        count: parseInt(r.count),
      })),
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: '통계 조회 실패' }, { status: 500 })
  }
}

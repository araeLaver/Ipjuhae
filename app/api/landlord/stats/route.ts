import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

interface UserRow {
  user_type: 'tenant' | 'landlord'
}

interface PropertyStatsRow {
  total_properties: string
  available_count: string
  reserved_count: string
  rented_count: string
  total_views: string
}

interface FavoriteCountRow {
  total_favorites: string
}

interface MessageCountRow {
  unread_count: string
  total_conversations: string
}

interface RecentActivityRow {
  type: 'property_view' | 'favorite_added' | 'message_received'
  description: string
  created_at: string
}

interface MonthlyStatRow {
  month: string
  views: string
  favorites: string
  messages: string
}

// GET /api/landlord/stats - 집주인 통계 조회
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    // 집주인 확인
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0 || userResult[0].user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 접근할 수 있습니다' }, { status: 403 })
    }

    // 매물 통계
    const propertyStats = await query<PropertyStatsRow>(
      `SELECT
        COUNT(*) as total_properties,
        COUNT(*) FILTER (WHERE status = 'available') as available_count,
        COUNT(*) FILTER (WHERE status = 'reserved') as reserved_count,
        COUNT(*) FILTER (WHERE status = 'rented') as rented_count,
        COALESCE(SUM(view_count), 0) as total_views
      FROM properties
      WHERE landlord_id = $1`,
      [payload.userId]
    )

    // 즐겨찾기 받은 수
    const favoriteCount = await query<FavoriteCountRow>(
      `SELECT COUNT(*) as total_favorites
       FROM tenant_favorites
       WHERE landlord_id = $1`,
      [payload.userId]
    )

    // 메시지 통계
    const messageStats = await query<MessageCountRow>(
      `SELECT
        COUNT(*) FILTER (
          WHERE m.sender_id != $1 AND m.is_read = FALSE
        ) as unread_count,
        COUNT(DISTINCT c.id) as total_conversations
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.landlord_id = $1`,
      [payload.userId]
    )

    // 최근 활동 (최근 10개)
    // 참고: 실제 활동 로그 테이블이 없으므로 대화방 생성/메시지를 활동으로 표시
    const recentMessages = await query<RecentActivityRow>(
      `SELECT
        'message_received' as type,
        COALESCE(p.name, '알 수 없음') || '님이 메시지를 보냈습니다' as description,
        m.created_at
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      LEFT JOIN profiles p ON m.sender_id = p.user_id
      WHERE c.landlord_id = $1 AND m.sender_id != $1
      ORDER BY m.created_at DESC
      LIMIT 10`,
      [payload.userId]
    )

    // 월별 통계 (최근 6개월)
    // 현재는 메시지 수만 계산 (조회수 로그 테이블이 없음)
    const monthlyStats = await query<MonthlyStatRow>(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', m.created_at), 'YYYY-MM') as month,
        '0' as views,
        '0' as favorites,
        COUNT(*) as messages
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.landlord_id = $1
        AND m.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
      GROUP BY DATE_TRUNC('month', m.created_at)
      ORDER BY month`,
      [payload.userId]
    )

    const stats = propertyStats[0]
    const favorites = favoriteCount[0]
    const messages = messageStats[0]

    return NextResponse.json({
      summary: {
        totalProperties: parseInt(stats?.total_properties || '0'),
        availableProperties: parseInt(stats?.available_count || '0'),
        reservedProperties: parseInt(stats?.reserved_count || '0'),
        rentedProperties: parseInt(stats?.rented_count || '0'),
        totalViews: parseInt(stats?.total_views || '0'),
        totalFavorites: parseInt(favorites?.total_favorites || '0'),
        unreadMessages: parseInt(messages?.unread_count || '0'),
        totalConversations: parseInt(messages?.total_conversations || '0'),
      },
      recentActivity: recentMessages.map(a => ({
        type: a.type,
        description: a.description,
        createdAt: a.created_at,
      })),
      monthlyStats: monthlyStats.map(m => ({
        month: m.month,
        views: parseInt(m.views),
        favorites: parseInt(m.favorites),
        messages: parseInt(m.messages),
      })),
    })
  } catch (error) {
    console.error('통계 조회 오류:', error)
    return NextResponse.json({ error: '통계를 불러오는데 실패했습니다' }, { status: 500 })
  }
}

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

// GET /api/landlord/stats - ì§‘ì£¼???µê³„ ì¡°íšŒ
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
    }

    // ì§‘ì£¼???•ì¸
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0 || userResult[0].user_type !== 'landlord') {
      return NextResponse.json({ error: 'ì§‘ì£¼?¸ë§Œ ?‘ê·¼?????ˆìŠµ?ˆë‹¤' }, { status: 403 })
    }

    // ë§¤ë¬¼ ?µê³„
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

    // ì¦ê²¨ì°¾ê¸° ë°›ì? ??
    const favoriteCount = await query<FavoriteCountRow>(
      `SELECT COUNT(*) as total_favorites
       FROM tenant_favorites
       WHERE landlord_id = $1`,
      [payload.userId]
    )

    // ë©”ì‹œì§€ ?µê³„
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

    // ìµœê·¼ ?œë™ (ìµœê·¼ 10ê°?
    // ì°¸ê³ : ?¤ì œ ?œë™ ë¡œê·¸ ?Œì´ë¸”ì´ ?†ìœ¼ë¯€ë¡??€?”ë°© ?ì„±/ë©”ì‹œì§€ë¥??œë™?¼ë¡œ ?œì‹œ
    const recentMessages = await query<RecentActivityRow>(
      `SELECT
        'message_received' as type,
        COALESCE(p.name, '?????†ìŒ') || '?˜ì´ ë©”ì‹œì§€ë¥?ë³´ëƒˆ?µë‹ˆ?? as description,
        m.created_at
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      LEFT JOIN profiles p ON m.sender_id = p.user_id
      WHERE c.landlord_id = $1 AND m.sender_id != $1
      ORDER BY m.created_at DESC
      LIMIT 10`,
      [payload.userId]
    )

    // ?”ë³„ ?µê³„ (ìµœê·¼ 6ê°œì›”)
    // ?„ì¬??ë©”ì‹œì§€ ?˜ë§Œ ê³„ì‚° (ì¡°íšŒ??ë¡œê·¸ ?Œì´ë¸”ì´ ?†ìŒ)
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
    console.error('?µê³„ ì¡°íšŒ ?¤ë¥˜:', error)
    return NextResponse.json({ error: '?µê³„ë¥?ë¶ˆëŸ¬?¤ëŠ”???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}


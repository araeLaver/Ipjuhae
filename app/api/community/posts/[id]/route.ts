import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { logger } from '@/lib/logger'
import { readableAudiences, type CommunityAudience } from '@/lib/community'

interface PostRow {
  id: string
  author_id: string
  audience: CommunityAudience
  category: string | null
  title: string
  body: string
  view_count: number
  comment_count: number
  author_role: string
  created_at: string
  author_name: string | null
}

// GET /api/community/posts/[id]
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 목록과 마찬가지로 읽기는 열어 둔다 — 검색·SNS에서 들어온 사람이 글을 볼 수 있어야
  // 유입이 된다. 역할 판 글은 여전히 해당 역할만 볼 수 있다.
  const user = await getCurrentUser()

  const { id } = await params
  try {
    const post = await queryOne<PostRow>(
      `SELECT p.id, p.author_id, p.audience, p.category, p.title, p.body,
              p.view_count, p.comment_count, p.created_at,
              COALESCE(pr.name, u.name) AS author_name,
              COALESCE(u.user_type, 'guest') AS author_role
         FROM community_posts p
         LEFT JOIN users u ON u.id = p.author_id
         LEFT JOIN profiles pr ON pr.user_id = p.author_id
        WHERE p.id = $1 AND p.deleted_at IS NULL AND p.hidden_at IS NULL`,
      [id]
    )
    if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 })

    const isAuthor = !!user && post.author_id === user.id
    if (!isAuthor && !readableAudiences(user?.user_type ?? null).includes(post.audience)) {
      return NextResponse.json({ error: '접근할 수 없는 게시글입니다' }, { status: 403 })
    }

    // best-effort view count
    await query('UPDATE community_posts SET view_count = view_count + 1 WHERE id = $1', [id]).catch(() => undefined)

    return NextResponse.json({ post: { ...post, is_author: isAuthor } })
  } catch (error) {
    logger.error('커뮤니티 상세 조회 오류', { error })
    return NextResponse.json({ error: '게시글을 불러오지 못했습니다' }, { status: 500 })
  }
}

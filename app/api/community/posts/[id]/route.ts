import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { logger } from '@/lib/logger'
import { readableAudiences, type CommunityAudience } from '@/lib/community'

/**
 * 상세 조회 결과.
 *
 * `author_id`는 본인 글 판정(`is_author`)과 게시판 접근 판정에만 쓰고 **응답에서는 뺀다.**
 * `author_name`은 아예 조회하지 않는다 — `profiles.name`은 임차인 검증용 실명이고,
 * 커뮤니티는 익명 게시판이다. 표시 이름은 클라이언트가 `author_role`에서 만든다. (DOW-1236)
 */
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
              COALESCE(u.user_type, 'guest') AS author_role
         FROM community_posts p
         LEFT JOIN users u ON u.id = p.author_id
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

    // `author_id`는 판정에만 쓰고 응답에서 뺀다. 같은 계정의 글을 엮을 수 있는 값이라
    // 익명 게시판에서 내려보낼 이유가 없다. "내 글" 표시는 서버가 비교한 `is_author`로 한다.
    const { author_id: _authorId, ...publicPost } = post
    return NextResponse.json({ post: { ...publicPost, is_author: isAuthor } })
  } catch (error) {
    logger.error('커뮤니티 상세 조회 오류', { error })
    return NextResponse.json({ error: '게시글을 불러오지 못했습니다' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne, transaction } from '@/lib/db'
import { sanitizeUserInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { readableAudiences, type CommunityAudience } from '@/lib/community'

interface CommentRow {
  id: string
  author_id: string
  body: string
  created_at: string
  author_name: string | null
}

async function loadReadablePost(postId: string, userType: string | null, userId: string) {
  const post = await queryOne<{ id: string; audience: CommunityAudience; author_id: string }>(
    'SELECT id, audience, author_id FROM community_posts WHERE id = $1 AND deleted_at IS NULL',
    [postId]
  )
  if (!post) return { post: null, allowed: false }
  const allowed = post.author_id === userId || readableAudiences(userType).includes(post.audience)
  return { post, allowed }
}

// GET /api/community/posts/[id]/comments
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { id } = await params
  const { post, allowed } = await loadReadablePost(id, user.user_type, user.id)
  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: '접근할 수 없는 게시글입니다' }, { status: 403 })

  try {
    const comments = await query<CommentRow>(
      `SELECT c.id, c.author_id, c.body, c.created_at,
              COALESCE(pr.name, u.name) AS author_name
         FROM community_comments c
         JOIN users u ON u.id = c.author_id
         LEFT JOIN profiles pr ON pr.user_id = c.author_id
        WHERE c.post_id = $1 AND c.deleted_at IS NULL
        ORDER BY c.created_at ASC
        LIMIT 200`,
      [id]
    )
    return NextResponse.json({ comments })
  } catch (error) {
    logger.error('댓글 조회 오류', { error })
    return NextResponse.json({ error: '댓글을 불러오지 못했습니다' }, { status: 500 })
  }
}

const createSchema = z.object({ body: z.string().min(1, '내용을 입력해주세요').max(2000) })

// POST /api/community/posts/[id]/comments
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { id } = await params
  const { post, allowed } = await loadReadablePost(id, user.user_type, user.id)
  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: '접근할 수 없는 게시글입니다' }, { status: 403 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '잘못된 입력입니다' }, { status: 400 })
  }

  try {
    const comment = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        'INSERT INTO community_comments (post_id, author_id, body) VALUES ($1, $2, $3) RETURNING id',
        [id, user.id, sanitizeUserInput(parsed.data.body)]
      )
      await client.query('UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = $1', [id])
      return inserted.rows[0]
    })
    return NextResponse.json({ id: comment?.id }, { status: 201 })
  } catch (error) {
    logger.error('댓글 작성 오류', { error })
    return NextResponse.json({ error: '댓글 작성에 실패했습니다' }, { status: 500 })
  }
}

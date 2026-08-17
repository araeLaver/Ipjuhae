import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { sanitizeUserInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import {
  canPostTo,
  isCommunityAudience,
  readableAudiences,
  type CommunityAudience,
} from '@/lib/community'

interface PostRow {
  id: string
  author_id: string
  audience: string
  category: string | null
  title: string
  body: string
  view_count: number
  comment_count: number
  created_at: string
  author_name: string | null
}

// GET /api/community/posts?audience=&page=&limit=
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('audience')
  const allowed = readableAudiences(user.user_type)

  let audiences: CommunityAudience[] = allowed
  if (requested && requested !== 'all_boards') {
    if (!isCommunityAudience(requested) || !allowed.includes(requested)) {
      return NextResponse.json({ error: '접근할 수 없는 게시판입니다' }, { status: 403 })
    }
    audiences = [requested]
  }

  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
  const offset = (page - 1) * limit

  try {
    const rows = await query<PostRow>(
      `SELECT p.id, p.author_id, p.audience, p.category, p.title, p.body,
              p.view_count, p.comment_count, p.created_at,
              COALESCE(pr.name, u.name) AS author_name
         FROM community_posts p
         JOIN users u ON u.id = p.author_id
         LEFT JOIN profiles pr ON pr.user_id = p.author_id
        WHERE p.deleted_at IS NULL
          AND p.audience = ANY($1::text[])
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3`,
      [audiences, limit, offset]
    )
    return NextResponse.json({ posts: rows, page, limit, hasMore: rows.length === limit })
  } catch (error) {
    logger.error('커뮤니티 목록 조회 오류', { error })
    return NextResponse.json({ error: '게시글을 불러오지 못했습니다' }, { status: 500 })
  }
}

const createSchema = z.object({
  audience: z.enum(['all', 'tenant', 'landlord', 'broker']),
  category: z.string().max(40).optional(),
  title: z.string().min(1, '제목을 입력해주세요').max(200),
  body: z.string().min(1, '내용을 입력해주세요').max(10000),
})

// POST /api/community/posts
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '잘못된 입력입니다' }, { status: 400 })
  }
  const data = parsed.data

  if (!canPostTo(user.user_type, data.audience)) {
    return NextResponse.json({ error: '이 게시판에 글을 쓸 수 없습니다' }, { status: 403 })
  }

  try {
    const post = await queryOne<{ id: string }>(
      `INSERT INTO community_posts (author_id, audience, category, title, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        user.id,
        data.audience,
        data.category ? sanitizeUserInput(data.category) : null,
        sanitizeUserInput(data.title),
        sanitizeUserInput(data.body),
      ]
    )
    return NextResponse.json({ id: post?.id }, { status: 201 })
  } catch (error) {
    logger.error('커뮤니티 작성 오류', { error })
    return NextResponse.json({ error: '게시글 작성에 실패했습니다' }, { status: 500 })
  }
}

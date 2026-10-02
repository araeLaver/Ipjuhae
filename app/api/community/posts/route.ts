import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import crypto from 'node:crypto'
import { query, queryOne } from '@/lib/db'
import { sanitizeUserInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import {
  canPostTo,
  isCommunityAudience,
  readableAudiences,
  type CommunityAudience,
} from '@/lib/community'

/**
 * 목록 응답 한 줄.
 *
 * 작성자를 가리키는 값(`author_id`·`author_name`)은 **일부러 없다.** 커뮤니티는 익명
 * 게시판이고 글쓰기 화면이 그렇게 약속한다. `profiles.name`은 임차인 검증용 실명이라
 * 내려보내면 약속이 깨지고, `author_id`는 같은 계정의 글을 전부 엮을 수 있는 값이다.
 * 표시 이름은 클라이언트가 `author_role`에서 만든다(`authorDisplayName`). (DOW-1236)
 */
interface PostRow {
  id: string
  audience: string
  category: string | null
  title: string
  body: string
  view_count: number
  comment_count: number
  created_at: string
  /**
   * 운영자 여부만. `admin` 아니면 전부 `member`다.
   *
   * 실제 역할(`tenant`·`landlord`·`broker`)을 내려보내지 않는다 — 익명 게시판에서 역할
   * 라벨은 글쓴이의 신원 범위를 좁히고, 화면은 이 값을 운영자 판정에만 쓴다
   * (`AuthorRoleBadge`는 `admin`이 아니면 아무것도 렌더하지 않는다). (DOW-1262)
   */
  author_role: 'admin' | 'member'
}

// GET /api/community/posts?audience=&page=&limit=
export async function GET(request: Request) {
  // 읽기는 로그인을 요구하지 않는다. 커뮤니티가 유입 장치이므로 검색·SNS에서 들어온
  // 사람이 로그인 벽을 만나면 안 된다. 비로그인은 '전체' 판만 보이고,
  // 역할 판은 로그인해야 열린다(readableAudiences가 이미 그렇게 동작한다).
  const user = await getCurrentUser()
  const viewerType = user?.user_type ?? null

  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('audience')
  const allowed = readableAudiences(viewerType)

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
    // 저장된 작성 누계 대신 현재 공개 댓글만 집계한다(신고 숨김·삭제·복원 반영).
    const rows = await query<PostRow>(
      `SELECT p.id, p.audience, p.category, p.title, p.body,
              p.view_count, (SELECT COUNT(*)::int FROM community_comments c
                WHERE c.post_id = p.id AND c.deleted_at IS NULL AND c.hidden_at IS NULL
                  AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE
                    (b.blocker_id=$4::uuid AND b.blocked_id=c.author_id) OR (b.blocker_id=c.author_id AND b.blocked_id=$4::uuid))) AS comment_count, p.created_at,
              CASE WHEN u.user_type = 'admin' THEN 'admin' ELSE 'member' END AS author_role
         FROM community_posts p
         LEFT JOIN users u ON u.id = p.author_id
        WHERE p.deleted_at IS NULL AND p.hidden_at IS NULL
          AND p.audience = ANY($1::text[])
          AND NOT EXISTS (SELECT 1 FROM community_blocks b WHERE
            (b.blocker_id=$4::uuid AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$4::uuid))
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3`,
      [audiences, limit, offset, user?.id ?? null]
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
/** 익명 작성자를 구분하기 위한 값. 원문 IP는 저장하지 않는다. */
function authorHash(request: Request): string {
  return crypto
    .createHash('sha256')
    .update(`${getClientIp(request)}:${process.env.JWT_SECRET ?? 'ipjuhae'}`)
    .digest('hex')
    .slice(0, 32)
}

export async function POST(request: Request) {
  // 계정 없이 쓸 수 있다. 가입을 권할 단계가 아니라서 로그인 벽을 두지 않는다.
  const user = await getCurrentUser()

  if (!user) {
    // 대신 같은 곳에서 쏟아내는 것만 막는다.
    const limited = rateLimit(`community:${getClientIp(request)}`, { limit: 5, windowMs: 10 * 60_000 })
    if (!limited.success) {
      return NextResponse.json(
        { error: '잠시 후 다시 시도해주세요. 짧은 시간에 너무 많이 올렸습니다.' },
        { status: 429 }
      )
    }
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '잘못된 입력입니다' }, { status: 400 })
  }
  const data = parsed.data

  // 익명은 '전체' 판에만 쓴다. 역할 판은 그 역할인지 확인할 방법이 없다.
  if (!user && data.audience !== 'all') {
    return NextResponse.json({ error: '이 게시판은 로그인 후 쓸 수 있습니다' }, { status: 403 })
  }
  if (user && !canPostTo(user.user_type, data.audience)) {
    return NextResponse.json({ error: '이 게시판에 글을 쓸 수 없습니다' }, { status: 403 })
  }

  try {
    const post = await queryOne<{ id: string }>(
      `INSERT INTO community_posts (author_id, author_hash, audience, category, title, body)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        user?.id ?? null,
        user ? null : authorHash(request),
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

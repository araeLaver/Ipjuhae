import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import crypto from 'node:crypto'
import { query, queryOne, transaction } from '@/lib/db'
import { sanitizeUserInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { readableAudiences, type CommunityAudience } from '@/lib/community'

/**
 * 댓글 응답 한 줄.
 *
 * 작성자를 가리키는 값(`author_id`·`author_name`)은 **일부러 없다.** 댓글 입력창이
 * 익명이라고 약속하고, `profiles.name`은 임차인 검증용 실명이다. `author_id`는 계속
 * 저장하되(신고·정화 경로에 필요) 조회 응답에는 싣지 않는다. 표시 이름은 클라이언트가
 * `author_role`에서 만든다(`authorDisplayName`). (DOW-1236)
 */
interface CommentRow {
  id: string
  body: string
  created_at: string
  /** 작성자 계정의 역할. 운영자 답을 옆 사람 추측과 구분하는 유일한 근거다. */
  author_role: string
}

async function loadReadablePost(postId: string, userType: string | null, userId: string | null) {
  const post = await queryOne<{ id: string; audience: CommunityAudience; author_id: string }>(
    'SELECT id, audience, author_id FROM community_posts WHERE id = $1 AND deleted_at IS NULL AND hidden_at IS NULL',
    [postId]
  )
  if (!post) return { post: null, allowed: false }
  const allowed = post.author_id === userId || readableAudiences(userType).includes(post.audience)
  return { post, allowed }
}

// GET /api/community/posts/[id]/comments
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()

  const { id } = await params
  const { post, allowed } = await loadReadablePost(id, user?.user_type ?? null, user?.id ?? null)
  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: '접근할 수 없는 게시글입니다' }, { status: 403 })

  try {
    const comments = await query<CommentRow>(
      `SELECT c.id, c.body, c.created_at,
              COALESCE(u.user_type, 'guest') AS author_role
         FROM community_comments c
         LEFT JOIN users u ON u.id = c.author_id
        WHERE c.post_id = $1 AND c.deleted_at IS NULL AND c.hidden_at IS NULL
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

  if (!user) {
    // 글 작성(`posts/route.ts`)·신고(`reports/route.ts`)와 같은 방식으로 익명만 막는다.
    // 한도는 10분 15회 — 한 글타래에서 주고받는 게 정상이라 글 작성(10분 5회)보다 느슨해야
    // 하지만, 로그인 없이 쓰는 댓글을 무제한으로 두면 도배 경로가 그대로 열린다.
    const limited = rateLimit(`community-comment:${getClientIp(request)}`, { limit: 15, windowMs: 10 * 60_000 })
    if (!limited.success) {
      return NextResponse.json(
        { error: '잠시 후 다시 시도해주세요. 짧은 시간에 너무 많이 올렸습니다.' },
        { status: 429 }
      )
    }
  }

  const { id } = await params
  const { post, allowed } = await loadReadablePost(id, user?.user_type ?? null, user?.id ?? null)
  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: '접근할 수 없는 게시글입니다' }, { status: 403 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '잘못된 입력입니다' }, { status: 400 })
  }

  try {
    const comment = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        'INSERT INTO community_comments (post_id, author_id, author_hash, body) VALUES ($1, $2, $3, $4) RETURNING id',
        [
          id,
          user?.id ?? null,
          user
            ? null
            : crypto
                .createHash('sha256')
                .update(`${getClientIp(request)}:${process.env.JWT_SECRET ?? 'ipjuhae'}`)
                .digest('hex')
                .slice(0, 32),
          sanitizeUserInput(parsed.data.body),
        ]
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

import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'node:crypto'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { sanitizeUserInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

/** 신고가 이만큼 쌓이면 운영자 확인 전에 먼저 가린다. */
const AUTO_HIDE_AT = 3

const schema = z
  .object({
    postId: z.string().uuid().optional(),
    commentId: z.string().uuid().optional(),
    reason: z.string().min(1, '신고 사유를 골라주세요').max(200),
  })
  .refine((v) => v.postId || v.commentId, { message: '신고 대상이 없습니다' })

function reporterHash(request: Request): string {
  return crypto
    .createHash('sha256')
    .update(`${getClientIp(request)}:${process.env.JWT_SECRET ?? 'ipjuhae'}`)
    .digest('hex')
    .slice(0, 32)
}

// POST /api/community/reports
export async function POST(request: Request) {
  // 신고는 로그인 없이 할 수 있어야 한다. 글을 익명으로 쓰는 곳이라
  // 신고만 계정을 요구하면 아무도 신고하지 않는다.
  const user = await getCurrentUser()

  const limited = rateLimit(`report:${getClientIp(request)}`, { limit: 20, windowMs: 60 * 60_000 })
  if (!limited.success) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '잘못된 입력입니다' },
      { status: 400 }
    )
  }
  const { postId, commentId, reason } = parsed.data

  try {
    await query(
      `INSERT INTO community_reports (post_id, comment_id, reporter_id, reporter_hash, reason)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        postId ?? null,
        commentId ?? null,
        user?.id ?? null,
        user ? null : reporterHash(request),
        sanitizeUserInput(reason),
      ]
    )

    const target = postId ? 'post_id' : 'comment_id'
    const targetId = postId ?? commentId
    const counted = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM community_reports WHERE ${target} = $1`,
      [targetId]
    )
    const total = parseInt(counted?.n ?? '0', 10)

    if (total >= AUTO_HIDE_AT) {
      const table = postId ? 'community_posts' : 'community_comments'
      await query(
        `UPDATE ${table} SET hidden_at = NOW() WHERE id = $1 AND hidden_at IS NULL`,
        [targetId]
      )
      logger.warn('신고 누적으로 자동 비공개', { target, targetId, total })
    }

    return NextResponse.json({ ok: true, hidden: total >= AUTO_HIDE_AT })
  } catch (error) {
    logger.error('신고 처리 오류', { error })
    return NextResponse.json({ error: '신고를 접수하지 못했습니다' }, { status: 500 })
  }
}

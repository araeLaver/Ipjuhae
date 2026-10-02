import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { readableAudiences, type CommunityAudience } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
const schema = z.object({ postId: z.string().uuid().optional(), commentId: z.string().uuid().optional() })
  .refine(v => Boolean(v.postId) !== Boolean(v.commentId))

// Resolve the author server-side: no stable author ID is exposed in anonymous UGC.
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '차단은 로그인 후 이용해주세요.' }, { status: 401 })
  if (!rateLimit(`community-block:${user.id}`, { limit: 30, windowMs: 3600000 }).success)
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '잘못된 대상입니다.' }, { status: 400 })
  try {
    const { postId, commentId } = parsed.data
    const target = await queryOne<{ author_id: string | null; audience: CommunityAudience }>(postId
      ? 'SELECT author_id, audience FROM community_posts WHERE id=$1 AND deleted_at IS NULL AND hidden_at IS NULL'
      : `SELECT c.author_id, p.audience FROM community_comments c JOIN community_posts p ON p.id=c.post_id
         WHERE c.id=$1 AND c.deleted_at IS NULL AND c.hidden_at IS NULL AND p.deleted_at IS NULL AND p.hidden_at IS NULL`, [postId || commentId])
    if (!target || !readableAudiences(user.user_type).includes(target.audience))
      return NextResponse.json({ error: '대상을 찾을 수 없습니다.' }, { status: 404 })
    if (!target.author_id) return NextResponse.json({ error: '비로그인 작성자는 계정 차단할 수 없습니다. 글 또는 댓글을 신고해주세요.' }, { status: 409 })
    if (target.author_id === user.id) return NextResponse.json({ error: '본인은 차단할 수 없습니다.' }, { status: 400 })
    await query('INSERT INTO community_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user.id,target.author_id])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '차단을 처리하지 못했습니다.' }, { status: 500 })
  }
}

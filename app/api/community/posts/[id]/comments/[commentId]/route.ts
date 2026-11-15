import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { transaction } from '@/lib/db'
import { readableAudiences, type CommunityAudience } from '@/lib/community'
import { logger } from '@/lib/logger'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  const { id, commentId } = await params
  if (![id, commentId].every(value => z.string().uuid().safeParse(value).success)) {
    return NextResponse.json({ error: '댓글을 찾을 수 없습니다' }, { status: 404 })
  }
  try {
    const result = await transaction(async client => {
      // 부모를 먼저 잠가 삭제/숨김 및 동일 글의 댓글 삭제와 순서를 맞춘다.
      const parent = await client.query<{ author_id: string | null; audience: CommunityAudience }>(
        'SELECT author_id, audience FROM community_posts WHERE id = $1 AND deleted_at IS NULL AND hidden_at IS NULL FOR UPDATE', [id])
      const post = parent.rows[0]
      if (!post) return { status: 404, error: '게시글을 찾을 수 없습니다' }
      if (post.author_id !== user.id && !readableAudiences(user.user_type).includes(post.audience)) {
        return { status: 403, error: '접근할 수 없는 게시글입니다' }
      }
      const found = await client.query<{ author_id: string | null }>(
        'SELECT author_id FROM community_comments WHERE id = $1 AND post_id = $2 AND deleted_at IS NULL AND hidden_at IS NULL FOR UPDATE', [commentId, id])
      if (!found.rows[0]) return { status: 404, error: '댓글을 찾을 수 없습니다' }
      if (found.rows[0].author_id !== user.id) return { status: 403, error: '본인 댓글만 삭제할 수 있습니다' }
      await client.query('UPDATE community_comments SET deleted_at = NOW() WHERE id = $1 AND post_id = $2 AND author_id = $3', [commentId, id, user.id])
      // 저장 누계는 수정하지 않는다. 모든 읽기 경로와 동일한 공개 집계를 반환한다.
      const count = await client.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM community_comments WHERE post_id = $1 AND deleted_at IS NULL AND hidden_at IS NULL', [id])
      return { status: 200, deleted: true, id: commentId, total: count.rows[0].total }
    })
    const { status, ...payload } = result
    return NextResponse.json(payload, { status })
  } catch (error) {
    logger.error('커뮤니티 댓글 삭제 오류', { error })
    return NextResponse.json({ error: '삭제하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}

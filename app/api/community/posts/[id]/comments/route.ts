import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne, transaction } from '@/lib/db'
import { sanitizeUserInput } from '@/lib/sanitize'

interface PostSpaceRow {
  space: 'tenant' | 'landlord'
}

interface CommunityCommentRow {
  id: string
  content: string
  created_at: string
  author_id: string
  author_name: string | null
  author_email: string
  author_type: string
}

function canWrite(space: string, userType: string): boolean {
  return userType === space || userType === 'admin'
}

function toComment(row: CommunityCommentRow) {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      name: row.author_name || row.author_email.split('@')[0],
      userType: row.author_type,
    },
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params
    const post = await queryOne<PostSpaceRow>(
      'SELECT space FROM community_posts WHERE id = $1',
      [id]
    )
    if (!post) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 })
    }
    if (!canWrite(post.space, user.user_type)) {
      return NextResponse.json({ error: '해당 커뮤니티에 댓글을 작성할 권한이 없습니다' }, { status: 403 })
    }

    const body = await request.json()
    const content = sanitizeUserInput(String(body.content || ''))
    if (content.length < 2 || content.length > 1000) {
      return NextResponse.json({ error: '댓글은 2자 이상 1000자 이하로 입력해주세요' }, { status: 400 })
    }

    const comment = await transaction(async (client) => {
      const inserted = await client.query<CommunityCommentRow>(
        `WITH inserted AS (
           INSERT INTO community_comments (post_id, author_id, content)
           VALUES ($1, $2, $3)
           RETURNING *
         )
         SELECT
           c.id,
           c.content,
           c.created_at::text,
           u.id AS author_id,
           u.name AS author_name,
           u.email AS author_email,
           u.user_type AS author_type
         FROM inserted c
         JOIN users u ON u.id = c.author_id`,
        [id, user.id, content]
      )

      await client.query(
        'UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = $1',
        [id]
      )

      return inserted.rows[0]
    })

    return NextResponse.json({ comment: toComment(comment) }, { status: 201 })
  } catch (error) {
    console.error('Create community comment error:', error)
    return NextResponse.json({ error: '댓글 작성 중 오류가 발생했습니다' }, { status: 500 })
  }
}

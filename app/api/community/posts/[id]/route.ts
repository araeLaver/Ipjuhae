import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

interface CommunityPostRow {
  id: string
  space: 'tenant' | 'landlord'
  category: string
  title: string
  content: string
  is_pinned: boolean
  view_count: number
  comment_count: number
  created_at: string
  author_id: string
  author_name: string | null
  author_email: string
  author_type: string
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

function toPost(row: CommunityPostRow) {
  return {
    id: row.id,
    space: row.space,
    category: row.category,
    title: row.title,
    content: row.content,
    isPinned: row.is_pinned,
    viewCount: row.view_count,
    commentCount: row.comment_count,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      name: row.author_name || row.author_email.split('@')[0],
      userType: row.author_type,
    },
  }
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await query('UPDATE community_posts SET view_count = view_count + 1 WHERE id = $1', [id])

  const post = await queryOne<CommunityPostRow>(
    `SELECT
       p.id,
       p.space,
       p.category,
       p.title,
       p.content,
       p.is_pinned,
       p.view_count,
       p.comment_count,
       p.created_at::text,
       u.id AS author_id,
       u.name AS author_name,
       u.email AS author_email,
       u.user_type AS author_type
     FROM community_posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.id = $1`,
    [id]
  )

  if (!post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 })
  }

  const comments = await query<CommunityCommentRow>(
    `SELECT
       c.id,
       c.content,
       c.created_at::text,
       u.id AS author_id,
       u.name AS author_name,
       u.email AS author_email,
       u.user_type AS author_type
     FROM community_comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [id]
  )

  return NextResponse.json({
    post: toPost(post),
    comments: comments.map(toComment),
  })
}

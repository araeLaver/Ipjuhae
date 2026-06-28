import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { sanitizeUserInput } from '@/lib/sanitize'

type CommunitySpace = 'tenant' | 'landlord'

interface CommunityPostRow {
  id: string
  space: CommunitySpace
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

const VALID_SPACES: CommunitySpace[] = ['tenant', 'landlord']
const VALID_CATEGORIES = ['general', 'question', 'tip', 'review']

function parseSpace(raw: string | null): CommunitySpace {
  return raw === 'landlord' ? 'landlord' : 'tenant'
}

function canWrite(space: CommunitySpace, userType: string): boolean {
  return userType === space || userType === 'admin'
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const space = parseSpace(searchParams.get('space'))
  const category = searchParams.get('category')
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 50)

  const conditions = ['p.space = $1']
  const values: unknown[] = [space]
  let idx = 2

  if (category && category !== 'all' && VALID_CATEGORIES.includes(category)) {
    conditions.push(`p.category = $${idx++}`)
    values.push(category)
  }

  values.push(limit)

  const rows = await query<CommunityPostRow>(
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
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.is_pinned DESC, p.created_at DESC
     LIMIT $${idx}`,
    values
  )

  return NextResponse.json({ posts: rows.map(toPost) })
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const space = body.space as CommunitySpace
    const category = VALID_CATEGORIES.includes(body.category) ? body.category : 'general'
    const title = sanitizeUserInput(String(body.title || ''))
    const content = sanitizeUserInput(String(body.content || ''))

    if (!VALID_SPACES.includes(space)) {
      return NextResponse.json({ error: '유효하지 않은 커뮤니티 공간입니다' }, { status: 400 })
    }
    if (!canWrite(space, user.user_type)) {
      return NextResponse.json({ error: '해당 커뮤니티에 글을 작성할 권한이 없습니다' }, { status: 403 })
    }
    if (title.length < 2 || title.length > 120) {
      return NextResponse.json({ error: '제목은 2자 이상 120자 이하로 입력해주세요' }, { status: 400 })
    }
    if (content.length < 5 || content.length > 3000) {
      return NextResponse.json({ error: '본문은 5자 이상 3000자 이하로 입력해주세요' }, { status: 400 })
    }

    const [row] = await query<CommunityPostRow>(
      `WITH inserted AS (
         INSERT INTO community_posts (space, author_id, category, title, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *
       )
       SELECT
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
       FROM inserted p
       JOIN users u ON u.id = p.author_id`,
      [space, user.id, category, title, content]
    )

    return NextResponse.json({ post: toPost(row) }, { status: 201 })
  } catch (error) {
    console.error('Create community post error:', error)
    return NextResponse.json({ error: '커뮤니티 글 작성 중 오류가 발생했습니다' }, { status: 500 })
  }
}

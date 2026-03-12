import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAdminUser, logAdminAction } from '@/lib/admin'

interface UserDetailRow {
  id: string
  email: string
  name: string | null
  user_type: string
  created_at: string
  phone_number: string | null
  phone_verified: boolean
}

interface ProfileRow {
  id: string
  name: string
  age_range: string
  family_type: string
  pets: string[]
  smoking: boolean
  noise_level: string | null
  duration: string | null
  trust_score: number
  is_complete: boolean
  bio: string | null
  intro: string | null
  created_at: string
}

interface VerificationRow {
  employment_verified: boolean
  employment_company: string | null
  income_verified: boolean
  income_range: string | null
  credit_verified: boolean
  credit_grade: number | null
}

interface DocRow {
  id: string
  document_type: string
  file_name: string
  status: string
  created_at: string
}

interface RefRow {
  id: string
  landlord_name: string | null
  landlord_phone: string
  status: string
  created_at: string
  completed_at: string | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { id } = await params

  const user = await queryOne<UserDetailRow>(
    `SELECT id, email, name, user_type, created_at::text, phone_number, phone_verified
     FROM users WHERE id = $1`,
    [id]
  )

  if (!user) {
    return NextResponse.json({ error: '유저를 찾을 수 없습니다' }, { status: 404 })
  }

  const [profile, verification, documents, references] = await Promise.all([
    queryOne<ProfileRow>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [id]
    ),
    queryOne<VerificationRow>(
      'SELECT * FROM verifications WHERE user_id = $1',
      [id]
    ),
    query<DocRow>(
      `SELECT id, document_type, file_name, status, created_at::text
       FROM verification_documents WHERE user_id = $1 ORDER BY created_at DESC`,
      [id]
    ),
    query<RefRow>(
      `SELECT id, landlord_name, landlord_phone, status, created_at::text, completed_at::text
       FROM landlord_references WHERE user_id = $1 ORDER BY created_at DESC`,
      [id]
    ),
  ])

  return NextResponse.json({ user, profile, verification, documents, references })
}

// PATCH: user_type 변경 (admin ↔ landlord ↔ tenant)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as { user_type?: string }

  if (!body.user_type || !['tenant', 'landlord', 'admin'].includes(body.user_type)) {
    return NextResponse.json({ error: '유효하지 않은 user_type' }, { status: 400 })
  }

  await query(
    'UPDATE users SET user_type = $1, updated_at = NOW() WHERE id = $2',
    [body.user_type, id]
  )

  await logAdminAction(admin.id, 'change_user_type', 'user', id, { user_type: body.user_type })

  return NextResponse.json({ ok: true })
}

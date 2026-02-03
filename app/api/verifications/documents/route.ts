import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { VerificationDocument } from '@/types/database'

const VALID_TYPES = ['employment', 'income', 'credit']

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { documentType, fileName } = await request.json()

    if (!documentType || !VALID_TYPES.includes(documentType)) {
      return NextResponse.json({ error: '유효하지 않은 서류 유형입니다' }, { status: 400 })
    }

    if (!fileName) {
      return NextResponse.json({ error: '파일명이 필요합니다' }, { status: 400 })
    }

    const [doc] = await query<VerificationDocument>(
      `INSERT INTO verification_documents (user_id, document_type, file_name, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [user.id, documentType, fileName]
    )

    return NextResponse.json({ document: doc })
  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json({ error: '서류 업로드 중 오류가 발생했습니다' }, { status: 500 })
  }
}

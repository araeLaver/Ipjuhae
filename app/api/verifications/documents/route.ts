import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { uploadVerificationDocument } from '@/lib/storage'
import { VerificationDocument } from '@/types/database'

const VALID_TYPES = ['employment', 'income', 'credit']
const MAX_FILE_SIZE = 20 * 1024 * 1024

async function parseDocumentPayload(request: Request) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const documentType = String(formData.get('documentType') || '')
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return { error: '업로드할 파일이 필요합니다' }
    }
    if (file.size > MAX_FILE_SIZE) {
      return { error: '파일 크기는 20MB 이하여야 합니다' }
    }

    return {
      documentType,
      fileName: file.name,
      file,
      fileUrl: null,
      contentType: file.type || 'application/octet-stream',
    }
  }

  const { documentType, fileName, fileUrl } = await request.json()
  return {
    documentType,
    fileName,
    fileUrl: fileUrl || null,
    file: null,
    contentType: null,
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = await parseDocumentPayload(request)
    if ('error' in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 })
    }

    const { documentType, fileName } = payload

    if (!documentType || !VALID_TYPES.includes(documentType)) {
      return NextResponse.json({ error: '유효하지 않은 서류 유형입니다' }, { status: 400 })
    }

    if (!fileName) {
      return NextResponse.json({ error: '파일명이 필요합니다' }, { status: 400 })
    }

    let fileUrl = payload.fileUrl || null
    if (payload.file) {
      const upload = await uploadVerificationDocument(
        user.id,
        documentType,
        payload.file,
        fileName,
        payload.contentType || 'application/octet-stream'
      )

      if (!upload.success) {
        return NextResponse.json(
          { error: upload.error || '파일 저장에 실패했습니다' },
          { status: 400 }
        )
      }
      fileUrl = upload.url || null
    }

    const [doc] = await query<VerificationDocument>(
      `INSERT INTO verification_documents (user_id, document_type, file_name, file_url, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [user.id, documentType, fileName, fileUrl]
    )

    return NextResponse.json({ document: doc })
  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json({ error: '서류 업로드 중 오류가 발생했습니다' }, { status: 500 })
  }
}

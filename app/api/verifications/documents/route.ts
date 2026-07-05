import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { uploadVerificationDocument } from '@/lib/storage'
import { ValidationValue, EvidenceRecord, VerificationDocument } from '@/types/database'
import { extractTextFromDocument } from '@/lib/ocr-pipeline'
import { logger } from '@/lib/logger'

const VALID_TYPES = ['employment', 'income', 'credit']
const MAX_FILE_SIZE = 20 * 1024 * 1024

interface ParsePayloadResult {
  documentType: string
  fileName: string
  fileUrl: string | null
  file: File | null
  contentType: string | null
  error?: string
}

async function parseDocumentPayload(request: Request): Promise<ParsePayloadResult | { error: string }> {
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

function safeValidationText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 3000)
}

function createExtractionSource(documentType: string, source: 'image' | 'pdf'): ValidationValue {
  return {
    id: '',
    owner_user_id: '',
    subject_type: 'tenant',
    subject_id: null,
    validation_key: `${documentType}_ocr_source`,
    validation_score: null,
    validation_numeric: null,
    validation_text: source,
    validation_flag: null,
    status: 'valid',
    source_evidence_id: null,
    source_comment: null,
    created_at: new Date(),
    updated_at: new Date(),
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
        payload.contentType || 'application/octet-stream',
      )

      if (!upload.success) {
        return NextResponse.json(
          { error: upload.error || '파일 저장에 실패했습니다' },
          { status: 400 },
        )
      }
      fileUrl = upload.url || null
    }

    if (payload.file && !fileUrl) {
      return NextResponse.json({ error: '파일 저장 URL을 생성하지 못했습니다' }, { status: 400 })
    }

    const [doc] = await query<VerificationDocument>(
      `INSERT INTO verification_documents (user_id, document_type, file_name, file_url, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [user.id, documentType, fileName, fileUrl],
    )

    const [evidence] = fileUrl
      ? await query<EvidenceRecord>(
          `INSERT INTO evidence_records
            (owner_user_id, uploader_user_id, purpose, target_type, target_id, document_type, file_name, file_url, extraction_status)
           VALUES ($1, $1, 'tenant_verification', 'document', $2, $3, $4, $5, 'raw_uploaded')
           RETURNING *`,
          [user.id, doc.id, documentType, fileName, fileUrl],
        )
      : [null]

    const createdValidations: ValidationValue[] = []

        if (payload.file && evidence) {
          try {
        await query('UPDATE evidence_records SET extraction_status = $2 WHERE id = $1', [
          evidence.id,
          'ocr_pending',
        ])

        const { text, source } = await extractTextFromDocument(payload.file, {
          prompt: '문서의 핵심 텍스트를 정확하게 추출해 주세요.',
        })
        const textLength = text.replace(/\s/g, '').length

        await query('UPDATE evidence_records SET extraction_status = $2, extraction_payload = $3 WHERE id = $1', [
          evidence.id,
          'ocr_complete',
          JSON.stringify({
            text,
            source,
            documentType,
            analyzedAt: new Date().toISOString(),
            provider: 'ai-omakase',
          }),
        ])

        const [ocrLengthValidation] = await query<ValidationValue>(
          `INSERT INTO validation_values
            (owner_user_id, subject_type, subject_id, validation_key, validation_score, validation_numeric, validation_text, validation_flag, status, source_evidence_id, source_comment)
           VALUES ($1, 'tenant', $2, $3, $4, $5, $6, $7, 'valid', $8, $9)
           RETURNING *`,
          [
            user.id,
            user.id,
            `${documentType}_ocr_text_length`,
            textLength,
            textLength,
            safeValidationText(text),
            'ocr',
            evidence.id,
            `OCR(${source})`,
          ],
        )

        const [ocrSourceValidation] = await query<ValidationValue>(
          `INSERT INTO validation_values
            (owner_user_id, subject_type, subject_id, validation_key, validation_score, validation_numeric, validation_text, validation_flag, status, source_evidence_id, source_comment)
           VALUES ($1, 'tenant', $2, $3, NULL, NULL, $4, 'ocr', 'valid', $5, $6)
            RETURNING *`,
          [
            user.id,
            user.id,
            `${documentType}_ocr_source`,
            source,
            evidence.id,
            `OCR source: ${source}`,
          ],
        )

        createdValidations.push(ocrLengthValidation, ocrSourceValidation)
      } catch (error) {
        logger.error('문서 OCR 추출 실패', {
          userId: user.id,
          documentType,
          documentId: doc.id,
          error,
        })

        await query(
          'UPDATE evidence_records SET extraction_status = $2, extraction_payload = $3 WHERE id = $1',
          [
            evidence.id,
            'ocr_failed',
            JSON.stringify({
              error: error instanceof Error ? error.message : 'OCR 처리 실패',
              documentType,
              analyzedAt: new Date().toISOString(),
            }),
          ],
        )

        const [errorValidation] = await query<ValidationValue>(
          `INSERT INTO validation_values
            (owner_user_id, subject_type, subject_id, validation_key, validation_score, validation_numeric, validation_text, validation_flag, status, source_evidence_id, source_comment)
           VALUES ($1, 'tenant', $2, $3, NULL, NULL, NULL, NULL, 'needs_review', $4, $5)
            RETURNING *`,
          [
            user.id,
            user.id,
            `${documentType}_ocr_error`,
            evidence.id,
            error instanceof Error ? error.message : 'OCR 처리 실패',
          ],
        )

        createdValidations.push(errorValidation)
      }
    }

    const [validationCount] = await query<{ validation_count: string }>(
      `SELECT COUNT(*)::integer AS validation_count
       FROM validation_values
       WHERE owner_user_id = $1 AND subject_type = 'tenant' AND subject_id = $2`,
      [user.id, user.id],
    )

    return NextResponse.json({
      document: doc,
      evidence,
      validations: createdValidations,
      validationCount: validationCount?.validation_count ?? 0,
    })
  } catch (error) {
    logger.error('Document upload error:', { error })
    return NextResponse.json({ error: '서류 업로드 중 오류가 발생했습니다' }, { status: 500 })
  }
}

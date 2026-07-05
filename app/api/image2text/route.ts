import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { isUploadedFile, validateDocumentFile } from '@/lib/document-file'
import { extractTextFromDocument } from '@/lib/ocr-pipeline'

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart/form-data가 필요합니다' }, { status: 400 })
    }

    const formData = await request.formData()
    const image = formData.get('image') || formData.get('file')
    const prompt = String(formData.get('prompt') || '')
    const pdfUnlockCode = String(formData.get('pdf_unlock_code') || '')
    const temperatureRaw = String(formData.get('temperature') || '0.1')
    const temperature = Number.parseFloat(temperatureRaw)

    if (!isUploadedFile(image)) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다' }, { status: 400 })
    }

    const validation = validateDocumentFile(image)
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { text, source } = await extractTextFromDocument(image, {
      prompt,
      temperature: Number.isFinite(temperature) ? temperature : 0.1,
      pdfUnlockCode: pdfUnlockCode || undefined,
    })

    return NextResponse.json({
      text,
      provider: 'ai-omakase',
      source,
    })
  } catch (error) {
    console.error('Image2Text error:', error)
    return NextResponse.json(
      { error: '이미지 텍스트 추출 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

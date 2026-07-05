import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/admin', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/ocr-pipeline', () => ({
  extractTextFromDocument: vi.fn(),
}))

import { POST as imageToText } from '@/app/api/image2text/route'
import { getAdminUser } from '@/lib/admin'
import { extractTextFromDocument } from '@/lib/ocr-pipeline'

function multipartRequest(file: File) {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('prompt', 'extract text')

  return new Request('http://localhost:3000/api/image2text', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/image2text security checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires an admin user before running OCR', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)

    const file = new File(['fake'], 'doc.png', { type: 'image/png' })
    const res = await imageToText(multipartRequest(file))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toContain('관리자 권한')
    expect(extractTextFromDocument).not.toHaveBeenCalled()
  })

  it('rejects unsupported file types before running OCR', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', user_type: 'admin' } as never)

    const file = new File(['<html></html>'], 'doc.html', { type: 'text/html' })
    const res = await imageToText(multipartRequest(file))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('PDF, JPG, PNG')
    expect(extractTextFromDocument).not.toHaveBeenCalled()
  })

  it('runs OCR for admin users with supported files', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', user_type: 'admin' } as never)
    vi.mocked(extractTextFromDocument).mockResolvedValue({ text: '추출 결과', source: 'image' })

    const file = new File(['png-data'], 'doc.png', { type: 'image/png' })
    const res = await imageToText(multipartRequest(file))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      text: '추출 결과',
      provider: 'ai-omakase',
      source: 'image',
    })
    expect(extractTextFromDocument).toHaveBeenCalledOnce()
  })
})

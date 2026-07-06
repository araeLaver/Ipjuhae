import { beforeEach, describe, expect, it, vi } from 'vitest'
import { File as NodeFile } from 'node:buffer'

Object.defineProperty(globalThis, 'File', {
  value: NodeFile,
  configurable: true,
})

vi.mock('@/lib/admin', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/ocr-pipeline', () => ({
  extractTextFromDocument: vi.fn(),
}))

import { POST as imageToText } from '@/app/api/image2text/route'
import { getAdminUser } from '@/lib/admin'
import { extractTextFromDocument } from '@/lib/ocr-pipeline'

function multipartRequest(file: { name: string; type: string; content: string }) {
  const boundary = '----rentme-test-boundary'
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="image"; filename="${file.name}"`,
    `Content-Type: ${file.type}`,
    '',
    file.content,
    `--${boundary}`,
    'Content-Disposition: form-data; name="prompt"',
    '',
    'extract text',
    `--${boundary}--`,
    '',
  ].join('\r\n')

  return new Request('http://localhost:3000/api/image2text', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  })
}

describe('POST /api/image2text security checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires an admin user before running OCR', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)

    const file = { name: 'doc.png', type: 'image/png', content: 'fake' }
    const res = await imageToText(multipartRequest(file))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toContain('관리자 권한')
    expect(extractTextFromDocument).not.toHaveBeenCalled()
  })

  it('rejects unsupported file types before running OCR', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', user_type: 'admin' } as never)

    const file = { name: 'doc.html', type: 'text/html', content: '<html></html>' }
    const res = await imageToText(multipartRequest(file))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('PDF, JPG, PNG')
    expect(extractTextFromDocument).not.toHaveBeenCalled()
  })

  it('runs OCR for admin users with supported files', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', user_type: 'admin' } as never)
    vi.mocked(extractTextFromDocument).mockResolvedValue({ text: '추출 결과', source: 'image' })

    const file = { name: 'doc.png', type: 'image/png', content: 'png-data' }
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

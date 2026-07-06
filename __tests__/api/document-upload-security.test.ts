import { beforeEach, describe, expect, it, vi } from 'vitest'
import { File as NodeFile } from 'node:buffer'

Object.defineProperty(globalThis, 'File', {
  value: NodeFile,
  configurable: true,
})

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  uploadVerificationDocument: vi.fn(),
}))

vi.mock('@/lib/ocr-pipeline', () => ({
  extractTextFromDocument: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { POST as uploadDocument } from '@/app/api/verifications/documents/route'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { uploadVerificationDocument } from '@/lib/storage'
import { extractTextFromDocument } from '@/lib/ocr-pipeline'

function jsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/verifications/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function multipartRequest(file: { name: string; type: string; content: string }) {
  const boundary = '----rentme-test-boundary'
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="documentType"',
    '',
    'income',
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${file.name}"`,
    `Content-Type: ${file.type}`,
    '',
    file.content,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  return new Request('http://localhost:3000/api/verifications/documents', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  })
}

describe('POST /api/verifications/documents security checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never)
  })

  it('rejects client-supplied fileUrl so users cannot register arbitrary evidence URLs', async () => {
    const res = await uploadDocument(jsonRequest({
      documentType: 'income',
      fileName: 'income.pdf',
      fileUrl: 'https://attacker.example/payload.html',
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('파일 URL 직접 지정')
    expect(query).not.toHaveBeenCalled()
    expect(uploadVerificationDocument).not.toHaveBeenCalled()
  })

  it('rejects unsupported multipart file types before storage or OCR', async () => {
    const file = { name: 'payload.html', type: 'text/html', content: '<script>alert(1)</script>' }

    const res = await uploadDocument(multipartRequest(file))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('PDF, JPG, PNG')
    expect(query).not.toHaveBeenCalled()
    expect(uploadVerificationDocument).not.toHaveBeenCalled()
    expect(extractTextFromDocument).not.toHaveBeenCalled()
  })
})

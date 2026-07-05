import { describe, expect, it } from 'vitest'

import { normalizeDocumentContentType, validateDocumentFile } from '@/lib/document-file'

describe('document file validation', () => {
  it('allows supported document content types', () => {
    expect(normalizeDocumentContentType('proof.pdf', 'application/pdf')).toBe('application/pdf')
    expect(normalizeDocumentContentType('proof.jpg', 'image/jpeg')).toBe('image/jpeg')
    expect(normalizeDocumentContentType('proof.png', 'image/png')).toBe('image/png')
  })

  it('rejects mismatched extensions and content types', () => {
    expect(normalizeDocumentContentType('proof.pdf', 'text/html')).toBeNull()
    expect(normalizeDocumentContentType('proof.png', 'application/pdf')).toBeNull()
  })

  it('falls back to the extension for octet-stream uploads', () => {
    expect(normalizeDocumentContentType('proof.pdf', 'application/octet-stream')).toBe('application/pdf')
  })

  it('rejects oversize files', () => {
    const file = new File([new Uint8Array(8)], 'proof.png', { type: 'image/png' })
    expect(validateDocumentFile(file, 4)).toMatchObject({ error: expect.stringContaining('20MB') })
  })
})

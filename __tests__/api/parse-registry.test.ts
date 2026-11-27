import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/check/parse-registry/route'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/check/parse-registry', () => {
  it('OPENAI_API_KEY가 없으면 503과 텍스트 붙여넣기 안내를 반환한다', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const res = await POST(new Request('http://localhost/api/check/parse-registry', { method: 'POST' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe('AI_UNAVAILABLE')
  })

  it('허용되지 않은 파일 형식은 400으로 차단한다', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-only')
    const form = new FormData()
    form.append('file', new File(['hello'], 'doc.pdf', { type: 'application/pdf' }))
    const res = await POST(
      new Request('http://localhost/api/check/parse-registry', { method: 'POST', body: form })
    )
    expect(res.status).toBe(400)
  })
})

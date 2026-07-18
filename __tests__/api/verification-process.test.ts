import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { POST } from '@/app/api/verifications/process/route'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

function makeRequest(documentId = 'document-1'): Request {
  return new Request('http://localhost:3000/api/verifications/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId }),
  })
}

describe('POST /api/verifications/process', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('기본 설정에서는 인증 및 DB 접근 전에 410으로 폐쇄한다', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('ALLOW_LEGACY_MOCK_VERIFICATION', '')

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(410)
    expect(data.code).toBe('LEGACY_MOCK_VERIFICATION_DISABLED')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(getCurrentUser).not.toHaveBeenCalled()
    expect(queryOne).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('production에서는 opt-in 값이 true여도 항상 410으로 폐쇄한다', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_LEGACY_MOCK_VERIFICATION', 'true')

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(410)
    expect(data.code).toBe('LEGACY_MOCK_VERIFICATION_DISABLED')
    expect(getCurrentUser).not.toHaveBeenCalled()
    expect(queryOne).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('비운영 환경에서 명시적으로 opt-in한 경우에만 기존 인증 흐름을 연다', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ALLOW_LEGACY_MOCK_VERIFICATION', 'true')
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'tester@example.com',
    } as never)
    vi.mocked(queryOne).mockResolvedValue({
      id: 'document-1',
      user_id: '11111111-1111-4111-8111-111111111111',
      document_type: 'employment',
      status: 'pending',
    } as never)
    vi.mocked(query).mockResolvedValue([])

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('processing')
    expect(getCurrentUser).toHaveBeenCalledOnce()
    expect(queryOne).toHaveBeenCalledOnce()
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'processing'"),
      ['document-1']
    )
  })
})

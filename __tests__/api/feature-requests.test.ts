import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({
  getAdminUser: vi.fn(),
}))

import { POST } from '@/app/api/feature-requests/route'
import { GET as adminGET } from '@/app/api/admin/feature-requests/route'
import { getAdminUser } from '@/lib/admin'
import { query } from '@/lib/db'

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/feature-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/feature-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(query).mockResolvedValue([])
  })

  it('빈 메시지를 DB 접근 전에 거부한다', async () => {
    const empty = await POST(request({ message: '   ' }))
    const missing = await POST(request({}))

    expect(empty.status).toBe(400)
    expect(missing.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('2000자 초과 메시지를 거부한다', async () => {
    const response = await POST(request({ message: 'a'.repeat(2001) }))

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('잘못된 user_type을 거부한다', async () => {
    const response = await POST(request({ message: '월세 자동이체 원해요', user_type: 'admin' }))

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('유효한 의견을 저장하고 알 수 없는 source는 preview로 정규화한다', async () => {
    const response = await POST(
      request({ message: '  월세 자동이체 원해요  ', contact: '010-1234-5678', source: 'hacked' })
    )

    expect(response.status).toBe(201)
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO feature_requests'), [
      '월세 자동이체 원해요',
      '010-1234-5678',
      null,
      'preview',
    ])
  })

  it('landing source와 user_type을 그대로 저장한다', async () => {
    const response = await POST(request({ message: '집주인 후기 기능', user_type: 'tenant', source: 'landing' }))

    expect(response.status).toBe(201)
    expect(query).toHaveBeenCalledWith(expect.any(String), ['집주인 후기 기능', null, 'tenant', 'landing'])
  })
})

describe('/api/admin/feature-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(query).mockResolvedValue([])
  })

  it('관리자가 아니면 403을 반환한다', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null as never)

    const response = await adminGET()

    expect(response.status).toBe(403)
    expect(query).not.toHaveBeenCalled()
  })

  it('관리자에게 최신순 목록을 반환한다', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ userId: 'admin' } as never)
    vi.mocked(query).mockResolvedValue([{ id: 1, message: '테스트', source: 'preview' }] as never)

    const response = await adminGET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.requests).toHaveLength(1)
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'))
  })
})

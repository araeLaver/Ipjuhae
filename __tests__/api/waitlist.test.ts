import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ query: vi.fn(), queryOne: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { POST } from '@/app/api/waitlist/route'
import { query, queryOne } from '@/lib/db'

function request(user_type: string, consent = true): Request {
  return new Request('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pilot@example.invalid', user_type, consent }),
  })
}

describe('파일럿 신청 역할과 저장 계약', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(query).mockResolvedValue([])
    vi.mocked(queryOne).mockResolvedValue({ count: '1' })
  })

  it.each(['tenant', 'landlord', 'broker'])('%s 신청을 기존 저장 형식으로 받는다', async (role) => {
    const response = await POST(request(role))
    expect(response.status).toBe(201)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO waitlist'),
      [null, 'pilot@example.invalid', role, null, expect.any(String), null, null, null, null],
    )
    expect(await response.json()).toEqual({ message: '신청이 완료되었습니다', count: 1 })
  })

  it('임대인도 개인정보 동의 없이는 저장하지 않는다', async () => {
    expect((await POST(request('landlord', false))).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('지원하지 않는 역할은 저장하지 않는다', async () => {
    expect((await POST(request('admin'))).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  verifyTokenAllowed: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { cookies } from 'next/headers'
import { GET, POST } from '@/app/api/messages/conversations/route'
import { verifyTokenAllowed } from '@/lib/auth'
import { query } from '@/lib/db'

const brokerId = '11111111-1111-4111-8111-111111111111'
const tenantId = '22222222-2222-4222-8222-222222222222'
const adminId = '33333333-3333-4333-8333-333333333333'

function mockAuth(userId: string) {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'auth_token') return { value: 'test-token' }
      return undefined
    }),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
  vi.mocked(verifyTokenAllowed).mockResolvedValue({ userId } as never)
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/messages/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('messages conversations API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('대화 목록 상대 역할을 대화 컬럼 위치가 아니라 users.user_type에서 반환한다', async () => {
    mockAuth(tenantId)
    vi.mocked(query)
      .mockResolvedValueOnce([
        {
          id: 'conversation-1',
          landlord_id: brokerId,
          tenant_id: tenantId,
          last_message_at: '2026-09-25T00:00:00.000Z',
          created_at: '2026-09-25T00:00:00.000Z',
          other_user_name: '중개사',
          other_user_id: brokerId,
          other_user_type: 'broker',
          last_message: '안녕하세요',
          unread_count: 0,
        },
      ])
      .mockResolvedValueOnce([{ total: '1' }])

    const response = await GET(new Request('http://localhost:3000/api/messages/conversations'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.conversations[0]).toMatchObject({
      other_user_id: brokerId,
      other_user_type: 'broker',
    })
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('tu.user_type'),
      [tenantId, 20, 0],
    )
  })

  it('broker 발신 대화 생성이 두 참가자 ID를 targetUserId로 무너뜨리지 않는다', async () => {
    mockAuth(brokerId)
    vi.mocked(query)
      .mockResolvedValueOnce([{ user_type: 'broker' }])
      .mockResolvedValueOnce([{ user_type: 'tenant' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'conversation-1' }])

    const response = await POST(postRequest({ targetUserId: tenantId }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ conversationId: 'conversation-1', isNew: true })
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('WHERE landlord_id = $1 AND tenant_id = $2'),
      [brokerId, tenantId],
    )
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO conversations'),
      [brokerId, tenantId],
    )
  })

  it('landlord/tenant이 없는 역할 조합도 같은 순서로 기존 대화를 찾는다', async () => {
    mockAuth(adminId)
    vi.mocked(query)
      .mockResolvedValueOnce([{ user_type: 'admin' }])
      .mockResolvedValueOnce([{ user_type: 'broker' }])
      .mockResolvedValueOnce([{ id: 'conversation-existing' }])

    const response = await POST(postRequest({ targetUserId: brokerId }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ conversationId: 'conversation-existing', isNew: false })
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('WHERE landlord_id = $1 AND tenant_id = $2'),
      [brokerId, adminId],
    )
  })
})

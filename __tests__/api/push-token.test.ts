import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  verifyTokenAllowed: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { DELETE, PUT } from '@/app/api/notifications/push-token/route'
import { verifyTokenAllowed } from '@/lib/auth'
import { query } from '@/lib/db'
import { cookies } from 'next/headers'

const userId = '11111111-1111-4111-8111-111111111111'
const expoToken = 'ExponentPushToken[test-device-token]'

function request(method: 'PUT' | 'DELETE', body?: unknown, token = expoToken): Request {
  const url = new URL('http://localhost:3000/api/notifications/push-token')
  if (method === 'DELETE') url.searchParams.set('token', token)
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('/api/notifications/push-token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'auth-token' }),
    } as never)
    vi.mocked(verifyTokenAllowed).mockResolvedValue({ userId } as never)
    vi.mocked(query).mockResolvedValue([])
  })

  it('인증되지 않은 token 등록을 거부한다', async () => {
    vi.mocked(verifyTokenAllowed).mockResolvedValue(null)

    const response = await PUT(request('PUT', { token: expoToken, platform: 'android' }))

    expect(response.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })

  it('잘못된 Expo token과 platform을 DB 접근 전에 거부한다', async () => {
    const invalidToken = await PUT(request('PUT', { token: 'invalid', platform: 'android' }))
    const invalidPlatform = await PUT(request('PUT', { token: expoToken, platform: 'web' }))

    expect(invalidToken.status).toBe(400)
    expect(invalidPlatform.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('유효한 token을 현재 사용자 소유로 upsert한다', async () => {
    const response = await PUT(request('PUT', { token: expoToken, platform: 'android' }))

    expect(response.status).toBe(200)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (token)'),
      [userId, expoToken, 'android'],
    )
  })

  it('token 삭제를 현재 사용자 소유 범위로 제한한다', async () => {
    const response = await DELETE(request('DELETE'))

    expect(response.status).toBe(204)
    expect(query).toHaveBeenCalledWith(
      'DELETE FROM push_tokens WHERE user_id = $1 AND token = $2',
      [userId, expoToken],
    )
  })
})

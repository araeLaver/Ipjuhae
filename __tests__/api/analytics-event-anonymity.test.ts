/**
 * `/check` 깔때기 3종은 로그인 쿠키가 있어도 계정과 묶이면 안 된다.
 *
 * 화면 쪽에서 조심하는 것으로는 못 지킨다. 서버 한 곳에서 못박았는지를
 * 여기서 검증한다 — 특히 `getCurrentUser`가 **호출조차 되지 않는지**까지 본다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackServer: vi.fn(),
}))

import { POST } from '@/app/api/analytics/event/route'
import { getCurrentUser } from '@/lib/auth'
import { trackServer } from '@/lib/analytics'

const userId = '11111111-1111-4111-8111-111111111111'

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `auth_token=logged-in` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/analytics/event — 익명 보장', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 로그인한 사용자를 흉내 낸다. 익명 이벤트는 이 값을 쓰면 안 된다.
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId } as never)
    vi.mocked(trackServer).mockResolvedValue(undefined)
  })

  const anonymousEvents = [
    'check_result_viewed',
    'tester_invite_shown',
    'tester_invite_clicked',
  ] as const

  it.each(anonymousEvents)('%s 은 로그인 조회 자체를 하지 않는다', async (event) => {
    const res = await POST(request({ event_name: event, session_id: 'sess-1' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(getCurrentUser).not.toHaveBeenCalled()

    const [name, options] = vi.mocked(trackServer).mock.calls[0]
    expect(name).toBe(event)
    expect(options).not.toHaveProperty('userId')
    expect(options).not.toHaveProperty('sessionId')
  })

  it('익명 이벤트에 실려 온 식별자와 금액은 저장되지 않는다', async () => {
    await POST(
      request({
        event_name: 'check_result_viewed',
        session_id: 'sess-1',
        properties: {
          surface: 'web',
          level: 'danger',
          from: 'cafe',
          user_id: userId,
          device_id: 'device-abc',
          deposit: 30000,
          market_price: 40000,
        },
      })
    )

    const [, options] = vi.mocked(trackServer).mock.calls[0]
    expect(options).toEqual({
      properties: { surface: 'web', level: 'danger', from: 'cafe' },
    })
  })

  it('기존 이벤트는 종전대로 계정과 세션을 함께 저장한다', async () => {
    await POST(request({ event_name: 'page_view', session_id: 'sess-1' }))

    expect(getCurrentUser).toHaveBeenCalled()
    expect(trackServer).toHaveBeenCalledWith('page_view', {
      userId,
      sessionId: 'sess-1',
      properties: {},
    })
  })

  it('/check의 page_view는 로그인 상태여도 계정에 붙지 않는다', async () => {
    // 깔때기 3종만 익명으로 두면 "몇 시에 누가 /check를 썼는지"가 계정에 남는다.
    // 금액이 아니라 방문 사실이지만, 개인정보처리방침에 적은 문장은 그걸 안 한다고 읽힌다.
    const res = await POST(
      request({
        event_name: 'page_view',
        session_id: 'sess-1',
        properties: { path: '/check', from: 'cafe' },
      })
    )

    expect(res.status).toBe(200)
    expect(getCurrentUser).not.toHaveBeenCalled()
    expect(trackServer).toHaveBeenCalledWith('page_view', {
      properties: { path: '/check', from: 'cafe' },
    })

    const [, options] = vi.mocked(trackServer).mock.calls[0]
    expect(options).not.toHaveProperty('userId')
    expect(options).not.toHaveProperty('sessionId')
  })

  it('랜딩(/)의 page_view는 종전대로 집계된다 — /admin/waitlist가 이 행을 쓴다', async () => {
    await POST(
      request({ event_name: 'page_view', session_id: 'sess-1', properties: { path: '/' } })
    )

    expect(getCurrentUser).toHaveBeenCalled()
    expect(trackServer).toHaveBeenCalledWith('page_view', {
      userId,
      sessionId: 'sess-1',
      properties: { path: '/' },
    })
  })

  it('예전에 라우트 목록에서 빠져 있던 match_view_toggle도 이제 저장된다', async () => {
    const res = await POST(request({ event_name: 'match_view_toggle' }))

    expect(await res.json()).toEqual({ ok: true })
    expect(trackServer).toHaveBeenCalledWith('match_view_toggle', expect.anything())
  })

  it('모르는 이벤트는 200을 주되 저장하지 않는다', async () => {
    const res = await POST(request({ event_name: 'not_a_real_event' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid_event' })
    expect(trackServer).not.toHaveBeenCalled()
  })
})

/**
 * 앱 익명 계측이 프로덕션 CSRF를 통과하는지 본다.
 *
 * 배경: 토큰이 자동으로 붙는 `apiClient`를 피해 맨 `fetch`로 바꾸면서
 * `x-mobile-client` 헤더까지 같이 떨어졌고, 앱 이벤트 3종이 프로덕션에서
 * 403으로 **전량** 버려졌다. 화면은 멀쩡하고 에러도 안 나서 숫자가 0인 걸로만 보인다.
 *
 * 그래서 두 가지를 동시에 검증한다.
 * 1. 요청에 `x-mobile-client: true`가 실린다 (CSRF 통과 조건)
 * 2. 그런데도 인증 헤더는 실리지 않는다 (익명 보장)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { trackAnonymous } from '../../mobile/src/services/analytics'

function lastRequest(): { url: string; init: RequestInit } {
  const call = vi.mocked(globalThis.fetch).mock.calls.at(-1)
  if (!call) throw new Error('fetch가 호출되지 않았다')
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit }
}

function headersOf(init: RequestInit): Record<string, string> {
  const raw = (init.headers ?? {}) as Record<string, string>
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]))
}

describe('앱 익명 계측 — CSRF 통과와 익명 보장', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('x-mobile-client 헤더를 반드시 보낸다 — 없으면 미들웨어가 403으로 버린다', () => {
    trackAnonymous('check_result_viewed', { level: 'danger' })

    const headers = headersOf(lastRequest().init)
    expect(headers['x-mobile-client']).toBe('true')
  })

  it('CSRF 헤더는 붙여도 인증 정보는 붙이지 않는다', () => {
    trackAnonymous('tester_invite_clicked')

    const { init } = lastRequest()
    const headers = headersOf(init)

    expect(headers).not.toHaveProperty('authorization')
    expect(headers).not.toHaveProperty('cookie')
    expect(init.credentials).toBeUndefined()
  })

  it('3종 모두 같은 헤더 조합으로 나간다', () => {
    const events = ['check_result_viewed', 'tester_invite_shown', 'tester_invite_clicked'] as const

    for (const event of events) {
      trackAnonymous(event)
      const headers = headersOf(lastRequest().init)
      expect(headers['x-mobile-client'], `${event}에 헤더가 빠졌다`).toBe('true')
    }

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(events.length)
  })

  it('본문에는 surface=app과 이벤트 이름만 실린다 — 기기 ID는 만들지 않는다', () => {
    trackAnonymous('check_result_viewed', { level: 'safe', from: 'cafe' })

    const { url, init } = lastRequest()
    expect(url).toContain('/analytics/event')

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body).toEqual({
      event_name: 'check_result_viewed',
      properties: { surface: 'app', level: 'safe', from: 'cafe' },
    })
    expect(body).not.toHaveProperty('session_id')
    expect(JSON.stringify(body)).not.toContain('device')
  })

  it('네트워크가 실패해도 던지지 않는다', () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('offline'))

    expect(() => trackAnonymous('tester_invite_shown')).not.toThrow()
  })
})

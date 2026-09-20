/**
 * 익명 보장은 리뷰가 아니라 테스트로 고정한다.
 *
 * `/check` 계측이 사용자 식별자나 입력 금액을 흘리면 티켓이 금지한 바로 그
 * 동작이 된다. 화면 코드를 누가 고치든 서버에서 걸리도록 여기서 못박는다.
 */

import { describe, expect, it } from 'vitest'
import {
  ANONYMOUS_ONLY_EVENTS,
  EVENT_NAMES,
  anonymousPathOf,
  isAnonymousOnlyEvent,
  isEventName,
  resolveAnonymousProperties,
  sanitizeAnonymousProperties,
} from '@/lib/analytics-events'

describe('analytics 이벤트 이름 목록', () => {
  it('새로 추가한 /check 깔때기 3종을 인정한다', () => {
    expect(isEventName('check_result_viewed')).toBe(true)
    expect(isEventName('tester_invite_shown')).toBe(true)
    expect(isEventName('tester_invite_clicked')).toBe(true)
  })

  it('예전에 라우트 목록에서 빠져 조용히 버려지던 이름도 살아 있다', () => {
    // match_view_toggle은 두 union에는 있는데 라우트 VALID_EVENTS에는 없었다.
    expect(isEventName('match_view_toggle')).toBe(true)
  })

  it('모르는 이름과 이름이 아닌 값은 거부한다', () => {
    expect(isEventName('drop_table')).toBe(false)
    expect(isEventName('')).toBe(false)
    expect(isEventName(undefined)).toBe(false)
    expect(isEventName(123)).toBe(false)
  })

  it('이름 목록에 중복이 없다', () => {
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length)
  })
})

describe('익명 전용 이벤트 판정', () => {
  it('/check 깔때기 3종만 익명 전용이다', () => {
    for (const name of ANONYMOUS_ONLY_EVENTS) {
      expect(isAnonymousOnlyEvent(name)).toBe(true)
    }
    expect(ANONYMOUS_ONLY_EVENTS).toHaveLength(3)
  })

  it('기존 이벤트는 익명 전용이 아니다', () => {
    expect(isAnonymousOnlyEvent('page_view')).toBe(false)
    expect(isAnonymousOnlyEvent('user_signup')).toBe(false)
  })
})

describe('sanitizeAnonymousProperties', () => {
  it('허용 목록에 있는 키만 남긴다', () => {
    const out = sanitizeAnonymousProperties({
      surface: 'web',
      level: 'danger',
      from: 'cafe',
      utm_source: 'naver',
      utm_medium: 'post',
      utm_campaign: 'sep',
      referrer_host: 'cafe.naver.com',
    })

    expect(out).toEqual({
      surface: 'web',
      level: 'danger',
      from: 'cafe',
      utm_source: 'naver',
      utm_medium: 'post',
      utm_campaign: 'sep',
      referrer_host: 'cafe.naver.com',
    })
  })

  it('식별자와 입력 금액은 통과하지 못한다', () => {
    const out = sanitizeAnonymousProperties({
      surface: 'web',
      user_id: '11111111-1111-4111-8111-111111111111',
      device_id: 'abcdef',
      session_id: 'sess-1',
      email: 'someone@example.com',
      deposit: 30000,
      market_price: 40000,
      mortgage: 1000,
      ip: '1.2.3.4',
    })

    expect(out).toEqual({ surface: 'web' })
  })

  it('제어문자를 지우고 64자에서 자른다', () => {
    const out = sanitizeAnonymousProperties({
      from: 'ca\u0001fe',
      utm_campaign: 'x'.repeat(200),
    })

    expect(out.from).toBe('cafe')
    expect(out.utm_campaign).toHaveLength(64)
  })

  it('빈 값과 null은 버린다', () => {
    expect(sanitizeAnonymousProperties({ from: '', level: null, surface: '   ' })).toEqual({})
  })

  it('객체·배열 값은 버린다 — 중첩으로 개인정보가 실려 오는 길을 막는다', () => {
    expect(
      sanitizeAnonymousProperties({ from: { nested: 'x' }, level: ['a'], surface: 'app' })
    ).toEqual({ surface: 'app' })
  })

  it('숫자와 불리언은 문자열로 정규화한다', () => {
    expect(sanitizeAnonymousProperties({ level: 3, from: true })).toEqual({
      level: '3',
      from: 'true',
    })
  })

  it('properties 자체가 없거나 이상해도 던지지 않는다', () => {
    expect(sanitizeAnonymousProperties(undefined)).toEqual({})
    expect(sanitizeAnonymousProperties(null)).toEqual({})
    expect(sanitizeAnonymousProperties('string')).toEqual({})
    expect(sanitizeAnonymousProperties([1, 2])).toEqual({})
  })
})

describe('anonymousPathOf — 익명 경로 판정', () => {
  it('/check와 그 하위 경로를 익명으로 본다', () => {
    expect(anonymousPathOf('/check')).toBe('/check')
    expect(anonymousPathOf('/check/result')).toBe('/check')
  })

  it('쿼리와 해시는 떼고 정규화된 경로만 돌려준다', () => {
    // 경로에 섞여 들어온 값이 그대로 저장되는 길을 막는다.
    expect(anonymousPathOf('/check?from=cafe')).toBe('/check')
    expect(anonymousPathOf('/check/result?token=secret#x')).toBe('/check')
  })

  it('/check로 시작만 하는 다른 경로는 익명 경로가 아니다', () => {
    expect(anonymousPathOf('/checkout')).toBeNull()
    expect(anonymousPathOf('/checking')).toBeNull()
  })

  it('다른 경로와 문자열이 아닌 값은 null', () => {
    expect(anonymousPathOf('/')).toBeNull()
    expect(anonymousPathOf('/matches')).toBeNull()
    expect(anonymousPathOf(undefined)).toBeNull()
    expect(anonymousPathOf(123)).toBeNull()
  })
})

describe('resolveAnonymousProperties — 익명 판정 단일 출처', () => {
  it('깔때기 3종은 속성을 허용 목록으로 걸러 돌려준다', () => {
    expect(
      resolveAnonymousProperties('check_result_viewed', {
        surface: 'web',
        level: 'danger',
        deposit: 30000,
      })
    ).toEqual({ surface: 'web', level: 'danger' })
  })

  it('/check의 page_view도 익명으로 처리한다 — 방침에 적은 문장과 동작을 맞춘다', () => {
    expect(
      resolveAnonymousProperties('page_view', { path: '/check', from: 'cafe' })
    ).toEqual({ path: '/check', from: 'cafe' })
  })

  it('/check page_view에 실려 온 식별자는 버린다', () => {
    // 경로의 쿼리스트링은 저장하지 않는다. 유입 구분은 별도 `from` 속성으로 온다.
    expect(
      resolveAnonymousProperties('page_view', {
        path: '/check?token=secret',
        user_id: 'u-1',
        device_id: 'd-1',
        deposit: 30000,
      })
    ).toEqual({ path: '/check' })
  })

  it('다른 경로의 page_view는 익명 대상이 아니다 — 기존 집계가 그대로 돌아야 한다', () => {
    // /admin/waitlist가 랜딩(/) page_view로 채널별 방문을 센다.
    expect(resolveAnonymousProperties('page_view', { path: '/' })).toBeNull()
    expect(resolveAnonymousProperties('page_view', { path: '/matches' })).toBeNull()
    expect(resolveAnonymousProperties('page_view', {})).toBeNull()
  })

  it('익명 대상이 아닌 이벤트는 null', () => {
    expect(resolveAnonymousProperties('user_signup', { path: '/check' })).toBeNull()
    expect(resolveAnonymousProperties('match_view_toggle', {})).toBeNull()
  })
})

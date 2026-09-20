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
  isAnonymousOnlyEvent,
  isEventName,
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

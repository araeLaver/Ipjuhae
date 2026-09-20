/**
 * 이벤트 이름과 익명 규칙의 단일 출처.
 *
 * 전에는 이름 목록이 세 군데(클라이언트 union, 서버 union, 라우트의 VALID_EVENTS)에
 * 복사돼 있었다. 라우트 목록에서 빠진 이름은 200 OK를 받고 조용히 버려진다 —
 * 실제로 `match_view_toggle`이 그 상태였다. 목록을 여기 한 곳으로 모은다.
 *
 * DB도 React도 import 하지 않는다. 순수 상수와 함수만 둔다.
 * 그래야 클라이언트·서버·라우트가 전부 같은 목록을 본다.
 */

export const EVENT_NAMES = [
  'page_view',
  'user_signup',
  'profile_complete',
  'profile_submitted',
  'listing_created',
  'listing_submitted',
  'match_generated',
  'match_viewed',
  'match_view_toggle',
  'listing_viewed',
  // /check 결과 화면 → 테스터 전환 깔때기. 아래 ANONYMOUS_ONLY_EVENTS 참고.
  'check_result_viewed',
  'tester_invite_shown',
  'tester_invite_clicked',
] as const

export type EventName = (typeof EVENT_NAMES)[number]

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && (EVENT_NAMES as readonly string[]).includes(value)
}

/**
 * 익명 전용 이벤트.
 *
 * `/check`는 가입 없이 쓰는 화면이다. 로그인한 사람이 쓰더라도 그 이용 기록이
 * 계정과 묶이면 안 된다. 이 목록의 이벤트는 서버가 로그인 조회를 아예 하지 않고
 * user_id / session_id 를 NULL로 고정한다.
 *
 * 화면마다 조심하게 만들지 않는다. 서버 한 곳에서 못박는다.
 */
export const ANONYMOUS_ONLY_EVENTS = [
  'check_result_viewed',
  'tester_invite_shown',
  'tester_invite_clicked',
] as const satisfies readonly EventName[]

export function isAnonymousOnlyEvent(event: string): boolean {
  return (ANONYMOUS_ONLY_EVENTS as readonly string[]).includes(event)
}

/**
 * 익명 이벤트에 실려도 되는 속성 키 — 허용 목록.
 *
 * 여기 없는 키는 서버에서 버린다. 금액(`deposit`, `market_price`)이나
 * 식별자(`user_id`, `device_id`)를 담을 수 있는 키는 통과 자체가 안 된다.
 * 클라이언트가 실수로 보내도 저장되지 않는다.
 */
export const ANONYMOUS_PROPERTY_KEYS = [
  'surface', // 'web' | 'app'
  'level', // 위험 등급 버킷 (safe/caution/danger/critical)
  'from', // 유입 채널 태그 (?from=cafe)
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'referrer_host',
] as const

export type AnonymousPropertyKey = (typeof ANONYMOUS_PROPERTY_KEYS)[number]

const MAX_VALUE_LEN = 64

/**
 * 허용 목록에 있는 키만 남기고 값을 문자열로 정규화한다.
 * 제어문자를 지우고 64자에서 자른다. 비면 버린다.
 */
export function sanitizeAnonymousProperties(
  input: unknown
): Partial<Record<AnonymousPropertyKey, string>> {
  const out: Partial<Record<AnonymousPropertyKey, string>> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out

  const source = input as Record<string, unknown>

  for (const key of ANONYMOUS_PROPERTY_KEYS) {
    const raw = source[key]
    if (raw === null || raw === undefined) continue
    if (typeof raw === 'object') continue

    // eslint-disable-next-line no-control-regex
    const cleaned = String(raw)
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .slice(0, MAX_VALUE_LEN)
    if (cleaned.length > 0) out[key] = cleaned
  }

  return out
}

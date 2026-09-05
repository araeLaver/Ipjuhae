/**
 * 유입 경로(UTM) 수집 — 클라이언트 전용. DB import 금지.
 *
 * 첫 진입(first-touch) 기준으로 탭 세션 동안 유지한다.
 * 스레드에서 들어와 새로고침하거나 페이지를 옮겨 다녀도 최초 출처를 잃지 않는다.
 *
 * 저장하지 않는 것: IP, User-Agent, referrer 전체 URL.
 * referrer는 호스트만 남긴다 — 쿼리스트링에 개인정보가 실려 올 수 있기 때문.
 */

export interface Attribution {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer_host: string | null
}

const STORAGE_KEY = 'ipjuhae:attribution'
const MAX_LEN = 64

const EMPTY: Attribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  referrer_host: null,
}

/** 길이를 자르고 제어문자를 제거한다. 값이 비면 null. */
export function sanitizeTag(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, MAX_LEN)
  return cleaned.length > 0 ? cleaned : null
}

function hasAnyValue(a: Attribution): boolean {
  return Boolean(a.utm_source || a.utm_medium || a.utm_campaign || a.referrer_host)
}

/** 현재 URL과 document.referrer에서 유입 정보를 읽는다. */
function readFromPage(): Attribution {
  if (typeof window === 'undefined') return EMPTY

  const params = new URLSearchParams(window.location.search)

  let referrerHost: string | null = null
  const referrer = document.referrer
  if (referrer) {
    try {
      const host = new URL(referrer).hostname
      // 사이트 내부 이동은 유입이 아니다
      if (host && host !== window.location.hostname) referrerHost = host
    } catch {
      // 파싱 불가한 referrer는 무시한다
    }
  }

  return {
    utm_source: sanitizeTag(params.get('utm_source')),
    utm_medium: sanitizeTag(params.get('utm_medium')),
    utm_campaign: sanitizeTag(params.get('utm_campaign')),
    referrer_host: sanitizeTag(referrerHost),
  }
}

/**
 * 이 탭에서의 첫 유입 정보를 돌려준다.
 * 이미 저장된 값이 있으면 그것을 쓰고, 없을 때만 현재 페이지에서 읽어 저장한다.
 */
export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return EMPTY

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Attribution>
      return {
        utm_source: sanitizeTag(parsed.utm_source),
        utm_medium: sanitizeTag(parsed.utm_medium),
        utm_campaign: sanitizeTag(parsed.utm_campaign),
        referrer_host: sanitizeTag(parsed.referrer_host),
      }
    }
  } catch {
    // sessionStorage를 못 쓰는 환경(프라이빗 모드 등)에서는 매번 새로 읽는다
  }

  const fresh = readFromPage()

  if (hasAnyValue(fresh)) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    } catch {
      // 저장 실패해도 이번 요청에는 값을 그대로 쓴다
    }
  }

  return fresh
}

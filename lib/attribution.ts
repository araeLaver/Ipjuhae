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
  /** 짧은 유입 채널 태그. utm 세트를 다 붙이기 번거로운 곳에 `?from=cafe` 한 줄로 쓴다. */
  from: string | null
}

const STORAGE_KEY = 'ipjuhae:attribution'
const MAX_LEN = 64

const EMPTY: Attribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  referrer_host: null,
  from: null,
}

/** 길이를 자르고 제어문자를 제거한다. 값이 비면 null. */
export function sanitizeTag(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, MAX_LEN)
  return cleaned.length > 0 ? cleaned : null
}

function hasAnyValue(a: Attribution): boolean {
  return Boolean(a.utm_source || a.utm_medium || a.utm_campaign || a.referrer_host || a.from)
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
    from: sanitizeTag(params.get('from')),
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
      const saved: Attribution = {
        utm_source: sanitizeTag(parsed.utm_source),
        utm_medium: sanitizeTag(parsed.utm_medium),
        utm_campaign: sanitizeTag(parsed.utm_campaign),
        referrer_host: sanitizeTag(parsed.referrer_host),
        // 예전 형태로 저장된 값에는 from이 없다. sanitizeTag가 null로 바꿔주므로 그대로 호환된다.
        from: sanitizeTag(parsed.from),
      }

      // first-touch는 유지하되, 아직 **비어 있는** 칸만 현재 URL에서 채운다.
      //
      // 카페 글 링크로 `/`에 들어오면 referrer_host만 저장된다. 그 상태에서
      // 사이트 안을 돌다 `/check?from=cafe`로 가면, 저장된 값이 있다는 이유만으로
      // `from`이 통째로 사라졌다. 명시적으로 붙여 보낸 채널 태그가 조용히
      // 버려지는 건 모집 링크를 뿌리는 쪽에서 알아챌 방법이 없다.
      //
      // 이미 값이 있는 칸은 덮지 않는다 — first-touch 성질은 그대로다.
      return fillEmptySlots(saved)
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

/** 저장된 값에서 비어 있는 칸만 현재 URL 값으로 채운다. 채워졌으면 다시 저장한다. */
function fillEmptySlots(saved: Attribution): Attribution {
  const current = readFromPage()
  const merged: Attribution = { ...saved }
  let changed = false

  for (const key of Object.keys(merged) as (keyof Attribution)[]) {
    if (merged[key] === null && current[key] !== null) {
      merged[key] = current[key]
      changed = true
    }
  }

  if (changed) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    } catch {
      // 저장 실패해도 이번 요청에는 채워진 값을 쓴다
    }
  }

  return merged
}

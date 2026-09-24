/**
 * 서비스 기본 주소(base URL)를 만드는 단일 지점.
 *
 * 왜 한 곳에 모으는가:
 * `NEXT_PUBLIC_BASE_URL`을 `${base}/login` 꼴로 이어 붙이는 곳이 13군데였다.
 * 지금 값(`https://www.ipjuhae.com`)에 끝 슬래시가 없어서 동작할 뿐, 누군가 환경변수에
 * 슬래시를 하나 붙이는 순간 13곳이 한꺼번에 `//`가 된다. 그중 두 곳은 조용히 넘어가지
 * 않는다 — `lib/oauth.ts`의 `redirect_uri`가 어긋나면 소셜 로그인 전체가 실패하고,
 * `lib/email.ts`가 만든 링크는 이미 발송된 뒤라 되돌릴 수 없다.
 *
 * 환경변수 한 글자가 코드 리뷰도 배포 게이트도 거치지 않고 그 결과를 만든다.
 * 그래서 값이 안전한지를 매번 믿는 대신, 정규화를 여기 한 번만 둔다.
 * (판정을 한 곳에 모으는 방식은 `lib/safe-redirect.ts`와 같다.)
 */

export const DEFAULT_BASE_URL = 'http://localhost:3000'

/**
 * 끝 슬래시를 제거해 `https://x.com/` 와 `https://x.com` 이 같은 값이 되게 한다.
 * 값이 비어 있으면 `fallback`을 쓴다. fallback 자체에도 정규화를 적용한다.
 */
export function normalizeBaseUrl(
  value: string | null | undefined,
  fallback: string = DEFAULT_BASE_URL,
): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  const base = raw.length > 0 ? raw : fallback
  return base.replace(/\/+$/, '')
}

/** 정규화된 `NEXT_PUBLIC_BASE_URL`. 호출 시점에 읽는다 — 모듈 로드 시점에 굳히지 않는다. */
export function getBaseUrl(fallback: string = DEFAULT_BASE_URL): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL, fallback)
}

/**
 * base URL과 경로를 `//` 없이 잇는다.
 *
 * 경로 앞의 슬래시는 있어도 없어도 같은 결과를 준다. 호출부마다 `/`를 붙일지 말지
 * 고민하게 두면 결국 어딘가는 틀린다.
 */
export function buildUrl(path: string, fallback: string = DEFAULT_BASE_URL): string {
  const base = getBaseUrl(fallback)
  const trimmed = typeof path === 'string' ? path.trim() : ''
  if (trimmed.length === 0) return base
  return `${base}/${trimmed.replace(/^\/+/, '')}`
}

/**
 * 로그인 후 "원래 가려던 곳"으로 돌려보낼 때 쓰는 경로 검증.
 *
 * 로그인 진입점이 네 군데(비밀번호·매직 링크·소셜·미들웨어 리다이렉트)라 같은 판정을
 * 각자 구현하면 한 곳만 느슨해진다. 판정은 여기 한 곳에만 둔다.
 *
 * 통과 조건은 "이 사이트 안의 절대경로"다:
 * - `/`로 시작해야 한다 (`https://evil.example`처럼 스킴이 붙은 값 차단)
 * - `//host`는 프로토콜 상대 URL이라 외부 호스트다. 차단한다.
 * - `/\host`도 브라우저가 `//host`와 같게 해석하므로 함께 차단한다.
 * - 개행·제어문자가 섞인 값은 헤더 주입 소재라 차단한다.
 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    // 0x20 미만은 개행·탭을 포함한 제어문자, 0x7f는 DEL.
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (hasControlChar(value)) return null
  return value
}

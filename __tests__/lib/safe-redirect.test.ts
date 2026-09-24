import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from '@/lib/safe-redirect'

/**
 * DOW-1168 회귀 방어.
 *
 * 403 화면에서 로그인으로 보낼 때 쓰던 주소가 `/login?redirect=//<id>` 였다.
 * `//<id>`는 경로가 아니라 프로토콜 상대 URL(호스트)이라 외부로 튕긴다.
 * 판정을 한 곳에 모았으니 그 판정이 이 값을 확실히 떨어뜨리는지 여기서 고정한다.
 */
describe('safeRedirectPath', () => {
  it('같은 사이트 절대경로는 그대로 통과시킨다', () => {
    expect(safeRedirectPath('/community/abc-123')).toBe('/community/abc-123')
    expect(safeRedirectPath('/landlord/properties?tab=active')).toBe(
      '/landlord/properties?tab=active'
    )
  })

  it('DOW-1168에서 실제로 나왔던 //<id> 형태를 거부한다', () => {
    expect(safeRedirectPath('//abc-123')).toBeNull()
  })

  it('프로토콜 상대 URL과 백슬래시 변형을 거부한다', () => {
    expect(safeRedirectPath('//evil.example/path')).toBeNull()
    expect(safeRedirectPath('/\\evil.example')).toBeNull()
  })

  it('스킴이 붙은 외부 주소를 거부한다', () => {
    expect(safeRedirectPath('https://evil.example')).toBeNull()
    expect(safeRedirectPath('javascript:alert(1)')).toBeNull()
  })

  it('상대경로처럼 /로 시작하지 않는 값을 거부한다', () => {
    expect(safeRedirectPath('community/abc')).toBeNull()
    expect(safeRedirectPath('')).toBeNull()
    expect(safeRedirectPath(null)).toBeNull()
    expect(safeRedirectPath(undefined)).toBeNull()
  })

  it('개행·제어문자가 섞인 값을 거부한다', () => {
    expect(safeRedirectPath('/ok' + String.fromCharCode(10) + 'Set-Cookie: x=1')).toBeNull()
    expect(safeRedirectPath('/ok' + String.fromCharCode(13))).toBeNull()
    expect(safeRedirectPath('/ok' + String.fromCharCode(0))).toBeNull()
    expect(safeRedirectPath('/ok' + String.fromCharCode(127))).toBeNull()
  })
})

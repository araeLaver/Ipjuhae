/**
 * 앱 익명 계측이 프로덕션 CSRF를 통과하는 형태인지 본다.
 *
 * 배경: 토큰이 자동으로 붙는 `apiClient`를 피해 맨 `fetch`로 바꾸면서
 * `x-mobile-client` 헤더까지 같이 떨어졌고, 앱 이벤트 3종이 프로덕션에서
 * 403으로 **전량** 버려졌다. 화면은 멀쩡하고 에러도 안 나서 숫자가 0인 걸로만 보인다.
 *
 * `middleware.ts`의 CSRF 검사는 POST에 대해 `x-mobile-client: true`,
 * 호스트와 일치하는 Origin, 호스트와 일치하는 Referer 셋 중 하나를 요구한다.
 * React Native의 fetch는 Origin도 Referer도 붙이지 않으므로 앱에게는 첫 번째가
 * 유일한 통과 경로다.
 *
 * 앱 모듈을 import하지 않고 **소스를 텍스트로 읽어** 검사한다.
 * `mobile/`은 Expo 전용 tsconfig를 쓰는 별도 프로젝트라, 웹 저장소의 vitest가
 * 그 파일을 변환하려 하면 Expo 의존성이 설치되지 않은 CI에서 로드 단계부터 깨진다.
 * 여기서 지키려는 것은 "헤더가 코드에 남아 있는가" 하나이므로 이 방식으로 충분하다.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SOURCE_PATH = join(process.cwd(), 'mobile/src/services/analytics.ts')
const source = readFileSync(SOURCE_PATH, 'utf-8')

/** 주석을 걷어낸 실제 코드만 본다 — 설명문에 적힌 단어에 속지 않기 위해서다. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('앱 익명 계측 — CSRF 통과 조건', () => {
  it('x-mobile-client 헤더를 보낸다 — 없으면 미들웨어가 403으로 버린다', () => {
    expect(code).toMatch(/['"]x-mobile-client['"]\s*:\s*['"]true['"]/)
  })

  it('CSRF 헤더는 붙여도 인증 정보는 붙이지 않는다 — 익명 보장', () => {
    expect(code).not.toMatch(/Authorization/i)
    expect(code).not.toMatch(/credentials\s*:/)
    // apiClient를 다시 쓰기 시작하면 토큰이 자동으로 붙어 계정과 묶인다.
    expect(code).not.toMatch(/apiClient/)
  })

  it('기기 식별자를 만들거나 보내지 않는다', () => {
    expect(code).not.toMatch(/device_id|deviceId|installationId/)
  })

  it('허용된 익명 속성 키만 타입으로 열어 둔다', () => {
    // 서버가 최종 판정하지만, 앱 타입에서부터 금액이 들어갈 자리를 만들지 않는다.
    expect(code).not.toMatch(/deposit|market_price/)
  })
})

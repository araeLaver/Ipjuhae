/**
 * 앱 익명 계측 — **실제로 호출해서** 나가는 요청을 본다.
 *
 * 왜 이 파일이 따로 있나:
 * `analytics-csrf.test.ts`는 소스를 문자열로 읽어 정규식으로 검사한다. 형태는 지키지만
 * "런타임에 그 헤더가 정말 실려 나가는가"는 보증하지 못한다. 헤더 한 줄이 빠져
 * 앱 이벤트 3종이 프로덕션에서 403으로 **전량** 버려진 적이 있고, 화면은 멀쩡했기
 * 때문에 숫자가 0인 걸로만 드러났다. 그 사고는 형태가 아니라 행위로 막아야 한다.
 *
 * `mobile/`은 Expo 전용 프로젝트라 vitest가 그 파일을 직접 transform하면
 * `mobile/tsconfig.json`의 `extends: expo/tsconfig.base`를 해석하려다
 * `mobile/node_modules`가 없는 CI에서 로드 단계부터 깨진다.
 * 그래서 vitest의 transform을 태우지 않고 esbuild로 직접 번들한다.
 * `expo-constants`는 한 줄짜리 셔임으로 바꾼다 — Expo는 설치하지 않는다.
 */

import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { beforeAll, afterEach, describe, expect, it } from 'vitest'

interface Captured {
  url: string
  init: RequestInit
}

const captured: Captured[] = []
let trackAnonymous: (event: string, properties?: Record<string, unknown>) => void

/** 앱 소스를 Expo 없이 실행 가능한 ESM으로 번들한다. */
async function loadAppAnalytics() {
  const dir = mkdtempSync(join(tmpdir(), 'mobile-analytics-'))
  const shim = join(dir, 'expo-constants.js')
  writeFileSync(
    shim,
    'export default { expoConfig: { extra: { apiBaseUrl: "https://www.ipjuhae.com/api" } } }\n'
  )

  const outfile = join(dir, 'analytics.mjs')
  await build({
    entryPoints: [join(process.cwd(), 'mobile/src/services/analytics.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    alias: { 'expo-constants': shim },
    logLevel: 'silent',
  })

  return import(pathToFileURL(outfile).href)
}

/** 헤더를 소문자 키로 눕힌다 — 대소문자 때문에 검사를 놓치지 않기 위해서다. */
function headersOf(init: RequestInit): Record<string, string> {
  const raw = (init.headers ?? {}) as Record<string, string>
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v)]))
}

beforeAll(async () => {
  globalThis.fetch = ((url: string, init: RequestInit) => {
    captured.push({ url, init })
    return Promise.resolve(new Response('{"ok":true}', { status: 200 }))
  }) as typeof fetch

  const mod = await loadAppAnalytics()
  trackAnonymous = mod.trackAnonymous
}, 30_000)

afterEach(() => {
  captured.length = 0
})

describe('앱 익명 계측 — 실제로 나가는 요청', () => {
  it('x-mobile-client 헤더를 실제로 실어 보낸다 — 없으면 미들웨어가 403으로 전량 버린다', () => {
    trackAnonymous('check_result_viewed', { level: 'danger' })

    expect(captured).toHaveLength(1)
    expect(headersOf(captured[0].init)['x-mobile-client']).toBe('true')
  })

  it('분석 라우트로 POST 한다', () => {
    trackAnonymous('tester_invite_shown')

    expect(captured[0].url).toBe('https://www.ipjuhae.com/api/analytics/event')
    expect(captured[0].init.method).toBe('POST')
  })

  it('CSRF 헤더는 붙여도 인증 정보는 실리지 않는다 — 익명 보장', () => {
    trackAnonymous('tester_invite_clicked', { from: 'cafe' })

    const headers = headersOf(captured[0].init)
    expect(headers).not.toHaveProperty('authorization')
    expect(headers).not.toHaveProperty('cookie')
    expect(captured[0].init.credentials).toBeUndefined()
  })

  it('surface=app 과 허용된 속성만 보낸다 — 식별자·금액은 실리지 않는다', () => {
    trackAnonymous('check_result_viewed', { level: 'critical' })

    const body = JSON.parse(String(captured[0].init.body))
    expect(body.event_name).toBe('check_result_viewed')
    expect(body.properties).toEqual({ surface: 'app', level: 'critical' })
    expect(body.session_id).toBeUndefined()
    expect(JSON.stringify(body)).not.toMatch(/user_id|device_id|deposit|market_price/)
  })

  it('네트워크가 죽어도 화면을 멈추지 않는다 — 동기 throw', () => {
    globalThis.fetch = (() => {
      throw new Error('network down')
    }) as typeof fetch

    expect(() => trackAnonymous('check_result_viewed')).not.toThrow()
  })

  it('네트워크가 죽어도 화면을 멈추지 않는다 — reject', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch

    expect(() => trackAnonymous('check_result_viewed')).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
})

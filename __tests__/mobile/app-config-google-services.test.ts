/**
 * Android 푸시 설정이 빌드에 **실제로 실리는지**를 본다.
 *
 * 왜 이 파일이 있나 (DOW-1222):
 * 앱은 알림 권한을 받아도 토큰을 등록하지 못했다. 원인은 코드가 아니라 빌드 설정이었다 —
 * `google-services.json`이 저장소에도 `app.json`에도 없어서 Firebase가 초기화되지 않았고,
 * 그래서 운영 `push_tokens`는 한 행도 생긴 적이 없다. 이게 조용했던 게 문제의 핵심이다.
 * 체크리스트의 "push_tokens에 행이 없어야 한다"는 항목은 그 상태에서 **통과로 나온다**.
 *
 * 그래서 확인하는 건 파일의 존재가 아니라 결과다: 설정이 주어졌을 때 Expo config에
 * `android.googleServicesFile`이 실리는가, 없을 때 스토어 빌드가 조용히 지나가지 않는가.
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const require_ = createRequire(import.meta.url)
const CONFIG_PATH = join(process.cwd(), 'mobile', 'app.config.js')
const LOCAL_FILE = join(process.cwd(), 'mobile', 'google-services.json')

type ExpoConfig = { android?: Record<string, unknown>; name?: string }

function loadConfigFactory() {
  delete require_.cache[require_.resolve(CONFIG_PATH)]
  return require_(CONFIG_PATH) as (arg: { config: ExpoConfig }) => ExpoConfig
}

const BASE: ExpoConfig = {
  name: '입주해',
  android: { package: 'com.ipjuhae.app', versionCode: 1 },
}

let tmpDir: string
const savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gs-'))
  for (const key of ['GOOGLE_SERVICES_JSON', 'EAS_BUILD_PLATFORM', 'EAS_BUILD_PROFILE']) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.restoreAllMocks()
})

describe('mobile/app.config.js — Android FCM 설정 주입', () => {
  it('EAS file 환경변수가 가리키는 파일을 googleServicesFile로 싣는다', () => {
    const uploaded = join(tmpDir, 'google-services.json')
    writeFileSync(uploaded, '{}')
    process.env.GOOGLE_SERVICES_JSON = uploaded

    const config = loadConfigFactory()({ config: structuredClone(BASE) })

    expect(config.android?.googleServicesFile).toBe(uploaded)
    // 기존 android 설정을 덮어쓰지 않는다
    expect(config.android?.package).toBe('com.ipjuhae.app')
    expect(config.name).toBe('입주해')
  })

  it('환경변수가 존재하지 않는 경로를 가리키면 무시한다 — prebuild가 그 자리에서 깨지기 때문', () => {
    process.env.GOOGLE_SERVICES_JSON = join(tmpDir, 'nope.json')

    const config = loadConfigFactory()({ config: structuredClone(BASE) })

    expect(config.android?.googleServicesFile).toBeUndefined()
  })

  it('설정이 없으면 googleServicesFile 없이 그대로 두되, 경고를 남긴다', () => {
    const config = loadConfigFactory()({ config: structuredClone(BASE) })

    // 로컬 개발자가 파일을 실제로 두고 있을 수 있다. 그 경우는 이 단언의 대상이 아니다.
    if (!existsLocalFile()) {
      expect(config.android?.googleServicesFile).toBeUndefined()
      expect(console.warn).toHaveBeenCalled()
      expect(vi.mocked(console.warn).mock.calls[0][0]).toContain('푸시 토큰이 발급되지 않습니다')
    }
  })

  it('Android production 빌드에서는 설정 없이 통과시키지 않는다 — 조용한 미발급이 이 이슈의 원인이었다', () => {
    if (existsLocalFile()) return

    process.env.EAS_BUILD_PLATFORM = 'android'
    process.env.EAS_BUILD_PROFILE = 'production'

    expect(() => loadConfigFactory()({ config: structuredClone(BASE) })).toThrow(
      /google-services\.json/
    )
  })

  it('preview 빌드는 막지 않는다 — QA용 APK는 푸시 없이도 나와야 한다', () => {
    if (existsLocalFile()) return

    process.env.EAS_BUILD_PLATFORM = 'android'
    process.env.EAS_BUILD_PROFILE = 'preview'

    const config = loadConfigFactory()({ config: structuredClone(BASE) })

    expect(config.android?.googleServicesFile).toBeUndefined()
  })
})

function existsLocalFile(): boolean {
  return existsSync(LOCAL_FILE)
}

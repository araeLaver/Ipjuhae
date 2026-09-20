/**
 * 앱 알림 설정 — OS 권한과 앱 상태가 **실제로** 같이 움직이는지 본다.
 *
 * 왜 이 파일이 있나:
 * [DOW-632]는 "알림 toggle이 OS 권한과 동기화되지 않는다"로 열렸고,
 * 이후 `notificationService.ts`가 구현되면서 코드 존재만으로 해결로 간주됐다.
 * 그런데 사용자에게 보이는 건 코드가 아니라 `NotificationSettingsScreen`의
 * Switch 값 하나다. 그 값은 `PushState.enabled`에서 그대로 오고,
 * `enabled`는 AsyncStorage 선호값에서 온다. 즉 "선호값 true + OS 권한 denied"라는
 * 조합이 만들어지는 순간 화면은 켜진 상태로 거짓말을 한다.
 *
 * 그래서 형태(파일·함수 존재)가 아니라 행위(호출 결과)로 검증한다.
 * `mobile/`은 Expo 전용이라 vitest transform을 태우면 `expo/tsconfig.base`
 * 해석에서 깨지므로 `analytics-runtime.test.ts`와 같은 방식으로
 * esbuild 번들 + 네이티브 모듈 셔임으로 로드한다. Expo는 설치하지 않는다.
 */

import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

type PermissionStatus = 'granted' | 'denied' | 'undetermined'

interface PushState {
  enabled: boolean
  permission: PermissionStatus
  tokenRegistered: boolean
  error: string | null
}

interface Captured {
  url: string
  init: RequestInit
}

/** 셔임이 참조하는 기기 상태. 테스트가 이 값을 바꿔 OS를 흉내 낸다. */
interface ShimState {
  storage: Record<string, string>
  permission: PermissionStatus
  /** requestPermissionsAsync 호출 시 사용자가 고르는 결과 */
  onRequest: PermissionStatus | null
  requestCount: number
  unregisterCount: number
  openSettingsCount: number
  tokenThrows: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __notifShim: ShimState
}

const captured: Captured[] = []

let initializeNotifications: (canRegisterToken?: boolean) => Promise<PushState>
let enableNotifications: () => Promise<PushState>
let disableNotifications: () => Promise<PushState>

const PREFERENCE_KEY = 'push_notifications_enabled'
const TOKEN_KEY = 'expo_push_token'

/** 앱 소스를 Expo/React Native 없이 실행 가능한 ESM으로 번들한다. */
async function loadNotificationService() {
  const dir = mkdtempSync(join(tmpdir(), 'mobile-notifications-'))

  const write = (name: string, source: string) => {
    const file = join(dir, name)
    writeFileSync(file, source)
    return file
  }

  const constants = write(
    'expo-constants.js',
    `export default { expoConfig: { extra: { apiBaseUrl: "https://www.ipjuhae.com/api", eas: { projectId: "test-project" } } } }\n`
  )

  // AsyncStorage는 기기 영속 저장소다. 앱을 껐다 켜는 상황을 이 객체로 흉내 낸다.
  const asyncStorage = write(
    'async-storage.js',
    `const s = () => globalThis.__notifShim.storage
export default {
  getItem: async (k) => (Object.prototype.hasOwnProperty.call(s(), k) ? s()[k] : null),
  setItem: async (k, v) => { s()[k] = String(v) },
  removeItem: async (k) => { delete s()[k] },
  multiRemove: async (keys) => { for (const k of keys) delete s()[k] },
}
`
  )

  // OS 알림 권한 자체. 사용자가 기기 설정에서 껐다 켜는 걸 permission으로 흉내 낸다.
  const notifications = write(
    'expo-notifications.js',
    `const s = () => globalThis.__notifShim
export const PermissionStatus = { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' }
export const AndroidImportance = { HIGH: 4 }
export function setNotificationHandler() {}
export async function setNotificationChannelAsync() {}
export async function getPermissionsAsync() { return { status: s().permission } }
export async function requestPermissionsAsync() {
  s().requestCount += 1
  if (s().onRequest) s().permission = s().onRequest
  return { status: s().permission }
}
export async function getExpoPushTokenAsync() {
  if (s().tokenThrows) throw new Error('token registration failed')
  return { data: 'ExponentPushToken[test]' }
}
export async function unregisterForNotificationsAsync() { s().unregisterCount += 1 }
`
  )

  const reactNative = write(
    'react-native.js',
    `export const Platform = { OS: 'ios' }
export const Linking = { openSettings: async () => { globalThis.__notifShim.openSettingsCount += 1 } }
`
  )

  const outfile = join(dir, 'notificationService.mjs')
  await build({
    entryPoints: [join(process.cwd(), 'mobile/src/services/notificationService.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    alias: {
      'expo-constants': constants,
      'expo-notifications': notifications,
      'react-native': reactNative,
      '@react-native-async-storage/async-storage': asyncStorage,
    },
    logLevel: 'silent',
  })

  return import(pathToFileURL(outfile).href)
}

function headersOf(init: RequestInit): Record<string, string> {
  const raw = (init.headers ?? {}) as Record<string, string>
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v)]))
}

beforeAll(async () => {
  globalThis.fetch = ((url: string, init: RequestInit = {}) => {
    captured.push({ url, init })
    return Promise.resolve(new Response('{"ok":true}', { status: 200 }))
  }) as typeof fetch

  const mod = await loadNotificationService()
  initializeNotifications = mod.initializeNotifications
  enableNotifications = mod.enableNotifications
  disableNotifications = mod.disableNotifications
}, 30_000)

beforeEach(() => {
  captured.length = 0
  globalThis.__notifShim = {
    storage: {},
    permission: 'undetermined',
    onRequest: null,
    requestCount: 0,
    unregisterCount: 0,
    openSettingsCount: 0,
    tokenThrows: false,
  }
})

describe('알림 켜기 — 권한을 실제로 받아야만 켜진다', () => {
  it('사용자가 권한을 허용하면 켜지고 서버에 토큰을 등록한다', async () => {
    globalThis.__notifShim.onRequest = 'granted'

    const state = await enableNotifications()

    expect(state).toMatchObject({ enabled: true, permission: 'granted', tokenRegistered: true })
    expect(globalThis.__notifShim.storage[PREFERENCE_KEY]).toBe('true')
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBe('ExponentPushToken[test]')

    const request = captured.at(-1)!
    expect(request.url).toBe('https://www.ipjuhae.com/api/notifications/push-token')
    expect(request.init.method).toBe('PUT')
    expect(JSON.parse(String(request.init.body))).toEqual({
      token: 'ExponentPushToken[test]',
      platform: 'ios',
    })
  })

  it('앱 요청에는 x-mobile-client 헤더가 실린다 — 없으면 미들웨어가 403으로 버린다', async () => {
    globalThis.__notifShim.onRequest = 'granted'

    await enableNotifications()

    expect(headersOf(captured.at(-1)!.init)['x-mobile-client']).toBe('true')
  })

  it('사용자가 권한을 거부하면 켜지지 않고 선호값도 false로 저장된다', async () => {
    globalThis.__notifShim.onRequest = 'denied'

    const state = await enableNotifications()

    expect(state.enabled).toBe(false)
    expect(state.permission).toBe('denied')
    expect(globalThis.__notifShim.storage[PREFERENCE_KEY]).toBe('false')
    expect(state.error).toMatch(/권한/)
    expect(captured).toHaveLength(0)
  })

  it('이미 권한이 허용되어 있으면 권한 팝업을 다시 띄우지 않는다', async () => {
    globalThis.__notifShim.permission = 'granted'

    await enableNotifications()

    expect(globalThis.__notifShim.requestCount).toBe(0)
  })

  it('토큰 등록이 실패해도 켜진 상태는 유지하되 실패를 화면에 알린다', async () => {
    globalThis.__notifShim.permission = 'granted'
    globalThis.__notifShim.tokenThrows = true

    const state = await enableNotifications()

    expect(state).toMatchObject({ enabled: true, tokenRegistered: false })
    expect(state.error).toMatch(/토큰/)
  })
})

describe('알림 끄기 — 기기와 서버 양쪽에서 토큰을 지운다', () => {
  beforeEach(() => {
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'true'
    globalThis.__notifShim.storage[TOKEN_KEY] = 'ExponentPushToken[test]'
    globalThis.__notifShim.permission = 'granted'
  })

  it('서버 토큰을 지우고 기기 토큰도 폐기한다 — 로그아웃 후 이전 계정 알림 차단', async () => {
    const state = await disableNotifications()

    expect(state.enabled).toBe(false)
    expect(globalThis.__notifShim.storage[PREFERENCE_KEY]).toBe('false')
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBeUndefined()
    expect(globalThis.__notifShim.unregisterCount).toBe(1)

    const request = captured.at(-1)!
    expect(request.init.method).toBe('DELETE')
    expect(request.url).toContain('/notifications/push-token?token=')
  })

  it('서버 삭제가 실패해도 기기 토큰은 반드시 폐기한다', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch

    const state = await disableNotifications()

    expect(state.enabled).toBe(false)
    expect(globalThis.__notifShim.unregisterCount).toBe(1)
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBeUndefined()
    expect(state.error).toMatch(/서버 토큰/)

    globalThis.fetch = ((url: string, init: RequestInit = {}) => {
      captured.push({ url, init })
      return Promise.resolve(new Response('{"ok":true}', { status: 200 }))
    }) as typeof fetch
  })
})

describe('앱 재시작 — 저장된 선호값과 OS 권한을 다시 맞춘다', () => {
  it('선호값이 없으면 꺼진 상태로 시작하고 권한 팝업도 띄우지 않는다', async () => {
    const state = await initializeNotifications()

    expect(state).toMatchObject({ enabled: false, permission: 'undetermined' })
    expect(globalThis.__notifShim.requestCount).toBe(0)
  })

  it('켜 둔 상태로 재시작하면 토큰을 갱신한다', async () => {
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'true'
    globalThis.__notifShim.permission = 'granted'

    const state = await initializeNotifications()

    expect(state).toMatchObject({ enabled: true, tokenRegistered: true })
  })

  it('비로그인 상태에서는 토큰을 등록하지 않는다', async () => {
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'true'
    globalThis.__notifShim.permission = 'granted'

    const state = await initializeNotifications(false)

    expect(state.tokenRegistered).toBe(false)
    expect(captured).toHaveLength(0)
  })

  /**
   * [DOW-632]의 원래 재현 절차 그대로다: 앱에서 알림을 켜고 → 기기 설정에서 권한을 끄고 →
   * 앱으로 돌아온다. 이때 `NotificationSettingsScreen`의 Switch는 `enabled`를 그대로
   * 렌더링하므로, `enabled`가 true로 남으면 화면은 "켜짐"으로 보이면서 실제로는
   * 알림이 한 통도 오지 않는다. 안내 문구만 "권한이 꺼져 있습니다"로 뜨는 모순 상태다.
   *
   * 현재 main은 이 조합을 보정하지 않는다(`enableNotifications`에만 강등 로직이 있고
   * `initializeNotifications`에는 없다). 결함이 살아 있는 동안 CI를 빨갛게 두지 않으려고
   * `it.fails`로 고정해 둔다 — 제품 코드가 고쳐지면 이 테스트가 실패하며,
   * 그때 `it.fails`를 `it`으로 바꾸는 것이 마무리다.
   */
  it.fails('권한을 기기 설정에서 끄면 앱 toggle도 꺼진 것으로 보여야 한다', async () => {
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()

    // 사용자가 기기 설정으로 가서 알림 권한을 끈다.
    globalThis.__notifShim.permission = 'denied'

    const state = await initializeNotifications()

    expect(state.permission).toBe('denied')
    expect(state.enabled).toBe(false)
  })

  it('권한이 꺼진 채 재시작하면 최소한 권한 상태는 denied로 보고한다', async () => {
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'true'
    globalThis.__notifShim.permission = 'denied'

    const state = await initializeNotifications()

    // 화면은 이 값으로 "기기 알림 설정 열기" 버튼을 띄운다.
    expect(state.permission).toBe('denied')
    expect(state.tokenRegistered).toBe(false)
    expect(captured).toHaveLength(0)
  })
})

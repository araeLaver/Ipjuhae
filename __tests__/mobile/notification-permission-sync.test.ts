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
  /** unregisterForNotificationsAsync가 실패하는 기기 — 토큰 폐기만 실패하는 상황 */
  unregisterThrows: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __notifShim: ShimState
}

const captured: Captured[] = []

let initializeNotifications: (canRegisterToken?: boolean) => Promise<PushState>
let enableNotifications: () => Promise<PushState>
let disableNotifications: () => Promise<PushState>
let apiClient: { clearTokens: () => Promise<void>; get: (url: string) => Promise<unknown> }

const PREFERENCE_KEY = 'push_notifications_enabled'
const TOKEN_KEY = 'expo_push_token'
const PENDING_REVOKE_KEY = 'expo_push_token_pending_revoke'

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
export async function unregisterForNotificationsAsync() {
  s().unregisterCount += 1
  if (s().unregisterThrows) throw new Error('unregister failed')
}
`
  )

  const reactNative = write(
    'react-native.js',
    `export const Platform = { OS: 'ios' }
export const Linking = { openSettings: async () => { globalThis.__notifShim.openSettingsCount += 1 } }
`
  )

  // `apiClient`도 같이 내보낸다. 세션 만료(401) 경로가 기기에 남은 push token까지
  // 비우는지 보려면 셔임으로 흉내 내지 말고 실제 `clearTokens()`를 태워야 한다.
  // 한 번들에서 꺼내야 두 모듈이 같은 AsyncStorage 셔임을 공유한다.
  const entry = write(
    'entry.ts',
    `export * from ${JSON.stringify(join(process.cwd(), 'mobile/src/services/notificationService.ts'))}
export { apiClient } from ${JSON.stringify(join(process.cwd(), 'mobile/src/services/apiClient.ts'))}
`
  )

  const outfile = join(dir, 'notificationService.mjs')
  await build({
    entryPoints: [entry],
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
  apiClient = mod.apiClient
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
    unregisterThrows: false,
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
    // 되돌리기를 단언보다 먼저 한다. 뒤에 두면 단언이 하나라도 깨지는 순간 거부하는
    // fetch가 그대로 남아 이 파일의 나머지 케이스까지 통째로 함께 무너진다.
    const working = globalThis.fetch
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch

    const state = await disableNotifications()
    globalThis.fetch = working

    expect(state.enabled).toBe(false)
    expect(globalThis.__notifShim.unregisterCount).toBe(1)
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBeUndefined()
    expect(globalThis.__notifShim.storage[PENDING_REVOKE_KEY]).toBe('ExponentPushToken[test]')
    expect(state.error).toMatch(/서버 토큰/)
  })

  /**
   * [DOW-1132]. 위 케이스는 기기 토큰이 폐기됐다는 것까지만 본다. 화면에 뜨는 문구는
   * "다음 연결 때 다시 처리해 주세요"라고 약속하는데, 그 재시도를 실제로 거는 건
   * `revokeStoredToken()`이고 그쪽은 `PUSH_PENDING_REVOKE_KEY`를 읽는다. 끄기 경로가
   * 거기에 토큰을 넘겨 두지 않으면 두 저장값이 모두 비어 재시도가 영영 오지 않는다 —
   * 서버 `push_tokens` 행은 남고 사용자는 처리됐다고 믿는다.
   */
  it('서버 삭제가 실패하면 다음 복귀에서 같은 토큰으로 다시 삭제를 건다', async () => {
    const working = globalThis.fetch
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch

    await disableNotifications()

    globalThis.fetch = working
    captured.length = 0
    await initializeNotifications(true)

    const deletes = captured.filter((c) => c.init.method === 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].url).toContain(encodeURIComponent('ExponentPushToken[test]'))
    expect(globalThis.__notifShim.storage[PENDING_REVOKE_KEY]).toBeUndefined()
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

  /**
   * [DOW-1117] 2번. 이 경로는 포그라운드 복귀마다 지나간다. 기기 토큰이 그대로인데도
   * 매번 `PUT /notifications/push-token`을 보내면 앱 전환 횟수만큼 요청이 쌓인다.
   */
  it('토큰이 그대로면 다시 등록하지 않는다', async () => {
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'true'
    globalThis.__notifShim.storage[TOKEN_KEY] = 'ExponentPushToken[test]'
    globalThis.__notifShim.permission = 'granted'

    const state = await initializeNotifications()

    expect(state).toMatchObject({ enabled: true, tokenRegistered: true })
    expect(captured).toHaveLength(0)
  })

  it('토큰이 바뀌면 다시 등록한다 — 재설치·토큰 회전은 놓치지 않는다', async () => {
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'true'
    globalThis.__notifShim.storage[TOKEN_KEY] = 'ExponentPushToken[old]'
    globalThis.__notifShim.permission = 'granted'

    const state = await initializeNotifications()

    expect(state.tokenRegistered).toBe(true)
    expect(captured.at(-1)!.init.method).toBe('PUT')
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBe('ExponentPushToken[test]')
  })

  /**
   * 오프라인으로 복귀하면 토큰 조회 자체가 실패한다. 이미 등록해 둔 토큰이 있는데도
   * 복귀할 때마다 "등록하지 못했습니다"를 띄우는 건 사용자에게 줄 정보가 아니다.
   */
  it('이미 등록된 토큰이 있으면 갱신 실패를 오류로 띄우지 않는다', async () => {
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'true'
    globalThis.__notifShim.storage[TOKEN_KEY] = 'ExponentPushToken[test]'
    globalThis.__notifShim.permission = 'granted'
    globalThis.__notifShim.tokenThrows = true

    const state = await initializeNotifications()

    expect(state).toMatchObject({ enabled: true, tokenRegistered: true, error: null })
  })

  it('등록된 토큰이 없는데 갱신도 실패하면 그때는 오류를 알린다', async () => {
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'true'
    globalThis.__notifShim.permission = 'granted'
    globalThis.__notifShim.tokenThrows = true

    const state = await initializeNotifications()

    expect(state).toMatchObject({ enabled: true, tokenRegistered: false })
    expect(state.error).toMatch(/토큰/)
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
   * [DOW-1114]에서 `initializeNotifications`가 `reconcilePreference`로 선호값을
   * OS 권한에 맞추도록 고쳤다. 이제 정상 통과해야 하는 케이스다.
   */
  it('권한을 기기 설정에서 끄면 앱 toggle도 꺼진 것으로 보여야 한다', async () => {
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()

    // 사용자가 기기 설정으로 가서 알림 권한을 끈다.
    globalThis.__notifShim.permission = 'denied'

    const state = await initializeNotifications()

    expect(state.permission).toBe('denied')
    expect(state.enabled).toBe(false)
    // 선호값도 함께 내려가야 다음 실행에서 같은 모순이 반복되지 않는다.
    expect(globalThis.__notifShim.storage[PREFERENCE_KEY]).toBe('false')
  })

  /**
   * [DOW-1117] 1번. 위 케이스는 "화면이 꺼진 것으로 보이는가"까지만 본다.
   * 서버는 여전히 이 기기를 발송 대상으로 들고 있다. 앱 안에서 끄면
   * `disableNotifications()`가 서버 토큰 삭제와 기기 토큰 폐기까지 하는데,
   * 권한이 밖에서 꺼진 경로에는 그 정리가 없었다.
   */
  it('권한이 밖에서 꺼지면 서버 토큰도 지우고 기기 토큰을 폐기한다', async () => {
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()
    captured.length = 0

    globalThis.__notifShim.permission = 'denied'
    await initializeNotifications()

    const request = captured.at(-1)!
    expect(request.init.method).toBe('DELETE')
    expect(request.url).toContain('/notifications/push-token?token=')
    expect(globalThis.__notifShim.unregisterCount).toBe(1)
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBeUndefined()
  })

  it('정리가 끝난 뒤 다시 복귀해도 같은 삭제 요청을 반복하지 않는다', async () => {
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()
    globalThis.__notifShim.permission = 'denied'
    await initializeNotifications()
    captured.length = 0

    await initializeNotifications()

    expect(captured).toHaveLength(0)
  })

  /**
   * 이 경로에는 실패를 알려 줄 사용자가 없다(앱이 방금 앞으로 나온 순간이다).
   * 저장된 토큰을 지워 버리면 서버 행은 영영 남으므로, 남겨 두고 다음에 다시 건다.
   */
  it('서버 삭제가 실패하면 저장된 토큰을 남겨 다음 복귀에서 다시 시도한다', async () => {
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()

    const working = globalThis.fetch
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch
    globalThis.__notifShim.permission = 'denied'
    const state = await initializeNotifications()

    expect(state.enabled).toBe(false)
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBe('ExponentPushToken[test]')
    expect(globalThis.__notifShim.unregisterCount).toBe(0)

    // 다음 복귀에서 네트워크가 돌아오면 그때 정리된다.
    globalThis.fetch = working
    captured.length = 0
    await initializeNotifications()

    expect(captured.at(-1)!.init.method).toBe('DELETE')
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBeUndefined()
  })

  it('비로그인 상태에서는 서버 토큰 정리를 시도하지 않는다 — 401이 날 뿐이다', async () => {
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()
    captured.length = 0

    globalThis.__notifShim.permission = 'denied'
    const state = await initializeNotifications(false)

    expect(state.enabled).toBe(false)
    expect(captured).toHaveLength(0)
    // 토큰은 남겨 둔다. 다시 로그인해 초기화가 돌 때 정리한다.
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBe('ExponentPushToken[test]')
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

/**
 * QA가 `b6e94891` 재검증 중 잡은 후속 2건. `7f166f63`이 고쳤고 QA가 재검증했다 —
 * 이 블록은 이제 회귀 방지용이다. [DOW-1117] 코멘트 참고.
 */
describe('토큰 수명주기 — 계정 전환과 정리 재시도 (DOW-1117 후속)', () => {
  /**
   * push_tokens.token은 UNIQUE이고, 기기 토큰의 소유자를 옮기는 유일한 수단이
   * PUT의 `ON CONFLICT (token) DO UPDATE SET user_id`다. 복귀 경로에서 PUT을
   * 건너뛰면 이 기기는 이전 계정의 발송 대상으로 남는다.
   *
   * 세션을 비우는 지점이 `expo_push_token`도 함께 지우므로 다음 계정의 초기화에서
   * 저장값이 비어 있고, 재등록 생략에 걸리지 않는다.
   */
  it('같은 기기에서 계정이 바뀌면 토큰 소유자를 서버에 다시 올린다', async () => {
    globalThis.__notifShim.permission = 'granted'
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()
    expect(captured.filter((c) => c.init.method === 'PUT')).toHaveLength(1)

    // 401 → apiClient가 세션을 비운다. disableNotifications()는 돌지 않으므로
    // 선호값은 기기에 그대로 남는다. 그 상태로 다른 계정이 로그인한다.
    await apiClient.clearTokens()
    captured.length = 0

    const state = await initializeNotifications(true)

    expect(state).toMatchObject({ enabled: true, tokenRegistered: true })
    expect(captured.filter((c) => c.init.method === 'PUT')).toHaveLength(1)
  })

  /**
   * 위 케이스가 기대는 전제를 따로 고정한다. 세션 정리가 `expo_push_token`을
   * 남기도록 되돌아가면 계정 전환 케이스만으로는 원인이 드러나지 않는다.
   */
  it('세션이 만료되면(401) 기기에 남은 push token도 함께 비운다', async () => {
    globalThis.__notifShim.permission = 'granted'
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBe('ExponentPushToken[test]')

    const working = globalThis.fetch
    globalThis.fetch = (() =>
      Promise.resolve(new Response('{}', { status: 401 }))) as typeof fetch
    await expect(apiClient.get('/me')).rejects.toThrow('UNAUTHORIZED')
    globalThis.fetch = working

    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBeUndefined()
    expect(globalThis.__notifShim.storage['auth_token']).toBeUndefined()
  })

  it('서버 삭제가 끝났으면 복귀마다 같은 DELETE를 되풀이하지 않는다', async () => {
    // 서버 행은 이미 지워졌는데 기기 토큰 폐기만 실패하면, 저장값이 남아 복귀마다
    // 같은 DELETE가 다시 나갔다. `7f166f63`이 두 try를 갈라 고쳤다.
    globalThis.__notifShim.storage[PREFERENCE_KEY] = 'false'
    globalThis.__notifShim.storage[TOKEN_KEY] = 'ExponentPushToken[test]'
    globalThis.__notifShim.permission = 'denied'
    globalThis.__notifShim.unregisterThrows = true

    await initializeNotifications(true)
    expect(captured.filter((c) => c.init.method === 'DELETE')).toHaveLength(1)

    await initializeNotifications(true)
    await initializeNotifications(true)

    expect(captured.filter((c) => c.init.method === 'DELETE')).toHaveLength(1)
  })
})

/**
 * QA가 `7f166f63` 재검증 중 잡은 후속 1건. [DOW-1123]에서 고쳤고, 이 블록은 이제
 * 회귀 방지용이다.
 *
 * `clearTokens()`가 `expo_push_token`까지 지우게 되면서(같은 커밋의 3번 수정),
 * 정리 `DELETE`가 **401**로 실패하는 경로에서 저장값이 401 핸들러에 의해 같이
 * 지워졌다. 그러면 `revokeStoredToken()`이 다음 복귀에 지울 토큰을 못 찾아,
 * "서버 삭제가 실패하면 남겨 두고 다시 건다"는 설계 의도(`notificationService.ts`
 * 주석)가 이 경로에서만 조용히 무너졌다. 위 `서버 삭제가 실패하면 …` 케이스는
 * 네트워크 거부(reject)만 태우므로 이 조합을 잡지 못한다.
 *
 * 수정은 실패한 토큰을 `expo_push_token_pending_revoke`로 옮겨 둔다. 원래 자리에
 * 되돌리지 않는 것이 핵심이라, 바로 위 계정 전환 케이스와 함께 봐야 한다 —
 * `PUSH_TOKEN_KEY`를 복구하는 수정이면 그쪽이 깨진다.
 */
describe('토큰 수명주기 — 401로 정리에 실패한 뒤 재시도 (DOW-1117 후속 2차)', () => {
  it('정리 DELETE가 401이면 저장된 토큰을 남겨 재로그인 후 다시 시도한다', async () => {
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()

    // 세션이 서버에서 이미 만료된 기기. 기기 설정에서 알림을 끈 뒤 앱이 앞으로 나온다.
    const working = globalThis.fetch
    globalThis.fetch = ((url: string, init: RequestInit = {}) => {
      captured.push({ url, init })
      return Promise.resolve(new Response('{}', { status: 401 }))
    }) as typeof fetch
    globalThis.__notifShim.permission = 'denied'
    await initializeNotifications(true)
    globalThis.fetch = working

    // 서버 행은 그대로다. 지울 토큰이 남아야 재로그인 후 초기화에서 다시 걸 수 있다.
    // QA 원안은 `TOKEN_KEY`가 복구되기를 기대했지만, 그 자리는 "재등록을 생략해도
    // 되는 토큰"을 뜻해 바로 아래 케이스가 깨진다. 값은 대기 자리로 간다.
    expect(globalThis.__notifShim.storage[PENDING_REVOKE_KEY]).toBe('ExponentPushToken[test]')
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBeUndefined()

    // 같은 계정으로 재로그인한 뒤의 복귀.
    captured.length = 0
    await initializeNotifications(true)

    expect(captured.at(-1)!.init.method).toBe('DELETE')
    expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBeUndefined()
    expect(globalThis.__notifShim.storage[PENDING_REVOKE_KEY]).toBeUndefined()
  })

  /**
   * 위 수정이 `TOKEN_KEY`를 되돌리는 방식이면 이 케이스가 깨진다. 401 정리 실패와
   * 계정 전환이 겹치는 조합이라 두 케이스 어느 쪽도 단독으로는 잡지 못한다.
   */
  it('401로 정리에 실패한 뒤 다른 계정이 켜면 토큰 소유자를 다시 올린다', async () => {
    globalThis.__notifShim.permission = 'granted'
    globalThis.__notifShim.onRequest = 'granted'
    await enableNotifications()

    // 세션 만료 + 기기 설정에서 알림 끄기 → 정리 DELETE가 401로 실패한다.
    const working = globalThis.fetch
    globalThis.fetch = (() =>
      Promise.resolve(new Response('{}', { status: 401 }))) as typeof fetch
    globalThis.__notifShim.permission = 'denied'
    await initializeNotifications(true)
    globalThis.fetch = working

    // 다른 계정이 로그인하고, 기기 설정에서 권한을 되돌린 뒤 앱에서 알림을 켠다.
    // push_tokens.token은 UNIQUE라 이 PUT만이 소유자를 옮긴다.
    captured.length = 0
    globalThis.__notifShim.permission = 'granted'
    const state = await enableNotifications()

    expect(state).toMatchObject({ enabled: true, tokenRegistered: true })
    expect(captured.filter((c) => c.init.method === 'PUT')).toHaveLength(1)
  })
})

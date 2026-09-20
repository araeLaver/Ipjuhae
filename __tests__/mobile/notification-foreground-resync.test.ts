// @vitest-environment jsdom
/**
 * 앱 알림 설정 — 앱을 **재시작하지 않고** 기기 설정에서 돌아오는 경로.
 *
 * 왜 이 파일이 따로 있나:
 * [DOW-1114]의 재현 절차 3번은 "앱으로 돌아와"다. 재시작이 아니다.
 * `notification-permission-sync.test.ts`는 service 함수를 직접 호출해서 검증하므로
 * "앱이 그 함수를 다시 부르는가"는 보지 못한다. 실제로 그 호출을 일으키는 건
 * `NotificationContext`의 `AppState` 리스너 하나뿐이고, 그게 빠지면 화면은
 * 재시작 전까지 계속 켜진 것으로 거짓말을 한다. 리스너가 사라지거나 조건이
 * 틀어지는 회귀를 여기서 잡는다.
 *
 * service 테스트와 같은 이유로 Expo/React Native는 설치하지 않고 esbuild 번들 +
 * 네이티브 모듈 셔임으로 로드한다. 다만 여기서는 Provider를 실제로 render해야 하므로
 * react/react-dom은 external로 두어 테스트와 **같은 React 인스턴스**를 쓴다.
 * (번들이 react를 따로 품으면 hook이 서로 다른 dispatcher를 보고 깨진다.)
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import { act, cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

type PermissionStatus = 'granted' | 'denied' | 'undetermined'
type AppStateStatus = 'active' | 'background' | 'inactive'

interface PushState {
  enabled: boolean
  permission: PermissionStatus
  tokenRegistered: boolean
  error: string | null
}

interface ShimState {
  storage: Record<string, string>
  permission: PermissionStatus
  tokenThrows: boolean
  /** AppState 리스너. 테스트가 이걸 직접 불러 포그라운드 복귀를 흉내 낸다. */
  appStateListeners: Array<(next: AppStateStatus) => void>
  appState: AppStateStatus
}

declare global {
  // eslint-disable-next-line no-var
  var __notifCtxShim: ShimState
}

const PREFERENCE_KEY = 'push_notifications_enabled'

/** 렌더된 Provider가 내려주는 값. probe 컴포넌트가 매 렌더마다 갱신한다. */
let observed: (PushState & { isLoading: boolean }) | null = null
let tokenRequests = 0
let outDir = ''
let NotificationProvider: React.FC<{ children: React.ReactNode }>
let useNotifications: () => PushState & { isLoading: boolean }

async function loadNotificationContext() {
  // jsdom 환경에서는 Node의 TextEncoder가 **다른 realm의** Uint8Array를 돌려주고,
  // esbuild는 `encode('') instanceof Uint8Array`를 환경 검사로 쓰기 때문에 로드 즉시 죽는다.
  // 결과를 현재 realm의 Uint8Array로 다시 감싼 뒤에 esbuild를 로드한다.
  class RealmSafeTextEncoder extends NodeTextEncoder {
    encode(input = '') {
      return new Uint8Array(super.encode(input))
    }
  }
  globalThis.TextEncoder = RealmSafeTextEncoder as unknown as typeof globalThis.TextEncoder
  globalThis.TextDecoder = NodeTextDecoder as unknown as typeof globalThis.TextDecoder
  const { build } = await import('esbuild')

  // bare specifier(react/react-dom)를 external로 두려면 번들 결과가 프로젝트
  // node_modules 아래 있어야 node가 해석할 수 있다.
  outDir = mkdtempSync(join(process.cwd(), 'node_modules', '.qa-notif-ctx-'))

  const write = (name: string, source: string) => {
    const file = join(outDir, name)
    writeFileSync(file, source)
    return file
  }

  const constants = write(
    'expo-constants.js',
    `export default { expoConfig: { extra: { apiBaseUrl: "https://www.ipjuhae.com/api", eas: { projectId: "test-project" } } } }\n`
  )

  const asyncStorage = write(
    'async-storage.js',
    `const s = () => globalThis.__notifCtxShim.storage
export default {
  getItem: async (k) => (Object.prototype.hasOwnProperty.call(s(), k) ? s()[k] : null),
  setItem: async (k, v) => { s()[k] = String(v) },
  removeItem: async (k) => { delete s()[k] },
  multiRemove: async (keys) => { for (const k of keys) delete s()[k] },
}
`
  )

  const notifications = write(
    'expo-notifications.js',
    `const s = () => globalThis.__notifCtxShim
export const PermissionStatus = { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' }
export const AndroidImportance = { HIGH: 4 }
export function setNotificationHandler() {}
export async function setNotificationChannelAsync() {}
export async function getPermissionsAsync() { return { status: s().permission } }
export async function requestPermissionsAsync() { return { status: s().permission } }
export async function getExpoPushTokenAsync() {
  if (s().tokenThrows) throw new Error('token registration failed')
  return { data: 'ExponentPushToken[test]' }
}
export async function unregisterForNotificationsAsync() {}
`
  )

  // AppState는 OS가 주는 앱 생명주기 신호다. 테스트가 리스너를 직접 호출해
  // "기기 설정에 갔다가 앱으로 돌아왔다"를 흉내 낸다.
  const reactNative = write(
    'react-native.js',
    `const s = () => globalThis.__notifCtxShim
export const Platform = { OS: 'ios' }
export const Linking = { openSettings: async () => {} }
export const AppState = {
  get currentState() { return s().appState },
  addEventListener(type, cb) {
    if (type !== 'change') return { remove() {} }
    s().appStateListeners.push(cb)
    return { remove() {
      const i = s().appStateListeners.indexOf(cb)
      if (i >= 0) s().appStateListeners.splice(i, 1)
    } }
  },
}
`
  )

  // NotificationContext는 useAuth()에서 인증 상태만 본다. 로그인 플로우 전체를
  // 끌고 오지 않도록 그 두 값만 내주는 셔임으로 바꾼다.
  const authContext = write(
    'auth-context.js',
    `export function useAuth() { return { isAuthenticated: true, isLoading: false } }
export const AuthProvider = ({ children }) => children
`
  )

  const outfile = join(outDir, 'NotificationContext.mjs')
  await build({
    entryPoints: [join(process.cwd(), 'mobile/src/contexts/NotificationContext.tsx')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    jsx: 'automatic',
    external: ['react', 'react/jsx-runtime'],
    alias: {
      'expo-constants': constants,
      'expo-notifications': notifications,
      'react-native': reactNative,
      '@react-native-async-storage/async-storage': asyncStorage,
    },
    plugins: [
      {
        name: 'auth-context-shim',
        setup(build) {
          build.onResolve({ filter: /(^|\/)AuthContext$/ }, () => ({ path: authContext }))
        },
      },
    ],
    logLevel: 'silent',
  })

  return import(pathToFileURL(outfile).href)
}

/** Provider가 내려주는 값을 observed에 복사만 하는 화면 대역. */
function Probe() {
  observed = useNotifications()
  return null
}

function renderProvider() {
  return render(React.createElement(NotificationProvider, null, React.createElement(Probe)))
}

/** OS가 앱 상태 변화를 알리는 순간. NotificationSettingsScreen은 그대로 두고 신호만 넣는다. */
async function emitAppState(next: AppStateStatus) {
  globalThis.__notifCtxShim.appState = next
  await act(async () => {
    for (const listener of [...globalThis.__notifCtxShim.appStateListeners]) listener(next)
  })
}

beforeAll(async () => {
  globalThis.fetch = ((url: string, init: RequestInit = {}) => {
    if (String(url).includes('/notifications/push-token')) tokenRequests += 1
    void init
    return Promise.resolve(new Response('{"ok":true}', { status: 200 }))
  }) as typeof fetch

  const mod = await loadNotificationContext()
  NotificationProvider = mod.NotificationProvider
  useNotifications = mod.useNotifications
}, 60_000)

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true })
})

beforeEach(() => {
  observed = null
  tokenRequests = 0
  globalThis.__notifCtxShim = {
    // 이전 실행에서 사용자가 알림을 켜 둔 기기 상태로 시작한다.
    storage: { [PREFERENCE_KEY]: 'true' },
    permission: 'granted',
    tokenThrows: false,
    appStateListeners: [],
    appState: 'active',
  }
})

afterEach(() => {
  cleanup()
})

describe('앱 재시작 없이 기기 설정에서 돌아오는 경로 (DOW-1114)', () => {
  it('권한을 끄고 앱으로 돌아오면 toggle이 즉시 꺼진 것으로 보인다', async () => {
    await act(async () => {
      renderProvider()
    })
    expect(observed).toMatchObject({ enabled: true, permission: 'granted' })

    // 사용자가 기기 설정으로 나가서 권한을 끄고 돌아온다.
    await emitAppState('background')
    globalThis.__notifCtxShim.permission = 'denied'
    await emitAppState('active')

    expect(observed).toMatchObject({ enabled: false, permission: 'denied' })
    // 선호값까지 되돌아야 다음 실행에서 같은 모순이 되살아나지 않는다.
    expect(globalThis.__notifCtxShim.storage[PREFERENCE_KEY]).toBe('false')
  })

  it('복귀 시점에 권한이 그대로면 켜진 상태가 유지된다', async () => {
    await act(async () => {
      renderProvider()
    })

    await emitAppState('background')
    await emitAppState('active')

    expect(observed).toMatchObject({ enabled: true, permission: 'granted' })
    expect(globalThis.__notifCtxShim.storage[PREFERENCE_KEY]).toBe('true')
  })

  it('앱이 뒤로 갈 때는 재조회하지 않는다 — 불필요한 토큰 요청을 만들지 않는다', async () => {
    await act(async () => {
      renderProvider()
    })
    const afterMount = tokenRequests

    await emitAppState('background')

    expect(tokenRequests).toBe(afterMount)
  })

  it('Provider가 언마운트되면 AppState 리스너를 정리한다', async () => {
    let view: ReturnType<typeof renderProvider>
    await act(async () => {
      view = renderProvider()
    })
    expect(globalThis.__notifCtxShim.appStateListeners.length).toBeGreaterThan(0)

    await act(async () => {
      view!.unmount()
    })

    expect(globalThis.__notifCtxShim.appStateListeners).toHaveLength(0)
  })
})

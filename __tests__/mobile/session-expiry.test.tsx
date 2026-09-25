// @vitest-environment jsdom
/**
 * DOW-1194 A1·A2·A3 — 세션 만료 복구 경로와 서버 오류 문구 노출.
 *
 * 왜 소스 grep이 아니라 실제 번들을 돌리는가: 이 세 건은 전부 "던진 쪽은 있는데
 * 받는 쪽이 없다"는 결함이다. 소스에 문자열이 있는지를 세면 고치기 전 코드도
 * 통과한다(DOW-730 전례). 그래서 `apiClient` → `api` → `AuthContext` →
 * `SessionExpiredBanner`를 실제로 번들해 401을 흘려보내고, 화면에 무엇이
 * 남는지로 판정한다. 네트워크는 `fetch`를 갈아끼워 흉내내고, 세션 만료는
 * 저장된 토큰을 서버가 거부하는 상황(실측: 만료 토큰에 `/auth/me`가 401)을
 * 그대로 재현한다.
 */

import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TextEncoder } from 'node:util'

type Bundle = {
  apiClient: {
    get(url: string): Promise<unknown>
    post(url: string, body?: unknown): Promise<unknown>
    setTokens(token: string): Promise<void>
    getToken(): Promise<string | null>
    uploadFile(url: string, file: { uri: string; name: string; type: string }): Promise<unknown>
    onUnauthorized(listener: () => void): () => void
  }
  SESSION_EXPIRED_MESSAGE: string
  SessionExpiredError: new (message?: string) => Error
  AuthProvider: React.ComponentType<{ children: React.ReactNode }>
  useAuth: () => {
    isAuthenticated: boolean
    isLoading: boolean
    sessionExpiredMessage: string | null
    login(email: string, password: string): Promise<void>
    logout(): Promise<void>
    refreshUser(): Promise<void>
  }
  SessionExpiredBanner: React.ComponentType
}

let dir: string
let mod: Bundle
const fetchMock = vi.fn()
const storage = new Map<string, string>()
const qa = globalThis as typeof globalThis & {
  __sessionQA: { storage: Map<string, string> }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeAll(async () => {
  // esbuild는 Uint8Array realm이 어긋나면 터진다(DOW-730 하네스와 같은 이유).
  class Encoder extends TextEncoder {
    encode(input = '') {
      return new Uint8Array(super.encode(input))
    }
  }
  globalThis.TextEncoder = Encoder as typeof globalThis.TextEncoder
  const { build } = await import('esbuild')
  dir = mkdtempSync(join(process.cwd(), 'node_modules/.qa-session-'))

  const native = join(dir, 'native.js')
  writeFileSync(
    native,
    `import React from 'react';
const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : s;
const element = tag => ({children, style, onPress, accessibilityLabel, accessibilityRole}) =>
  React.createElement(tag, {style: flatten(style), onClick: onPress, 'aria-label': accessibilityLabel, role: accessibilityRole}, children);
export const View=element('div'), Text=element('span'), TouchableOpacity=element('button');
export const StyleSheet={create:s=>s};
`
  )
  const asyncStorage = join(dir, 'async-storage.js')
  writeFileSync(
    asyncStorage,
    `const store = () => globalThis.__sessionQA.storage;
export default {
  getItem: async k => store().has(k) ? store().get(k) : null,
  setItem: async (k, v) => { store().set(k, v) },
  removeItem: async k => { store().delete(k) },
  multiRemove: async ks => { ks.forEach(k => store().delete(k)) },
};
`
  )
  const constants = join(dir, 'constants.js')
  writeFileSync(constants, `export default { expoConfig: { extra: { apiBaseUrl: '/api' } } };`)
  const notifications = join(dir, 'notifications.js')
  writeFileSync(notifications, `export const disableNotifications = async () => {};`)

  const entry = join(dir, 'entry.tsx')
  const src = join(process.cwd(), 'mobile/src')
  writeFileSync(
    entry,
    `export { apiClient, SESSION_EXPIRED_MESSAGE, SessionExpiredError } from '${src}/services/apiClient';
export { AuthProvider, useAuth } from '${src}/contexts/AuthContext';
export { default as SessionExpiredBanner } from '${src}/components/SessionExpiredBanner';
`
  )

  const outfile = join(dir, 'bundle.mjs')
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    external: ['react'],
    plugins: [
      {
        name: 'qa-session',
        setup(b) {
          b.onResolve({ filter: /^react-native$/ }, () => ({ path: native }))
          b.onResolve({ filter: /async-storage$/ }, () => ({ path: asyncStorage }))
          b.onResolve({ filter: /^expo-constants$/ }, () => ({ path: constants }))
          b.onResolve({ filter: /notificationService$/ }, () => ({ path: notifications }))
        },
      },
    ],
  })
  mod = (await import(pathToFileURL(outfile).href)) as unknown as Bundle
})

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  delete (globalThis as { __sessionQA?: unknown }).__sessionQA
})

beforeEach(() => {
  storage.clear()
  fetchMock.mockReset()
  qa.__sessionQA = { storage }
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(cleanup)

const AUTH_TOKEN_KEY = 'auth_token'

describe('A2 — 서버 오류 문구가 사용자에게 그대로 전달된다', () => {
  it('403의 한국어 문구를 보여주고 HTTP 403을 노출하지 않는다', async () => {
    // 실측(prod): 이 저장소의 API 라우트는 `json({ error })` 형태다.
    fetchMock.mockResolvedValue(json(403, { error: '집주인 인증이 필요한 기능입니다' }))
    await expect(mod.apiClient.get('/landlord/properties')).rejects.toThrow(
      '집주인 인증이 필요한 기능입니다'
    )
    await expect(mod.apiClient.get('/landlord/properties')).rejects.not.toThrow(/HTTP/)
  })

  it('`message` 형태로 응답하는 소수 라우트도 읽는다', async () => {
    fetchMock.mockResolvedValue(json(400, { message: '이미 신청한 매물이에요' }))
    await expect(mod.apiClient.post('/listings/1/apply')).rejects.toThrow('이미 신청한 매물이에요')
  })

  it('서버가 문구를 주지 않으면 상태코드별 한국어 폴백을 쓴다', async () => {
    fetchMock.mockResolvedValue(json(500, {}))
    const error = await mod.apiClient.get('/community/posts').catch((e: Error) => e)
    expect(error.message).toContain('서버에 문제가 생겼어요')
    expect(error.message).not.toMatch(/HTTP|500/)
  })

  it('본문이 JSON이 아니어도 개발자 문자열을 노출하지 않는다', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    const error = await mod.apiClient.get('/community/posts').catch((e: Error) => e)
    expect(error.message).toContain('서버에 문제가 생겼어요')
    expect(error.message).not.toMatch(/HTTP|502|html/i)
  })

  it('토큰 없는 401(로그인 실패)은 세션 만료가 아니라 서버 문구를 보여준다', async () => {
    // 실측(prod): POST /api/auth/login 실패 → 401 { error: '이메일 또는 비밀번호가 올바르지 않습니다' }
    fetchMock.mockResolvedValue(json(401, { error: '이메일 또는 비밀번호가 올바르지 않습니다' }))
    const listener = vi.fn()
    const off = mod.apiClient.onUnauthorized(listener)
    const error = await mod.apiClient
      .post('/auth/login', { email: 'a@b.c', password: 'x' })
      .catch((e: Error) => e)
    off()
    expect(error.message).toBe('이메일 또는 비밀번호가 올바르지 않습니다')
    expect(error).not.toBeInstanceOf(mod.SessionExpiredError)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('A3 — uploadFile도 request()와 같은 401 처리를 탄다', () => {
  const file = { uri: 'file:///doc.jpg', name: 'doc.jpg', type: 'image/jpeg' }

  it('만료 토큰으로 서류를 올리면 토큰을 비우고 세션 만료를 알린다', async () => {
    await mod.apiClient.setTokens('expired-token')
    fetchMock.mockResolvedValue(json(401, { error: '유효하지 않은 토큰입니다' }))
    const listener = vi.fn()
    const off = mod.apiClient.onUnauthorized(listener)
    await expect(mod.apiClient.uploadFile('/verification/documents', file)).rejects.toThrow(
      mod.SESSION_EXPIRED_MESSAGE
    )
    off()
    expect(await mod.apiClient.getToken()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('업로드 실패 문구도 `Upload failed: 413`이 아니라 한국어다', async () => {
    await mod.apiClient.setTokens('good-token')
    fetchMock.mockResolvedValue(json(413, {}))
    const error = await mod.apiClient
      .uploadFile('/verification/documents', file)
      .catch((e: Error) => e)
    expect(error.message).toBe('파일 용량이 너무 큽니다.')
    expect(error.message).not.toMatch(/Upload failed/)
  })
})

describe('A1 — 세션이 끊기면 비인증 화면으로 돌아가고 안내가 남는다', () => {
  // AppNavigator:174의 `isAuthenticated ? 인증 스택 : 비인증 스택` 분기를 그대로 흉내낸다.
  function Harness() {
    const { isAuthenticated, isLoading, refreshUser } = mod.useAuth()
    if (isLoading) return <span>로딩</span>
    return (
      <div>
        <span>{isAuthenticated ? '인증 스택' : '비인증 스택'}</span>
        <button onClick={() => void refreshUser().catch(() => undefined)}>다시 불러오기</button>
      </div>
    )
  }

  function mount() {
    return render(
      <mod.AuthProvider>
        <mod.SessionExpiredBanner />
        <Harness />
      </mod.AuthProvider>
    )
  }

  const loggedIn = { user: { id: 'u1', email: 'a@b.c', name: '홍길동', userType: 'tenant' } }

  it('앱 사용 중 토큰이 무효화되면 비인증 스택으로 돌아가고 안내를 띄운다', async () => {
    storage.set(AUTH_TOKEN_KEY, 'valid-token')
    fetchMock.mockResolvedValue(json(200, loggedIn))
    mount()
    await screen.findByText('인증 스택')

    // 서버가 토큰을 거부하기 시작한다(실측: 만료 토큰 → 401).
    fetchMock.mockResolvedValue(json(401, { error: '유효하지 않은 토큰입니다' }))
    fireEvent.click(screen.getByText('다시 불러오기'))

    await screen.findByText('비인증 스택')
    expect(screen.getByText(mod.SESSION_EXPIRED_MESSAGE)).toBeVisible()
    expect(storage.get(AUTH_TOKEN_KEY)).toBeUndefined()
  })

  it('화면과 무관한 백그라운드 요청의 401도 같은 복구 경로를 탄다', async () => {
    storage.set(AUTH_TOKEN_KEY, 'valid-token')
    fetchMock.mockResolvedValue(json(200, loggedIn))
    mount()
    await screen.findByText('인증 스택')

    // 화면이 부르지 않은 요청(알림 동기화 등)이 401을 받는 경우.
    fetchMock.mockResolvedValue(json(401, { error: '유효하지 않은 토큰입니다' }))
    await act(async () => {
      await mod.apiClient.get('/notifications').catch(() => undefined)
    })

    await screen.findByText('비인증 스택')
    expect(screen.getByText(mod.SESSION_EXPIRED_MESSAGE)).toBeVisible()
  })

  it('안내는 닫을 수 있고 다시 로그인하면 인증 스택으로 복구된다', async () => {
    storage.set(AUTH_TOKEN_KEY, 'valid-token')
    fetchMock.mockResolvedValue(json(200, loggedIn))
    mount()
    await screen.findByText('인증 스택')

    fetchMock.mockResolvedValue(json(401, { error: '유효하지 않은 토큰입니다' }))
    fireEvent.click(screen.getByText('다시 불러오기'))
    await screen.findByText(mod.SESSION_EXPIRED_MESSAGE)

    fireEvent.click(screen.getByText('닫기'))
    await waitFor(() => expect(screen.queryByText(mod.SESSION_EXPIRED_MESSAGE)).toBeNull())
    expect(screen.getByText('비인증 스택')).toBeVisible()
  })

  it('스스로 로그아웃한 사용자에게는 만료 안내를 띄우지 않는다', async () => {
    storage.set(AUTH_TOKEN_KEY, 'valid-token')
    fetchMock.mockResolvedValue(json(200, loggedIn))
    const view = mount()
    await screen.findByText('인증 스택')

    function Logout() {
      const { logout } = mod.useAuth()
      return <button onClick={() => void logout()}>로그아웃</button>
    }
    view.rerender(
      <mod.AuthProvider>
        <mod.SessionExpiredBanner />
        <Harness />
        <Logout />
      </mod.AuthProvider>
    )
    await screen.findByText('인증 스택')

    // 로그아웃 요청 자체가 401로 돌아오는 경우까지 포함한다.
    fetchMock.mockResolvedValue(json(401, { error: '로그인이 필요합니다' }))
    await act(async () => {
      fireEvent.click(screen.getByText('로그아웃'))
    })

    await screen.findByText('비인증 스택')
    expect(screen.queryByText(mod.SESSION_EXPIRED_MESSAGE)).toBeNull()
  })
})

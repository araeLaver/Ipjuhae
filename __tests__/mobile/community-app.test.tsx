// @vitest-environment jsdom
/**
 * DOW-1196 D1·D2·D3 — 앱 커뮤니티를 웹과 동등하게.
 *
 * 소스 grep으로 대신하지 않는 이유는 [DOW-730] 전례 그대로다. "함수가 있는가"를
 * 세면 화면에서 부르지 않아도 통과한다. 여기서는 실제 화면 두 개를 번들해
 * 렌더하고, **나간 HTTP 요청**과 **화면에 남은 글자**로만 판정한다.
 *
 * react-native·react-navigation은 esbuild onResolve로 갈아끼운다
 * (`session-expiry.test.tsx`와 같은 하네스).
 */

import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TextEncoder } from 'node:util'

type Bundle = {
  CommunityScreen: React.ComponentType<{ navigation: { navigate: (...a: unknown[]) => void } }>
  CommunityPostScreen: React.ComponentType<{
    navigation: unknown
    route: { params: { postId: string } }
  }>
  AuthProvider: React.ComponentType<{ children: React.ReactNode }>
}

let dir: string
let mod: Bundle
const fetchMock = vi.fn()
const storage = new Map<string, string>()
const alerts: { title: string; message?: string }[] = []
const qa = globalThis as typeof globalThis & {
  __communityQA: { storage: Map<string, string>; alerts: typeof alerts }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const POST_ID = 'p1'

/** 서버가 내려주는 글 한 줄(snake_case 그대로). */
const postRow = (over: Record<string, unknown> = {}) => ({
  id: POST_ID,
  audience: 'all',
  category: null,
  title: '보증금 8천, 근저당 6천이면 위험한가요',
  body: '등기부에서 근저당을 봤는데 어느 정도면 위험한 건지 모르겠습니다.',
  view_count: 12,
  comment_count: 1,
  created_at: new Date(2026, 8, 20).toISOString(),
  author_role: 'tenant',
  ...over,
})

const commentRow = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  body: '근저당이 시세의 70%를 넘으면 위험합니다.',
  created_at: new Date(2026, 8, 21).toISOString(),
  author_role: 'broker',
  ...over,
})

beforeAll(async () => {
  class Encoder extends TextEncoder {
    encode(input = '') {
      return new Uint8Array(super.encode(input))
    }
  }
  globalThis.TextEncoder = Encoder as typeof globalThis.TextEncoder
  const { build } = await import('esbuild')
  dir = mkdtempSync(join(process.cwd(), 'node_modules/.qa-community-'))

  /**
   * react-native 대역. `Modal`은 `visible`일 때만, `FlatList`는 머리글·행·빈 상태를
   * 실제 순서대로 낸다 — 이 셋이 커뮤니티 화면의 뼈대라 대충 내면 판정이 헐거워진다.
   */
  const native = join(dir, 'native.js')
  writeFileSync(
    native,
    `import React from 'react';
const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : s;
const box = tag => ({children, style, onPress, disabled, accessibilityLabel}) =>
  React.createElement(tag, {
    style: flatten(style),
    onClick: disabled ? undefined : onPress,
    disabled,
    'aria-label': accessibilityLabel,
  }, children);
export const View = box('div'), Text = box('span'), TouchableOpacity = box('button');
export const ScrollView = box('div'), SafeAreaView = box('div'), KeyboardAvoidingView = box('div');
export const ActivityIndicator = () => React.createElement('span', null, '불러오는 중');
export const RefreshControl = () => null;
export const StyleSheet = { create: s => s };
export const Platform = { OS: 'ios', select: o => o.ios };
export const Alert = {
  alert: (title, message) => { globalThis.__communityQA.alerts.push({ title, message }) },
};
export const TextInput = ({ value, onChangeText, placeholder, style, multiline }) =>
  React.createElement(multiline ? 'textarea' : 'input', {
    value: value ?? '',
    placeholder,
    style: flatten(style),
    onChange: e => onChangeText && onChangeText(e.target.value),
  });
export const Modal = ({ visible, children }) =>
  visible ? React.createElement('div', { role: 'dialog' }, children) : null;
export const FlatList = ({ data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent }) =>
  React.createElement('div', null,
    ListHeaderComponent ?? null,
    (data ?? []).length === 0
      ? (ListEmptyComponent ?? null)
      : (data ?? []).map((item, index) =>
          React.createElement(React.Fragment, { key: keyExtractor ? keyExtractor(item) : index },
            renderItem({ item, index }))));
`
  )

  const asyncStorage = join(dir, 'async-storage.js')
  writeFileSync(
    asyncStorage,
    `const store = () => globalThis.__communityQA.storage;
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

  // `useFocusEffect`는 화면이 보일 때마다 도는 훅이다. 테스트에서는 마운트 1회면 된다.
  const navigation = join(dir, 'navigation.js')
  writeFileSync(
    navigation,
    `import { useEffect } from 'react';
export const useFocusEffect = cb => useEffect(cb, [cb]);
export const useNavigation = () => ({ navigate: () => {} });
`
  )
  const empty = join(dir, 'empty.js')
  writeFileSync(empty, `export default {};`)

  const entry = join(dir, 'entry.tsx')
  const src = join(process.cwd(), 'mobile/src')
  writeFileSync(
    entry,
    `export { default as CommunityScreen } from '${src}/screens/CommunityScreen';
export { default as CommunityPostScreen } from '${src}/screens/CommunityPostScreen';
export { AuthProvider } from '${src}/contexts/AuthContext';
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
        name: 'qa-community',
        setup(b) {
          b.onResolve({ filter: /^react-native$/ }, () => ({ path: native }))
          b.onResolve({ filter: /async-storage$/ }, () => ({ path: asyncStorage }))
          b.onResolve({ filter: /^expo-constants$/ }, () => ({ path: constants }))
          b.onResolve({ filter: /notificationService$/ }, () => ({ path: notifications }))
          b.onResolve({ filter: /^@react-navigation\/native$/ }, () => ({ path: navigation }))
          b.onResolve({ filter: /^@react-navigation\// }, () => ({ path: empty }))
          b.onResolve({ filter: /navigation\/AppNavigator$/ }, () => ({ path: empty }))
        },
      },
    ],
  })
  mod = (await import(pathToFileURL(outfile).href)) as unknown as Bundle
})

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  delete (globalThis as { __communityQA?: unknown }).__communityQA
})

beforeEach(() => {
  storage.clear()
  alerts.length = 0
  fetchMock.mockReset()
  qa.__communityQA = { storage, alerts }
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(cleanup)

/** 나간 요청 중 이 경로·메서드에 해당하는 것. */
function callsTo(path: string, method = 'GET') {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).includes(path) && ((init as RequestInit | undefined)?.method ?? 'GET') === method
  )
}

/** 로그인 상태로 `CommunityScreen`을 띄운다. `userType`이 null이면 비로그인. */
async function mountBoard(userType: string | null, posts: unknown[] = []) {
  if (userType) storage.set('auth_token', 'valid-token')
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/auth/me')) {
      return userType
        ? json(200, { user: { id: 'u1', email: 'a@b.c', name: '홍길동', userType } })
        : json(401, { user: null })
    }
    if (String(url).includes('/community/posts')) return json(200, { posts })
    return json(200, {})
  })

  render(
    <mod.AuthProvider>
      <mod.CommunityScreen navigation={{ navigate: () => {} }} />
    </mod.AuthProvider>
  )
  // 인증 확인 → 목록 조회까지 끝나야 탭이 확정된다.
  await waitFor(() => expect(callsTo('/community/posts').length).toBeGreaterThan(0))
  await waitFor(() => expect(screen.queryByText('불러오는 중')).toBeNull())
}

describe('D1 — 앱에서 댓글을 쓸 수 있다', () => {
  async function mountPost() {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/comments') && init?.method === 'POST') {
        return json(201, { id: 'c-new' })
      }
      if (String(url).includes('/comments')) return json(200, { comments: [commentRow()] })
      if (String(url).includes('/community/posts/')) return json(200, { post: postRow() })
      return json(200, {})
    })
    render(
      <mod.CommunityPostScreen navigation={{}} route={{ params: { postId: POST_ID } }} />
    )
    await screen.findByText(postRow().title)
  }

  it('입력창에 적고 누르면 댓글이 서버로 나간다', async () => {
    await mountPost()

    const input = screen.getByPlaceholderText(/답을 남겨주세요/)
    fireEvent.change(input, { target: { value: '등기부 을구도 같이 보세요.' } })
    await act(async () => {
      fireEvent.click(screen.getByText('댓글 남기기'))
    })

    const posted = callsTo(`/community/posts/${POST_ID}/comments`, 'POST')
    expect(posted).toHaveLength(1)
    expect(JSON.parse(String(posted[0][1]?.body))).toEqual({ body: '등기부 을구도 같이 보세요.' })
  })

  it('앱 요청임을 알리는 헤더를 붙여 보낸다 — 빠지면 CSRF 403으로 전량 버려진다', async () => {
    await mountPost()

    fireEvent.change(screen.getByPlaceholderText(/답을 남겨주세요/), {
      target: { value: '확인해보겠습니다.' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('댓글 남기기'))
    })

    const headers = callsTo(`/community/posts/${POST_ID}/comments`, 'POST')[0][1]
      ?.headers as Record<string, string>
    expect(headers['x-mobile-client']).toBe('true')
  })

  it('올린 뒤 목록을 다시 불러온다 — 서버가 거른 글이 내 화면에만 남지 않게', async () => {
    await mountPost()
    const before = callsTo(`/community/posts/${POST_ID}/comments`).length

    fireEvent.change(screen.getByPlaceholderText(/답을 남겨주세요/), {
      target: { value: '감사합니다.' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('댓글 남기기'))
    })

    await waitFor(() =>
      expect(callsTo(`/community/posts/${POST_ID}/comments`).length).toBeGreaterThan(before)
    )
  })

  it('실패하면 서버 문구를 그대로 알린다', async () => {
    await mountPost()
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/comments') && init?.method === 'POST') {
        return json(429, { error: '잠시 후 다시 시도해주세요. 짧은 시간에 너무 많이 올렸습니다.' })
      }
      if (String(url).includes('/comments')) return json(200, { comments: [] })
      return json(200, { post: postRow() })
    })

    fireEvent.change(screen.getByPlaceholderText(/답을 남겨주세요/), { target: { value: '도배' } })
    await act(async () => {
      fireEvent.click(screen.getByText('댓글 남기기'))
    })

    await waitFor(() => expect(alerts).toHaveLength(1))
    expect(alerts[0].message).toBe('잠시 후 다시 시도해주세요. 짧은 시간에 너무 많이 올렸습니다.')
  })

  it('빈 댓글은 보내지 않는다', async () => {
    await mountPost()
    await act(async () => {
      fireEvent.click(screen.getByText('댓글 남기기'))
    })
    expect(callsTo(`/community/posts/${POST_ID}/comments`, 'POST')).toHaveLength(0)
  })
})

describe('E2 — 댓글 수를 한 번만 보여준다', () => {
  it('같은 숫자를 두 곳에 나란히 두지 않는다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/comments')) return json(200, { comments: [commentRow()] })
      if (String(url).includes('/community/posts/')) return json(200, { post: postRow() })
      return json(200, {})
    })
    render(<mod.CommunityPostScreen navigation={{}} route={{ params: { postId: POST_ID } }} />)
    await screen.findByText(postRow().title)

    await waitFor(() => expect(screen.getAllByText('댓글 1')).toHaveLength(1))
  })
})

describe('D2 — 작성 대상 규칙이 앱에도 있다', () => {
  it('비로그인에게도 어느 게시판에 올라가는지 알린다', async () => {
    await mountBoard(null)
    fireEvent.click(screen.getByText('지금 막히는 게 무엇인가요'))

    // 안내는 `<Text>전체 게시판</Text>에 올라갑니다.` 꼴이다. 기본 매처는 자식
    // 엘리먼트의 글자를 합쳐 주지 않으므로, 합쳐서 한 문장으로 읽히는지를 본다.
    expect(
      screen.getAllByText((_, el) => el?.textContent === '전체 게시판에 올라갑니다.').length
    ).toBeGreaterThan(0)
  })

  it('탭이 all이면 로그인 사용자는 본인 역할 게시판이 기본이다', async () => {
    await mountBoard('landlord')
    fireEvent.click(screen.getByText('지금 막히는 게 무엇인가요'))

    // 안내 문구와 선택 버튼 양쪽에 '임대인 게시판'이 있으므로 존재만 본다.
    expect(screen.getAllByText('임대인 게시판').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText('제목'), { target: { value: '세입자 확인' } })
    fireEvent.change(screen.getByPlaceholderText(/어떤 상황인지/), { target: { value: '본문' } })
    await act(async () => {
      fireEvent.click(screen.getByText('올리기'))
    })

    const posted = callsTo('/community/posts', 'POST')
    expect(posted).toHaveLength(1)
    expect(JSON.parse(String(posted[0][1]?.body)).audience).toBe('landlord')
  })

  it('보고 있던 탭이 그대로 기본 대상이 된다', async () => {
    await mountBoard('landlord')
    fireEvent.click(screen.getByText('임대인'))
    await waitFor(() => expect(screen.queryByText('불러오는 중')).toBeNull())

    // 전체 탭으로 옮긴 뒤 글쓰기를 열면 대상도 따라와야 한다.
    fireEvent.click(screen.getByText('전체'))
    await waitFor(() => expect(screen.queryByText('불러오는 중')).toBeNull())
    fireEvent.click(screen.getByText('지금 막히는 게 무엇인가요'))

    fireEvent.change(screen.getByPlaceholderText('제목'), { target: { value: '질문' } })
    fireEvent.change(screen.getByPlaceholderText(/어떤 상황인지/), { target: { value: '본문' } })
    await act(async () => {
      fireEvent.click(screen.getByText('올리기'))
    })

    // 탭 all + 임대인 계정 → 임대인 게시판 (DOW-1136 규칙)
    expect(JSON.parse(String(callsTo('/community/posts', 'POST')[0][1]?.body)).audience).toBe(
      'landlord'
    )
  })

  it('비로그인 글은 공용 게시판으로 간다', async () => {
    await mountBoard(null)
    fireEvent.click(screen.getByText('지금 막히는 게 무엇인가요'))
    fireEvent.change(screen.getByPlaceholderText('제목'), { target: { value: '질문' } })
    fireEvent.change(screen.getByPlaceholderText(/어떤 상황인지/), { target: { value: '본문' } })
    await act(async () => {
      fireEvent.click(screen.getByText('올리기'))
    })

    expect(JSON.parse(String(callsTo('/community/posts', 'POST')[0][1]?.body)).audience).toBe('all')
  })

  it('대상을 직접 고르면 그 선택이 이긴다', async () => {
    await mountBoard('landlord')
    fireEvent.click(screen.getByText('지금 막히는 게 무엇인가요'))

    // 임대인 계정이 고를 수 있는 판은 전체·임대인 둘이다.
    fireEvent.click(screen.getByText('전체 게시판'))
    fireEvent.change(screen.getByPlaceholderText('제목'), { target: { value: '질문' } })
    fireEvent.change(screen.getByPlaceholderText(/어떤 상황인지/), { target: { value: '본문' } })
    await act(async () => {
      fireEvent.click(screen.getByText('올리기'))
    })

    expect(JSON.parse(String(callsTo('/community/posts', 'POST')[0][1]?.body)).audience).toBe('all')
  })
})

describe('D3 — 네트워크 실패를 권한 오류로 표시하지 않는다', () => {
  async function mountWithListFailure(status: number, body: unknown) {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/me')) return json(401, { user: null })
      if (String(url).includes('/community/posts')) return json(status, body)
      return json(200, {})
    })
    render(
      <mod.AuthProvider>
        <mod.CommunityScreen navigation={{ navigate: () => {} }} />
      </mod.AuthProvider>
    )
    await waitFor(() => expect(screen.queryByText('불러오는 중')).toBeNull())
  }

  it('서버 500을 "볼 수 없는 게시판"으로 말하지 않는다', async () => {
    await mountWithListFailure(500, { error: '게시글을 불러오지 못했습니다' })

    expect(screen.queryByText('이 게시판은 볼 수 없어요')).toBeNull()
    expect(screen.getByText('게시글을 불러오지 못했습니다')).toBeVisible()
  })

  it('네트워크가 끊겨도 "볼 수 없는 게시판"이 아니다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/me')) return json(401, { user: null })
      throw new TypeError('Network request failed')
    })
    render(
      <mod.AuthProvider>
        <mod.CommunityScreen navigation={{ navigate: () => {} }} />
      </mod.AuthProvider>
    )
    await waitFor(() => expect(screen.queryByText('불러오는 중')).toBeNull())

    expect(screen.queryByText('이 게시판은 볼 수 없어요')).toBeNull()
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('실패를 "아직 질문이 없어요"로 감추지 않는다', async () => {
    await mountWithListFailure(500, { error: '게시글을 불러오지 못했습니다' })
    expect(screen.queryByText('아직 질문이 없어요')).toBeNull()
  })

  it('권한(403)일 때만 볼 수 없다고 말하고, 재시도를 권하지 않는다', async () => {
    await mountWithListFailure(403, { error: '접근할 수 없는 게시판입니다' })

    expect(screen.getByText('이 게시판은 볼 수 없어요')).toBeVisible()
    expect(screen.queryByText('다시 시도')).toBeNull()
  })
})

describe('C4·E1 — 읽을 수 있는 탭만, 웹과 같은 용어로', () => {
  it('비로그인에게는 전체 판만 보인다', async () => {
    await mountBoard(null)

    expect(screen.getByText('전체')).toBeVisible()
    expect(screen.queryByText('임차인')).toBeNull()
    expect(screen.queryByText('임대인')).toBeNull()
    expect(screen.queryByText('공인중개사')).toBeNull()
  })

  it('임대인에게는 전체와 임대인 판만 보인다 — 못 읽는 판을 보여주고 막지 않는다', async () => {
    await mountBoard('landlord')

    expect(screen.getByText('전체')).toBeVisible()
    expect(screen.getByText('임대인')).toBeVisible()
    expect(screen.queryByText('임차인')).toBeNull()
    expect(screen.queryByText('공인중개사')).toBeNull()
  })

  it('공인중개사에게는 본인 판이 보인다', async () => {
    await mountBoard('broker')

    expect(screen.getByText('공인중개사')).toBeVisible()
    expect(screen.queryByText('임차인')).toBeNull()
  })

  it('중개사무소라는 말을 쓰지 않는다 — 웹 기준은 공인중개사다', async () => {
    await mountBoard('broker', [postRow({ id: 'x1', audience: 'broker', author_role: 'broker' })])

    expect(screen.queryByText('중개사무소')).toBeNull()
  })
})

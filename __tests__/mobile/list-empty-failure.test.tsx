// @vitest-environment jsdom
// 모바일 화면은 로드 실패를 "비어 있음"으로 감추지 않는다.
// 실패 / 빈 결과 / 로딩이 서로 다른 렌더 결과여야 하고, 실패에는 재시도 경로가 있어야 한다.
import React from 'react'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { beforeAll, afterAll, afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TextEncoder } from 'node:util'

let dir: string
let RegisterScreen: React.ComponentType<any>
let ListingsScreen: React.ComponentType<any>
let PropertiesScreen: React.ComponentType<any>
let TenantBrowseScreen: React.ComponentType<any>
let MessagesScreen: React.ComponentType<any>
let MatchesScreen: React.ComponentType<any>
let ChatRoomScreen: React.ComponentType<any>
let HomeScreen: React.ComponentType<any>
let ProfileScreen: React.ComponentType<any>
let VerificationScreen: React.ComponentType<any>

const api = {
  register: vi.fn(),
  fetchListings: vi.fn(),
  fetchLandlordProperties: vi.fn(),
  fetchTenants: vi.fn(),
  updatePropertyStatus: vi.fn(),
  deleteProperty: vi.fn(),
  startConversation: vi.fn(),
  fetchConversations: vi.fn(),
  fetchMatches: vi.fn(),
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
  fetchTenantProfile: vi.fn(),
  fetchLandlordStats: vi.fn(),
  fetchVerificationStatus: vi.fn(),
  submitVerificationDocument: vi.fn(),
}
// useAuth가 돌려줄 사용자. 화면마다 tenant/landlord를 갈아끼운다.
const authUser = { current: { userType: 'tenant', name: 'QA', id: 'qa-user' } as Record<string, unknown> | null }
const state = globalThis as typeof globalThis & { __mobileListQA: typeof api }

beforeAll(async () => {
  class Encoder extends TextEncoder {
    encode(input = '') { return new Uint8Array(super.encode(input)) }
  }
  globalThis.TextEncoder = Encoder as typeof globalThis.TextEncoder
  const { build } = await import('esbuild')
  dir = mkdtempSync(join(process.cwd(), 'node_modules/.qa-mobile-lists-'))

  const native = join(dir, 'native.js')
  writeFileSync(native, `import React from 'react';
const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : (s || {});
const element = tag => ({children, style, onPress}) => React.createElement(tag, {style: flatten(style), onClick:onPress}, children);
export const View=element('div'), Text=element('span'), TouchableOpacity=element('button');
export const Image=({source, style})=>React.createElement('img',{src:source?.uri||'', style:flatten(style), alt:''});
export const ActivityIndicator=()=>React.createElement('progress');
export const RefreshControl=()=>null;
export const FlatList=({data, renderItem, keyExtractor, ListEmptyComponent})=>React.createElement('div',{}, data?.length ? data.map((item,index)=>React.createElement(React.Fragment,{key:keyExtractor?.(item,index)||index}, renderItem({item,index}))) : ListEmptyComponent);
export const ScrollView=element('div');
export const TextInput=({value, onChangeText, placeholder})=>React.createElement('input',{value:value||'', placeholder, onChange:e=>onChangeText?.(e.target.value)});
export const KeyboardAvoidingView=element('div');
export const Platform={OS:'ios', select:o=>o.ios};
export const StyleSheet={create:s=>s}; export const Alert={alert:()=>{}};
`)
  const navigation = join(dir, 'navigation.js')
  writeFileSync(navigation, `import React from 'react'; export const useFocusEffect = fn => React.useEffect(() => fn(), [fn]);`)
  const apiClient = join(dir, 'api.js')
  writeFileSync(apiClient, `export const fetchListings=(...a)=>globalThis.__mobileListQA.fetchListings(...a);
export const fetchLandlordProperties=(...a)=>globalThis.__mobileListQA.fetchLandlordProperties(...a);
export const fetchTenants=(...a)=>globalThis.__mobileListQA.fetchTenants(...a);
export const updatePropertyStatus=(...a)=>globalThis.__mobileListQA.updatePropertyStatus(...a);
export const deleteProperty=(...a)=>globalThis.__mobileListQA.deleteProperty(...a);
export const startConversation=(...a)=>globalThis.__mobileListQA.startConversation(...a);
export const fetchConversations=(...a)=>globalThis.__mobileListQA.fetchConversations(...a);
export const fetchMatches=(...a)=>globalThis.__mobileListQA.fetchMatches(...a);
export const fetchMessages=(...a)=>globalThis.__mobileListQA.fetchMessages(...a);
export const sendMessage=(...a)=>globalThis.__mobileListQA.sendMessage(...a);
export const fetchTenantProfile=(...a)=>globalThis.__mobileListQA.fetchTenantProfile(...a);
export const fetchLandlordStats=(...a)=>globalThis.__mobileListQA.fetchLandlordStats(...a);
export const fetchVerificationStatus=(...a)=>globalThis.__mobileListQA.fetchVerificationStatus(...a);
export const submitVerificationDocument=(...a)=>globalThis.__mobileListQA.submitVerificationDocument(...a);
`)

  const auth = join(dir, 'auth.js')
  writeFileSync(auth, `export const useAuth = () => ({ user: globalThis.__mobileListQAUser.current, logout: () => {}, register: (...args) => globalThis.__mobileListQA.register(...args) });`)
  const imageService = join(dir, 'imageService.js')
  writeFileSync(imageService, `export const pickImage = async () => null; export const takePhoto = async () => null;
export default { pickImage, takePhoto };`)

  const plugin = {
    name: 'mobile-list-qa',
    setup(b: any) {
      b.onResolve({ filter: /^react-native$/ }, () => ({ path: native }))
      b.onResolve({ filter: /^@react-navigation\/native$/ }, () => ({ path: navigation }))
      b.onResolve({ filter: /^\.\.\/services\/api$/ }, () => ({ path: apiClient }))
      b.onResolve({ filter: /^\.\.\/contexts\/AuthContext$/ }, () => ({ path: auth }))
      b.onResolve({ filter: /^\.\.\/services\/imageService$/ }, () => ({ path: imageService }))
    },
  }

  await build({
    entryPoints: [
      'mobile/src/screens/RegisterScreen.tsx',
      'mobile/src/screens/ListingsScreen.tsx',
      'mobile/src/screens/PropertiesScreen.tsx',
      'mobile/src/screens/TenantBrowseScreen.tsx',
      'mobile/src/screens/MessagesScreen.tsx',
      'mobile/src/screens/MatchesScreen.tsx',
      'mobile/src/screens/ChatRoomScreen.tsx',
      'mobile/src/screens/HomeScreen.tsx',
      'mobile/src/screens/ProfileScreen.tsx',
      'mobile/src/screens/VerificationScreen.tsx',
    ],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: dir,
    external: ['react'],
    plugins: [plugin],
  })

  RegisterScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'RegisterScreen.js')).href)).default
  ListingsScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'ListingsScreen.js')).href)).default
  PropertiesScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'PropertiesScreen.js')).href)).default
  TenantBrowseScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'TenantBrowseScreen.js')).href)).default
  MessagesScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'MessagesScreen.js')).href)).default
  MatchesScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'MatchesScreen.js')).href)).default
  ChatRoomScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'ChatRoomScreen.js')).href)).default
  HomeScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'HomeScreen.js')).href)).default
  ProfileScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'ProfileScreen.js')).href)).default
  VerificationScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'VerificationScreen.js')).href)).default
})

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  delete (globalThis as any).__mobileListQA
})

beforeEach(() => {
  vi.resetAllMocks()
  state.__mobileListQA = api
  authUser.current = { userType: 'tenant', name: 'QA', id: 'qa-user' }
  ;(globalThis as any).__mobileListQAUser = authUser
})

afterEach(cleanup)

describe('모바일 목록 실패 상태', () => {
  it('매물 둘러보기 실패를 빈 매물로 보여주지 않는다', async () => {
    api.fetchListings.mockRejectedValueOnce(new Error('503'))
    render(<ListingsScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('매물을 불러오지 못했습니다')
    expect(screen.queryByText('등록된 매물이 없습니다')).toBeNull()
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('내 매물 실패를 등록 매물 0건으로 보여주지 않는다', async () => {
    api.fetchLandlordProperties.mockRejectedValueOnce(new Error('503'))
    render(<PropertiesScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('내 매물을 불러오지 못했습니다')
    expect(screen.queryByText('등록된 매물이 없습니다')).toBeNull()
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('세입자 탐색 실패를 검색 결과 0건으로 보여주지 않는다', async () => {
    api.fetchTenants.mockRejectedValueOnce(new Error('503'))
    render(<TenantBrowseScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('세입자 목록을 불러오지 못했습니다')
    expect(screen.queryByText('검색된 세입자가 없습니다')).toBeNull()
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  // --- DOW-1195: 같은 패턴이 남아 있던 6화면 ---

  it('대화 목록 실패를 "아직 대화가 없습니다"로 감추지 않는다', async () => {
    api.fetchConversations.mockRejectedValueOnce(new Error('503'))
    render(<MessagesScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('대화를 불러오지 못했습니다')
    expect(screen.queryByText('아직 대화가 없습니다')).toBeNull()
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('매칭 실패를 "매칭 결과가 없습니다"로 감추지 않는다', async () => {
    api.fetchMatches.mockRejectedValueOnce(new Error('503'))
    render(<MatchesScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('매칭 결과를 불러오지 못했습니다')
    expect(screen.queryByText('매칭 결과가 없습니다')).toBeNull()
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('대화방 로드 실패를 빈 대화방으로 감추지 않는다', async () => {
    api.fetchMessages.mockRejectedValueOnce(new Error('503'))
    render(<ChatRoomScreen route={{ params: { conversationId: 'c1' } }} />)

    await screen.findByText('대화 내용을 불러오지 못했습니다')
    expect(screen.queryByText('대화를 시작해보세요')).toBeNull()
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('홈 로드 실패를 신뢰 점수 0으로 감추지 않는다', async () => {
    api.fetchTenantProfile.mockRejectedValueOnce(new Error('503'))
    render(<HomeScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('홈 정보를 불러오지 못했습니다')
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('홈 최초 로딩은 신뢰 점수 0과 구분한다', () => {
    api.fetchTenantProfile.mockImplementationOnce(() => new Promise(() => {}))
    render(<HomeScreen navigation={{ navigate: vi.fn() }} />)

    expect(screen.getByRole('progressbar')).toBeVisible()
    expect(screen.queryByText('신뢰 점수')).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('프로필 로드 실패를 미완성 프로필로 감추지 않는다', async () => {
    api.fetchTenantProfile.mockRejectedValueOnce(new Error('503'))
    api.fetchVerificationStatus.mockRejectedValueOnce(new Error('503'))
    render(<ProfileScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('프로필을 불러오지 못했습니다')
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('프로필 최초 로딩은 미완성 프로필과 구분한다', () => {
    api.fetchTenantProfile.mockImplementationOnce(() => new Promise(() => {}))
    api.fetchVerificationStatus.mockImplementationOnce(() => new Promise(() => {}))
    render(<ProfileScreen navigation={{ navigate: vi.fn() }} />)

    expect(screen.getByRole('progressbar')).toBeVisible()
    expect(screen.queryByText('신뢰 점수')).toBeNull()
    expect(screen.queryByText('미인증')).toBeNull()
  })

  it('인증 로드 실패를 제출 서류 없음으로 감추지 않는다', async () => {
    api.fetchVerificationStatus.mockRejectedValueOnce(new Error('503'))
    render(<VerificationScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('인증 정보를 불러오지 못했습니다')
    expect(screen.getByText('다시 시도')).toBeVisible()
  })

  it('인증 최초 로딩은 제출 서류 없음과 구분한다', () => {
    api.fetchVerificationStatus.mockImplementationOnce(() => new Promise(() => {}))
    render(<VerificationScreen navigation={{ navigate: vi.fn() }} />)

    expect(screen.getByRole('progressbar')).toBeVisible()
    expect(screen.queryByText('미인증')).toBeNull()
    expect(screen.queryByText('서류 제출')).toBeNull()
  })

  it('성공하면 실패 화면이 아니라 빈 결과 화면을 보여준다', async () => {
    api.fetchConversations.mockResolvedValue([])
    render(<MessagesScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('아직 대화가 없습니다')
    expect(screen.queryByText('대화를 불러오지 못했습니다')).toBeNull()
    expect(screen.queryByText('다시 시도')).toBeNull()
  })

  it('매칭이 0건이면 실패가 아니라 빈 결과로 보여준다', async () => {
    api.fetchMatches.mockResolvedValue([])
    render(<MatchesScreen navigation={{ navigate: vi.fn() }} />)

    await screen.findByText('매칭 결과가 없습니다')
    expect(screen.queryByText('매칭 결과를 불러오지 못했습니다')).toBeNull()
    expect(screen.queryByText('다시 시도')).toBeNull()
  })

  it('대화방에 메시지가 없으면 실패가 아니라 시작 안내를 보여준다', async () => {
    api.fetchMessages.mockResolvedValue([])
    render(<ChatRoomScreen route={{ params: { conversationId: 'c1' } }} />)

    await screen.findByText('대화를 시작해보세요')
    expect(screen.queryByText('대화 내용을 불러오지 못했습니다')).toBeNull()
    expect(screen.queryByText('다시 시도')).toBeNull()
  })
})


describe('6화면 재시도 복구', () => {
  const cases = [
    ['대화 목록', () => MessagesScreen, 'fetchConversations', [], '대화를 불러오지 못했습니다', '아직 대화가 없습니다'],
    ['매칭', () => MatchesScreen, 'fetchMatches', [], '매칭 결과를 불러오지 못했습니다', '매칭 결과가 없습니다'],
    ['대화방', () => ChatRoomScreen, 'fetchMessages', [], '대화 내용을 불러오지 못했습니다', '대화를 시작해보세요'],
    ['홈', () => HomeScreen, 'fetchTenantProfile', null, '홈 정보를 불러오지 못했습니다', '신뢰 점수'],
    ['프로필', () => ProfileScreen, 'fetchTenantProfile', null, '프로필을 불러오지 못했습니다', 'QA'],
    ['인증', () => VerificationScreen, 'fetchVerificationStatus', null, '인증 정보를 불러오지 못했습니다', '서류 제출'],
  ] as const

  it.each(cases)('%s: 최초 대기 → 실패 → 재시도 → 성공을 구분한다', async (_name, component, method, result, errorTitle, successText) => {
    let rejectFirst!: (reason: Error) => void
    let resolveRetry!: (value: unknown) => void
    api.fetchVerificationStatus.mockResolvedValue(null)
    api[method]
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveRetry = resolve }))
    const Component = component()
    render(<Component navigation={{ navigate: vi.fn() }} route={{ params: { conversationId: 'c1' } }} />)
    expect(screen.getByRole('progressbar')).toBeVisible()
    expect(screen.queryByText(errorTitle)).toBeNull()
    expect(screen.queryAllByText(successText)).toHaveLength(0)

    rejectFirst(new Error('503'))
    await screen.findByText(errorTitle)
    expect(screen.queryByRole('progressbar')).toBeNull()
    fireEvent.click(screen.getByText('다시 시도'))
    expect(api[method]).toHaveBeenCalledTimes(2)
    resolveRetry(result)
    await waitFor(() => expect(screen.queryByText(errorTitle)).toBeNull())
    expect(screen.queryByText(errorTitle)).toBeNull()
    expect(screen.queryByText('다시 시도')).toBeNull()
    expect(screen.getAllByText(successText).length).toBeGreaterThan(0)
  })
})


describe('공인중개사 가입과 역할별 화면', () => {
  it('공인중개사를 선택해 broker로 가입 요청한다', async () => {
    render(<RegisterScreen navigation={{ goBack: vi.fn() }} />)
    fireEvent.click(screen.getByText('공인중개사'))
    fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '중개사' } })
    fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: 'broker@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('8자 이상'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByPlaceholderText('비밀번호 확인'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
    await waitFor(() => expect(api.register).toHaveBeenCalledWith('broker@example.com', 'password123', '중개사', 'broker'))
  })

  it.each(['broker', 'admin'])('%s 홈은 커뮤니티·프로필로 이동하며 집주인 기능을 표시하지 않는다', async userType => {
    authUser.current = { userType, name: 'QA' }
    const navigate = vi.fn()
    render(<HomeScreen navigation={{ navigate }} />)
    await screen.findByText('커뮤니티와 프로필을 이용해 보세요')
    expect(screen.queryByText('매물 관리')).toBeNull()
    expect(screen.queryByText('세입자 탐색')).toBeNull()
    expect(api.fetchLandlordStats).not.toHaveBeenCalled()
    expect(api.fetchTenantProfile).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('커뮤니티'))
    expect(navigate).toHaveBeenCalledWith('Community')
    fireEvent.click(screen.getByText('프로필'))
    expect(navigate).toHaveBeenCalledWith('Profile')
  })

  it.each([['broker', '공인중개사'], ['admin', '운영자'], ['tenant', '임차인'], ['landlord', '임대인'], ['unknown', '회원']])('대화 상대 %s 라벨을 표시한다', async (userType, label) => {
    api.fetchConversations.mockResolvedValue([{ id: '1', otherUser: { name: '상대방', userType }, unreadCount: 0 }])
    render(<MessagesScreen navigation={{ navigate: vi.fn() }} />)
    expect(await screen.findByText(label)).toBeVisible()
  })
})

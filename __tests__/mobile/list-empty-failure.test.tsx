// @vitest-environment jsdom
// 모바일 목록 화면도 실패와 빈 결과를 실제 렌더 결과로 구분한다.
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { beforeAll, afterAll, afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TextEncoder } from 'node:util'

let dir: string
let ListingsScreen: React.ComponentType<any>
let PropertiesScreen: React.ComponentType<any>
let TenantBrowseScreen: React.ComponentType<any>

const api = {
  fetchListings: vi.fn(),
  fetchLandlordProperties: vi.fn(),
  fetchTenants: vi.fn(),
  updatePropertyStatus: vi.fn(),
  deleteProperty: vi.fn(),
  startConversation: vi.fn(),
}
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
`)

  const plugin = {
    name: 'mobile-list-qa',
    setup(b: any) {
      b.onResolve({ filter: /^react-native$/ }, () => ({ path: native }))
      b.onResolve({ filter: /^@react-navigation\/native$/ }, () => ({ path: navigation }))
      b.onResolve({ filter: /^\.\.\/services\/api$/ }, () => ({ path: apiClient }))
    },
  }

  await build({
    entryPoints: [
      'mobile/src/screens/ListingsScreen.tsx',
      'mobile/src/screens/PropertiesScreen.tsx',
      'mobile/src/screens/TenantBrowseScreen.tsx',
    ],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: dir,
    external: ['react'],
    plugins: [plugin],
  })

  ListingsScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'ListingsScreen.js')).href)).default
  PropertiesScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'PropertiesScreen.js')).href)).default
  TenantBrowseScreen = (await import(/* @vite-ignore */ pathToFileURL(join(dir, 'TenantBrowseScreen.js')).href)).default
})

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  delete (globalThis as any).__mobileListQA
})

beforeEach(() => {
  vi.clearAllMocks()
  state.__mobileListQA = api
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
})

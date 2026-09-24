// @vitest-environment jsdom
// 실제 화면과 API mapper를 실행한다. native primitive만 DOM으로 대체하므로 기기 렌더링 검증은 별도다.
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { beforeAll, afterAll, afterEach, beforeEach, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TextEncoder } from 'node:util'

let dir: string
let Screen: React.ComponentType<any>
const get = vi.fn()
const state = globalThis as typeof globalThis & { __communityQA: { get: typeof get } }

beforeAll(async () => {
  class Encoder extends TextEncoder {
    encode(input = '') { return new Uint8Array(super.encode(input)) }
  }
  globalThis.TextEncoder = Encoder as typeof globalThis.TextEncoder
  const { build } = await import('esbuild')
  dir = mkdtempSync(join(process.cwd(), 'node_modules/.qa-community-'))
  const shim = join(dir, 'native.js')
  writeFileSync(shim, `import React from 'react';
const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : s;
const element = tag => ({children, style, onPress}) => React.createElement(tag, {style: flatten(style), onClick:onPress}, children);
export const View=element('div'), Text=element('span'), ScrollView=element('section'), TouchableOpacity=element('button');
export const ActivityIndicator=()=>React.createElement('progress');
export const StyleSheet={create:s=>s}; export const Alert={alert:()=>{}};
`)
  // 목록 화면 전체를 로드하지 않고 실제 소스의 역할 표만 사용한다.
  const roles = join(dir, 'roles.ts')
  const source = readFileSync('mobile/src/screens/CommunityScreen.tsx', 'utf8')
  const declaration = source.match(/export const ROLE_LABELS: Record<string, string> = \{[\s\S]*?\};/)?.[0]
  if (!declaration) throw new Error('ROLE_LABELS 선언을 찾지 못했습니다')
  writeFileSync(roles, declaration)
  const client = join(dir, 'client.js')
  writeFileSync(client, 'export const apiClient={get:(...args)=>globalThis.__communityQA.get(...args)};')
  await build({ entryPoints:['mobile/src/screens/CommunityPostScreen.tsx'], bundle:true, platform:'node', format:'esm', outfile:join(dir,'screen.mjs'), external:['react'], plugins:[{name:'qa-native',setup(b){
    b.onResolve({filter:/^\.\/CommunityScreen$/},()=>({path:roles}))
    b.onResolve({filter:/^react-native$/},()=>({path:shim}))
    b.onResolve({filter:/^\.\/apiClient$/},()=>({path:client}))
  }}] })
  Screen = (await import(/* @vite-ignore */ pathToFileURL(join(dir,'screen.mjs')).href)).default
})
afterAll(()=>{ if(dir) rmSync(dir,{recursive:true,force:true}); delete (globalThis as any).__communityQA })
afterEach(cleanup)
const row = (role: string | null, id='c1') => ({id, body:`댓글 본문 ${id}`, created_at:'2026-09-24', author_name:null, author_role:role})
const post = {id:'p1',title:'검증 글',body:'본문',created_at:'2026-09-24',author_name:'작성자',author_role:'guest',comment_count:99,view_count:3}
beforeEach(()=>{get.mockReset(); state.__communityQA={get}})
function respond(comments: unknown[]) { get.mockImplementation(async (path:string)=>path.endsWith('/comments')?{comments}:{post}) }
function mount(){return render(<Screen route={{params:{postId:'p1'}}} />)}
it('정상 목록·운영자 배지와 강조·익명 이름·실제 개수를 표시한다',async()=>{
  respond([row('admin'),row('unknown','c2')]); mount()
  const body = await screen.findByText('댓글 본문 c1')
  expect(screen.getByText('댓글 본문 c2')).toBeVisible()
  expect(screen.getAllByText('댓글 2')).toHaveLength(2)
  expect(screen.queryByText('댓글 99')).toBeNull()
  expect(screen.getAllByText('익명')).toHaveLength(2)
  expect(screen.getAllByText('운영자')).toHaveLength(1)
  expect(body.parentElement?.style.backgroundColor).not.toBe(screen.getByText('댓글 본문 c2').parentElement?.style.backgroundColor)
  expect(get).toHaveBeenCalledWith('/community/posts/p1/comments')
})
it.each(['unknown',null])('알 수 없거나 없는 역할 %s는 배지를 표시하지 않는다',async role=>{
  respond([row(role)]); mount(); await screen.findByText('댓글 본문 c1')
  expect(screen.queryByText('운영자')).toBeNull()
  expect(screen.queryByText('unknown')).toBeNull()
})
it('빈 목록은 댓글 0과 빈 상태를 표시한다',async()=>{
  respond([]); mount(); await screen.findByText('아직 댓글이 없어요')
  expect(screen.getAllByText('댓글 0')).toHaveLength(2)
})
it('조회 실패에서는 숫자를 숨기고 재시도로 복구한다',async()=>{
  get.mockImplementation(async (path:string)=>{if(path.endsWith('/comments'))throw new Error('503');return {post}})
  mount(); await screen.findByText('댓글을 불러오지 못했어요')
  expect(screen.queryByText('댓글 0')).toBeNull()
  expect(screen.queryByText('아직 댓글이 없어요')).toBeNull()
  respond([row('admin')]); fireEvent.click(screen.getByText('다시 시도'))
  await screen.findByText('댓글 본문 c1')
  expect(screen.getAllByText('댓글 1')).toHaveLength(2)
  expect(screen.queryByText('댓글을 불러오지 못했어요')).toBeNull()
})
it('댓글 응답 대기 중에는 빈 목록 메시지를 노출하지 않는다',async()=>{
  let resolve!: (value:unknown)=>void
  get.mockImplementation((path:string)=>path.endsWith('/comments')?new Promise(r=>{resolve=r}):Promise.resolve({post}))
  mount(); await screen.findByText('검증 글')
  expect(screen.getByRole('progressbar')).toBeVisible()
  expect(screen.queryByText('아직 댓글이 없어요')).toBeNull()
  resolve({comments:[]}); await waitFor(()=>expect(screen.queryByRole('progressbar')).toBeNull())
})

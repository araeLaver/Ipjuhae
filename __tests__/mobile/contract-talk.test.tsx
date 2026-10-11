// @vitest-environment jsdom
// 실제 네이티브 화면과 서버 상태 모델을 실행한다. 기기 primitive만 DOM으로 대체한다.
import React from 'react'
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react'
import {beforeAll,afterAll,beforeEach,afterEach,it,expect,vi} from 'vitest'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {TextEncoder} from 'node:util'
import {randomUUID} from 'node:crypto'
import {createService,MemoryTalkStore} from '@/lib/contract-talk/service'
let dir:string,Screen:React.ComponentType,service:ReturnType<typeof createService>
const tenant={id:randomUUID(),email:'native-owner@example.test',user_type:'tenant'},landlord={id:randomUUID(),email:'native-recipient@example.test',user_type:'landlord'}
let actor=tenant
const get=vi.fn(),post=vi.fn(),patch=vi.fn()
const qa=globalThis as any
beforeAll(async()=>{
 class Encoder extends TextEncoder{encode(input=''){return new Uint8Array(super.encode(input))}};globalThis.TextEncoder=Encoder as typeof globalThis.TextEncoder
 const {build}=await import('esbuild');dir=mkdtempSync(join(process.cwd(),'node_modules/.qa-talk-'))
 writeFileSync(join(dir,'native.js'),`import React from 'react';const element=tag=>({children,onPress,disabled,accessibilityLabel,accessibilityRole})=>React.createElement(tag,{onClick:onPress,disabled,'aria-label':accessibilityLabel,role:accessibilityRole},children);export const View=element('div'),ScrollView=element('section'),Text=element('span'),TouchableOpacity=element('button');export const StyleSheet={create:s=>s};export const Share={share:async()=>{}};export const Alert={alert:(title,text,buttons)=>buttons[1].onPress()};export const TextInput=({value,onChangeText,multiline,accessibilityLabel})=>React.createElement(multiline?'textarea':'input',{value,'aria-label':accessibilityLabel,onChange:e=>onChangeText(e.target.value)});`)
 writeFileSync(join(dir,'client.js'),`export class ApiError extends Error{constructor(message,status){super(message);this.status=status}};export const apiClient={get:(...a)=>globalThis.__talkQA.get(...a),post:(...a)=>globalThis.__talkQA.post(...a),patch:(...a)=>globalThis.__talkQA.patch(...a)};`)
 writeFileSync(join(dir,'auth.js'),`export const useAuth=()=>({user:{userType:globalThis.__talkQA.role()}});`)
 writeFileSync(join(dir,'uuid.js'),`export const uuid={v4:()=>globalThis.__talkQA.uuid()};`)
 await build({entryPoints:['mobile/src/screens/ContractTalkScreen.tsx'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'screen.mjs'),external:['react'],plugins:[{name:'native-qa',setup(b){b.onResolve({filter:/^react-native$/},()=>({path:join(dir,'native.js')}));b.onResolve({filter:/services\/apiClient$/},()=>({path:join(dir,'client.js')}));b.onResolve({filter:/contexts\/AuthContext$/},()=>({path:join(dir,'auth.js')}));b.onResolve({filter:/^expo-modules-core$/},()=>({path:join(dir,'uuid.js')}))}}]})
 Screen=(await import(/* @vite-ignore */pathToFileURL(join(dir,'screen.mjs')).href)).default
})
afterAll(()=>{rmSync(dir,{recursive:true,force:true});delete qa.__talkQA});afterEach(cleanup)
beforeEach(()=>{actor=tenant;service=createService(new MemoryTalkStore());get.mockReset();post.mockReset();patch.mockReset();qa.__talkQA={get,post,patch,role:()=>actor.user_type,uuid:randomUUID};get.mockImplementation(async(path:string)=>path==='/contract-talk'?{requests:await service.list(actor)}:{talk:await service.get(actor,path.split('/').pop()!,path.includes('/shared/'))});post.mockImplementation(async(path:string,input:unknown)=>path==='/contract-talk'?{talk:await service.create(actor,input)}:{});patch.mockImplementation(async(path:string,input:unknown)=>({talk:await service.mutate(actor,path.split('/').pop()!,path.includes('/shared/'),input)}))})
const fill=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}})
const click=async(name:string)=>{fireEvent.click(screen.getByRole('button',{name}));await waitFor(()=>expect(screen.getByRole('button',{name:'보낸·받은 요청으로 돌아가기'})).not.toBeDisabled())}
it('생성·직접 받은 목록·답변·양측 합의·완료·정정·취소를 같은 서버 모델로 연결한다',async()=>{
 const r=render(<Screen/>);await screen.findByText('보낸·받은 요청이 없습니다.');fireEvent.click(screen.getByText('새 요청 만들기'));fill('상대 임대인의 계정 이메일',landlord.email);fill('가능한 시간 (YYYY-MM-DD HH:mm, 줄마다 최대 3개)',new Date(Date.now()+86400000).toISOString().slice(0,16).replace('T',' '));await click('요청 만들기');expect(post.mock.calls[0][1]).toHaveProperty('clientKey');await screen.findByText('공유 링크 직접 전달');
 const item=(await service.list(tenant))[0];r.unmount();actor=landlord;const rr=render(<Screen/>);fireEvent.click(await screen.findByText('받은 요청 · 응답 대기'));await screen.findByLabelText('답변 1');for(let i=1;i<=3;i++)fill('답변 '+i,'native answer '+i);fill('제안 시간 (YYYY-MM-DD HH:mm)',new Date(Date.now()+2*86400000).toISOString().slice(0,16).replace('T',' '));await click('답변 저장');for(let i=1;i<=3;i++)await click(`답변 ${i} 합의`);await click('내 대화 완료');rr.unmount();
 actor=tenant;const rt=render(<Screen/>);fireEvent.click(await screen.findByText('보낸 요청 · 답변 있음'));await screen.findByText('제안 시간에 합의');await click('제안 시간에 합의');for(let i=1;i<=3;i++)await click(`답변 ${i} 합의`);await click('내 대화 완료');await click('내 확인 완료');rt.unmount();actor=landlord;let t=await service.get(actor,item.id,false);await service.mutate(actor,t.id,false,{version:t.version,change:{action:'confirm'}});const rl=render(<Screen/>);fireEvent.click(await screen.findByText('받은 요청 · 양측 확인 완료'));await screen.findByText('정정 위해 대화 다시 열기');await click('정정 위해 대화 다시 열기');expect((await service.get(tenant,item.id,false)).confirmed.tenant).toBe(false);rl.unmount();actor=tenant;render(<Screen/>);fireEvent.click(await screen.findByText('보낸 요청 · 답변 있음'));await screen.findByText('요청 취소');await click('요청 취소');expect((await service.get(tenant,item.id,false)).cancelled).toBe(true)
})
it('의견은 직접 입력한 내용과 surface만 보내며 더블클릭을 막는다',async()=>{
 let done!:()=>void;post.mockImplementation(()=>new Promise<void>(resolve=>{done=resolve}));render(<Screen/>);await screen.findByText('보낸·받은 요청이 없습니다.');fill('불편했던 동작','retry control unclear');fireEvent.click(screen.getByText('의견 보내기'));fireEvent.click(screen.getByText('의견 보내기'));expect(post).toHaveBeenCalledTimes(1);expect(post).toHaveBeenCalledWith('/feature-requests',{message:'retry control unclear',source:'app'});done();await screen.findByText('의견이 접수됐어요')
})
it('목록 실패 후 재시도와 요청 생성 실패 후 같은 key 재시도를 제공한다',async()=>{
 get.mockRejectedValueOnce(new Error('offline'));render(<Screen/>);await screen.findByText('offline');fireEvent.click(screen.getByText('목록 새로고침'));await waitFor(()=>expect(screen.queryByText('offline')).toBeNull());fireEvent.click(screen.getByText('새 요청 만들기'));fill('상대 임대인의 계정 이메일',landlord.email);fill('가능한 시간 (YYYY-MM-DD HH:mm, 줄마다 최대 3개)',new Date(Date.now()+86400000).toISOString().slice(0,16));post.mockRejectedValueOnce(new Error('offline'));fireEvent.click(screen.getByText('요청 만들기'));await screen.findByText('offline');fireEvent.click(screen.getByText('요청 만들기'));await screen.findByText('공유 링크 직접 전달');expect(post.mock.calls[0][1].clientKey).toBe(post.mock.calls[1][1].clientKey)
})

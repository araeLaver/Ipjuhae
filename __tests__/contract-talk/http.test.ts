import { afterEach, describe, expect, it, vi } from 'vitest'
import { talkHandler } from '@/lib/contract-talk/http'
import { MemoryTalkStore } from '@/lib/contract-talk/service'
import { randomUUID } from 'node:crypto'
const actor={id:'owner',user_type:'tenant'}
const body=()=>({clientKey:randomUUID(),slots:[new Date(Date.now()+86400000).toISOString()]})
const request=(payload:unknown,origin='http://localhost')=>new Request('http://localhost/api/contract-talk',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)})
afterEach(()=>vi.unstubAllEnvs())
describe('계약 전 대화 HTTP 보안 경계',()=>{
 it('운영에서는 플래그가 있어도 404이며 인증/DB를 호출하지 않는다',async()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('CONTRACT_TALK_TEST_ENABLED','1')
  const auth=vi.fn(async()=>actor),store=new MemoryTalkStore();const create=vi.spyOn(store,'create')
  expect((await talkHandler(store,auth)(request(body()))).status).toBe(404);expect(auth).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled()
 })
 it('비로그인·다른 Origin·초과 본문을 거부한다',async()=>{
  expect((await talkHandler(new MemoryTalkStore(),async()=>null,()=>true)(request(body()))).status).toBe(401)
  expect((await talkHandler(new MemoryTalkStore(),async()=>actor,()=>true)(request(body(),'http://other-site'))).status).toBe(403)
  expect((await talkHandler(new MemoryTalkStore(),async()=>actor,()=>true)(request('x'.repeat(10000)))).status).toBe(413)
 })
 it('요청과 응답은 no-store이며 임의 owner/권한 필드는 거부한다',async()=>{
  const handler=talkHandler(new MemoryTalkStore(),async()=>actor,()=>true)
  const response=await handler(request(body()));expect(response.status).toBe(201);expect(response.headers.get('cache-control')).toBe('no-store')
  expect((await handler(request({...body(),ownerId:'other'}))).status).toBe(400)
 })
 it('잘못된 JSON/콘텐츠 타입을 안전하게 처리한다',async()=>{
  const handler=talkHandler(new MemoryTalkStore(),async()=>actor,()=>true)
  expect((await handler(new Request('http://localhost/api/contract-talk',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:'{'}))).status).toBe(400)
  expect((await handler(new Request('http://localhost/api/contract-talk',{method:'POST',headers:{Origin:'http://localhost'},body:'x'}))).status).toBe(415)
 })
})

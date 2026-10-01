import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createService, MemoryTalkStore, type Actor, type TalkView } from '@/lib/contract-talk/service'

const tenant:Actor={id:'tenant-a',user_type:'tenant'}, landlord:Actor={id:'landlord-a',user_type:'landlord'}, stranger:Actor={id:'landlord-b',user_type:'landlord'}
let now:number, service:ReturnType<typeof createService>, owner:TalkView
const change = (actor:Actor, talk:TalkView, action:unknown, shared=actor!==tenant) => service.mutate(actor,shared?owner.shareId!:owner.id,shared,{version:talk.version,change:action})
beforeEach(async()=>{
 now=Date.now();service=createService(new MemoryTalkStore(),()=>now)
 owner=await service.create(tenant,{clientKey:randomUUID(),slots:[new Date(now+86400000).toISOString()]})
})
const respond=()=>change(landlord,owner,{action:'respond',answers:['앱으로 수리 요청을 남깁니다.','다음 주 입주 가능합니다.','시설 상태를 함께 확인합니다.'],proposedTime:null})

describe('계약 전 대화 상태와 최소 권한',()=>{
 it('요청 생성만으로 전달/응답 완료가 되지 않는다',()=>{expect(owner.progress).toBe('requested');expect(owner.answers).toEqual(['','','']);expect(owner.shareId).toMatch(/^[a-f0-9]{64}$/);expect(owner).not.toHaveProperty('ownerId');expect(owner).not.toHaveProperty('respondentId')})
 it('임차인 외 생성과 비로그인 접근을 거부한다',async()=>{
  await expect(service.create(landlord,{clientKey:randomUUID(),slots:owner.slots})).rejects.toMatchObject({status:403})
  await expect(service.get(null,owner.shareId!,true)).rejects.toMatchObject({status:401})
 })
 it('동일 생성 키의 반복/동시 요청은 같은 요청 하나를 반환한다',async()=>{
  const input={clientKey:randomUUID(),slots:owner.slots};const results=await Promise.all([service.create(tenant,input),service.create(tenant,input)])
  expect(results[0].id).toBe(results[1].id);expect(results[0].shareId).toBe(results[1].shareId)
  await expect(service.create(tenant,{...input,slots:[new Date(now+2*86400000).toISOString()]})).rejects.toMatchObject({status:409})
 })
 it('과거/중복/30일 초과 일정을 거부한다',async()=>{
  for(const slots of [[new Date(now-1).toISOString()],[...owner.slots,...owner.slots],[new Date(now+31*86400000).toISOString()]]) await expect(service.create(tenant,{clientKey:randomUUID(),slots})).rejects.toMatchObject({status:400})
 })
 it('틀린 링크와 다른 임차인의 private ID 접근을 거부한다',async()=>{
  await expect(service.get(landlord,'nope',true)).rejects.toMatchObject({status:404})
  await expect(service.get({...tenant,id:'another-tenant'},owner.id,false)).rejects.toMatchObject({status:404})
  await expect(service.get(landlord,owner.id,false)).rejects.toMatchObject({status:404})
 })
 it('최초 응답자를 원자적으로 고정하고 타인에게 응답 내용을 노출하지 않는다',async()=>{
  const action={action:'respond',answers:['답변','',''],proposedTime:null}
  const results=await Promise.allSettled([change(landlord,owner,action),change(stranger,owner,action)])
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
  await expect(service.get(stranger,owner.shareId!,true)).rejects.toMatchObject({status:404})
 })
 it('임차인의 임대인 답변 위조와 임대인의 취소/일정 수정은 거부한다',async()=>{
  await expect(change(tenant,owner,{action:'respond',answers:['x','',''],proposedTime:null},false)).rejects.toMatchObject({status:403})
  await expect(change(landlord,owner,{action:'cancel'})).rejects.toMatchObject({status:403})
  await expect(change(landlord,owner,{action:'edit',slots:owner.slots})).rejects.toMatchObject({status:403})
 })
 it('답변 또는 시간만으로 응답할 수 있지만 확인 완료를 자동 부여하지 않는다',async()=>{
  const t=await change(landlord,owner,{action:'respond',answers:['','',''],proposedTime:owner.slots[0]})
  expect(t.progress).toBe('responded');expect(t.canConfirm).toBe(false)
 })
 it('빈 답변/시간 및 과거 제안은 거부한다',async()=>{
  await expect(change(landlord,owner,{action:'respond',answers:['','',''],proposedTime:null})).rejects.toMatchObject({status:400})
  await expect(change(landlord,owner,{action:'respond',answers:['x','',''],proposedTime:new Date(now-1).toISOString()})).rejects.toMatchObject({status:400})
 })
 it('응답 전 수정은 허용하고 응답 후 요청 수정은 막는다',async()=>{
  owner=await change(tenant,owner,{action:'edit',slots:[new Date(now+2*86400000).toISOString()]},false)
  const t=await respond()
  await expect(change(tenant,t,{action:'edit',slots:owner.slots},false)).rejects.toMatchObject({status:409})
 })
 it('반복 클릭의 오래된 version은 합의를 중복 적용하지 않는다',async()=>{
  const t=await respond();await change(tenant,t,{action:'accept',index:0,value:true},false)
  await expect(change(tenant,t,{action:'accept',index:0,value:true},false)).rejects.toMatchObject({status:409})
 })
 it('응답 수정은 기존 답변 합의를 초기화한다',async()=>{
  let t=await respond();t=await change(tenant,t,{action:'accept',index:0,value:true},false)
  t=await change(landlord,t,{action:'respond',answers:['새 내용','입주 일정','시설 확인'],proposedTime:null})
  expect(t.accepted.tenant).toEqual([false,false,false])
 })
 it('추가 확인은 표시한 당사자가 해소해야 하며 대화 완료와 확인 완료를 구분한다',async()=>{
  let t=await respond()
  for(let i=0;i<3;i++){t=await change(tenant,t,{action:'accept',index:i,value:true},false);t=await change(landlord,t,{action:'accept',index:i,value:true})}
  t=await change(landlord,t,{action:'check',index:2,value:true})
  t=await change(tenant,t,{action:'conversation_done'},false);t=await change(landlord,t,{action:'conversation_done'})
  expect(t.progress).toBe('conversation_completed');expect(t.canConfirm).toBe(false)
  await expect(change(tenant,t,{action:'confirm'},false)).rejects.toMatchObject({status:409})
  t=await change(tenant,t,{action:'check',index:2,value:false},false);expect(t.canConfirm).toBe(false)
  t=await change(landlord,t,{action:'check',index:2,value:false});expect(t.canConfirm).toBe(true)
  t=await change(tenant,t,{action:'confirm'},false);expect(t.progress).toBe('conversation_completed')
  t=await change(landlord,t,{action:'confirm'});expect(t.progress).toBe('confirmed')
  await expect(change(tenant,t,{action:'accept',index:0,value:false},false)).rejects.toMatchObject({status:409})
 })
 it('만료와 취소는 링크/수정 모두 차단하며 요청자는 상태만 계속 확인할 수 있다',async()=>{
  let t=await respond();t=await change(tenant,t,{action:'cancel'},false)
  await expect(service.get(landlord,owner.shareId!,true)).rejects.toMatchObject({status:410})
  expect((await service.get(tenant,owner.id,false)).cancelled).toBe(true)
  await expect(change(tenant,t,{action:'edit',slots:owner.slots},false)).rejects.toMatchObject({status:410})
  const fresh=await service.create(tenant,{clientKey:randomUUID(),slots:owner.slots})
  now+=8*86400000
  await expect(service.get(landlord,fresh.shareId!,true)).rejects.toMatchObject({status:410})
  expect((await service.get(tenant,fresh.id,false)).inactive).toBe(true)
 })
})

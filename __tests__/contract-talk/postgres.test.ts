import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createService } from '@/lib/contract-talk/service'
import { postgresTalkStore } from '@/lib/contract-talk/postgres'
import appPool from '@/lib/db'
const enabled=process.env.CONTRACT_TALK_PG_TEST==='1'
const suite=enabled?describe:describe.skip
suite('격리 PostgreSQL 계약 전 대화 통합',()=>{
 let db:Pool,ownerId:string,landlordId:string
 let now=Date.now()
 const service=createService(postgresTalkStore,()=>now)
 const tenant=()=>({id:ownerId,user_type:'tenant',email:'pg-owner@example.test'})
 const landlord=()=>({id:landlordId,user_type:'landlord',email:'pg-landlord@example.test'})
 const make=()=>({recipientEmail:'pg-landlord@example.test',clientKey:randomUUID(),slots:[new Date(now+86400000).toISOString()]})
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!)
  if(!['127.0.0.1','localhost'].includes(url.hostname)||process.env.DB_SCHEMA!=='contract_talk_test')throw new Error('격리 local DB만 허용')
  db=new Pool({connectionString:url.toString()})
  ownerId=randomUUID();landlordId=randomUUID()
  await db.query("INSERT INTO contract_talk_test.users(id,email,user_type) VALUES($1,$2,'tenant'),($3,$4,'landlord')",[ownerId,`${ownerId}@example.test`,landlordId,`${landlordId}@example.test`])
 })
 afterAll(async()=>{if(db){await db.query('DELETE FROM contract_talk_test.users WHERE id=ANY($1::uuid[])',[[ownerId,landlordId]]);await db.end()}await appPool.end()})
 it('동시 생성·새 service 인스턴스 재조회로 영속성과 중복 방지를 검증한다',async()=>{
  const input=make(),[a,b]=await Promise.all([service.create(tenant(),input),service.create(tenant(),input)])
  expect(a.id).toBe(b.id)
  expect((await createService(postgresTalkStore).get(tenant(),a.id,false)).id).toBe(a.id)
  expect(a).not.toHaveProperty('recipientHash')
 })
 it('지정 계정만 응답하며 row lock/version으로 동시 갱신을 보호한다',async()=>{
  const t=await service.create(tenant(),make())
  await expect(service.get({...landlord(),id:randomUUID(),email:'wrong@example.test'},t.shareId!,true)).rejects.toMatchObject({status:404})
  const change={version:1,change:{action:'respond',answers:['연락 방법','입주 일정','추가 사항'],proposedTime:null}}
  const results=await Promise.allSettled([service.mutate(landlord(),t.shareId!,true,change),service.mutate(landlord(),t.shareId!,true,change)])
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
  const latest=await service.get(tenant(),t.id,false)
  expect(latest.version).toBe(2)
  await service.mutate(tenant(),t.id,false,{version:2,change:{action:'cancel'}})
  await expect(service.get(landlord(),t.shareId!,true)).rejects.toMatchObject({status:410})
  expect((await service.get(tenant(),t.id,false)).answers).toEqual(['','',''])
 })
 it('만료 접근/변경을 차단하고 만료 30일 지난 이 기능 기록만 정리한다',async()=>{
  const t=await service.create(tenant(),make());now+=8*86400000
  await expect(service.get(landlord(),t.shareId!,true)).rejects.toMatchObject({status:410})
  await expect(service.mutate(tenant(),t.id,false,{version:1,change:{action:'cancel'}})).rejects.toMatchObject({status:410})
  now=Date.now()
  await db.query("UPDATE contract_talk_test.contract_talk_requests SET expires_at=NOW()-interval '31 days' WHERE id=$1",[t.id])
  await service.create(tenant(),make())
  expect((await db.query('SELECT id FROM contract_talk_test.contract_talk_requests WHERE id=$1',[t.id])).rowCount).toBe(0)
 })
 it('생성 중복은 한 번만 익명 집계하며 받은 목록은 지정 계정으로 제한한다',async()=>{
  const before=await db.query("SELECT count(*)::int AS n FROM contract_talk_test.analytics_events WHERE event_name='contract_talk_created'")
  const input=make(),t=await service.create(tenant(),input,'app');await service.create(tenant(),input,'app')
  const after=await db.query("SELECT count(*)::int AS n FROM contract_talk_test.analytics_events WHERE event_name='contract_talk_created'")
  expect(after.rows[0].n-before.rows[0].n).toBe(1)
  const [row]=(await db.query("SELECT user_id,session_id,properties FROM contract_talk_test.analytics_events WHERE event_name='contract_talk_created' ORDER BY id DESC LIMIT 1")).rows
  expect(row).toMatchObject({user_id:null,session_id:null,properties:{surface:'app'}});expect(Object.keys(row.properties)).toEqual(['surface'])
  expect((await service.list(landlord())).some(r=>r.id===t.id)).toBe(true)
  expect(await service.list({...landlord(),id:randomUUID(),email:'outsider@example.test'})).toEqual([])
  const counts=async()=>Object.fromEntries((await db.query("SELECT event_name,count(*)::int AS n FROM contract_talk_test.analytics_events WHERE event_name LIKE 'contract_talk_%' GROUP BY event_name")).rows.map(r=>[r.event_name,r.n]))
  const prior=await counts();let current=t
  const change=async(actor:ReturnType<typeof tenant>,action:unknown)=>{current=await service.mutate(actor,current.id,false,{version:current.version,change:action},'app')}
  current=await service.mutate(landlord(),t.shareId!,true,{version:1,change:{action:'respond',answers:['a','b','c'],proposedTime:new Date(now+2*86400000).toISOString()}},'app')
  await change(landlord(),{action:'respond',answers:['a','b','c'],proposedTime:current.proposedTime})
  await change(tenant(),{action:'accept_time',value:true});await change(tenant(),{action:'accept_time',value:true})
  for(const actor of [tenant(),landlord()]){for(let index=0;index<3;index++)await change(actor,{action:'accept',index,value:true});await change(actor,{action:'conversation_done'})}
  for(const actor of [tenant(),landlord()])await change(actor,{action:'confirm'})
  await change(tenant(),{action:'cancel'})
  const afterActions=await counts()
  for(const event of ['responded','schedule_agreed','completed','cancelled'])expect(afterActions['contract_talk_'+event]-(prior['contract_talk_'+event]??0)).toBe(1)
  const rows=(await db.query("SELECT user_id,session_id,properties FROM contract_talk_test.analytics_events WHERE event_name LIKE 'contract_talk_%'")).rows
  for(const row of rows){expect(row.user_id).toBeNull();expect(row.session_id).toBeNull();expect(Object.keys(row.properties)).toEqual(['surface'])}

 })
 it('DB 일일 생성 한도를 강제한다',async()=>{
  for(let i=0;i<6;i++)await service.create(tenant(),make())
  await expect(service.create(tenant(),make())).rejects.toMatchObject({status:429})
 })
})

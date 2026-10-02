import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { eraseAccountData, DeletionReviewRequired } from '@/lib/account-erasure'
import { storageObjectScope } from '@/lib/storage-ownership'
import { emailHash } from '@/lib/contract-talk/model'

// Explicit isolated instance only. Never inherit DATABASE_URL or an existing schema.
const enabled = process.env.ACCOUNT_ERASURE_SYNTHETIC === '1'
const schema = `audit_${randomUUID().replaceAll('-', '')}`
const pool = new Pool({ connectionString: 'postgresql://down@127.0.0.1:55439/postgres' })
const authState = vi.hoisted(() => ({ user: null as null | { id: string; user_type: string }, token: null as string | null }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => name==='auth_token' && authState.token ? {value:authState.token}:undefined }), headers: async () => new Headers() }))
vi.mock('@/lib/auth', async original => ({ ...await original<typeof import('@/lib/auth')>(), getCurrentUser: async () => authState.user }))
const storage = vi.hoisted(() => ({ fail: false, failedKeys: new Set<string>(), keys: new Set<string>() }))
vi.mock('@/lib/storage', () => ({ deleteFile: async (key: string) => {
  if (storage.fail || storage.failedKeys.has(key)) return { success: false }
  storage.keys.delete(key); return { success: true }
} }))
// Give worker the same isolated transaction connection; production DB module is not used.
vi.mock('@/lib/db', () => ({
  query: async (sql: string, args: unknown[]) => { const c=await connection();try{return (await c.query(sql,args)).rows}finally{c.release()} },
  queryOne: async (sql: string, args: unknown[]) => { const c=await connection();try{return (await c.query(sql,args)).rows[0] ?? null}finally{c.release()} },
  transaction: async (fn: (client: unknown) => Promise<unknown>) => {
  const client = await pool.connect()
  try { await client.query(`SET search_path TO ${schema}`); await client.query('BEGIN'); const r = await fn(client); await client.query('COMMIT'); return r }
  catch(e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
} }))
import { generateToken, verifyTokenAllowed } from '@/lib/auth'
import { POST as createListing } from '@/app/api/listings/route'
import { POST as reportContent } from '@/app/api/community/reports/route'
import { POST as blockAuthor } from '@/app/api/community/blocks/route'
import { GET as readPost } from '@/app/api/community/posts/[id]/route'
import { GET as listPosts } from '@/app/api/community/posts/route'
import { GET as readComments } from '@/app/api/community/posts/[id]/comments/route'
import { communityPairBlocked } from '@/lib/community-blocks'
import { getHomeContent } from '@/lib/home-content'
import { socketMembershipAllowed } from '@/socket-auth'
import { drainAccountStorageDeletes, ownedStorageKey } from '@/lib/account-storage-delete'
async function connection() { const client = await pool.connect(); await client.query(`SET search_path TO ${schema}`); return client }

describe.skipIf(!enabled)('synthetic PostgreSQL + synthetic storage erasure', () => {
  beforeAll(async () => {
    process.env.STORAGE_PROVIDER = 'mock'; process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    const client = await pool.connect()
    try {
      await client.query(`CREATE SCHEMA ${schema}`); await client.query(`SET search_path TO ${schema}`)
      const files = [...readFileSync('db/migrate.ts','utf8').matchAll(/'(schema\.sql|migration-[^']+\.sql)'/g)].map(m => m[1])
      for (const file of files) {
        // Operator-account approval migrations are intentionally inapplicable to synthetic users.
        if (file.startsWith('migration-034-') || file.startsWith('migration-035-')) continue
        await client.query(readFileSync(`db/${file}`,'utf8'))
      }
    } finally { client.release() }
  }, 30000)
  afterAll(async () => { await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end() })

  async function seed() {
    const client = await connection(); const id=randomUUID(), other=randomUUID(), unrelated=randomUUID(), conv=randomUUID()
    await client.query("INSERT INTO users(id,email,password_hash,user_type) VALUES($1,$2,'synthetic','tenant'),($3,$4,'synthetic','landlord'),($5,$6,'synthetic','tenant')",[id,`${id}@example.invalid`,other,`${other}@example.invalid`,unrelated,`${unrelated}@example.invalid`])
    await client.query("INSERT INTO profiles(user_id,name,age_range,family_type,bio,phone) VALUES($1,'synthetic private','30대','가족','private','01000000000')",[id])
    await client.query("INSERT INTO tenant_profiles(user_id,budget_min,budget_max,move_in_date,workplace) VALUES($1,100,900,CURRENT_DATE,'private')",[id])
    const key=`profiles/${id}/synthetic.webp`;storage.keys.add(key)
    await client.query('INSERT INTO account_storage_objects(object_key,owner_user_id,storage_scope) VALUES($1,$2,$3)',[key,id,storageObjectScope()])
    await client.query('UPDATE users SET profile_image=$2 WHERE id=$1',[id,`http://localhost:3000/mock-storage/${key}`])
    await client.query("INSERT INTO verification_documents(user_id,document_type,file_name,file_url) VALUES($1,'employment','synthetic.pdf',$2)",[id,`http://localhost:3000/mock-storage/${key}`])
    await client.query('INSERT INTO conversations(id,landlord_id,tenant_id) VALUES($1,$2,$3)',[conv,other,id])
    await client.query("INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,$2,'private')",[conv,other])
    await client.query('INSERT INTO conversations(landlord_id,tenant_id) VALUES($1,$2)',[other,unrelated])
    const talkId=randomUUID(),share=randomUUID().replaceAll('-','').repeat(2),hash=emailHash(`${id}@example.invalid`)
    await client.query(`INSERT INTO contract_talk_requests(id,share_id,recipient_hash,owner_id,client_key,version,expires_at,payload)
      VALUES($1,$2,$3,$4,$5,1,NOW()+interval '1 day',$6::jsonb)`,[talkId,share,hash,unrelated,randomUUID(),JSON.stringify({id:talkId,shareId:share,recipientHash:hash,ownerId:unrelated,respondentId:id,version:1,answers:['private']})])
    client.release(); return {id,other,unrelated,conv,key}
  }
  it('erases both participants conversation, respondent payload and demographics; preserves unrelated records; retries storage and erasure',async()=>{
    const {id,other,unrelated,key,conv}=await seed(); const client=await connection()
    try {
      await client.query('BEGIN'); await eraseAccountData(client,id,`${id}@example.invalid`);await client.query('COMMIT')
      for (const table of ['profiles','tenant_profiles','verification_documents']) expect((await client.query(`SELECT 1 FROM ${table} WHERE user_id=$1`,[id])).rows).toHaveLength(0)
      expect((await client.query('SELECT 1 FROM conversations WHERE tenant_id=$1',[id])).rows).toHaveLength(0)
      expect((await client.query('SELECT 1 FROM messages WHERE sender_id=$1',[other])).rows).toHaveLength(0)
      expect((await client.query('SELECT 1 FROM conversations WHERE tenant_id=$1',[unrelated])).rows).toHaveLength(1)
      expect((await client.query("SELECT 1 FROM contract_talk_requests WHERE payload->>'respondentId'=$1",[id])).rows).toHaveLength(0)
      expect((await client.query('SELECT email,password_hash,deleted_at FROM users WHERE id=$1',[id])).rows[0]).toMatchObject({email:`deleted_${id}@deleted.invalid`,password_hash:'deleted'})
      expect(await socketMembershipAllowed(client,{userId:id,conversationId:conv})).toBe(false)
      expect(storage.keys.has(key)).toBe(true)
      storage.fail=true;await drainAccountStorageDeletes()
      expect((await client.query('SELECT attempts FROM account_storage_deletes WHERE object_key=$1',[key])).rows[0].attempts).toBe(1)
      storage.fail=false;await client.query('UPDATE account_storage_deletes SET next_attempt_at=NOW() WHERE object_key=$1',[key]);await drainAccountStorageDeletes();await drainAccountStorageDeletes()
      expect(storage.keys.has(key)).toBe(false)
      expect((await client.query('SELECT 1 FROM account_storage_deletes WHERE object_key=$1',[key])).rows).toHaveLength(0)
      await client.query('BEGIN');await eraseAccountData(client,id,`deleted_${id}@deleted.invalid`);await client.query('COMMIT')
    } finally {await client.query('ROLLBACK');client.release()}
  })
  it('rolls back late SQL failure, including durable queue, without touching external objects',async()=>{
    const {id,key}=await seed(); const client=await connection()
    try {
      await client.query(`CREATE FUNCTION fail_erasure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`)
      await client.query('CREATE TRIGGER fail_erasure BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fail_erasure()')
      await client.query('BEGIN');await expect(eraseAccountData(client,id,`${id}@example.invalid`)).rejects.toThrow('synthetic failure');await client.query('ROLLBACK')
      expect((await client.query('SELECT 1 FROM profiles WHERE user_id=$1',[id])).rows).toHaveLength(1)
      expect((await client.query('SELECT 1 FROM account_storage_deletes WHERE object_key=$1',[key])).rows).toHaveLength(0)
      expect(storage.keys.has(key)).toBe(true)
      await client.query('DROP TRIGGER fail_erasure ON users');await client.query('DROP FUNCTION fail_erasure()')
    }finally{await client.query('ROLLBACK');client.release()}
  })
  it('refuses unsupported financial/shared records without partial changes',async()=>{
    const {id}=await seed();const client=await connection()
    try {
      await client.query("INSERT INTO landlord_subscriptions(landlord_id) VALUES($1)",[id])
      await client.query('BEGIN');await expect(eraseAccountData(client,id,`${id}@example.invalid`)).rejects.toBeInstanceOf(DeletionReviewRequired);await client.query('ROLLBACK')
      expect((await client.query('SELECT 1 FROM profiles WHERE user_id=$1',[id])).rows).toHaveLength(1)
    }finally{await client.query('ROLLBACK');client.release()}
  })
  it('rejects encoded foreign object aliases using server ownership proof',async()=>{
    const {id,other}=await seed();const client=await connection();const victimKey=`profiles/${other}/synthetic-victim.webp`
    try {
      await client.query('UPDATE users SET profile_image=$2 WHERE id=$1',[other,`http://localhost:3000/mock-storage/${victimKey}`])
      const alias=`http://localhost:3000/mock-storage/profiles/%${other.charCodeAt(0).toString(16)}${other.slice(1)}/synthetic-victim.webp`
      await client.query("INSERT INTO listings(landlord_id,monthly_rent,address,photo_urls) VALUES($1,1,'synthetic',ARRAY[$2])",[id,alias])
      await client.query('BEGIN');await expect(eraseAccountData(client,id,`${id}@example.invalid`)).rejects.toBeInstanceOf(DeletionReviewRequired);await client.query('ROLLBACK')
      expect((await client.query('SELECT 1 FROM account_storage_deletes WHERE object_key=$1',[victimKey])).rows).toHaveLength(0)
    }finally{await client.query('ROLLBACK');client.release()}
  })
  it('rejects unproven references, hostile host/query/path variants and unverified queue entries',async()=>{
    const {id,other}=await seed();const c=await connection();const foreign=`profiles/${other}/synthetic.webp`
    const variants=[
      `http://localhost:3000/mock-storage/${foreign}`,`http://localhost:3000/mock-storage/%70rofiles/${other}/synthetic.webp`,
      `http://localhost:3000/mock-storage/profiles%2f${other}%2fsynthetic.webp`,
      `http://localhost:3000/mock-storage/${foreign}?ignored=1`, `http://localhost:3000/mock-storage/${foreign}#fragment`,
      `http://unrelated.invalid/mock-storage/${foreign}`,`http://localhost@unrelated.invalid/mock-storage/${foreign}`,
      `http://localhost:3000/mock-storage/%252e%252e/foreign`, `http://localhost:3000/mock-storage/%2e%2e%2fforeign`,
      `http://localhost:3000/mock-storage/profiles/${id}/unproven.webp`,
    ]
    try {
      const listing=await c.query("INSERT INTO listings(landlord_id,monthly_rent,address) VALUES($1,1,'synthetic') RETURNING id",[id])
      for(const url of variants){
        await c.query('UPDATE listings SET photo_urls=ARRAY[$2] WHERE id=$1',[listing.rows[0].id,url])
        await c.query('BEGIN');await expect(eraseAccountData(c,id,`${id}@example.invalid`)).rejects.toBeInstanceOf(DeletionReviewRequired);await c.query('ROLLBACK')
        expect((await c.query('SELECT 1 FROM account_storage_deletes WHERE object_key=$1',[foreign])).rows).toHaveLength(0)
      }
      storage.keys.add(foreign)
      await c.query('INSERT INTO account_storage_deletes(object_key) VALUES($1)',[foreign])
      const status=await drainAccountStorageDeletes();expect(status.review).toBeGreaterThan(0)
      expect(storage.keys.has(foreign)).toBe(true)
    }finally{await c.query('ROLLBACK');c.release()}
  })
  it('does not starve later objects behind twenty permanent failures and surfaces capped failures',async()=>{
    const {id}=await seed();const c=await connection();const keys=Array.from({length:25},(_,i)=>`profiles/${id}/queue-${i}.webp`)
    try {
      for(const key of keys){storage.keys.add(key);await c.query('INSERT INTO account_storage_objects(object_key,owner_user_id,storage_scope) VALUES($1,$2,$3)',[key,id,storageObjectScope()]);await c.query('INSERT INTO account_storage_deletes(object_key,owner_user_id,storage_scope) VALUES($1,$2,$3)',[key,id,storageObjectScope()])}
      for(const key of keys.slice(0,20))storage.failedKeys.add(key)
      await drainAccountStorageDeletes();await drainAccountStorageDeletes()
      for(const key of keys.slice(20))expect(storage.keys.has(key)).toBe(false)
      for(let n=0;n<4;n++){await c.query("UPDATE account_storage_deletes SET next_attempt_at=NOW() WHERE owner_user_id=$1 AND status='retry'",[id]);await drainAccountStorageDeletes()}
      const status=await drainAccountStorageDeletes();expect(status.review).toBeGreaterThanOrEqual(20)
      expect((await c.query("SELECT 1 FROM account_storage_deletes WHERE owner_user_id=$1 AND status='retry'",[id])).rows).toHaveLength(0)
    }finally{storage.failedKeys.clear();c.release()}
  })
  it('erases only attributable conversation notification copies in the same transaction',async()=>{
    const {id,other,conv}=await seed();const c=await connection()
    try {
      await c.query("INSERT INTO notifications(user_id,type,title,body,metadata) VALUES($1,'new_message','synthetic sender','private preview',$2),($1,'new_message','unrelated','keep',$3)",[other,JSON.stringify({conversationId:conv,fromName:'synthetic'}),JSON.stringify({conversationId:randomUUID()})])
      await c.query('BEGIN');await eraseAccountData(c,id,`${id}@example.invalid`);await c.query('COMMIT')
      expect((await c.query('SELECT body FROM notifications WHERE user_id=$1',[other])).rows.map(r=>r.body)).toEqual(['keep'])
    }finally{await c.query('ROLLBACK');c.release()}
  })
  it('rejects every stale session after erasure; active users and existing cookie/Bearer boundaries remain',async()=>{
    const {id,other}=await seed();const c=await connection();const old1=generateToken(id,'landlord'),old2=generateToken(id,'landlord')
    const request=(bearer?:string)=>new Request('http://localhost/api/listings',{method:'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({monthly_rent:1,deposit:0,address:'synthetic'})})
    try {
      expect(await verifyTokenAllowed(old1)).not.toBeNull()
      authState.token=null;expect((await createListing(request(old1))).status).toBe(401)
      authState.token=generateToken(other,'landlord');expect((await createListing(request())).status).toBe(201)
      await c.query('BEGIN');await eraseAccountData(c,id,`${id}@example.invalid`);await c.query('COMMIT')
      for(const token of [old1,old2]){expect(await verifyTokenAllowed(token)).toBeNull();authState.token=token;expect((await createListing(request())).status).toBe(401)}
      expect((await c.query('SELECT 1 FROM listings WHERE landlord_id=$1',[id])).rows).toHaveLength(0)
    }finally{authState.token=null;await c.query('ROLLBACK');c.release()}
  })
  it('server upload records authenticated namespace ownership; deletion never infers legacy ownership from URL',async()=>{
    const {id,other}=await seed();const c=await connection()
    const actual=await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage')
    try {
      const result=await actual.uploadFile({ownerUserId:id,folder:`profiles/${id}`,file:Buffer.from('synthetic'),fileName:'synthetic.webp',contentType:'image/webp'})
      expect(result.success).toBe(true)
      expect((await c.query('SELECT owner_user_id,storage_scope FROM account_storage_objects WHERE object_key=$1',[result.key])).rows[0]).toEqual({owner_user_id:id,storage_scope:storageObjectScope()})
      await expect(actual.uploadFile({ownerUserId:id,folder:`profiles/${other}`,file:Buffer.from('synthetic'),fileName:'synthetic.webp',contentType:'image/webp'})).rejects.toThrow('Untrusted upload namespace')
    }finally{c.release()}
  })
  it('holds every replaced registry object referenced by another account through canonical aliases',async()=>{
    const {id,other,key:p}=await seed();const c=await connection();const q=`profiles/${id}/replacement.webp`
    try {
      storage.keys.add(q);await c.query('INSERT INTO account_storage_objects(object_key,owner_user_id,storage_scope) VALUES($1,$2,$3)',[q,id,storageObjectScope()])
      await c.query('UPDATE users SET profile_image=$2 WHERE id=$1',[id,`http://localhost:3000/mock-storage/${q}`])
      await c.query('UPDATE verification_documents SET file_url=$2 WHERE user_id=$1',[id,`http://localhost:3000/mock-storage/${q}`])
      const listing=await c.query("INSERT INTO listings(landlord_id,monthly_rent,address) VALUES($1,1,'synthetic') RETURNING id",[other])
      for(const alias of [`http://localhost:3000/mock-storage/${p}`,`http://LOCALHOST:3000/mock-storage/%70rofiles/${id}/synthetic.webp?version=1#photo`]){
        await c.query('UPDATE listings SET photo_urls=ARRAY[$2] WHERE id=$1',[listing.rows[0].id,alias])
        await c.query('BEGIN');await expect(eraseAccountData(c,id,`${id}@example.invalid`)).rejects.toBeInstanceOf(DeletionReviewRequired);await c.query('ROLLBACK')
        expect((await c.query('SELECT 1 FROM account_storage_deletes WHERE owner_user_id=$1',[id])).rows).toHaveLength(0)
        expect(storage.keys.has(p)).toBe(true);expect(storage.keys.has(q)).toBe(true)
      }
      await c.query('INSERT INTO account_storage_deletes(object_key,owner_user_id,storage_scope) VALUES($1,$2,$3)',[p,id,storageObjectScope()])
      await drainAccountStorageDeletes()
      expect((await c.query('SELECT last_error_code FROM account_storage_deletes WHERE object_key=$1',[p])).rows[0].last_error_code).toBe('SHARED_REFERENCE')
      expect(storage.keys.has(p)).toBe(true)
    }finally{await c.query('ROLLBACK');c.release()}
  })
  it('refuses shared storage objects without deleting another user data',async()=>{
    const {id,unrelated,key}=await seed();const client=await connection()
    try {
      await client.query('UPDATE users SET profile_image=$2 WHERE id=$1',[unrelated,`http://localhost:3000/mock-storage/${key}`])
      await client.query('BEGIN');await expect(eraseAccountData(client,id,`${id}@example.invalid`)).rejects.toBeInstanceOf(DeletionReviewRequired);await client.query('ROLLBACK')
      expect(storage.keys.has(key)).toBe(true)
      expect((await client.query('SELECT 1 FROM profiles WHERE user_id=$1',[id])).rows).toHaveLength(1)
    }finally{await client.query('ROLLBACK');client.release()}
  })
  it('enforces self/guest/board permissions and bidirectional community blocks without exposing author IDs',async()=>{
    const {id,other,unrelated}=await seed(); const client=await connection();const post=randomUUID(),comment=randomUUID()
    try {
      await client.query("INSERT INTO community_posts(id,author_id,audience,title,body) VALUES($1,$2,'all','synthetic','test')",[post,other])
      await client.query("INSERT INTO community_comments(id,post_id,author_id,body) VALUES($1,$2,$3,'test')",[comment,post,other])
      const request=()=>new Request('http://localhost/api/community/blocks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postId:post})})
      authState.user=null;expect((await blockAuthor(request())).status).toBe(401)
      authState.user={id:other,user_type:'landlord'};expect((await blockAuthor(request())).status).toBe(400)
      authState.user={id,user_type:'tenant'};expect((await blockAuthor(request())).status).toBe(200)
      expect((await blockAuthor(request())).status).toBe(200)
      expect(await communityPairBlocked(id,other)).toBe(true);expect(await communityPairBlocked(other,id)).toBe(true)
      expect(await communityPairBlocked(id,id)).toBe(false);expect(await communityPairBlocked(unrelated,other)).toBe(false)
      const context={params:Promise.resolve({id:post})}
      expect((await readPost(new Request('http://localhost/api/community/posts/'+post),context)).status).toBe(404)
      expect((await readComments(new Request('http://localhost/api/community/posts/'+post+'/comments'),context)).status).toBe(404)
      const listed=await (await listPosts(new Request('http://localhost/api/community/posts'))).json()
      expect(listed.posts.some((p:{id:string})=>p.id===post)).toBe(false)
      expect((await getHomeContent(id)).questions.some(p=>p.id===post)).toBe(false)
      authState.user={id:unrelated,user_type:'tenant'}
      const detail=await (await readPost(new Request('http://localhost/api/community/posts/'+post),context)).json()
      expect(detail.post.id).toBe(post);expect(detail.post).not.toHaveProperty('author_id')
      // Foreign-role board cannot be targeted by guessing a post UUID.
      await client.query("UPDATE community_posts SET audience='landlord' WHERE id=$1",[post])
      expect((await blockAuthor(request())).status).toBe(404)
      await client.query("UPDATE community_posts SET audience='all',author_id=NULL WHERE id=$1",[post])
      expect((await blockAuthor(request())).status).toBe(409)
    }finally{authState.user=null;client.release()}
  })
  it('reuses comment reporting, deduplicates reporters and automatically hides at three',async()=>{
    const {id,other,unrelated}=await seed();const client=await connection();const post=randomUUID(),comment=randomUUID()
    try {
      await client.query("INSERT INTO community_posts(id,author_id,audience,title,body) VALUES($1,$2,'all','synthetic','test')",[post,id])
      await client.query("INSERT INTO community_comments(id,post_id,author_id,body) VALUES($1,$2,$3,'test')",[comment,post,id])
      const request=(extra={})=>new Request('http://localhost/api/community/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({commentId:comment,reason:'synthetic spam',...extra})})
      authState.user={id,user_type:'tenant'};expect((await reportContent(request({postId:post}))).status).toBe(400)
      for(const reporter of [id,id,other]) {authState.user={id:reporter,user_type:'tenant'};expect((await (await reportContent(request())).json()).hidden).toBe(false)}
      authState.user={id:unrelated,user_type:'tenant'};expect((await (await reportContent(request())).json()).hidden).toBe(true)
      expect((await client.query('SELECT hidden_at FROM community_comments WHERE id=$1',[comment])).rows[0].hidden_at).not.toBeNull()
      expect((await client.query('SELECT count(*)::int AS n FROM community_reports WHERE comment_id=$1',[comment])).rows[0].n).toBe(3)
    }finally{authState.user=null;client.release()}
  })
  it('rejects arbitrary storage origins and paths',()=>{
    expect(()=>ownedStorageKey('https://unrelated.invalid/file')).toThrow()
    expect(()=>ownedStorageKey('http://localhost:3000/another/file')).toThrow()
    expect(()=>ownedStorageKey('http://localhost:3000/mock-storage/%2e%2e%2ffile')).toThrow()
  })
})

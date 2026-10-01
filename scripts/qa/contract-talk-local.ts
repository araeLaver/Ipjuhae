/** Local-only synthetic-account fixture and reverse proxy. Never deploy this server. */
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { verifyToken } from '../../lib/auth'
import { getJwtSecret } from '../../lib/jwt'
import { MemoryTalkStore, type Actor } from '../../lib/contract-talk/service'
import { talkHandler } from '../../lib/contract-talk/http'

if (process.env.CONTRACT_TALK_TEST_ENABLED !== '1' || process.env.NODE_ENV === 'production' || !process.env.JWT_SECRET) throw new Error('로컬 테스트 플래그와 임시 JWT_SECRET이 필요합니다. 운영에서는 실행할 수 없습니다.')
const port = 3104
const origin = `http://127.0.0.1:${port}`
const actors: Record<string, Actor> = {
  tenant: { id:'00000000-0000-4000-8000-000000000001',user_type:'tenant' },
  landlord: { id:'00000000-0000-4000-8000-000000000002',user_type:'landlord' },
  stranger: { id:'00000000-0000-4000-8000-000000000003',user_type:'landlord' },
}
const store = new MemoryTalkStore()
let clockOffset = 0
// fixture clock is private to this loopback server; production handlers have no clock override.
const clock = () => Date.now() + clockOffset
function actorFrom(cookie = '') {
  const token = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('auth_token='))?.slice('auth_token='.length)
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  return Object.values(actors).find(a=>a.id===payload.userId && a.user_type===payload.userType) ?? null
}
// Use the same HTTP adapter and domain rules. Only storage/auth/clock are fixtures.
const fixtureStore = {
  create: store.create.bind(store), find: store.find.bind(store), update: store.update.bind(store),
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', origin)
    if (url.pathname.startsWith('/__local/login/')) {
      const actor = actors[url.pathname.split('/').pop()!]
      if (!actor) { res.writeHead(404);res.end();return }
      const token = jwt.sign({userId:actor.id,userType:actor.user_type,tokenType:'access'},getJwtSecret(),{expiresIn:'30m',algorithm:'HS256',jwtid:randomUUID(),audience:process.env.JWT_AUDIENCE||'rentme-api',issuer:process.env.JWT_ISSUER||'rentme'})
      res.writeHead(302,{'Set-Cookie':`auth_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800`,Location:'/contract-talk','Cache-Control':'no-store'});res.end();return
    }
    if (url.pathname.startsWith('/__local/') && req.method==='POST' && (req.headers.origin!==origin || req.headers['x-local-fixture']!=='1')) {res.writeHead(403);res.end();return}
    if (url.pathname==='/__local/advance' && req.method==='POST') {
      clockOffset += 8*86400000
      res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');return
    }
    if (url.pathname==='/__local/reset' && req.method==='POST') { clockOffset=0;res.writeHead(200);res.end();return }
    if (url.pathname==='/api/analytics/event') {res.writeHead(202);res.end('{}');return}
    if (url.pathname==='/api/auth/me') {const actor=actorFrom(req.headers.cookie);res.writeHead(actor?200:401,{'Content-Type':'application/json'});res.end(JSON.stringify(actor?{user:{...actor,name:'로컬 합성 계정'}}:{error:'로그인이 필요합니다.'}));return}
    if (url.pathname.startsWith('/api/contract-talk')) {
      const parts=url.pathname.split('/').filter(Boolean)
      const shared=parts[2]==='shared'
      const key=shared?parts[3]:parts[2]
      let body=''
      for await (const chunk of req) {body+=chunk.toString();if(Buffer.byteLength(body)>8192){res.writeHead(413);res.end();return}}
      const headers=new Headers()
      for(const [key,value] of Object.entries(req.headers)) if(value) headers.set(key,Array.isArray(value)?value.join(','):value)
      const request=new Request(url,{method:req.method,headers,body:body||undefined})
      // Inject clock through a store wrapper without changing production adapter defaults.
      const handler=talkHandler(fixtureStore,async()=>actorFrom(req.headers.cookie),()=>true,clock)
      const response=await handler(request,key,shared)
      res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(await response.text());return
    }
    const upstream=http.request({hostname:'127.0.0.1',port:3103,path:req.url,method:req.method,headers:req.headers},response=>{
      res.writeHead(response.statusCode??502,response.headers);response.pipe(res)
    })
    upstream.on('error',()=>{res.writeHead(502);res.end('먼저 Next 로컬 서버를 3103 포트에서 시작해주세요.')})
    req.pipe(upstream)
  } catch { res.writeHead(500);res.end('로컬 테스트 요청 오류') }
})
server.listen(port,'127.0.0.1',()=>console.log(`로컬 합성 데이터 테스트: ${origin}/__local/login/tenant · 임대인: ${origin}/__local/login/landlord`))

/** 로컬 PostgreSQL에서 실제 GET 핸들러와 홈 조회의 공개 댓글 수를 대조한다.
 * QA_DATABASE_URL을 명시한 경우만 실행한다. 임시 테이블만 사용하고 끝에 롤백한다.
 */
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { Client } from 'pg'
vi.mock('@/lib/db', () => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }))
import { query, queryOne } from '@/lib/db'
import { GET as list } from '@/app/api/community/posts/route'
import { GET as detail } from '@/app/api/community/posts/[id]/route'
import { GET as comments } from '@/app/api/community/posts/[id]/comments/route'
import { getHomeContent } from '@/lib/home-content'
import { getCurrentUser } from '@/lib/auth'
import { transaction } from '@/lib/db'
import { PATCH, DELETE as deletePost } from '@/app/api/community/posts/[id]/route'
import { DELETE as deleteComment } from '@/app/api/community/posts/[id]/comments/[commentId]/route'
const url = process.env.QA_DATABASE_URL
let client: Client
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
beforeAll(async () => {
  if (!url) return
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw Error('로컬 DB만 허용')
  client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 })
  await client.connect()
  await client.query('BEGIN')
  await client.query('SET LOCAL search_path = pg_temp')
  await client.query('CREATE TEMP TABLE users (id uuid, user_type text) ON COMMIT DROP')
  await client.query(`CREATE TEMP TABLE community_posts (
    id uuid, author_id uuid, audience text, category text, title text, body text,
    view_count int DEFAULT 0, comment_count int DEFAULT 0, created_at timestamptz DEFAULT now(),
    hidden_at timestamptz, deleted_at timestamptz, updated_at timestamptz) ON COMMIT DROP`)
  await client.query(`CREATE TEMP TABLE community_comments (
    id uuid, post_id uuid, author_id uuid, body text, created_at timestamptz DEFAULT now(),
    hidden_at timestamptz, deleted_at timestamptz, updated_at timestamptz) ON COMMIT DROP`)
  vi.mocked(query).mockImplementation(async (sql, args) => (await client.query(sql, args)).rows)
  vi.mocked(queryOne).mockImplementation(async (sql, args) => (await client.query(sql, args)).rows[0] ?? null)
  await client.query(`INSERT INTO community_posts (id,audience,title,body,comment_count)
    VALUES ($1,'all','QA 댓글 집계 질문','본문',2),($2,'all','다른 글','본문',1)`, [id, other])
  await client.query(`INSERT INTO community_comments (id,post_id,body)
    VALUES ($1,$1,'첫 댓글'),($2,$1,'두 번째 댓글'),
    ('33333333-3333-4333-8333-333333333333',$2,'다른 글 댓글')`, [id, other])
})
afterAll(async () => { if (client) { await client.query('ROLLBACK'); await client.end() } })
it.skipIf(!url)('목록·상세·홈·댓글 total은 숨김/삭제/복원/0건에서 같은 공개 댓글 수를 반환한다', async () => {
  async function check(expected: number) {
    const ctx = { params: Promise.resolve({ id }) }
    const listing = await (await list(new Request('http://localhost/api/community/posts'))).json()
    const post = await (await detail(new Request(`http://localhost/api/community/posts/${id}`), ctx)).json()
    const reply = await (await comments(new Request(`http://localhost/api/community/posts/${id}/comments`), ctx)).json()
    const home = await getHomeContent()
    const values = {
      list: listing.posts.find((p: {id: string}) => p.id === id)?.comment_count,
      detail: post.post?.comment_count,
      home: home.questions.find(p => p.id === id)?.comment_count,
      comments: reply.total,
    }
    console.log('공개 댓글 집계', expected, values)
    expect(values).toEqual({list:expected,detail:expected,home:expected,comments:expected})
    expect(listing.posts.find((p: {id:string}) => p.id === other)?.comment_count).toBe(1)
  }
  await check(2)
  await client.query('UPDATE community_comments SET hidden_at = now() WHERE id = $1', [id])
  await check(1)
  await client.query('UPDATE community_comments SET deleted_at = now() WHERE id = $1', [other])
  await check(0)
  await client.query('UPDATE community_comments SET hidden_at = NULL WHERE id = $1', [id])
  await check(1)
  await client.query('UPDATE community_comments SET deleted_at = now() WHERE id = $1', [id])
  await check(0)
})

it.skipIf(!url)('독립 실제 SQL: 본인 수정·댓글 삭제 후 3개 집계 일치·글 삭제 후 읽기 차단', async () => {
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const cid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const pid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  await client.query("INSERT INTO users VALUES ($1,'tenant')", [owner])
  await client.query("INSERT INTO community_posts (id,author_id,audience,title,body) VALUES ($1,$2,'all','독립 DB 제목','본문')", [pid,owner])
  await client.query("INSERT INTO community_comments (id,post_id,author_id,body) VALUES ($1,$2,$3,'본인 댓글'), ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',$2,NULL,'익명 공개 댓글')", [cid,pid,owner])
  await client.query("INSERT INTO community_comments (id,post_id,body,hidden_at) VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',$1,'숨김 댓글',now())", [pid])
  vi.mocked(getCurrentUser).mockResolvedValue({id:owner,user_type:'tenant'} as never)
  vi.mocked(transaction).mockImplementation(async fn => fn(client as never))
  const ctx = {params:Promise.resolve({id:pid})}
  const req = () => new Request('http://localhost/qa', {method:'PATCH',body:JSON.stringify({title:'수정 DB 제목'})})
  expect((await PATCH(req(),ctx)).status).toBe(200)
  expect((await client.query('SELECT title FROM community_posts WHERE id=$1',[pid])).rows[0].title).toBe('수정 DB 제목')
  const response = await deleteComment(req(),{params:Promise.resolve({id:pid,commentId:cid})})
  expect(await response.json()).toEqual({deleted:true,id:cid,total:1})
  const listing = await (await list(new Request('http://localhost/api/community/posts'))).json()
  const detailData = await (await detail(new Request('http://localhost/qa'),ctx)).json()
  const replies = await (await comments(new Request('http://localhost/qa'),ctx)).json()
  expect([listing.posts.find((p:{id:string})=>p.id===pid).comment_count,detailData.post.comment_count,replies.total]).toEqual([1,1,1])
  expect(replies.comments).toHaveLength(1)
  expect((await deletePost(req(),ctx)).status).toBe(200)
  expect((await detail(new Request('http://localhost/qa'),ctx)).status).toBe(404)
  expect((await comments(new Request('http://localhost/qa'),ctx)).status).toBe(404)
  const remaining = await (await list(new Request('http://localhost/api/community/posts'))).json()
  expect(remaining.posts.some((p:{id:string})=>p.id===pid)).toBe(false)
  expect((await client.query('SELECT deleted_at FROM community_posts WHERE id=$1',[pid])).rows[0].deleted_at).toBeTruthy()
})
it.skipIf(!url)('실제 SQL 201개 댓글은 200+1 페이지와 공개 total을 유지한다', async () => {
  const pid = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  await client.query("INSERT INTO community_posts (id,audience,title,body) VALUES ($1,'all','페이지 합성 제목','본문')", [pid])
  await client.query("INSERT INTO community_comments (id,post_id,body,created_at) SELECT overlay(overlay(md5('qa-page-' || n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,$1,'페이지 댓글 ' || n,'2026-10-13'::timestamptz + n * interval '1 second' FROM generate_series(1,201) n", [pid])
  const ctx = {params:Promise.resolve({id:pid})}
  const first = await (await comments(new Request('http://localhost/qa'),ctx)).json()
  expect(first.total).toBe(201); expect(first.comments).toHaveLength(200); expect(first.nextCursor).toBeTruthy()
  const last = await (await comments(new Request('http://localhost/qa?cursor='+encodeURIComponent(first.nextCursor)),ctx)).json()
  expect(last.total).toBe(201); expect(last.comments).toHaveLength(1); expect(last.nextCursor).toBeNull()
  expect(new Set([...first.comments,...last.comments].map((c: {id:string})=>c.id)).size).toBe(201)
})

/**
 * DOW-1236 — 커뮤니티 조회 응답에 작성자 실명·계정 id가 실리지 않는다.
 *
 * 판정 기준은 **응답 payload의 키**다. 값이 `null`인지 보는 방식으로는 회귀를 못 잡는다 —
 * `COALESCE(pr.name, u.name)`가 다시 들어와도 프로필 없는 계정에서는 `null`이 나와서
 * 그대로 통과한다. 그래서 여기서는 키의 존재 자체를 본다.
 *
 * 화면 쪽 판정(실명이 렌더되지 않고 표시 이름이 역할에서 나온다)은
 * `__tests__/components/community-post-view.test.tsx`와 `__tests__/mobile/community-comments.test.tsx`가 본다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))

import { GET as listPosts } from '@/app/api/community/posts/route'
import { GET as getPost } from '@/app/api/community/posts/[id]/route'
import { GET as getComments } from '@/app/api/community/posts/[id]/comments/route'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

const VIEWER = { id: 'viewer-1', user_type: 'tenant' } as never
const AUTHOR_ID = '11111111-1111-1111-1111-111111111111'

/** DB가 실제로 돌려주는 모양. 라우트가 SELECT에서 뺐으므로 이름·계정 id는 여기에 없다. */
const postRow = {
  id: 'p1',
  audience: 'all',
  category: null,
  title: '보증금 질문',
  body: '본문',
  view_count: 1,
  comment_count: 0,
  created_at: '2026-09-26T00:00:00.000Z',
  author_role: 'tenant',
}

/** 상세는 본인 글 판정을 위해 `author_id`를 조회하지만 응답에서는 빼야 한다. */
const detailRow = { ...postRow, author_id: AUTHOR_ID }

const commentRow = {
  id: 'c1',
  body: '댓글 본문',
  created_at: '2026-09-26T01:00:00.000Z',
  author_role: 'admin',
}

const listRequest = () => listPosts(new Request('http://localhost/api/community/posts?audience=all'))
const detailRequest = () =>
  getPost(new Request('http://localhost/api/community/posts/p1'), { params: Promise.resolve({ id: 'p1' }) })
const commentsRequest = () =>
  getComments(new Request('http://localhost/api/community/posts/p1/comments'), {
    params: Promise.resolve({ id: 'p1' }),
  })

/** 응답 본문에 이 키들이 어느 깊이에서든 나타나면 실패다. */
function forbiddenKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) forbiddenKeys(item, found)
    return found
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'author_name' || key === 'author_id') found.push(key)
      forbiddenKeys(child, found)
    }
  }
  return found
}

/**
 * DB 대역. **SELECT 목록을 보고 컬럼을 채운다.**
 *
 * 고정 행을 돌려주면 `COALESCE(pr.name, u.name) AS author_name`이 다시 들어와도
 * mock이 이름을 안 주니 payload 판정이 통과해 버린다. 실제 DB처럼 "고른 것만 주는" 대역을
 * 써야 SQL 회귀가 payload 판정에서도 잡힌다.
 */
function simulateDb() {
  const rowFor = (sql: string) => {
    const base = /FROM community_comments/.test(sql) ? commentRow : detailRow
    const row: Record<string, unknown> = { ...base }
    delete row.author_name
    delete row.author_id
    const selectList = sql.split('FROM')[0] ?? ''
    if (/AS author_name/.test(selectList)) row.author_name = '김철수'
    if (/author_id/.test(selectList)) row.author_id = AUTHOR_ID
    return row
  }
  vi.mocked(query).mockImplementation((async (sql: string) =>
    /SELECT/.test(String(sql)) ? [rowFor(String(sql))] : []) as never)
  vi.mocked(queryOne).mockImplementation((async (sql: string) => rowFor(String(sql))) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  simulateDb()
})

// 로그인 여부 × 목록·상세·댓글 = 6조합. 로그인 사용자에게만 이름이 붙던 결함이라
// 비로그인만 확인하면 결함을 통과시킨다.
describe.each([
  ['비로그인', null],
  ['로그인', VIEWER],
])('%s 조회', (_label, user) => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
  })

  it('목록 응답에 작성자 이름·계정 id가 없다', async () => {
    const response = await listRequest()
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(forbiddenKeys(payload)).toEqual([])
    expect(payload.posts[0].author_role).toBe('tenant')
  })

  it('상세 응답에 작성자 이름·계정 id가 없다 — 본인 글 표시는 is_author로 남는다', async () => {
    const response = await detailRequest()
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(forbiddenKeys(payload)).toEqual([])
    expect(payload.post.is_author).toBe(false)
    expect(payload.post.author_role).toBe('tenant')
  })

  it('댓글 응답에 작성자 이름·계정 id가 없다', async () => {
    const response = await commentsRequest()
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(forbiddenKeys(payload)).toEqual([])
    expect(payload.comments[0].author_role).toBe('admin')
  })
})

describe('SQL — 실명 경로 자체를 끊는다', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never)
  })

  it.each([
    ['목록', listRequest],
    ['상세', detailRequest],
    ['댓글', commentsRequest],
  ])('%s SQL은 profiles를 조인하지 않고 author_name을 만들지 않는다', async (_label, run) => {
    await run()

    // 라우트마다 query·queryOne 중 어느 쪽으로 읽는지 다르고, 상세는 조회 수 UPDATE도
    // 같은 mock을 쓴다. 그래서 둘을 합쳐 놓고 게시글·댓글을 읽는 SELECT만 고른다.
    const statements = [...vi.mocked(query).mock.calls, ...vi.mocked(queryOne).mock.calls].map(([sql]) => String(sql))
    const selects = statements.filter((s) => s.includes('SELECT') && /FROM community_(posts|comments)/.test(s))
    // 여기가 비면 아래 단정이 전부 공허하게 통과한다 — 대상 SQL을 잡았는지부터 본다.
    expect(selects.length).toBeGreaterThan(0)
    const sql = selects.find((s) => /AS author_role/.test(s)) ?? selects[0]

    expect(sql).not.toMatch(/author_name/)
    expect(sql).not.toMatch(/\bprofiles\b/)
    // 운영자 식별 근거는 남아 있어야 한다(DOW-1176).
    expect(sql).toMatch(/AS author_role/)
  })
})

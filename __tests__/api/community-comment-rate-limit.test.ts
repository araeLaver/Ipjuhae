/**
 * 익명 댓글 rate limit 회귀 테스트 (DOW-1158 D5).
 *
 * 결함이었던 것: `comments/route.ts`가 `rateLimit`을 **import만 하고 호출하지 않아서**
 * 로그인 없이 쓰는 댓글이 무제한이었다. 같은 저장소의 글 작성(10분 5회)·신고(1시간 20회)는
 * 막혀 있는데 댓글만 열려 있었다.
 *
 * 그래서 이 테스트는 "rateLimit을 호출하는지"를 소스에서 확인하지 않는다.
 * 실제로 같은 IP에서 연속 요청을 밀어넣어 **429가 돌아오는 지점**을 본다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { POST } from '@/app/api/community/posts/[id]/comments/route'
import { getCurrentUser } from '@/lib/auth'
import { queryOne, transaction } from '@/lib/db'

const POST_ID = '11111111-1111-1111-1111-111111111111'

function commentRequest(ip: string): Request {
  return new Request(`http://localhost:3000/api/community/posts/${POST_ID}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ body: '댓글입니다' }),
  })
}

const params = Promise.resolve({ id: POST_ID })

async function postComment(ip: string) {
  return POST(commentRequest(ip), { params })
}

describe('POST /api/community/posts/[id]/comments — 익명 rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queryOne).mockResolvedValue({ id: POST_ID, audience: 'all', author_id: null })
    vi.mocked(transaction).mockResolvedValue({ id: 'comment-1' })
  })

  it('비로그인 사용자는 10분 15회를 넘기면 429를 받는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const ip = '203.0.113.10'

    const statuses: number[] = []
    for (let i = 0; i < 16; i++) {
      statuses.push((await postComment(ip)).status)
    }

    expect(statuses.slice(0, 15)).toEqual(Array(15).fill(201))
    expect(statuses[15]).toBe(429)
  })

  it('한도를 넘긴 요청은 DB까지 가지 않는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const ip = '203.0.113.11'

    for (let i = 0; i < 15; i++) await postComment(ip)
    vi.mocked(transaction).mockClear()

    const blocked = await postComment(ip)

    expect(blocked.status).toBe(429)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('한도는 IP별로 센다 — 다른 IP는 막히지 않는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    for (let i = 0; i < 16; i++) await postComment('203.0.113.12')
    const other = await postComment('203.0.113.13')

    expect(other.status).toBe(201)
  })

  it('로그인 사용자는 글 작성 경로와 같이 이 한도를 적용받지 않는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      user_type: 'tenant',
    } as unknown as Awaited<ReturnType<typeof getCurrentUser>>)
    const ip = '203.0.113.14'

    const statuses: number[] = []
    for (let i = 0; i < 20; i++) {
      statuses.push((await postComment(ip)).status)
    }

    expect(statuses.every((s) => s === 201)).toBe(true)
  })
})

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

function commentRequest(ip: string, extraHeaders: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3000/api/community/posts/${POST_ID}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, ...extraHeaders },
    body: JSON.stringify({ body: '댓글입니다' }),
  })
}

const params = Promise.resolve({ id: POST_ID })

async function postComment(ip: string, extraHeaders: Record<string, string> = {}) {
  return POST(commentRequest(ip, extraHeaders), { params })
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

  /**
   * DOW-1165. 위 테스트들은 `x-forwarded-for`를 키로 삼는다 — 그런데 그 헤더는
   * 클라이언트가 직접 실어 보낼 수 있고 Fly Proxy는 거기에 덧붙이기만 한다.
   * 즉 한도가 걸려 있어도 요청마다 헤더를 바꾸면 그냥 빠져나갈 수 있었다.
   * 운영에서 실제로 들어오는 모양(`fly-client-ip` + 위조된 `x-forwarded-for`)으로
   * 눌러서, 한도가 위조 불가능한 값으로 세어지는지 확인한다.
   */
  it('x-forwarded-for를 매번 바꿔도 fly-client-ip가 같으면 한도에 걸린다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const realIp = '198.51.100.20'

    const statuses: number[] = []
    for (let i = 0; i < 16; i++) {
      // 매 요청 앞자리에 다른 IP를 심는다 — 공격자가 할 수 있는 일이다.
      statuses.push((await postComment(`203.0.113.${i}, ${realIp}`, { 'fly-client-ip': realIp })).status)
    }

    expect(statuses.slice(0, 15)).toEqual(Array(15).fill(201))
    expect(statuses[15]).toBe(429)
  })

  it('한도 초과 응답은 무엇이 일어났는지 문구로 알린다 — 조용히 실패하지 않는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const realIp = '198.51.100.21'

    for (let i = 0; i < 15; i++) await postComment(realIp, { 'fly-client-ip': realIp })
    const blocked = await postComment(realIp, { 'fly-client-ip': realIp })

    expect(blocked.status).toBe(429)
    // 클라이언트(`community-post-view.tsx`)는 이 `error` 문구를 그대로 toast에 띄운다.
    // 비어 있으면 '댓글 작성 실패'로 뭉개져 왜 막혔는지 알 수 없게 된다.
    expect((await blocked.json()).error).toBe('잠시 후 다시 시도해주세요. 짧은 시간에 너무 많이 올렸습니다.')
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

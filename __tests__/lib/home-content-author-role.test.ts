/**
 * DOW-1275 — 첫 화면 조회도 계정 역할을 그대로 읽지 않는다.
 *
 * 왜 이 테스트가 필요한가: [DOW-1262] 가 커뮤니티 3개 라우트의 `author_role` 을
 * admin/member 로 접었는데 `lib/home-content.ts` 한 곳이 남아 있었다. 배포된 `.next`
 * 산출물 대조로 찾았다 — 소스 검사 없이 두면 같은 결함이 다시 들어온다.
 *
 * **DB 대역이 SELECT 목록을 읽는다.** 고정 행을 돌려주면 SQL 을
 * `COALESCE(u.user_type, 'guest')` 로 되돌려도 대역이 접힌 값을 주기 때문에 값 판정이
 * 그대로 통과해 버린다(이 저장소의 반복 실패 패턴이다). 실제 DB 처럼 "고른 식대로 주는"
 * 대역을 써야 SQL 회귀가 값 판정에서도 잡힌다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

import { getHomeContent } from '@/lib/home-content'
import { query } from '@/lib/db'

/** DB `users.user_type` 에 실제로 들어 있는 값. 임대인이 쓴 글이다. */
const ACCOUNT_ROLE = 'landlord'

const baseRow = {
  id: 'p1',
  title: '보증금 질문',
  body: '본문',
  comment_count: 0,
  view_count: 1,
  created_at: '2026-09-27T00:00:00.000Z',
}

/** 운영자가 쓴 연재 글 — 운영자 필터의 입력이 살아 있는지 보려고 같이 둔다. */
const adminRow = { ...baseRow, id: 'p2', title: '임대인 노트 1화. 공실보다 연체가 비싸다' }

function simulateDb() {
  vi.mocked(query).mockImplementation((async (sql: string) => {
    const text = String(sql)
    const selectList = text.split('FROM')[0] ?? ''
    const collapsed =
      /CASE WHEN u\.user_type = 'admin' THEN 'admin' ELSE 'member' END AS author_role/.test(selectList)

    // 접는 식이 있을 때만 좁혀 준다. 없으면 DB 가 계정 역할을 그대로 돌려준다.
    const roleFor = (accountRole: string) =>
      collapsed ? (accountRole === 'admin' ? 'admin' : 'member') : accountRole

    return [
      { ...baseRow, author_role: roleFor(ACCOUNT_ROLE) },
      { ...adminRow, author_role: roleFor('admin') },
    ]
  }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  simulateDb()
})

describe('첫 화면 author_role', () => {
  it('일반 사용자 글의 author_role 이 member 로 접힌다 — 계정 역할이 새지 않는다', async () => {
    const { questions } = await getHomeContent()

    // 여기가 비면 아래 단정이 공허하게 통과한다 — 대상 글을 잡았는지부터 본다.
    expect(questions.length).toBeGreaterThan(0)
    const roles = questions.map((q) => q.author_role)
    expect(roles).not.toContain('landlord')
    expect(roles).not.toContain('tenant')
    expect(roles).not.toContain('guest')
    expect(roles).toContain('member')
  })

  it('운영자 글은 admin 으로 남아 연재 필터가 계속 동작한다', async () => {
    const { series, guideCount } = await getHomeContent()

    // 운영자 판정이 깨지면 연재가 통째로 사라진다 — 접기가 과하지 않은지 보는 쪽이다.
    expect(guideCount).toBeGreaterThan(0)
    expect(series.flatMap((s) => s.posts).map((p) => p.author_role)).toEqual(['admin'])
  })

  it('SQL 이 계정 역할을 그대로 읽지 않는다', async () => {
    await getHomeContent()

    const selects = vi
      .mocked(query)
      .mock.calls.map(([sql]) => String(sql))
      .filter((s) => s.includes('SELECT') && /FROM community_posts/.test(s))
    // 대상 SQL 을 잡았는지부터 확인한다.
    expect(selects.length).toBeGreaterThan(0)
    const sql = selects.find((s) => /AS author_role/.test(s)) ?? selects[0]

    expect(sql).not.toMatch(/COALESCE\(u\.user_type/)
    expect(sql).toMatch(/CASE WHEN u\.user_type = 'admin' THEN 'admin' ELSE 'member' END AS author_role/)
  })
})

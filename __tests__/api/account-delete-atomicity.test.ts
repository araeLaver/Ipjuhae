/**
 * 탈퇴(계정 삭제) — 중간에 실패해도 반쯤 지워진 계정이 남지 않는지 본다.
 *
 * 왜 이 파일이 있나:
 * 기존 `account-delete.test.ts`는 성공 경로 한 줄과 401만 본다. 그런데 이 라우트가
 * 위험한 지점은 성공이 아니라 **중간 실패**다. properties는 이미 hidden으로 바뀌었는데
 * users 익명화에서 터지면, 사용자는 로그인은 되지만 매물이 전부 사라진 상태가 된다.
 * 그 원자성은 `lib/db.ts`의 `transaction()`이 책임지므로, 라우트가 그걸 쓰는지만
 * 보지 말고 `transaction()` 자체가 ROLLBACK을 내는지까지 같이 고정한다.
 *
 * 한계(중요): 이 테스트는 pg를 모킹하므로 **SQL 식별자 오타는 잡지 못한다.**
 * 탈퇴 라우트는 과거에 컬럼/테이블 이름 불일치로 세 번 깨졌고 모킹 테스트는
 * 전부 통과했었다. 실DB 검증은 별도 회귀 항목으로 유지해야 한다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('lib/db transaction() — 실패 시 ROLLBACK', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  /** pg Pool을 흉내 내고, 실행된 제어문(BEGIN/COMMIT/ROLLBACK)을 기록한다. */
  async function loadDbWithFakePool() {
    const statements: string[] = []
    const release = vi.fn()
    const client = {
      query: vi.fn(async (text: string) => {
        statements.push(text)
        return { rows: [] }
      }),
      release,
    }
    vi.doMock('pg', () => ({
      Pool: class {
        on() {}
        async connect() {
          return client
        }
      },
    }))
    const db = await import('@/lib/db')
    return { db, statements, client, release }
  }

  it('성공하면 BEGIN → COMMIT 으로 닫고 커넥션을 반납한다', async () => {
    const { db, statements, release } = await loadDbWithFakePool()

    const result = await db.transaction(async (client) => {
      await client.query('UPDATE users SET name = $1', ['x'])
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(statements).toEqual(['BEGIN', 'UPDATE users SET name = $1', 'COMMIT'])
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('중간에 터지면 COMMIT 하지 않고 ROLLBACK 한다 — 반쯤 지워진 계정 방지', async () => {
    const { db, statements, release } = await loadDbWithFakePool()

    await expect(
      db.transaction(async (client) => {
        await client.query("UPDATE properties SET status = 'hidden'")
        throw new Error('users 익명화 실패')
      })
    ).rejects.toThrow('users 익명화 실패')

    expect(statements).toContain('ROLLBACK')
    expect(statements).not.toContain('COMMIT')
    // 롤백 경로에서도 커넥션이 새지 않아야 한다.
    expect(release).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /api/account/delete — 실패 경로와 개인정보 처리', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  const userId = '22222222-2222-4222-8222-222222222222'

  /** 라우트를 모킹된 의존성과 함께 새로 로드한다. */
  async function loadRoute(options: { failOnQueryIndex?: number } = {}) {
    const queries: Array<{ text: string; params?: unknown[] }> = []
    const clearAuthCookie = vi.fn()

    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn(async () => ({ id: userId })),
      clearAuthCookie,
    }))
    vi.doMock('@/lib/logger', () => ({
      logger: { info: vi.fn(), error: vi.fn() },
    }))
    vi.doMock('@/lib/db', () => ({
      transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) =>
        fn({
          query: vi.fn(async (text: string, params?: unknown[]) => {
            queries.push({ text, params })
            if (options.failOnQueryIndex !== undefined && queries.length - 1 === options.failOnQueryIndex) {
              throw new Error('DB 연결 끊김')
            }
            return { rows: [] }
          }),
        })
      ),
    }))

    const { DELETE } = await import('@/app/api/account/delete/route')
    return { DELETE, queries, clearAuthCookie }
  }

  it('두 번째 쿼리에서 터지면 500을 내고 세션 쿠키를 지우지 않는다', async () => {
    // 쿠키를 지워 버리면 사용자는 "탈퇴됐다"고 믿지만 DB는 롤백된 상태라
    // 로그인도 못 하고 데이터도 남는 최악의 불일치가 된다.
    const { DELETE, clearAuthCookie } = await loadRoute({ failOnQueryIndex: 1 })

    const response = await DELETE()

    expect(response.status).toBe(500)
    expect(clearAuthCookie).not.toHaveBeenCalled()
  })

  it('성공하면 200과 함께 세션 쿠키를 지운다', async () => {
    const { DELETE, clearAuthCookie } = await loadRoute()

    const response = await DELETE()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(clearAuthCookie).toHaveBeenCalledTimes(1)
  })

  it('password_hash를 무효화하고 deleted_at을 남겨 재로그인을 차단한다', async () => {
    const { DELETE, queries } = await loadRoute()
    await DELETE()

    const usersUpdate = queries.find((q) => /UPDATE users/.test(q.text))
    expect(usersUpdate).toBeDefined()
    expect(usersUpdate!.text).toMatch(/password_hash = 'deleted'/)
    expect(usersUpdate!.text).toMatch(/deleted_at = NOW\(\)/)
    expect(usersUpdate!.text).toMatch(/phone_number = NULL/)
    expect(usersUpdate!.params?.[0]).toBe(`deleted_${userId}@deleted.invalid`)
  })

  it('민감 검증 데이터와 제3자 연락처는 익명화가 아니라 삭제한다', async () => {
    const { DELETE, queries } = await loadRoute()
    await DELETE()

    const deletes = queries.filter((q) => /^DELETE FROM/.test(q.text.trim())).map((q) => q.text)
    expect(deletes.some((t) => /verifications/.test(t))).toBe(true)
    expect(deletes.some((t) => /landlord_references/.test(t))).toBe(true)
    expect(deletes.some((t) => /notifications/.test(t))).toBe(true)
    expect(deletes.some((t) => /tenant_favorites/.test(t))).toBe(true)
  })

  it('모든 쿼리가 하나의 transaction() 안에서 실행된다', async () => {
    const { DELETE, queries } = await loadRoute()
    const { transaction } = await import('@/lib/db')

    await DELETE()

    expect(vi.mocked(transaction)).toHaveBeenCalledTimes(1)
    expect(queries.length).toBeGreaterThanOrEqual(7)
  })
})

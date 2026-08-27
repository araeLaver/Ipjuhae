import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  clearAuthCookie: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  transaction: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

import { DELETE } from '@/app/api/account/delete/route'
import { clearAuthCookie, getCurrentUser } from '@/lib/auth'
import { transaction } from '@/lib/db'

describe('DELETE /api/account/delete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hides and anonymizes landlord properties before deleting the account', async () => {
    const userId = '11111111-1111-4111-8111-111111111111'
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId } as never)
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] })
    vi.mocked(transaction).mockImplementation(async (fn) => fn({ query: clientQuery } as never))

    const response = await DELETE()

    expect(response.status).toBe(200)
    expect(clientQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/status = 'hidden'[\s\S]*address = '탈퇴 회원 비공개 매물'[\s\S]*address_detail = NULL/),
      [userId],
    )
    expect(clearAuthCookie).toHaveBeenCalled()
  })

  it('rejects unauthenticated deletion', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never)

    const response = await DELETE()

    expect(response.status).toBe(401)
    expect(transaction).not.toHaveBeenCalled()
  })
})

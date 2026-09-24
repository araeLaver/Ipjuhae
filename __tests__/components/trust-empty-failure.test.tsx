// @vitest-environment jsdom
/**
 * DOW-1166: Trust 흐름의 조회 실패를 빈 목록으로 보여주지 않는 회귀 테스트.
 *
 * 사용자가 실제로 읽는 문구를 기준으로 본다. API 실패는 오류와 재시도,
 * 성공한 빈 배열은 정상 빈 상태로 분리돼야 한다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}))

const router = {
  push: routerPush,
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/trust/transactions',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/layout/header', () => ({ Header: () => null }))

import TrustCardsPage from '@/app/trust/cards/page'
import ContractReportsPage from '@/app/trust/reports/page'
import TransactionsPage from '@/app/trust/transactions/page'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Trust 거래 목록', () => {
  it('API 실패를 "등록된 거래가 없어요"로 보여주지 않고 재시도 경로를 준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).startsWith('/api/auth/me')) {
          return new Response(JSON.stringify({ user: { id: 'u1', userType: 'tenant' } }), { status: 200 })
        }
        return new Response(JSON.stringify({ error: 'DB down' }), { status: 500 })
      }),
    )

    render(<TransactionsPage />)

    await screen.findByText('거래 목록을 불러오지 못했습니다')
    expect(screen.queryByText('등록된 거래가 없어요')).toBeNull()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('API가 성공해서 빈 배열을 줄 때만 정상 빈 상태를 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).startsWith('/api/auth/me')) {
          return new Response(JSON.stringify({ user: { id: 'u1', userType: 'tenant' } }), { status: 200 })
        }
        return new Response(JSON.stringify({ transactions: [] }), { status: 200 })
      }),
    )

    render(<TransactionsPage />)

    await screen.findByText('등록된 거래가 없어요')
    expect(screen.queryByText('거래 목록을 불러오지 못했습니다')).toBeNull()
  })
})

describe('계약 전 확인 리포트 목록', () => {
  it('API 실패를 "아직 생성된 리포트가 없습니다"로 보여주지 않고 재시도 경로를 준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'DB down' }), { status: 500 })),
    )

    render(<ContractReportsPage />)

    await screen.findByText('리포트를 불러오지 못했습니다')
    expect(screen.queryByText('아직 생성된 리포트가 없습니다.')).toBeNull()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('API가 성공해서 빈 배열을 줄 때만 정상 빈 상태를 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ reports: [] }), { status: 200 })),
    )

    render(<ContractReportsPage />)

    await screen.findByText('아직 생성된 리포트가 없습니다.')
    expect(screen.queryByText('리포트를 불러오지 못했습니다')).toBeNull()
  })
})

describe('Trust Card 목록', () => {
  it('API 실패를 "발급된 Trust Card가 없습니다"로 보여주지 않고 재시도 경로를 준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'DB down' }), { status: 500 })),
    )

    render(<TrustCardsPage />)

    await screen.findByText('Trust Card를 불러오지 못했습니다')
    expect(screen.queryByText('발급된 Trust Card가 없습니다.')).toBeNull()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('API가 성공해서 빈 배열을 줄 때만 정상 빈 상태를 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ cards: [] }), { status: 200 })),
    )

    render(<TrustCardsPage />)

    await screen.findByText('발급된 Trust Card가 없습니다.')
    expect(screen.queryByText('Trust Card를 불러오지 못했습니다')).toBeNull()
  })
})

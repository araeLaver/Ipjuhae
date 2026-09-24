// @vitest-environment jsdom
/**
 * DOW-1166: 조회 실패를 빈 목록으로 보여주지 않는 회귀 테스트.
 *
 * 화면에 실제로 보이는 문구를 기준으로 본다. 소스 grep은 import 경유나
 * 상태 조합을 놓칠 수 있어서 이 결함의 판정 기준으로 쓰지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'

const { toastError, routerPush } = vi.hoisted(() => ({
  toastError: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn() },
  Toaster: () => null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/properties',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

import PublicPropertiesPage from '@/app/properties/page'
import LandlordPropertiesPage from '@/app/landlord/properties/page'

beforeEach(() => {
  vi.clearAllMocks()
  class MockIntersectionObserver {
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()
    takeRecords = vi.fn(() => [])
  }
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('공개 매물 목록', () => {
  it('API 실패를 "매물이 없습니다"로 보여주지 않고 재시도 경로를 준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'DB down' }), { status: 500 })),
    )

    render(<PublicPropertiesPage />)

    await screen.findByText('매물을 불러오지 못했습니다')
    expect(screen.queryByText('매물이 없습니다')).toBeNull()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('API가 성공해서 빈 배열을 줄 때만 정상 빈 상태를 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ properties: [], nextCursor: null, hasMore: false }), { status: 200 })),
    )

    render(<PublicPropertiesPage />)

    await screen.findByText('매물이 없습니다')
    expect(screen.queryByText('매물을 불러오지 못했습니다')).toBeNull()
  })
})

describe('임대인 내 매물 목록', () => {
  it('API 실패를 "등록된 매물이 없습니다"로 보여주지 않고 재시도 경로를 준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'DB down' }), { status: 500 })),
    )

    render(<LandlordPropertiesPage />)

    await screen.findByText('내 매물을 불러오지 못했습니다')
    expect(screen.queryByText('등록된 매물이 없습니다')).toBeNull()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('API가 성공해서 빈 배열을 줄 때만 정상 빈 상태를 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ properties: [] }), { status: 200 })),
    )

    render(<LandlordPropertiesPage />)

    await screen.findByText('등록된 매물이 없습니다')
    expect(screen.queryByText('내 매물을 불러오지 못했습니다')).toBeNull()
    await waitFor(() => expect(routerPush).not.toHaveBeenCalled())
  })
})

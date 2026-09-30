// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
vi.mock('@/components/layout/page-container', () => ({ PageContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
import PropertiesPage from '@/app/properties/page'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('실제 Select로 필터를 열어도 화면이 깨지지 않는다', async () => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ properties: [], nextCursor: null, hasMore: false })))
  render(<PropertiesPage />)
  fireEvent.click(screen.getByRole('button', { name: '검색 필터' }))
  expect(screen.getAllByRole('combobox')).toHaveLength(3)
  expect(screen.getByRole('button', { name: '검색 필터' }).getAttribute('aria-expanded')).toBe('true')
  await screen.findByText('매물이 없습니다')
})

it('월세와 관리비의 합계를 공과금 별도 표시와 함께 보여준다', async () => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ properties: [{
    id: 'p1', title: '테스트 매물', address: '서울', region: '서울', deposit: 10000000,
    monthlyRent: 500000, maintenanceFee: 70000, propertyType: 'oneroom', roomCount: 1,
    floor: 2, areaSqm: 20, options: [], availableFrom: null, viewCount: 0,
    createdAt: '2026-09-30', mainImageUrl: null, landlordName: null,
  }], nextCursor: null, hasMore: false })))
  render(<PropertiesPage />)
  await screen.findByText(/월 고정비 57만원/)
  expect(screen.getByText(/공과금 별도/)).toBeTruthy()
})

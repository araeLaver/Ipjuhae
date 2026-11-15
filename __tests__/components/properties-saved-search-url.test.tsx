// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { searchLabel, type SearchFilters } from '@/lib/saved-search'
import PropertiesPage from '@/app/properties/page'
vi.mock('@/components/layout/page-container', () => ({ PageContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

it.each<SearchFilters>([
  { q: '합정', region: '서울', propertyType: 'oneroom', sort: 'monthly_rent' },
  { q: '한강 뷰 & 역세권', region: '경기', propertyType: 'apartment', sort: 'deposit' },
  { q: '', region: '', propertyType: '', sort: 'created_at' },
  { q: '', region: '', propertyType: '', sort: 'view_count' },
])('저장 검색 $sort 적용 후 URL·API·재진입 조건을 유지한다', async filters => {
  window.history.replaceState({ nextMetadata: 'preserve' }, '', '/properties?q=합정&region=서울&type=oneroom&sort=created_at&cursor=old#results')
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  const fetchMock = vi.fn(async (input: string) => {
    if (input === '/api/saved-searches') return Response.json({ searches: [{ ...filters, id: 'saved', alerts_enabled: false }], alertsAvailable: false })
    const params = new URL(input, 'http://localhost').searchParams
    return Response.json({ properties: [{ id: 'p1', title: `${params.get('q') ?? ''}/${params.get('sort')}`, address: '주소', deposit: 0, monthlyRent: 0, maintenanceFee: 0, propertyType: 'oneroom', viewCount: 0 }], hasMore: false, nextCursor: null })
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<PropertiesPage />)
  await screen.findByText('합정/created_at')
  fireEvent.click(screen.getByRole('button', { name: '저장한 검색' }))
  fireEvent.click(await screen.findByRole('button', { name: `${searchLabel(filters)} 이 조건으로 검색` }))
  const appliedUrl = window.location.href
  const params = new URL(appliedUrl).searchParams
  expect(params.get('q') ?? '').toBe(filters.q)
  expect(params.get('region') ?? '').toBe(filters.region)
  expect(params.get('type') ?? '').toBe(filters.propertyType)
  expect(params.get('sort')).toBe(filters.sort)
  expect(params.has('cursor')).toBe(false)
  expect(window.location.hash).toBe('#results')
  expect(window.history.state).toEqual({ nextMetadata: 'preserve' })
  await screen.findByText(`${filters.q}/${filters.sort}`)
  for (const reopen of ['새로고침', 'URL 재진입']) {
    cleanup()
    if (reopen === 'URL 재진입') {
      window.history.replaceState(null, '', '/')
      window.history.replaceState(null, '', appliedUrl)
    }
    fetchMock.mockClear()
    render(<PropertiesPage />)
    await screen.findByText(`${filters.q}/${filters.sort}`)
    expect((screen.getByRole('textbox', { name: '지역명, 건물명으로 검색' }) as HTMLInputElement).value).toBe(filters.q)
    await waitFor(() => {
      const request = fetchMock.mock.calls.find(([url]) => url.startsWith('/api/properties?'))![0]
      const query = new URL(request, 'http://localhost').searchParams
      expect(query.get('q') ?? '').toBe(filters.q)
      expect(query.get('region') ?? '').toBe(filters.region)
      expect(query.get('type') ?? '').toBe(filters.propertyType)
      expect(query.get('sort')).toBe(filters.sort)
    })
  }
})

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SavedSearches } from '@/components/properties/saved-searches'
const filters = { q: '합정', region: '서울', propertyType: 'oneroom' as const, sort: 'created_at' as const }
const search = { ...filters, id: 's1', alerts_enabled: false, created_at: '2026-09-30' }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('저장 실패 시 성공으로 표시하지 않고 다시 저장할 수 있다', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ searches: [], alertsAvailable: true }))
    .mockResolvedValueOnce(Response.json({ error: '저장 실패' }, { status: 500 }))
    .mockResolvedValueOnce(Response.json({ search }, { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
  render(<SavedSearches filters={filters} onApply={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '저장한 검색' }))
  fireEvent.click(await screen.findByRole('button', { name: '현재 검색 조건 저장' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('검색 조건을 저장했습니다')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '현재 검색 조건 저장' }))
  await screen.findByText('검색 조건을 저장했습니다')
  const request = fetchMock.mock.calls[2][1]
  expect(JSON.parse(request.body)).toEqual({ filters, alertsEnabled: false })
})
it('로그인 복귀 URL에 현재 검색 조건을 보존한다', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 401 })))
  render(<SavedSearches filters={filters} onApply={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '저장한 검색' }))
  const link = await screen.findByRole('link', { name: '로그인해 주세요' })
  expect(decodeURIComponent(link.getAttribute('href')!)).toContain('/properties?q=')
  expect(decodeURIComponent(link.getAttribute('href')!)).toContain('type=oneroom')
})
it('저장한 조건 적용, 알림 변경, 삭제는 성공 응답 후 반영한다', async () => {
  const onApply = vi.fn()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ searches: [search], alertsAvailable: true }))
    .mockResolvedValueOnce(Response.json({ search: { ...search, alerts_enabled: true } }))
    .mockResolvedValueOnce(Response.json({ ok: true })))
  render(<SavedSearches filters={filters} onApply={onApply} />)
  fireEvent.click(screen.getByRole('button', { name: '저장한 검색' }))
  fireEvent.click(await screen.findByRole('button', { name: '이 조건으로 검색' }))
  expect(onApply).toHaveBeenCalledWith(search)
  fireEvent.click(screen.getByRole('button', { name: /알림 켜기/ }))
  fireEvent.click(await screen.findByRole('button', { name: /검색 삭제/ }))
  await screen.findByText('검색 조건을 삭제했습니다')
  await waitFor(() => expect(screen.queryByRole('button', { name: '이 조건으로 검색' })).toBeNull())
})
it('알림 서비스가 꺼져 있으면 알림 신청을 막고 조건 저장만 제공한다', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ searches: [], alertsAvailable: false })))
  render(<SavedSearches filters={filters} onApply={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '저장한 검색' }))
  expect((await screen.findByRole('checkbox', { name: '새 매물 알림 받기' })).hasAttribute('disabled')).toBe(true)
})

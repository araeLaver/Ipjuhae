// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
vi.mock('@/components/layout/page-container', () => ({ PageContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/lib/analytics-client', () => ({ trackEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
import MatchesPage from '@/app/matches/page'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('프로필 미작성을 매물 없음과 구분하고 작성 경로를 제공한다', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ matches: [], total: 0, requiresProfile: true })))
  render(<MatchesPage />)
  await screen.findByText('매칭을 위한 프로필을 작성해 주세요')
  expect(screen.queryByText('조건에 맞는 매물이 없습니다')).toBeNull()
  expect(screen.getByRole('link', { name: '매칭 조건 수정' }).getAttribute('href')).toBe('/profile/tenant')
})
it('로그인 후 매칭 화면으로 복귀할 수 있다', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: '로그인이 필요합니다' }, { status: 401 })))
  render(<MatchesPage />)
  expect((await screen.findByRole('link', { name: '로그인하고 매칭 보기' })).getAttribute('href')).toBe('/login?redirect=%2Fmatches')
})
it('저장소 접근이 거부되어도 매칭 화면을 사용할 수 있다', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ matches: [], total: 0 })))
  render(<MatchesPage />)
  await screen.findByText('조건에 맞는 매물이 없습니다')
})
it('잘못된 성공 응답을 정상 빈 상태로 표시하지 않는다', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ matches: [] })))
  render(<MatchesPage />)
  await screen.findByRole('button', { name: /다시 시도/ })
  expect(screen.queryByText('조건에 맞는 매물이 없습니다')).toBeNull()
})

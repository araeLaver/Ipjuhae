// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PolicyNewsFeed } from '@/components/policy-news-feed'

const item = {
  id: '1',
  title: '전세 보증금 지원',
  summary: '',
  ministry: '국토교통부',
  url: 'https://www.korea.kr/news/1',
  approvedAt: '2026-10-06',
}
const snapshot = {
  items: [
    item,
    {
      ...item,
      id: '2',
      title: '청약 전환 안내',
      url: 'https://www.korea.kr/news/2',
    },
  ],
  health: { status: 'ok', lastSuccessAt: new Date().toISOString() },
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('filters and searches official stories without confusing collection and publication dates', () => {
  render(<PolicyNewsFeed initialSnapshot={snapshot} />)
  expect(screen.getByText(/최근 수집:/)).toBeTruthy()
  expect(screen.getByText('최신 발표: 2026-10-06')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '주택·청약' }))
  expect(screen.queryByText('전세 보증금 지원')).toBeNull()
  expect(screen.getByText('청약 전환 안내')).toBeTruthy()
  fireEvent.change(screen.getByRole('searchbox', { name: '정책소식 검색' }), {
    target: { value: '없는 제목' },
  })
  expect(screen.getByText('검색 조건에 맞는 소식이 없습니다.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '전체' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
  expect(screen.getByText('전세 보증금 지원')).toBeTruthy()
})

it('updates the stored result on request and keeps existing stories on network failure', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...snapshot, items: [{ ...item, title: '새 발표' }] }),
      ),
    )
    .mockRejectedValueOnce(new Error('offline'))
  vi.stubGlobal('fetch', request)
  render(<PolicyNewsFeed initialSnapshot={snapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '최신 수집 결과 보기' }))
  await waitFor(() => expect(screen.getByText('새 발표')).toBeTruthy())
  expect(request).toHaveBeenCalledWith(
    '/api/policy-news',
    expect.objectContaining({ cache: 'no-store' }),
  )
  fireEvent.click(screen.getByRole('button', { name: '최신 수집 결과 보기' }))
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain(
      '갱신하지 못했습니다',
    ),
  )
  expect(screen.getByText('새 발표')).toBeTruthy()
})

it('shows partial collection failures rather than pretending there are no new stories', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...snapshot,
          health: { ...snapshot.health, status: 'degraded' },
        }),
        { status: 503 },
      ),
    ),
  )
  render(<PolicyNewsFeed initialSnapshot={snapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '최신 수집 결과 보기' }))
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('지연'),
  )
  expect(screen.getByText('전세 보증금 지원')).toBeTruthy()
})

it('refreshes an open visible page every five minutes and cleans up after leaving', async () => {
  vi.useFakeTimers()
  const request = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(snapshot)))
  vi.stubGlobal('fetch', request)
  const view = render(<PolicyNewsFeed initialSnapshot={snapshot} compact />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
  })
  expect(request).toHaveBeenCalledOnce()
  view.unmount()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
  })
  expect(request).toHaveBeenCalledOnce()
})

it('keeps a visible recovery path when collection or configuration is unavailable', () => {
  render(
    <PolicyNewsFeed
      initialSnapshot={{ items: [], health: { status: 'unavailable' } }}
      compact
    />,
  )
  expect(screen.getByRole('heading', { name: '최근 정책 소식' })).toBeTruthy()
  expect(
    screen.getByRole('button', { name: '최신 수집 결과 보기' }),
  ).toBeTruthy()
  expect(screen.getByText(/정책소식을 불러오지 못했습니다/)).toBeTruthy()
})

it('keeps the last articles and collection time when the store becomes unavailable', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [], health: { status: 'unavailable' } }),
          { status: 503 },
        ),
      ),
  )
  render(<PolicyNewsFeed initialSnapshot={snapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '최신 수집 결과 보기' }))
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('지연'),
  )
  expect(screen.getByText('전세 보증금 지원')).toBeTruthy()
  expect(screen.getByText(/최근 수집:/).textContent).not.toContain(
    '확인하지 못함',
  )
})

it('recovers the refresh button after a request hangs for ten seconds', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          )
        }),
    ),
  )
  render(<PolicyNewsFeed initialSnapshot={snapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '최신 수집 결과 보기' }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
  expect(screen.getByRole('status').textContent).toContain(
    '갱신하지 못했습니다',
  )
  expect(
    (
      screen.getByRole('button', {
        name: '최신 수집 결과 보기',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false)
  expect(screen.getByText('전세 보증금 지원')).toBeTruthy()
})

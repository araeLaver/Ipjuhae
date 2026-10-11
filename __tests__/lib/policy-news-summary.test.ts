import { expect, it } from 'vitest'
import { summarizePolicyNews } from '@/lib/policy-news-summary'

const article = {
  id: '1',
  title: '전세 지원',
  summary: '',
  ministry: '',
  url: 'https://www.korea.kr/news/1',
  approvedAt: '2026-10-11',
}

it('does not confuse successful collection today with a new announcement today', () => {
  const result = summarizePolicyNews(
    [article],
    { status: 'ok', lastSuccessAt: '2026-10-12T00:00:00Z' },
    new Date('2026-10-12T01:00:00Z'),
  )
  expect(result).toMatchObject({
    todayCount: 0,
    latestPublishedAt: '2026-10-11',
    message: '오늘 확인한 범위에서는 새 발표가 없습니다.',
  })
})

it('uses the Korean day at UTC midnight boundaries', () => {
  expect(
    summarizePolicyNews(
      [article],
      { status: 'ok', lastSuccessAt: '2026-10-10T16:00:00Z' },
      new Date('2026-10-10T17:00:00Z'),
    ).todayCount,
  ).toBe(1)
  expect(
    summarizePolicyNews(
      [],
      { status: 'ok', lastSuccessAt: '2026-10-10T14:59:00Z' },
      new Date('2026-10-10T15:01:00Z'),
    ).message,
  ).toContain('아직 확인하지 못했습니다')
})

it('does not call a failed collection day a day with no new announcements', () => {
  expect(
    summarizePolicyNews(
      [article],
      { status: 'degraded', lastSuccessAt: '2026-10-11T01:00:00Z' },
      new Date('2026-10-11T02:00:00Z'),
    ).message,
  ).toContain('지연')
})

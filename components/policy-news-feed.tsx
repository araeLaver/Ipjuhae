'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import {
  koreanDay,
  summarizePolicyNews,
  type PolicyNewsSnapshot,
} from '@/lib/policy-news-summary'

const FILTERS = ['전체', '전월세·보증금', '주택·청약'] as const
const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))

export function PolicyNewsFeed({
  initialSnapshot,
  compact = false,
}: {
  initialSnapshot: PolicyNewsSnapshot
  compact?: boolean
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('전체')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const pending = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setRefreshing(true)
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 10_000)
    try {
      const response = await fetch('/api/policy-news', {
        cache: 'no-store',
        signal: controller.signal,
      })
      const data: PolicyNewsSnapshot = await response.json()
      if (!Array.isArray(data.items) || !data.health?.status)
        throw new Error('Invalid snapshot')
      if (!response.ok && response.status !== 503)
        throw new Error('Request failed')
      setSnapshot((current) =>
        data.health.status !== 'ok' && data.items.length === 0
          ? {
              items: current.items,
              health: {
                ...data.health,
                lastSuccessAt:
                  data.health.lastSuccessAt ?? current.health.lastSuccessAt,
              },
            }
          : data,
      )
      setNow(new Date())
      setError(false)
    } catch {
      if (!controller.signal.aborted || timedOut) setError(true)
    } finally {
      clearTimeout(timeout)
      if (!controller.signal.aborted || timedOut) setRefreshing(false)
      pending.current = null
    }
  }, [])

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) {
        setNow(new Date())
        void refresh()
      }
    }
    const timer = setInterval(tick, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      pending.current?.abort()
    }
  }, [refresh])

  const summary = summarizePolicyNews(snapshot.items, snapshot.health, now)
  const filtered = snapshot.items.filter((item) => {
    const rental = /전세|월세|임대차|보증금|임차|임대인|전입|상생임대/.test(
      `${item.title} ${item.summary}`,
    )
    return (
      (filter === '전체' || (filter === '전월세·보증금' ? rental : !rental)) &&
      `${item.title} ${item.summary} ${item.ministry}`.includes(search.trim())
    )
  })
  const visible = compact ? filtered.slice(0, 3) : filtered

  return (
    <section
      id="policy-news"
      aria-labelledby="policy-news-heading"
      className="scroll-mt-24 border-t bg-muted/20"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-primary">
              공식 발표 모아보기
            </p>
            <h2
              id="policy-news-heading"
              className="text-xl font-bold sm:text-2xl"
            >
              최근 정책 소식
            </h2>
          </div>
          {compact && (
            <Link
              href="/policy/news"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
            >
              전체 소식 보기{' '}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </header>
        <div className="mt-4 rounded-xl border bg-background px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-sm font-medium">
              {error
                ? '화면을 갱신하지 못했습니다. 저장된 소식을 보여드립니다.'
                : summary.message}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {refreshing ? '불러오는 중' : '최신 수집 결과 보기'}
            </button>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              최근 수집:{' '}
              {snapshot.health.lastSuccessAt
                ? formatTime(snapshot.health.lastSuccessAt)
                : '확인하지 못함'}
            </span>
            <span>최신 발표: {summary.latestPublishedAt || '없음'}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            매시간 공식 발표를 확인합니다. 새 발표가 없는 날에는 목록이 같을 수
            있습니다.
          </p>
        </div>
        {!compact && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2" aria-label="소식 주제 선택">
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium ${filter === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="text-sm">
              <span className="sr-only">정책소식 검색</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="제목·기관으로 검색"
                className="min-h-11 w-full rounded-lg border bg-background px-3 sm:w-60"
              />
            </label>
          </div>
        )}
        {visible.length ? (
          <ul
            className={`mt-5 grid gap-3 ${compact ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}
          >
            {visible.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col rounded-xl border bg-background p-5 transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <time dateTime={item.approvedAt}>
                      {item.approvedAt || '발표일 미확인'}
                    </time>
                    {item.approvedAt === koreanDay(now) && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        오늘 발표
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold leading-relaxed">
                    {item.title}
                  </h3>
                  {item.summary && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.summary}
                    </p>
                  )}
                  <p className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
                    <span>{item.ministry || '대한민국 정책브리핑'}</span>
                    <span className="inline-flex items-center gap-1 text-primary">
                      원문 보기{' '}
                      <ArrowUpRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      <span className="sr-only">(새 창)</span>
                    </span>
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            {snapshot.items.length
              ? '검색 조건에 맞는 소식이 없습니다.'
              : snapshot.health.status === 'ok'
                ? '최근 확인 범위에 해당하는 정책소식이 없습니다.'
                : '정책소식을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          출처:{' '}
          <a
            href="https://www.korea.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            대한민국 정책브리핑
          </a>{' '}
          · 전월세·주거 지원·공공주택·청약 관련 공식 발표
        </p>
      </div>
    </section>
  )
}

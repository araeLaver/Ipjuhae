'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { PageContainer } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { MatchCard, type MatchItem } from '@/components/matches/MatchCard'
import { MatchListRow } from '@/components/matches/MatchList'
import {
  LayoutGrid,
  List,
  Home,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics-client'

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const PAGE_SIZE = 10
const VIEW_MODE_KEY = 'matches:viewMode'

type ViewMode = 'card' | 'list'

interface MatchesResponse {
  matches: MatchItem[]
  total: number
}

// ──────────────────────────────────────────────
// Skeleton loaders
// ──────────────────────────────────────────────
function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-1 pt-1">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-12 w-20" />
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b">
      <Skeleton className="h-4 w-4 rounded" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-32" />
        <div className="flex gap-1">
          <Skeleton className="h-3 w-14 rounded" />
          <Skeleton className="h-3 w-14 rounded" />
        </div>
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  )
}

function SkeletonList({ mode }: { mode: ViewMode }) {
  if (mode === 'card') {
    return (
      <div className="space-y-3">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }
  return (
    <Card>
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <SkeletonListRow key={i} />
      ))}
    </Card>
  )
}

// ──────────────────────────────────────────────
// Pagination controls
// ──────────────────────────────────────────────
interface PaginationProps {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-3 mt-6">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={page === 1}
        aria-label="이전 페이지"
      >
        <ChevronLeft className="h-4 w-4" />
        이전
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={page === totalPages}
        aria-label="다음 페이지"
      >
        다음
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ──────────────────────────────────────────────
// View toggle button group
// ──────────────────────────────────────────────
interface ViewToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-md border bg-muted/40 p-0.5 gap-0.5">
      <button
        onClick={() => onChange('card')}
        aria-label="카드 뷰"
        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
          mode === 'card'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        카드
      </button>
      <button
        onClick={() => onChange('list')}
        aria-label="리스트 뷰"
        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
          mode === 'list'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <List className="h-3.5 w-3.5" />
        리스트
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────
// Main page (inner — wrapped by Suspense)
// ──────────────────────────────────────────────
function MatchesContent() {
  // View mode — read from localStorage with SSR guard
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [data, setData] = useState<MatchesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Hydrate viewMode from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    if (saved === 'card' || saved === 'list') {
      setViewMode(saved)
    }
  }, [])

  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
    trackEvent('match_view_toggle', { mode })
  }, [])

  const loadMatches = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/matches')
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `오류가 발생했습니다 (${res.status})`)
      }
      const json: MatchesResponse = await res.json()
      setData(json)
      setPage(1)
      trackEvent('match_viewed', { total: json.total })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  // Pagination
  const totalItems = data?.matches.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const paginatedItems = data?.matches.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  ) ?? []

  const handlePrev = () => setPage((p) => Math.max(1, p - 1))
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1))

  // ── Render ──
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">매칭 결과</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          예산·지역·입주일·반려동물 기준으로 맞춤 매물을 찾아드립니다.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && <SkeletonList mode={viewMode} />}

      {/* Error state */}
      {!isLoading && error && (
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
          <Button variant="outline" size="sm" onClick={loadMatches}>
            <RefreshCw className="h-4 w-4 mr-2" />
            다시 시도
          </Button>
        </div>
      )}

      {/* Results */}
      {!isLoading && !error && data && (
        <>
          {/* Toolbar: count badge + view toggle */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{data.total}건 매칭</Badge>
              {totalPages > 1 && (
                <span className="text-xs text-muted-foreground">
                  ({page}/{totalPages} 페이지)
                </span>
              )}
            </div>
            {data.matches.length > 0 && (
              <ViewToggle mode={viewMode} onChange={handleViewMode} />
            )}
          </div>

          {/* Empty state */}
          {data.matches.length === 0 ? (
            <EmptyState
              icon={<Home className="h-12 w-12" />}
              title="조건에 맞는 매물이 없습니다"
              description="선호 지역, 예산, 입주 예정일을 조정하면 더 많은 매물을 찾을 수 있어요."
            />
          ) : viewMode === 'card' ? (
            /* Card view */
            <>
              <div className="space-y-3">
                {paginatedItems.map((item, idx) => (
                  <MatchCard
                    key={item.listing.id}
                    item={item}
                    rank={(page - 1) * PAGE_SIZE + idx + 1}
                  />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            </>
          ) : (
            /* List view */
            <>
              <Card className="divide-y overflow-hidden">
                {paginatedItems.map((item, idx) => (
                  <MatchListRow
                    key={item.listing.id}
                    item={item}
                    rank={(page - 1) * PAGE_SIZE + idx + 1}
                    isLast={idx === paginatedItems.length - 1}
                  />
                ))}
              </Card>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Page export — wrapped in Suspense for faster
// perceived render (skeleton shown immediately)
// ──────────────────────────────────────────────
export default function MatchesPage() {
  return (
    <PageContainer>
      <Suspense
        fallback={
          <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="mb-6">
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                      <Skeleton className="h-10 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        }
      >
        <MatchesContent />
      </Suspense>
    </PageContainer>
  )
}

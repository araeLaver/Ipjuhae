'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { TenantCard } from '@/components/landlord/TenantCard'
import { TenantSearchFilters } from '@/components/landlord/TenantSearchFilters'
import { useTenantSearch } from '@/hooks/useTenantSearch'
import { Users, Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Skeleton grid
// ---------------------------------------------------------------------------

function TenantCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-10 flex-shrink-0" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-8 w-full" />
      <div className="flex gap-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex justify-between pt-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TenantGrid() {
  const {
    tenants,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    error,
    filters,
    setFilters,
    resetFilters,
    loadMore,
  } = useTenantSearch(12)

  // Intersection Observer for auto-loadmore (optional, we also have button)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          void loadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  return (
    <div className="flex gap-6">
      {/* Sidebar filters */}
      <aside className="w-60 flex-shrink-0 hidden md:block">
        <TenantSearchFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
      </aside>

      {/* Grid area */}
      <div className="flex-1 min-w-0">
        {/* Result count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading ? '검색 중...' : `총 ${totalCount.toLocaleString()}명`}
          </p>
        </div>

        {/* Mobile filter (inline) */}
        <div className="md:hidden mb-4">
          <TenantSearchFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <TenantCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Results */}
        {!isLoading && tenants.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tenants.map((tenant) => (
                <TenantCard key={tenant.profile_id} tenant={tenant} />
              ))}
            </div>

            {/* Intersection observer sentinel */}
            <div ref={sentinelRef} className="h-4" />

            {/* Load more button */}
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      로딩 중...
                    </>
                  ) : (
                    '더 보기'
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!isLoading && tenants.length === 0 && !error && (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="조건에 맞는 세입자가 없습니다"
            description="필터를 조정하거나 초기화해 보세요"
            action={{ label: '필터 초기화', onClick: resetFilters }}
          />
        )}
      </div>
    </div>
  )
}

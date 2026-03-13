'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout/page-container'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Home, Calendar, Star } from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics-client'

interface MatchListing {
  id: number
  monthly_rent: number
  address: string
  available_from: string | null
  title?: string
  region?: string | null
  deposit?: number
  property_type?: string
}

interface MatchItem {
  listing_id: number
  score: number
  budget_score: number
  region_score: number
  date_score: number
  listing?: MatchListing
}

interface MatchesResponse {
  matches: MatchItem[]
  total: number
}

function formatPrice(amount: number): string {
  if (amount >= 100_000_000) {
    const uk = Math.floor(amount / 100_000_000)
    const man = Math.floor((amount % 100_000_000) / 10_000)
    return man > 0 ? `${uk}억 ${man}만` : `${uk}억`
  }
  if (amount >= 10_000) return `${Math.floor(amount / 10_000)}만`
  return `${amount}`
}

function ScoreBadge({ score }: { score: number }) {
  const colorClass =
    score >= 90
      ? 'bg-green-100 text-green-800 border-green-200'
      : score >= 70
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : 'bg-yellow-100 text-yellow-800 border-yellow-200'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      <Star className="h-3 w-3" />
      {score}점
    </span>
  )
}

function ScoreBreakdown({
  budget_score,
  region_score,
  date_score,
}: {
  budget_score: number
  region_score: number
  date_score: number
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
      <span
        className={`rounded px-1.5 py-0.5 ${budget_score > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
      >
        예산 {budget_score}/40
      </span>
      <span
        className={`rounded px-1.5 py-0.5 ${region_score > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
      >
        지역 {region_score}/40
      </span>
      <span
        className={`rounded px-1.5 py-0.5 ${date_score > 0 ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-500'}`}
      >
        입주일 {date_score}/20
      </span>
    </div>
  )
}

function MatchCard({ item }: { item: MatchItem }) {
  const listing = item.listing
  if (!listing) return null

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">
                {listing.title ?? `매물 #${listing.id}`}
              </h3>
              <ScoreBadge score={item.score} />
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-0.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{listing.address}</span>
            </div>

            {listing.available_from && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-0.5">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  입주가능:{' '}
                  {new Date(listing.available_from).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}

            {listing.property_type && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Home className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{listing.property_type}</span>
              </div>
            )}

            <ScoreBreakdown
              budget_score={item.budget_score}
              region_score={item.region_score}
              date_score={item.date_score}
            />
          </div>

          <div className="text-right flex-shrink-0">
            {listing.deposit !== undefined && listing.deposit > 0 && (
              <p className="text-xs text-muted-foreground">
                보증금 {formatPrice(listing.deposit)}
              </p>
            )}
            <p className="font-bold text-base">
              월 {formatPrice(listing.monthly_rent)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonCard() {
  return (
    <Card>
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
  )
}

export default function MatchesPage() {
  const [data, setData] = useState<MatchesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadMatches() {
      try {
        setIsLoading(true)
        const res = await fetch('/api/matches')
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error ?? `오류가 발생했습니다 (${res.status})`)
        }
        const json: MatchesResponse = await res.json()
        setData(json)
        trackEvent('match_viewed', { total: json.total })
      } catch (err) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
        setError(message)
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }

    loadMatches()
  }, [])

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">매칭 결과</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            예산·지역·입주일 기준으로 맞춤 매물을 찾아드립니다.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="secondary">{data.total}건 매칭</Badge>
            </div>

            {data.matches.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
                <Home className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <p className="font-medium">조건에 맞는 매물이 없습니다</p>
                <p className="text-sm mt-1">선호도 설정을 조정해보세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.matches.map((item) => (
                  <MatchCard key={item.listing_id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}

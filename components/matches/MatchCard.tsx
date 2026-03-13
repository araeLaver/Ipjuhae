'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Calendar, Star, Home, DollarSign } from 'lucide-react'

export interface MatchItem {
  listing: {
    id: number
    monthly_rent: number
    address: string
    available_from: string | null
    deposit?: number
    area_sqm?: number | null
    pet_allowed?: boolean | null
    [key: string]: unknown
  }
  score: number
  breakdown: {
    budget: number
    region: number
    moveIn: number
    pet: number
  }
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

function ScoreBreakdown({ breakdown }: { breakdown: MatchItem['breakdown'] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
      <span
        className={`rounded px-1.5 py-0.5 ${breakdown.budget > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
      >
        예산 {breakdown.budget}/40
      </span>
      <span
        className={`rounded px-1.5 py-0.5 ${breakdown.region > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
      >
        지역 {breakdown.region}/30
      </span>
      <span
        className={`rounded px-1.5 py-0.5 ${breakdown.moveIn > 0 ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-500'}`}
      >
        입주일 {breakdown.moveIn}/20
      </span>
      <span
        className={`rounded px-1.5 py-0.5 ${breakdown.pet > 0 ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-500'}`}
      >
        반려동물 {breakdown.pet}/10
      </span>
    </div>
  )
}

interface MatchCardProps {
  item: MatchItem
  rank: number
}

export function MatchCard({ item, rank }: MatchCardProps) {
  const { listing, score, breakdown } = item

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Title row: rank, name, score badge */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                {rank}
              </span>
              <h3 className="font-semibold text-sm truncate">
                매물 #{listing.id}
              </h3>
              <ScoreBadge score={score} />
            </div>

            {/* Address */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-0.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{listing.address}</span>
            </div>

            {/* Available from */}
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

            {/* Area */}
            {listing.area_sqm != null && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-0.5">
                <Home className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{listing.area_sqm}㎡</span>
              </div>
            )}

            {/* Pet info */}
            {listing.pet_allowed != null && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span className="text-xs">
                  {listing.pet_allowed ? '반려동물 가능' : '반려동물 불가'}
                </span>
              </div>
            )}

            <ScoreBreakdown breakdown={breakdown} />
          </div>

          {/* Price column */}
          <div className="text-right flex-shrink-0">
            {listing.deposit != null && listing.deposit > 0 && (
              <p className="text-xs text-muted-foreground">
                보증금 {formatPrice(listing.deposit)}
              </p>
            )}
            <div className="flex items-center justify-end gap-1">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="font-bold text-base">
                월 {formatPrice(listing.monthly_rent)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { MapPin, Calendar, Star, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchItem } from './MatchCard'

function formatPrice(amount: number): string {
  if (amount >= 100_000_000) {
    const uk = Math.floor(amount / 100_000_000)
    const man = Math.floor((amount % 100_000_000) / 10_000)
    return man > 0 ? `${uk}억 ${man}만` : `${uk}억`
  }
  if (amount >= 10_000) return `${Math.floor(amount / 10_000)}만`
  return `${amount}`
}

function ScoreChip({ score }: { score: number }) {
  const colorClass =
    score >= 90
      ? 'bg-green-100 text-green-700'
      : score >= 70
        ? 'bg-blue-100 text-blue-700'
        : 'bg-yellow-100 text-yellow-700'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
        colorClass,
      )}
    >
      <Star className="h-2.5 w-2.5" />
      {score}
    </span>
  )
}

interface MatchListRowProps {
  item: MatchItem
  rank: number
  isLast: boolean
}

export function MatchListRow({ item, rank, isLast }: MatchListRowProps) {
  const { listing, score, breakdown } = item

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
        !isLast && 'border-b',
      )}
    >
      {/* Rank number */}
      <span className="flex-shrink-0 w-6 text-center text-sm font-medium text-muted-foreground">
        {rank}
      </span>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm truncate">매물 #{listing.id}</span>
          <ScoreChip score={score} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[160px]">{listing.address}</span>
          </span>

          {listing.available_from && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {new Date(listing.available_from).toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>

        {/* Score breakdown micro-chips */}
        <div className="flex flex-wrap gap-1 mt-1">
          <span
            className={cn(
              'text-[10px] rounded px-1 py-0.5',
              breakdown.budget > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400',
            )}
          >
            예산 {breakdown.budget}/40
          </span>
          <span
            className={cn(
              'text-[10px] rounded px-1 py-0.5',
              breakdown.region > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400',
            )}
          >
            지역 {breakdown.region}/30
          </span>
          <span
            className={cn(
              'text-[10px] rounded px-1 py-0.5',
              breakdown.moveIn > 0 ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-400',
            )}
          >
            입주일 {breakdown.moveIn}/20
          </span>
          <span
            className={cn(
              'text-[10px] rounded px-1 py-0.5',
              breakdown.pet > 0 ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-400',
            )}
          >
            반려동물 {breakdown.pet}/10
          </span>
        </div>
      </div>

      {/* Price column */}
      <div className="flex-shrink-0 text-right">
        {listing.deposit != null && listing.deposit > 0 && (
          <p className="text-[10px] text-muted-foreground">
            보증금 {formatPrice(listing.deposit)}
          </p>
        )}
        <div className="flex items-center justify-end gap-0.5">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <p className="font-bold text-sm">{formatPrice(listing.monthly_rent)}</p>
        </div>
      </div>
    </div>
  )
}

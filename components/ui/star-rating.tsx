'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  const displayValue = readonly ? value : (hovered || value)

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={cn(
            'transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          )}
          aria-label={`${star}점`}
        >
          <Star
            className={cn(
              sizeMap[size],
              star <= displayValue
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            )}
          />
        </button>
      ))}
    </div>
  )
}

interface RatingDisplayProps {
  avgRating: number | null
  totalCount: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RatingDisplay({ avgRating, totalCount, size = 'sm', className }: RatingDisplayProps) {
  if (totalCount === 0) {
    return (
      <div className={cn('flex items-center gap-1 text-muted-foreground text-sm', className)}>
        <Star className={cn(sizeMap[size], 'fill-none text-gray-300')} />
        <span>리뷰 없음</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <StarRating value={Math.round(avgRating ?? 0)} readonly size={size} />
      <span className="text-sm font-medium">{avgRating?.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({totalCount})</span>
    </div>
  )
}

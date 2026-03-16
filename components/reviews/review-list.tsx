'use client'

import { useEffect, useState } from 'react'
import { StarRating } from '@/components/ui/star-rating'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Review {
  id: string
  reviewer_id: string
  reviewer_name: string
  rating: number
  comment: string | null
  created_at: string
}

interface ReviewListProps {
  userId: string
}

export function ReviewList({ userId }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/reviews/user/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews || [])
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [userId])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        아직 리뷰가 없습니다
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{review.reviewer_name}</p>
                <StarRating value={review.rating} readonly size="sm" className="mt-1" />
                {review.comment && (
                  <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: ko })}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

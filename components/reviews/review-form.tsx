'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StarRating } from '@/components/ui/star-rating'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ReviewFormProps {
  revieweeId: string
  revieweeName: string
  listingId?: number
  onSuccess?: () => void
  className?: string
}

export function ReviewForm({
  revieweeId,
  revieweeName,
  listingId,
  onSuccess,
  className,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      toast.error('별점을 선택해주세요')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revieweeId,
          listingId,
          rating,
          comment: comment.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast.success('리뷰가 등록되었습니다')
      setRating(0)
      setComment('')
      onSuccess?.()
    } catch (error) {
      toast.error((error as Error).message || '리뷰 등록 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <div>
        <p className="text-sm font-medium mb-2">{revieweeName}님에 대한 별점</p>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <div>
        <Textarea
          placeholder="한줄평을 남겨주세요 (선택, 최대 200자)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={200}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground text-right mt-1">
          {comment.length}/200
        </p>
      </div>

      <Button type="submit" disabled={isSubmitting || rating === 0} className="w-full">
        {isSubmitting ? '등록 중...' : '리뷰 등록'}
      </Button>
    </form>
  )
}

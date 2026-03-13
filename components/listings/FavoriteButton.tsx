'use client'

import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FavoriteButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 flex items-center gap-1.5"
      aria-label="관심 매물 추가"
      onClick={() => {
        // eslint-disable-next-line no-alert
        alert('관심 매물에 추가되었습니다.')
      }}
    >
      <Heart className="h-4 w-4" aria-hidden="true" />
      관심 매물
    </Button>
  )
}

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export function ListingCardSkeleton() {
  return (
    <Card aria-busy="true" aria-label="매물 카드 로딩 중">
      {/* Thumbnail skeleton */}
      <Skeleton className="w-full h-44 rounded-t-xl rounded-b-none" />

      <CardContent className="p-4 space-y-3">
        {/* Badge + region */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 w-10" />
        </div>

        {/* Address */}
        <Skeleton className="h-4 w-3/4" />

        {/* Price */}
        <div className="space-y-1">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Area / date */}
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  )
}

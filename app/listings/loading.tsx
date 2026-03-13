import { ListingCardSkeleton } from '@/components/listings/ListingCardSkeleton'
import { PageContainer } from '@/components/layout/page-container'

export default function ListingsLoading() {
  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <div>
          <div className="h-8 w-32 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded-md mt-2" />
        </div>

        <div className="h-4 w-16 bg-muted animate-pulse rounded-md" />

        <ul
          className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          aria-label="매물 목록 로딩 중"
          aria-busy="true"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <ListingCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </PageContainer>
  )
}

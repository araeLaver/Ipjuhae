import { mockListings } from '@/lib/mock-listings'
import { ListingCard } from '@/components/listings/ListingCard'
import { PageContainer } from '@/components/layout/page-container'
import { Building } from 'lucide-react'

async function getListings() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/listings`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    const listings = data.listings as typeof mockListings
    // If DB is empty, show seeded dummy listings
    if (listings.length === 0) return mockListings.slice(0, 5)
    return listings
  } catch {
    // Fallback to mock data when API is unavailable
    return mockListings.slice(0, 5)
  }
}

export const metadata = {
  title: '매물 리스트 | 입주해',
  description: '임주해에서 다양한 전세/월세 매물을 카드형으로 확인하세요. 세입자 프로필 기반 매칭으로 원하는 집을 빠르게 찾아보세요.',
  openGraph: {
    title: '매물 리스트 | 임주해',
    description: '임주해에서 다양한 전세/월세 매물을 카드형으로 확인하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 매물 리스트' }],
  },
}

export default async function ListingsPage() {
  const listings = await getListings()

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">매물 찾기</h1>
          <p className="text-muted-foreground">원하는 조건의 매물을 카드로 확인하세요</p>
        </div>

        {/* Count */}
        <p className="text-sm text-muted-foreground">{listings.length}개 매물</p>

        {/* Grid */}
        {listings.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3"
            role="status"
            aria-label="매물 없음"
          >
            <Building className="h-12 w-12" aria-hidden="true" />
            <p className="text-lg font-medium">매물이 없습니다</p>
            <p className="text-sm">조건을 변경하거나 나중에 다시 확인해보세요</p>
          </div>
        ) : (
          <ul
            className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            aria-label="매물 목록"
          >
            {listings.map((listing) => (
              <li key={listing.id}>
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  )
}

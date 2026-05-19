import { mockListings } from '@/lib/mock-listings'
import { ListingSearch } from '@/components/listings/ListingSearch'
import { PageContainer } from '@/components/layout/page-container'

async function getListings() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/listings`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
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
      <div className="space-y-8">
        <div className="rounded-lg bg-background p-6 shadow-soft">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-semibold text-primary">Rentme Search</p>
            <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">매물 찾기</h1>
            <p className="text-muted-foreground">
              세입자 프로필과 생활 조건을 기준으로 지역, 예산, 이동 동선에 맞는 매물을 비교하세요.
            </p>
          </div>
        </div>
        <ListingSearch listings={listings} />
      </div>
    </PageContainer>
  )
}

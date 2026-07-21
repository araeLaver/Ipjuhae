import { ListingSearch } from '@/components/listings/ListingSearch'
import { PageContainer } from '@/components/layout/page-container'
import type { Listing } from '@/lib/schemas/listing'

async function getListings() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/listings`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { listings?: Listing[] }
    return data.listings ?? []
  } catch {
    return []
  }
}

export const metadata = {
  title: 'Listing search | Rentme',
  description: 'Search real, live listings by region and budget.',
  openGraph: {
    title: 'Listing search | Rentme',
    description: 'Search real, live listings by region and budget.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Rentme listing list' }],
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
            <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Listing Search</h1>
            <p className="text-muted-foreground">
              Browse real listings and compare by region, budget, and conditions.
            </p>
          </div>
        </div>
        <ListingSearch listings={listings} />
      </div>
    </PageContainer>
  )
}

import { notFound } from 'next/navigation'
import { mockListings } from '@/lib/mock-listings'
import { ListingGallery } from '@/components/listings/ListingGallery'
import { FavoriteButton } from '@/components/listings/FavoriteButton'
import { ListingViewTracker } from '@/components/listings/ListingViewTracker'
import { PageContainer } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { MapPin, Layers, Maximize2, CalendarDays } from 'lucide-react'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: '아파트',
  villa: '빌라',
  officetel: '오피스텔',
  oneroom: '원룸',
  house: '주택',
  other: '기타',
}

async function getListing(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/listings/${id}`, {
      next: { revalidate: 60 },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    return data.listing as (typeof mockListings)[number]
  } catch {
    // Fallback to mock data
    const numId = parseInt(id, 10)
    return mockListings.find((l) => l.id === numId) ?? null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await getListing(id)
  if (!listing) return { title: '매물을 찾을 수 없습니다 | 입주해' }
  return {
    title: `${listing.address} | 입주해`,
    description: listing.description ?? `${listing.address} 매물 상세 정보`,
  }
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const listing = await getListing(id)

  if (!listing) {
    notFound()
  }

  return (
    <PageContainer maxWidth="lg">
      <ListingViewTracker listingId={id} />
      <div className="space-y-6">
        {/* Gallery */}
        <ListingGallery photoUrls={listing.photo_urls} address={listing.address} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {PROPERTY_TYPE_LABELS[listing.property_type] ?? listing.property_type}
              </Badge>
              <Badge variant="outline">{listing.region}</Badge>
            </div>
            <h1 className="text-xl font-bold leading-snug">{listing.address}</h1>
          </div>

          {/* 관심 매물 추가 button — UI only */}
          <FavoriteButton />
        </div>

        {/* Price Section */}
        <section aria-labelledby="price-heading" className="bg-muted/40 rounded-xl p-5 space-y-2">
          <h2 id="price-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            가격 정보
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <p className="text-xs text-muted-foreground">보증금</p>
              <p className="text-2xl font-bold text-primary">{listing.deposit}만원</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">월세</p>
              <p className="text-2xl font-bold">{listing.monthly_rent}만원</p>
            </div>
          </div>
        </section>

        {/* Details */}
        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            매물 정보
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                주소
              </dt>
              <dd className="text-sm font-medium">{listing.address}</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                면적
              </dt>
              <dd className="text-sm font-medium">{listing.area_sqm}㎡</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                층수
              </dt>
              <dd className="text-sm font-medium">{listing.floor}층</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                입주 가능일
              </dt>
              <dd className="text-sm font-medium">{listing.available_from}</dd>
            </div>
          </dl>
        </section>

        {/* Description */}
        {listing.description && (
          <section aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              상세 설명
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-line">{listing.description}</p>
          </section>
        )}
      </div>
    </PageContainer>
  )
}

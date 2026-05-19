import { notFound } from 'next/navigation'
import { mockListings } from '@/lib/mock-listings'
import { ListingGallery } from '@/components/listings/ListingGallery'
import { FavoriteButton } from '@/components/listings/FavoriteButton'
import { ListingViewTracker } from '@/components/listings/ListingViewTracker'
import { PageContainer } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, CheckCircle2, Layers, MapPin, Maximize2, MessageCircle, TrainFront } from 'lucide-react'

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
  const desc = listing.description ?? `${listing.address} 매물 상세 정보`
  return {
    title: `${listing.address} | 입주해`,
    description: desc,
    openGraph: {
      title: `${listing.address} | 임주해`,
      description: desc,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${listing.address} 매물` }],
    },
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

  const tags = listing.tags ?? []
  const matchScore = listing.match_score ?? 87
  const nearestStation = listing.nearest_station ?? listing.region
  const commuteNote = listing.commute_note ?? '생활권 확인'

  return (
    <PageContainer maxWidth="lg">
      <ListingViewTracker listingId={id} />
      <div className="space-y-6">
        {/* Gallery */}
        <ListingGallery photoUrls={listing.photo_urls} address={listing.address} />

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {PROPERTY_TYPE_LABELS[listing.property_type] ?? listing.property_type}
              </Badge>
              <Badge variant="outline">{listing.region}</Badge>
              <Badge className="bg-primary text-primary-foreground">{matchScore}% 추천</Badge>
            </div>
            <h1 className="text-xl font-bold leading-snug">{listing.address}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrainFront className="h-4 w-4" aria-hidden="true" />
              {nearestStation} · {commuteNote}
            </p>
          </div>

          <div className="flex gap-2">
            <FavoriteButton />
            <Button>
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              문의하기
            </Button>
          </div>
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
          <div className="flex flex-wrap gap-2 pt-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-sm bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {tag}
              </span>
            ))}
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
              <dt className="text-xs text-muted-foreground">방 / 욕실</dt>
              <dd className="text-sm font-medium">
                방 {listing.bedrooms ?? 1} · 욕실 {listing.bathrooms ?? 1}
              </dd>
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

        <section aria-labelledby="match-heading" className="rounded-lg border bg-background p-5 shadow-soft">
          <h2 id="match-heading" className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            추천 근거
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              '예산 조건과 월세 구간이 잘 맞습니다',
              `${nearestStation} 중심 생활 동선이 편리합니다`,
              `${tags[0] ?? '입주 조건'}을 선호하는 세입자에게 적합합니다`,
            ].map((reason) => (
              <div key={reason} className="flex gap-2 rounded-md bg-muted/50 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
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

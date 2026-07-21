import { notFound } from 'next/navigation'
import { ListingGallery } from '@/components/listings/ListingGallery'
import { FavoriteButton } from '@/components/listings/FavoriteButton'
import { ListingViewTracker } from '@/components/listings/ListingViewTracker'
import { PageContainer } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, CheckCircle2, Layers, MapPin, Maximize2, MessageCircle, TrainFront } from 'lucide-react'
import type { Listing } from '@/lib/schemas/listing'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  villa: 'Villa',
  officetel: 'Officetel',
  oneroom: 'One-room',
  house: 'House',
  other: 'Other',
}

type ListingForDetail = Listing & {
  property_type?: string | null
  region?: string | null
  nearest_station?: string | null
  commute_note?: string | null
  tags?: string[] | null
  match_score?: number | null
  description?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
}

const NO_REGION_TEXT = 'Region not set'

function deriveRegion(address: string) {
  const parts = address.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return NO_REGION_TEXT
  if (parts.length === 1) return parts[0]
  if (parts[0] === '서울시') return parts[1] ?? NO_REGION_TEXT
  return parts[0] ?? NO_REGION_TEXT
}

async function getListing(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/listings/${id}`, {
      next: { revalidate: 60 },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error('API error')

    const data = (await res.json()) as { listing?: ListingForDetail | null }
    return data.listing ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await getListing(id)
  if (!listing) return { title: 'Listing not found | Rentme' }
  const desc = listing.description ?? `${listing.address} detail`
  return {
    title: `${listing.address} | Rentme`,
    description: desc,
    openGraph: {
      title: `${listing.address} | Rentme`,
      description: desc,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${listing.address} listing` }],
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
  const matchScore = listing.match_score ?? null
  const propertyType = listing.property_type ?? 'other'
  const region = listing.region ?? deriveRegion(listing.address)
  const nearestStation = listing.nearest_station ?? region
  const commuteNote = listing.commute_note ?? 'Please check transport details'
  const bedrooms = listing.bedrooms ?? 1
  const bathrooms = listing.bathrooms ?? 1

  const matchReasons = matchScore
    ? [
        `This listing matches transport and move-in preferences well.`,
        `${nearestStation} is the base area and meets the recommended access condition.`,
        `${listing.area_sqm ?? 0}㎡ matches the selected area condition.`,
      ]
    : ['Matching details are being prepared.', 'Fallback by price and basic requirements.']

  return (
    <PageContainer maxWidth="lg">
      <ListingViewTracker listingId={id} />
      <div className="space-y-6">
        <ListingGallery photoUrls={listing.photo_urls} address={listing.address} />

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {PROPERTY_TYPE_LABELS[propertyType] ?? propertyType}
              </Badge>
              <Badge variant="outline">{region}</Badge>
              {matchScore !== null && <Badge className="bg-primary text-primary-foreground">{matchScore}% Match</Badge>}
            </div>
            <h1 className="text-xl font-bold leading-snug">{listing.address}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrainFront className="h-4 w-4" aria-hidden="true" />
              {nearestStation} 기준 {commuteNote}
            </p>
          </div>

          <div className="flex gap-2">
            <FavoriteButton />
            <Button>
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Contact
            </Button>
          </div>
        </div>

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

        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            매물 상세
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
                침실 {bedrooms}개, 욕실 {bathrooms}개
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                입주일
              </dt>
              <dd className="text-sm font-medium">{listing.available_from ?? '협의'}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="match-heading" className="rounded-lg border bg-background p-5 shadow-soft">
          <h2 id="match-heading" className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            매칭 근거
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {matchReasons.map((reason) => (
              <div key={reason} className="flex gap-2 rounded-md bg-muted/50 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </section>

        {listing.description && (
          <section aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              매물 소개
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-line">{listing.description}</p>
          </section>
        )}
      </div>
    </PageContainer>
  )
}

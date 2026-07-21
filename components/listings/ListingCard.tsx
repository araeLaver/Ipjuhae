import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Home, TrainFront, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Listing } from '@/lib/schemas/listing'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  villa: 'Villa',
  officetel: 'Officetel',
  oneroom: 'One-room',
  house: 'House',
  other: 'Other',
}

type ListingForCard = Listing & {
  property_type?: string | null
  region?: string | null
  nearest_station?: string | null
  commute_note?: string | null
  tags?: string[] | null
  match_score?: number | null
}

const NO_REGION_TEXT = 'Region not set'
const NO_LOCATION_TEXT = 'Address not set'
const NO_MATCH_TEXT = 'Matching data in preparation'

function formatRent(amount: number): string {
  if (amount >= 10000) return `${Math.floor(amount / 10000)}억 ${amount % 10000}만원`
  return `${amount}만원`
}

function deriveRegion(address: string) {
  const parts = address.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return NO_REGION_TEXT
  if (parts.length === 1) return parts[0]
  if (parts[0] === '서울시') return parts[1] ?? NO_REGION_TEXT
  return parts[0] ?? NO_REGION_TEXT
}

interface ListingCardProps {
  listing: ListingForCard
}

export function ListingCard({ listing }: ListingCardProps) {
  const regionLabel = listing.region ?? deriveRegion(listing.address)
  const mainPhoto = listing.photo_urls[0] ?? null
  const tags = listing.tags ?? []
  const propertyType = listing.property_type ?? 'other'
  const nearestStation = listing.nearest_station ?? regionLabel
  const commuteNote = listing.commute_note ?? 'Please check transport details'
  const showMatchScore = typeof listing.match_score === 'number'
  const matchText = showMatchScore ? `${listing.match_score}% Match` : NO_MATCH_TEXT

  return (
    <Link
      href={`/listings/${listing.id}`}
      aria-label={`${listing.address} listing detail`}
    >
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full group">
        <div className="relative w-full h-44 bg-muted rounded-t-xl overflow-hidden">
          {mainPhoto ? (
            <Image
              src={mainPhoto}
              alt={`${listing.address} listing image`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              aria-label="No listing image"
            >
              <Home className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <div className="absolute left-3 top-3 rounded-md bg-background/90 px-2 py-1 text-xs font-semibold shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-accent inline-block mr-1" aria-hidden="true" />
            {matchText}
          </div>
        </div>

        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {PROPERTY_TYPE_LABELS[propertyType] ?? propertyType}
            </Badge>
            <span className="text-xs text-muted-foreground">{regionLabel}</span>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1">
            <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {listing.address || NO_LOCATION_TEXT}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1">
            <TrainFront className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {nearestStation} around {commuteNote}
          </p>

          <div>
            <p className="font-bold text-primary">Deposit {formatRent(listing.deposit)}</p>
            <p className="text-sm text-muted-foreground">Monthly {listing.monthly_rent}만원</p>
          </div>

          <div className="flex flex-wrap gap-1 pt-1">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              {listing.area_sqm}㎡
              {listing.floor != null && ` · ${listing.floor}층`}
            </span>
            <span>Move-in: {listing.available_from ?? 'Ask'}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Home } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { MockListing } from '@/lib/mock-listings'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: '아파트',
  villa: '빌라',
  officetel: '오피스텔',
  oneroom: '원룸',
  house: '주택',
  other: '기타',
}

function formatRent(amount: number): string {
  if (amount >= 10000) return `${Math.floor(amount / 10000)}억`
  return `${amount}만`
}

interface ListingCardProps {
  listing: MockListing
}

export function ListingCard({ listing }: ListingCardProps) {
  const regionLabel = listing.address.split(' ').slice(0, 2).join(' ')
  const mainPhoto = listing.photo_urls[0] ?? null

  return (
    <Link
      href={`/listings/${listing.id}`}
      aria-label={`${listing.address} 매물 상세 보기`}
    >
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full group">
        {/* Thumbnail */}
        <div className="relative w-full h-44 bg-muted rounded-t-xl overflow-hidden">
          {mainPhoto ? (
            <Image
              src={mainPhoto}
              alt={`${listing.address} 매물 사진`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              aria-label="매물 사진 없음"
            >
              <Home className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {PROPERTY_TYPE_LABELS[listing.property_type] ?? listing.property_type}
            </Badge>
            <span className="text-xs text-muted-foreground">{listing.region}</span>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1">
            <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {regionLabel}
          </p>

          <div>
            <p className="font-bold text-primary">
              보증금 {formatRent(listing.deposit)}
            </p>
            <p className="text-sm text-muted-foreground">
              월세 {listing.monthly_rent}만
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              {listing.area_sqm}㎡
              {listing.floor && ` · ${listing.floor}층`}
            </span>
            <span>입주 {listing.available_from}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

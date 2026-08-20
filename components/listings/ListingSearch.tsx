'use client'

import { useMemo, useState } from 'react'
import { Building, Search, SlidersHorizontal } from 'lucide-react'
import { ListingCard } from '@/components/listings/ListingCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Listing } from '@/lib/schemas/listing'

type ListingForSearch = Listing & {
  property_type?: string | null
  region?: string | null
  nearest_station?: string | null
  commute_note?: string | null
  tags?: string[] | null
  match_score?: number | null
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: '아파트',
  villa: '빌라',
  officetel: '오피스텔',
  oneroom: '원룸',
  house: '주택',
  other: '기타',
}

const ALL_FILTER_VALUE = 'all'
const NO_REGION_LABEL = '전체'
const NO_REGION_TEXT = '지역 미정'
const DEFAULT_MATCH_SCORE = 0

const sortOptions = [
  { value: 'recommended', label: '추천순' },
  { value: 'rent-low', label: '월세 낮은순' },
  { value: 'deposit-low', label: '보증금 낮은순' },
  { value: 'area-large', label: '면적 넓은순' },
]

function deriveRegionFromAddress(address: string): string {
  const parts = address.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return NO_REGION_TEXT
  if (parts.length === 1) return parts[0]
  if (parts[0] === '서울시') return parts[1] ?? NO_REGION_TEXT
  return parts[0] ?? NO_REGION_TEXT
}

function normalizePropertyType(listing: ListingForSearch) {
  return listing.property_type ?? 'other'
}

function listingRegion(listing: ListingForSearch) {
  return listing.region ?? deriveRegionFromAddress(listing.address)
}

function listingMatchScore(listing: ListingForSearch) {
  return listing.match_score ?? DEFAULT_MATCH_SCORE
}

function searchableText(listing: ListingForSearch) {
  return [listing.address, listingRegion(listing), listing.nearest_station, ...(listing.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

interface ListingSearchProps {
  listings: ListingForSearch[]
  compact?: boolean
}

export function ListingSearch({ listings, compact = false }: ListingSearchProps) {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState(ALL_FILTER_VALUE)
  const [propertyType, setPropertyType] = useState(ALL_FILTER_VALUE)
  const [maxRent, setMaxRent] = useState('all')
  const [sort, setSort] = useState('recommended')

  const regionOptions = useMemo(() => {
    const values = new Set<string>([NO_REGION_LABEL])
    listings.forEach((listing) => values.add(listingRegion(listing)))
    return [{ value: ALL_FILTER_VALUE, label: NO_REGION_LABEL }, ...Array.from(values).sort().map((value) => ({
      value,
      label: value,
    }))]
  }, [listings])

  const propertyTypeOptions = useMemo(() => {
    const values = new Set<string>(['other'])
    listings.forEach((listing) => values.add(normalizePropertyType(listing)))
    return [
      { value: ALL_FILTER_VALUE, label: NO_REGION_LABEL },
      ...Array.from(values).sort().map((value) => ({
        value,
        label: PROPERTY_TYPE_LABELS[value] ?? value,
      })),
    ]
  }, [listings])

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const result = listings.filter((listing) => {
      const queryMatch = !normalizedQuery || searchableText(listing).includes(normalizedQuery)
      const regionMatch = region === ALL_FILTER_VALUE || listingRegion(listing) === region
      const typeMatch = propertyType === ALL_FILTER_VALUE || normalizePropertyType(listing) === propertyType
      const rentMatch = maxRent === ALL_FILTER_VALUE || listing.monthly_rent <= Number(maxRent)

      return queryMatch && regionMatch && typeMatch && rentMatch
    })

    return [...result].sort((a, b) => {
      if (sort === 'rent-low') return a.monthly_rent - b.monthly_rent
      if (sort === 'deposit-low') return a.deposit - b.deposit
      if (sort === 'area-large') return (b.area_sqm ?? 0) - (a.area_sqm ?? 0)
      if (sort === 'recommended') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      return listingMatchScore(b) - listingMatchScore(a)
    })
  }, [listings, maxRent, propertyType, query, region, sort])

  const resetFilters = () => {
    setQuery('')
    setRegion(ALL_FILTER_VALUE)
    setPropertyType(ALL_FILTER_VALUE)
    setMaxRent(ALL_FILTER_VALUE)
    setSort('recommended')
  }

  return (
    <section className="space-y-5" aria-labelledby="listing-search-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="listing-search-heading" className={compact ? 'text-xl font-bold' : 'text-2xl font-bold'}>
            매물 검색
          </h2>
          <p className="text-sm text-muted-foreground">주소와 필터로 검색하세요.</p>
        </div>
        <p className="text-sm font-medium text-muted-foreground">매물 {filteredListings.length}개</p>
      </div>

      <div className="rounded-lg border bg-background p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="listing-query">검색</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="listing-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="주소, 지역, 키워드"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>지역</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regionOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>유형</Label>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {propertyTypeOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>최대 월세</Label>
            <Select value={maxRent} onValueChange={setMaxRent}>
              <SelectTrigger>
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="60">60만원</SelectItem>
                <SelectItem value="80">80만원</SelectItem>
                <SelectItem value="100">100만원</SelectItem>
                <SelectItem value="130">130만원</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>정렬</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="button" variant="outline" onClick={resetFilters} className="md:w-10 md:px-0" aria-label="필터 초기화">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="ml-2 md:hidden">초기화</span>
          </Button>
        </div>
      </div>

      {filteredListings.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background py-16 text-muted-foreground"
          role="status"
          aria-label="매물 없음"
        >
          <Building className="h-12 w-12" aria-hidden="true" />
          <p className="text-lg font-medium text-foreground">조건에 맞는 매물이 없습니다.</p>
          <Button type="button" variant="outline" onClick={resetFilters}>
            초기화
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="매물 목록">
          {filteredListings.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

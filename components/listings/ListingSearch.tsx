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
import type { MockListing } from '@/lib/mock-listings'

const regions = ['전체', '서울', '경기', '인천']
const propertyTypes = [
  { value: 'all', label: '전체 유형' },
  { value: 'oneroom', label: '원룸' },
  { value: 'officetel', label: '오피스텔' },
  { value: 'villa', label: '빌라' },
  { value: 'apartment', label: '아파트' },
]
const sortOptions = [
  { value: 'recommended', label: '추천순' },
  { value: 'rent-low', label: '월세 낮은순' },
  { value: 'deposit-low', label: '보증금 낮은순' },
  { value: 'area-large', label: '면적 넓은순' },
]

interface ListingSearchProps {
  listings: MockListing[]
  compact?: boolean
}

export function ListingSearch({ listings, compact = false }: ListingSearchProps) {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('전체')
  const [propertyType, setPropertyType] = useState('all')
  const [maxRent, setMaxRent] = useState('all')
  const [sort, setSort] = useState('recommended')

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const result = listings.filter((listing) => {
      const queryMatch =
        !normalizedQuery ||
        [listing.address, listing.region, listing.nearest_station, ...(listing.tags ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      const regionMatch = region === '전체' || listing.region === region
      const typeMatch = propertyType === 'all' || listing.property_type === propertyType
      const rentMatch = maxRent === 'all' || listing.monthly_rent <= Number(maxRent)
      return queryMatch && regionMatch && typeMatch && rentMatch
    })

    return [...result].sort((a, b) => {
      if (sort === 'rent-low') return a.monthly_rent - b.monthly_rent
      if (sort === 'deposit-low') return a.deposit - b.deposit
      if (sort === 'area-large') return b.area_sqm - a.area_sqm
      return (b.match_score ?? 0) - (a.match_score ?? 0)
    })
  }, [listings, maxRent, propertyType, query, region, sort])

  const resetFilters = () => {
    setQuery('')
    setRegion('전체')
    setPropertyType('all')
    setMaxRent('all')
    setSort('recommended')
  }

  return (
    <section className="space-y-5" aria-labelledby="listing-search-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="listing-search-heading" className={compact ? 'text-xl font-bold' : 'text-2xl font-bold'}>
            추천 매물
          </h2>
          <p className="text-sm text-muted-foreground">
            지역, 예산, 생활 동선에 맞는 매물을 빠르게 좁혀보세요.
          </p>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{filteredListings.length}개 매물</p>
      </div>

      <div className="rounded-lg border bg-background p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="listing-query">검색어</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="listing-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="동네, 지하철역, 특징"
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
                {regions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
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
                {propertyTypes.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>월세</Label>
            <Select value={maxRent} onValueChange={setMaxRent}>
              <SelectTrigger>
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="60">60만원 이하</SelectItem>
                <SelectItem value="80">80만원 이하</SelectItem>
                <SelectItem value="100">100만원 이하</SelectItem>
                <SelectItem value="130">130만원 이하</SelectItem>
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
          <p className="text-lg font-medium text-foreground">조건에 맞는 매물이 없습니다</p>
          <Button type="button" variant="outline" onClick={resetFilters}>
            필터 초기화
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

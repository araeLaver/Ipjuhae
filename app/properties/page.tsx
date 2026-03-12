'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer } from '@/components/layout/page-container'
import { Building, MapPin, Home, Search, SlidersHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'

interface Property {
  id: string
  title: string
  address: string
  region: string | null
  deposit: number
  monthlyRent: number
  maintenanceFee: number
  propertyType: string
  roomCount: number
  floor: number | null
  areaSqm: number | null
  options: string[]
  availableFrom: string | null
  viewCount: number
  createdAt: string
  mainImageUrl: string | null
  landlordName: string | null
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: '아파트',
  villa: '빌라',
  officetel: '오피스텔',
  oneroom: '원룸',
  house: '주택',
  other: '기타',
}

const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

function formatPrice(amount: number): string {
  if (amount >= 100000000) {
    const uk = Math.floor(amount / 100000000)
    const man = Math.floor((amount % 100000000) / 10000)
    return man > 0 ? `${uk}억 ${man}만` : `${uk}억`
  }
  if (amount >= 10000) return `${Math.floor(amount / 10000)}만`
  return `${amount}`
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [sort, setSort] = useState('created_at')

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (region) params.set('region', region)
      if (propertyType) params.set('type', propertyType)
      params.set('sort', sort)
      if (cursor) params.set('cursor', cursor)
      return `/api/properties?${params.toString()}`
    },
    [q, region, propertyType, sort]
  )

  const fetchProperties = useCallback(
    async (cursor?: string) => {
      if (!cursor) setIsLoading(true)
      else setIsLoadingMore(true)

      try {
        const res = await fetch(buildQuery(cursor))
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        if (cursor) {
          setProperties(prev => [...prev, ...data.properties])
        } else {
          setProperties(data.properties)
        }
        setNextCursor(data.nextCursor)
        setHasMore(data.hasMore)
      } catch (err) {
        toast.error((err as Error).message)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [buildQuery]
  )

  // Re-fetch when filters change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchProperties()
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fetchProperties])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && nextCursor) {
          fetchProperties(nextCursor)
        }
      },
      { threshold: 0.5 }
    )
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, isLoadingMore, nextCursor, fetchProperties])

  const resetFilters = () => {
    setQ('')
    setRegion('')
    setPropertyType('')
    setSort('created_at')
  }

  const hasActiveFilters = q || region || propertyType

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">매물 찾기</h1>
          <p className="text-muted-foreground">원하는 조건의 매물을 찾아보세요</p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="지역명, 건물명으로 검색"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">지역</label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">전체</SelectItem>
                      {REGIONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">유형</label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">전체</SelectItem>
                      {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">정렬</label>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">최신순</SelectItem>
                      <SelectItem value="deposit">보증금순</SelectItem>
                      <SelectItem value="monthly_rent">월세순</SelectItem>
                      <SelectItem value="view_count">조회순</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={resetFilters}>
                  <X className="h-3 w-3 mr-1" />
                  필터 초기화
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* List */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <EmptyState
            icon={<Building className="h-12 w-12" />}
            title="매물이 없습니다"
            description="조건을 변경하거나 나중에 다시 확인해보세요"
            action={hasActiveFilters ? { label: '필터 초기화', onClick: resetFilters } : undefined}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{properties.length}개 매물</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map(property => (
                <Link key={property.id} href={`/properties/${property.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    {/* Image */}
                    <div className="w-full h-44 bg-muted rounded-t-xl overflow-hidden">
                      {property.mainImageUrl ? (
                        <img
                          src={property.mainImageUrl}
                          alt={property.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {PROPERTY_TYPE_LABELS[property.propertyType] || property.propertyType}
                        </Badge>
                        {property.region && (
                          <span className="text-xs text-muted-foreground">{property.region}</span>
                        )}
                      </div>
                      <h3 className="font-semibold line-clamp-1">{property.title}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {property.address}
                      </p>
                      <div>
                        <p className="font-bold text-primary">
                          보증금 {formatPrice(property.deposit)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          월세 {formatPrice(property.monthlyRent)}
                          {property.maintenanceFee > 0 && ` + 관리비 ${formatPrice(property.maintenanceFee)}`}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>
                          {property.areaSqm && `${property.areaSqm}㎡`}
                          {property.floor && ` · ${property.floor}층`}
                        </span>
                        <span>조회 {property.viewCount.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
              {isLoadingMore && <Skeleton className="h-4 w-24" />}
            </div>
          </>
        )}
      </div>
    </PageContainer>
  )
}

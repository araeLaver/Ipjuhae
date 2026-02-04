'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer } from '@/components/layout/page-container'
import { Building, Plus, MapPin, Home, ChevronRight } from 'lucide-react'
import { Property } from '@/types/database'
import { toast } from 'sonner'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: '아파트',
  villa: '빌라',
  officetel: '오피스텔',
  oneroom: '원룸',
  house: '주택',
  other: '기타',
}

const STATUS_LABELS: Record<string, string> = {
  available: '공실',
  reserved: '예약중',
  rented: '계약완료',
  hidden: '비공개',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  available: 'default',
  reserved: 'secondary',
  rented: 'outline',
  hidden: 'outline',
}

interface PropertyWithImage extends Property {
  main_image_url?: string
}

export default function PropertiesPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<PropertyWithImage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/landlord/properties')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        if (response.status === 403) {
          router.push('/landlord/onboarding')
          return
        }
        throw new Error(data.error)
      }

      setProperties(data.properties)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (amount: number) => {
    if (amount >= 100000000) {
      const uk = Math.floor(amount / 100000000)
      const man = Math.floor((amount % 100000000) / 10000)
      return man > 0 ? `${uk}억 ${man}만` : `${uk}억`
    }
    if (amount >= 10000) {
      return `${Math.floor(amount / 10000)}만`
    }
    return `${amount}`
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">내 매물</h1>
          <Link href="/landlord/properties/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              매물 등록
            </Button>
          </Link>
        </div>

        {properties.length === 0 ? (
          <EmptyState
            icon={<Building className="h-12 w-12" />}
            title="등록된 매물이 없습니다"
            description="매물을 등록하고 좋은 세입자를 찾아보세요"
            action={{
              label: '매물 등록하기',
              onClick: () => router.push('/landlord/properties/new'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {properties.map(property => (
              <Link key={property.id} href={`/landlord/properties/${property.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* 이미지 */}
                      <div className="w-24 h-24 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                        {property.main_image_url ? (
                          <img
                            src={property.main_image_url}
                            alt={property.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Home className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={STATUS_VARIANTS[property.status]}>
                                {STATUS_LABELS[property.status]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {PROPERTY_TYPE_LABELS[property.property_type]}
                              </span>
                            </div>
                            <h3 className="font-semibold truncate">{property.title}</h3>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>

                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {property.address}
                        </p>

                        <p className="font-semibold text-primary mt-2">
                          보증금 {formatPrice(property.deposit)} / 월세 {formatPrice(property.monthly_rent)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

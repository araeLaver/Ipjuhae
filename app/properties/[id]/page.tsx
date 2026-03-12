'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'
import {
  ArrowLeft, MapPin, Home, Eye, MessageSquare,
  ChevronLeft, ChevronRight, CheckCircle2, User,
} from 'lucide-react'
import { toast } from 'sonner'

interface PropertyDetail {
  id: string
  landlordId: string
  title: string
  description: string | null
  address: string
  addressDetail: string | null
  region: string | null
  deposit: number
  monthlyRent: number
  maintenanceFee: number
  propertyType: string
  roomCount: number
  bathroomCount: number
  floor: number | null
  totalFloor: number | null
  areaSqm: number | null
  options: string[]
  status: string
  availableFrom: string | null
  viewCount: number
  createdAt: string
  landlord: {
    name: string | null
    bio: string | null
    profileImage: string | null
  }
}

interface PropertyImage {
  id: string
  imageUrl: string
  thumbnailUrl: string | null
  sortOrder: number
  isMain: boolean
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: '아파트', villa: '빌라', officetel: '오피스텔',
  oneroom: '원룸', house: '주택', other: '기타',
}

function formatPrice(amount: number): string {
  if (amount >= 100000000) {
    const uk = Math.floor(amount / 100000000)
    const man = Math.floor((amount % 100000000) / 10000)
    return man > 0 ? `${uk}억 ${man}만` : `${uk}억`
  }
  if (amount >= 10000) return `${Math.floor(amount / 10000)}만`
  return `${amount}`
}

export default function PropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params.id as string

  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [images, setImages] = useState<PropertyImage[]>([])
  const [isFavorited, setIsFavorited] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)

  useEffect(() => {
    fetchProperty()
  }, [propertyId])

  const fetchProperty = async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('매물을 찾을 수 없습니다')
          router.push('/properties')
          return
        }
        throw new Error(data.error)
      }
      setProperty(data.property)
      setImages(data.images)
      setIsFavorited(data.isFavorited)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleContactLandlord = async () => {
    if (!property) return
    setIsSendingMessage(true)
    try {
      // Create or find conversation with landlord
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: property.landlordId,
          content: `안녕하세요! "${property.title}" 매물에 관심이 있어서 연락드립니다.`,
          propertyId: property.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          toast.error('로그인이 필요합니다')
          router.push('/login')
          return
        }
        throw new Error(data.error)
      }
      toast.success('메시지를 보냈습니다')
      if (data.conversationId) {
        router.push(`/messages/${data.conversationId}`)
      } else {
        router.push('/messages')
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsSendingMessage(false)
    }
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="lg">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (!property) return null

  const currentImage = images[imgIndex]

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-4">
        {/* Back */}
        <Link href="/properties">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
        </Link>

        {/* Image Gallery */}
        <div className="relative w-full h-72 sm:h-96 bg-muted rounded-xl overflow-hidden">
          {images.length > 0 && currentImage ? (
            <>
              <img
                src={currentImage.imageUrl}
                alt={property.title}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <button
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 rounded-full text-white hover:bg-black/60 transition"
                    onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 rounded-full text-white hover:bg-black/60 transition"
                    onClick={() => setImgIndex(i => (i + 1) % images.length)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        className={`w-2 h-2 rounded-full transition ${i === imgIndex ? 'bg-white' : 'bg-white/40'}`}
                        onClick={() => setImgIndex(i)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setImgIndex(i)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${i === imgIndex ? 'border-primary' : 'border-transparent'}`}
              >
                <img
                  src={img.thumbnailUrl || img.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title + badges */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>{PROPERTY_TYPE_LABELS[property.propertyType] || property.propertyType}</Badge>
                {property.region && <Badge variant="outline">{property.region}</Badge>}
                <Badge variant="secondary" className="ml-auto flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {property.viewCount.toLocaleString()}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">{property.title}</h1>
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" />
                {property.address}
                {property.addressDetail && ` ${property.addressDetail}`}
              </p>
            </div>

            {/* Price */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-primary">
                    보증금 {formatPrice(property.deposit)}
                  </p>
                  <p className="text-lg">
                    월세 <span className="font-semibold">{formatPrice(property.monthlyRent)}</span>
                    {property.maintenanceFee > 0 && (
                      <span className="text-muted-foreground text-sm ml-1">
                        + 관리비 {formatPrice(property.maintenanceFee)}
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Specs */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <h3 className="font-semibold mb-3">상세 정보</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  {[
                    ['방 수', `${property.roomCount}개`],
                    ['욕실', `${property.bathroomCount}개`],
                    property.areaSqm ? ['면적', `${property.areaSqm}㎡`] : null,
                    property.floor ? ['층', property.totalFloor ? `${property.floor}/${property.totalFloor}층` : `${property.floor}층`] : null,
                    property.availableFrom ? ['입주 가능일', new Date(property.availableFrom).toLocaleDateString('ko-KR')] : null,
                  ].filter((x): x is [string, string] => x !== null).map(([label, value]) => (
                    <div key={label} className="flex gap-2">
                      <span className="text-muted-foreground w-24">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            {property.options.length > 0 && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <h3 className="font-semibold mb-3">옵션/시설</h3>
                  <div className="flex flex-wrap gap-2">
                    {property.options.map(opt => (
                      <span
                        key={opt}
                        className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-full"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {opt}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {property.description && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <h3 className="font-semibold mb-2">상세 설명</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{property.description}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: Landlord + CTA */}
          <div className="space-y-4">
            {/* Landlord card */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <h3 className="font-semibold mb-3">집주인 정보</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {property.landlord.profileImage ? (
                      <img
                        src={property.landlord.profileImage}
                        alt={property.landlord.name || '집주인'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{property.landlord.name || '집주인'}</p>
                    <p className="text-xs text-muted-foreground">집주인</p>
                  </div>
                </div>
                {property.landlord.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{property.landlord.bio}</p>
                )}
              </CardContent>
            </Card>

            {/* CTA */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleContactLandlord}
              disabled={isSendingMessage}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              {isSendingMessage ? '전송 중...' : '집주인에게 연락하기'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              등록일: {new Date(property.createdAt).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

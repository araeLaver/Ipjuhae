'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'
import { PropertyForm } from '@/components/landlord/property-form'
import {
  ArrowLeft, Pencil, Trash2, Image as ImageIcon, Plus, X, Star, Loader2
} from 'lucide-react'
import { Property, PropertyImage } from '@/types/database'
import { toast } from 'sonner'

export default function PropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params.id as string

  const [property, setProperty] = useState<Property | null>(null)
  const [images, setImages] = useState<PropertyImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProperty()
  }, [propertyId])

  const fetchProperty = async () => {
    try {
      const response = await fetch(`/api/landlord/properties/${propertyId}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        if (response.status === 404) {
          toast.error('매물을 찾을 수 없습니다')
          router.push('/landlord/properties')
          return
        }
        throw new Error(data.error)
      }

      setProperty(data.property)
      setImages(data.images || [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 이 매물을 삭제하시겠습니까?')) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/landlord/properties/${propertyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      toast.success('매물이 삭제되었습니다')
      router.push('/landlord/properties')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`/api/landlord/properties/${propertyId}/images`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setImages(prev => [...prev, data.image])
      toast.success('이미지가 업로드되었습니다')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleImageDelete = async (imageId: string) => {
    if (!confirm('이 이미지를 삭제하시겠습니까?')) return

    try {
      const response = await fetch(
        `/api/landlord/properties/${propertyId}/images?imageId=${imageId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      setImages(prev => prev.filter(img => img.id !== imageId))
      toast.success('이미지가 삭제되었습니다')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleSetMainImage = async (imageId: string) => {
    try {
      const response = await fetch(`/api/landlord/properties/${propertyId}/images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, setMain: true }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      setImages(prev =>
        prev.map(img => ({
          ...img,
          is_main: img.id === imageId,
        }))
      )
      toast.success('대표 이미지가 변경되었습니다')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (!property) {
    return null
  }

  if (isEditing) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
          </div>

          <div>
            <h1 className="text-2xl font-bold">매물 수정</h1>
            <p className="text-muted-foreground">매물 정보를 수정하세요</p>
          </div>

          <PropertyForm
            property={property}
            onSuccess={(updated) => {
              setProperty(updated)
              setIsEditing(false)
            }}
          />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/landlord/properties">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              수정
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  삭제
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Images */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">매물 사진</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || images.length >= 10}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    사진 추가
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  등록된 사진이 없습니다
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  사진 추가하기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {images.map(image => (
                  <div key={image.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={image.thumbnail_url || image.image_url}
                        alt="매물 사진"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {image.is_main && (
                      <Badge className="absolute top-2 left-2" variant="default">
                        대표
                      </Badge>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!image.is_main && (
                        <button
                          onClick={() => handleSetMainImage(image.id)}
                          className="p-1.5 bg-card rounded-full shadow hover:bg-muted"
                          title="대표 이미지로 설정"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleImageDelete(image.id)}
                        className="p-1.5 bg-card rounded-full shadow hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="삭제"
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              최대 10개까지 등록 가능 ({images.length}/10)
            </p>
          </CardContent>
        </Card>

        {/* Property Info Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">매물 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">{property.title}</h2>
              <p className="text-muted-foreground">{property.address}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={property.status === 'available' ? 'default' : 'secondary'}>
                {property.status === 'available' && '공실'}
                {property.status === 'reserved' && '예약중'}
                {property.status === 'rented' && '계약완료'}
                {property.status === 'hidden' && '비공개'}
              </Badge>
              <Badge variant="outline">
                {property.property_type === 'apartment' && '아파트'}
                {property.property_type === 'villa' && '빌라'}
                {property.property_type === 'officetel' && '오피스텔'}
                {property.property_type === 'oneroom' && '원룸'}
                {property.property_type === 'house' && '주택'}
                {property.property_type === 'other' && '기타'}
              </Badge>
              {property.room_count && (
                <Badge variant="outline">방 {property.room_count}개</Badge>
              )}
              {property.area_sqm && (
                <Badge variant="outline">{property.area_sqm}㎡</Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">보증금</p>
                <p className="font-semibold">
                  {(property.deposit / 10000).toLocaleString()}만원
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">월세</p>
                <p className="font-semibold">
                  {(property.monthly_rent / 10000).toLocaleString()}만원
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">관리비</p>
                <p className="font-semibold">
                  {property.maintenance_fee
                    ? `${(property.maintenance_fee / 10000).toLocaleString()}만원`
                    : '-'}
                </p>
              </div>
            </div>

            {property.options && property.options.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">옵션</p>
                <div className="flex flex-wrap gap-2">
                  {property.options.map((option, idx) => (
                    <Badge key={idx} variant="secondary">
                      {option}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {property.description && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">상세 설명</p>
                <p className="text-sm whitespace-pre-wrap">{property.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}

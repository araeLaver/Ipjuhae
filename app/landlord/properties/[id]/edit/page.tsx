'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'
import { PropertyForm } from '@/components/landlord/property-form'
import { ArrowLeft } from 'lucide-react'
import { Property } from '@/types/database'
import { toast } from 'sonner'

export default function EditPropertyPage() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params.id as string

  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/landlord/properties/${propertyId}`)
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login')
            return
          }
          if (res.status === 404) {
            toast.error('매물을 찾을 수 없습니다')
            router.push('/landlord/properties')
            return
          }
          throw new Error(data.error)
        }

        setProperty(data.property)
      } catch (err) {
        toast.error((err as Error).message)
        router.push('/landlord/properties')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProperty()
  }, [propertyId, router])

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (!property) return null

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/landlord/properties/${propertyId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold">매물 수정</h1>
          <p className="text-muted-foreground">매물 정보를 수정하세요</p>
        </div>

        <PropertyForm
          property={property}
          onSuccess={(updated) => {
            toast.success('매물이 수정되었습니다')
            router.push(`/landlord/properties/${updated.id}`)
          }}
        />
      </div>
    </PageContainer>
  )
}

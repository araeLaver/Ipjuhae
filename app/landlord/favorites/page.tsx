'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer } from '@/components/layout/page-container'
import { FavoriteButton } from '@/components/landlord/favorite-button'
import { Shield, Heart, ChevronRight } from 'lucide-react'
import { getTrustScoreColor } from '@/lib/trust-score'
import { toast } from 'sonner'

interface FavoriteItem {
  id: string
  tenant_id: string
  note: string | null
  created_at: string
  tenant_name: string
  age_range: string
  family_type: string
  trust_score: number
  bio: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function FavoritesPage() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchFavorites()
  }, [])

  const fetchFavorites = async (page = 1) => {
    try {
      const response = await fetch(`/api/favorites?page=${page}&limit=20`)
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

      setFavorites(data.favorites)
      setPagination(data.pagination)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFavoriteRemoved = (tenantId: string) => {
    setFavorites(prev => prev.filter(f => f.tenant_id !== tenantId))
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">즐겨찾기</h1>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </PageContainer>
    )
  }

  if (favorites.length === 0) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">즐겨찾기</h1>
          <EmptyState
            icon={<Heart className="h-12 w-12" />}
            title="저장된 세입자가 없습니다"
            description="관심있는 세입자의 프로필에서 하트 버튼을 눌러 즐겨찾기에 추가하세요."
            action={{ label: '세입자 둘러보기', onClick: () => router.push('/landlord/tenants') }}
          />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">즐겨찾기</h1>
          <Badge variant="secondary">{pagination?.total || 0}명 저장됨</Badge>
        </div>

        <div className="space-y-3">
          {favorites.map(favorite => (
            <Link key={favorite.id} href={`/landlord/tenants/${favorite.tenant_id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Trust Score Badge */}
                      <div className="text-center">
                        <div className={`w-12 h-12 rounded-full ${getTrustScoreColor(favorite.trust_score)} flex items-center justify-center`}>
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                        <p className="text-xs mt-1 font-medium">{favorite.trust_score}점</p>
                      </div>

                      {/* Profile Info */}
                      <div>
                        <h3 className="font-semibold text-lg">{favorite.tenant_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {favorite.age_range} · {favorite.family_type}
                        </p>
                        {favorite.bio && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {favorite.bio}
                          </p>
                        )}
                        {favorite.note && (
                          <p className="text-xs text-primary mt-1">
                            메모: {favorite.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <FavoriteButton
                        tenantId={favorite.tenant_id}
                        variant="icon"
                        onToggle={(isFavorited) => {
                          if (!isFavorited) {
                            handleFavoriteRemoved(favorite.tenant_id)
                          }
                        }}
                      />
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => fetchFavorites(page)}
                className={`px-3 py-1 rounded ${
                  page === pagination.page
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

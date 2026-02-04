'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ProfileCard } from '@/components/profile/profile-card'
import { TrustScoreChart } from '@/components/profile/trust-score-chart'
import { PageContainer } from '@/components/layout/page-container'
import { AlertCircle, Star, ThumbsUp, ThumbsDown, ArrowLeft } from 'lucide-react'
import { FavoriteButton } from '@/components/landlord/favorite-button'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Profile, Verification, ReferenceResponse } from '@/types/database'
import { toast } from 'sonner'

interface TrustScoreBreakdown {
  profile: number
  employment: number
  income: number
  credit: number
  reference: number
  total: number
}

export default function TenantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [referenceResponses, setReferenceResponses] = useState<ReferenceResponse[]>([])
  const [scoreBreakdown, setScoreBreakdown] = useState<TrustScoreBreakdown | null>(null)
  const [tenantUserId, setTenantUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchTenantDetail()
  }, [id])

  const fetchTenantDetail = async () => {
    try {
      const response = await fetch(`/api/landlord/tenants/${id}`)
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

      setProfile(data.profile)
      setVerification(data.verification)
      setReferenceResponses(data.referenceResponses || [])
      setScoreBreakdown(data.trustScoreBreakdown)
      setTenantUserId(data.profile?.user_id || null)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (!profile) {
    return (
      <PageContainer maxWidth="md">
        <EmptyState
          icon={<AlertCircle className="h-12 w-12" />}
          title="프로필을 찾을 수 없습니다"
          action={{ label: '목록으로 돌아가기', onClick: () => router.push('/landlord/tenants') }}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        {/* Header with back button and favorite */}
        <div className="flex items-center justify-between">
          <Link href="/landlord/tenants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로
            </Button>
          </Link>
          {tenantUserId && (
            <FavoriteButton tenantId={tenantUserId} />
          )}
        </div>

        <ProfileCard profile={profile} verification={verification} />

        {scoreBreakdown && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">신뢰점수 상세</CardTitle>
            </CardHeader>
            <CardContent>
              <TrustScoreChart
                total={scoreBreakdown.total}
                breakdown={scoreBreakdown}
              />
            </CardContent>
          </Card>
        )}

        {referenceResponses.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">집주인 레퍼런스 ({referenceResponses.length}건)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {referenceResponses.map((response, index) => (
                  <div key={response.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">레퍼런스 #{index + 1}</span>
                      <div className="flex items-center gap-1">
                        {response.would_recommend ? (
                          <ThumbsUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <ThumbsDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={response.would_recommend ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>
                          {response.would_recommend ? '추천' : '비추천'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">월세 납부</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          {response.rent_payment}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">집 관리</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          {response.property_condition}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">이웃 관계</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          {response.neighbor_issues}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">퇴실 상태</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          {response.checkout_condition}
                        </span>
                      </div>
                    </div>

                    {response.comment && (
                      <p className="mt-3 text-sm text-muted-foreground italic">
                        &ldquo;{response.comment}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  )
}

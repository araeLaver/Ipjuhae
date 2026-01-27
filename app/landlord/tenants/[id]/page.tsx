'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileCard } from '@/components/profile/profile-card'
import { Home, ArrowLeft, Loader2, Star, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Profile, Verification, ReferenceResponse } from '@/types/database'

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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

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
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">입주해</span>
            </Link>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-red-600">{error || '프로필을 찾을 수 없습니다'}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">입주해</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Profile Card */}
          <ProfileCard profile={profile} verification={verification} />

          {/* Trust Score Breakdown */}
          {scoreBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">신뢰점수 상세</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">프로필 완성</span>
                    <span className="font-medium">{scoreBreakdown.profile}점</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">재직 인증</span>
                    <span className="font-medium">{scoreBreakdown.employment}점</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">소득 인증</span>
                    <span className="font-medium">{scoreBreakdown.income}점</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">신용 인증</span>
                    <span className="font-medium">{scoreBreakdown.credit}점</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">레퍼런스</span>
                    <span className={`font-medium ${scoreBreakdown.reference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {scoreBreakdown.reference >= 0 ? '+' : ''}{scoreBreakdown.reference}점
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold">총점</span>
                    <span className="font-bold text-lg">{scoreBreakdown.total}점</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reference Responses */}
          {referenceResponses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">집주인 레퍼런스 ({referenceResponses.length}건)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {referenceResponses.map((response, index) => {
                    const avgScore = (
                      response.rent_payment +
                      response.property_condition +
                      response.neighbor_issues +
                      response.checkout_condition
                    ) / 4

                    return (
                      <div key={response.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-muted-foreground">레퍼런스 #{index + 1}</span>
                          <div className="flex items-center gap-1">
                            {response.would_recommend ? (
                              <ThumbsUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <ThumbsDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className={response.would_recommend ? 'text-green-600' : 'text-red-600'}>
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
                            "{response.comment}"
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

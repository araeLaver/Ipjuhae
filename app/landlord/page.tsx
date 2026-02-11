'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'
import { Users, Building, ArrowRight, BarChart3 } from 'lucide-react'
import { LandlordProfile } from '@/types/database'
import { toast } from 'sonner'

export default function LandlordDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<LandlordProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/landlord/profile')
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

      if (!data.profile) {
        router.push('/landlord/onboarding')
        return
      }

      setProfile(data.profile)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">안녕하세요, {profile?.name}님!</h1>
          <p className="text-muted-foreground">입주해에서 좋은 세입자를 찾아보세요</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="text-center">
                <Building className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{profile?.property_count || 0}</p>
                <p className="text-sm text-muted-foreground">보유 매물</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">-</p>
                <p className="text-sm text-muted-foreground">열람한 프로필</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">바로가기</h2>

          <Link href="/landlord/tenants">
            <Card className="shadow-soft hover:shadow-card transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">세입자 찾기</h3>
                      <p className="text-sm text-muted-foreground">
                        인증된 세입자 프로필을 검색하세요
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/landlord/stats">
            <Card className="shadow-soft hover:shadow-card transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">통계 및 분석</h3>
                      <p className="text-sm text-muted-foreground">
                        매물 현황과 활동을 확인하세요
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {profile?.property_regions && profile.property_regions.length > 0 && (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">내 매물 지역</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.property_regions.map((region, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-primary/5 text-primary rounded-full text-sm border border-primary/10"
                  >
                    {region}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  )
}

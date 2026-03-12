'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'
import {
  Users, Building, ArrowRight, BarChart3, Eye,
  MessageSquare, Star, Home, TrendingUp,
} from 'lucide-react'
import { LandlordProfile } from '@/types/database'
import { toast } from 'sonner'

interface DashboardStats {
  summary: {
    totalProperties: number
    availableProperties: number
    reservedProperties: number
    rentedProperties: number
    totalViews: number
    totalFavorites: number
    unreadMessages: number
    totalConversations: number
  }
  recentActivity: Array<{
    type: string
    description: string
    createdAt: string
  }>
  monthlyStats: Array<{
    month: string
    views: number
    favorites: number
    messages: number
  }>
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  sub?: string
  highlight?: boolean
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-primary' : ''}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 bg-muted rounded-lg">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function LandlordDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<LandlordProfile | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const [profileRes, statsRes] = await Promise.all([
        fetch('/api/landlord/profile'),
        fetch('/api/landlord/stats'),
      ])

      const profileData = await profileRes.json()
      if (!profileRes.ok) {
        if (profileRes.status === 401) { router.push('/login'); return }
        if (profileRes.status === 403) { router.push('/landlord/onboarding'); return }
        throw new Error(profileData.error)
      }
      if (!profileData.profile) { router.push('/landlord/onboarding'); return }
      setProfile(profileData.profile)

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
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
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  const s = stats?.summary

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">안녕하세요, {profile?.name}님!</h1>
          <p className="text-muted-foreground">입주해에서 좋은 세입자를 찾아보세요</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Building className="h-5 w-5 text-primary" />}
            label="보유 매물"
            value={s?.totalProperties ?? profile?.property_count ?? 0}
            sub={s ? `공실 ${s.availableProperties}건` : undefined}
          />
          <StatCard
            icon={<Eye className="h-5 w-5 text-blue-500" />}
            label="총 조회수"
            value={s?.totalViews?.toLocaleString() ?? '-'}
          />
          <StatCard
            icon={<Star className="h-5 w-5 text-yellow-500" />}
            label="관심 세입자"
            value={s?.totalFavorites ?? '-'}
          />
          <StatCard
            icon={<MessageSquare className="h-5 w-5 text-green-500" />}
            label="미읽 메시지"
            value={s?.unreadMessages ?? '-'}
            highlight={(s?.unreadMessages ?? 0) > 0}
            sub={s ? `전체 ${s.totalConversations}건` : undefined}
          />
        </div>

        {/* Property status */}
        {s && (s.reservedProperties > 0 || s.rentedProperties > 0) && (
          <Card className="shadow-soft">
            <CardContent className="pt-4 pb-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> 매물 현황
              </h3>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">공실</span>
                  <span className="font-semibold">{s.availableProperties}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-muted-foreground">예약중</span>
                  <span className="font-semibold">{s.reservedProperties}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  <span className="text-muted-foreground">계약완료</span>
                  <span className="font-semibold">{s.rentedProperties}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {stats?.recentActivity && stats.recentActivity.length > 0 && (
          <Card className="shadow-soft">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base">최근 활동</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ul className="space-y-2">
                {stats.recentActivity.slice(0, 5).map((act, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{act.description}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {new Date(act.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Quick links */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">바로가기</h2>

          <Link href="/landlord/tenants">
            <Card className="shadow-soft hover:shadow-card transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">세입자 찾기</h3>
                      <p className="text-sm text-muted-foreground">인증된 세입자 프로필을 검색하세요</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/landlord/properties">
            <Card className="shadow-soft hover:shadow-card transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                      <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">내 매물 관리</h3>
                      <p className="text-sm text-muted-foreground">등록된 매물을 확인하고 수정하세요</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/landlord/stats">
            <Card className="shadow-soft hover:shadow-card transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-green-100 dark:bg-green-900/50 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">통계 및 분석</h3>
                      <p className="text-sm text-muted-foreground">매물 현황과 활동을 확인하세요</p>
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

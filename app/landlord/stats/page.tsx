'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'
import {
  Building, Eye, Heart, MessageSquare, TrendingUp,
  Home, Clock, CheckCircle2
} from 'lucide-react'
import { formatDistanceToNow } from '@/lib/date'
import { toast } from 'sonner'

interface Stats {
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
  recentActivity: {
    type: string
    description: string
    createdAt: string
  }[]
  monthlyStats: {
    month: string
    views: number
    favorites: number
    messages: number
  }[]
}

export default function LandlordStatsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/landlord/stats')
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

      setStats(data)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (!stats) {
    return null
  }

  const { summary, recentActivity, monthlyStats } = stats

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">통계 및 분석</h1>
          <p className="text-muted-foreground">매물 현황과 활동을 확인하세요</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalProperties}</p>
                  <p className="text-sm text-muted-foreground">전체 매물</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Home className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.availableProperties}</p>
                  <p className="text-sm text-muted-foreground">공실</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.reservedProperties}</p>
                  <p className="text-sm text-muted-foreground">예약중</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.rentedProperties}</p>
                  <p className="text-sm text-muted-foreground">계약완료</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Engagement Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">총 조회수</p>
                  <p className="text-3xl font-bold">{summary.totalViews.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Eye className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">즐겨찾기</p>
                  <p className="text-3xl font-bold">{summary.totalFavorites.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <Heart className="h-6 w-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">대화 ({summary.unreadMessages} 읽지 않음)</p>
                  <p className="text-3xl font-bold">{summary.totalConversations.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Stats Chart */}
        {monthlyStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                월별 활동
              </CardTitle>
              <CardDescription>최근 6개월간의 활동 추이</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monthlyStats.map((stat) => {
                  const total = stat.views + stat.favorites + stat.messages
                  const maxValue = Math.max(...monthlyStats.map(s => s.views + s.favorites + s.messages)) || 1

                  return (
                    <div key={stat.month} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {stat.month.replace('-', '년 ')}월
                        </span>
                        <span className="font-medium">{total} 활동</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(total / maxValue) * 100}%` }}
                        />
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>조회 {stat.views}</span>
                        <span>즐겨찾기 {stat.favorites}</span>
                        <span>메시지 {stat.messages}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 활동</CardTitle>
            <CardDescription>최근 10개의 활동 내역</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                아직 활동 내역이 없습니다
              </p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-full">
                      {activity.type === 'message_received' && (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      )}
                      {activity.type === 'favorite_added' && (
                        <Heart className="h-4 w-4 text-red-500" />
                      )}
                      {activity.type === 'property_view' && (
                        <Eye className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}

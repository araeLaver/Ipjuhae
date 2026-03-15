'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '@/components/layout/page-container'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, Crown, Zap, Building2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PlanLimits {
  maxProperties: number
  maxFeatured: number
  label: string
  price: number
}

interface SubscriptionData {
  plan: string
  limits: PlanLimits
  usage: { properties: number; featured: number }
  plans: Record<string, PlanLimits>
  subscription: { expires_at: string | null } | null
  stripeEnabled?: boolean
}

const PLAN_ICONS: Record<string, typeof Crown> = {
  free:  Building2,
  basic: Zap,
  pro:   Crown,
}

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    '매물 등록 3개',
    '기본 세입자 검색',
    '인앱 메시지',
    '레퍼런스 확인',
  ],
  basic: [
    '매물 등록 10개',
    '피처드 매물 2개 (7일)',
    '우선 노출',
    '고급 세입자 검색 필터',
    '무제한 메시지',
  ],
  pro: [
    '매물 등록 무제한',
    '피처드 매물 5개 (7일)',
    '최상단 노출 + 배지',
    '고급 분석 대시보드',
    '전담 고객 지원',
    '우선 인증 심사',
  ],
}

function SubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('결제가 완료되었습니다! 구독이 활성화됩니다.')
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('결제가 취소되었습니다.')
    }
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/landlord/subscription')
      const json = await res.json()

      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        if (res.status === 403) { router.push('/landlord/onboarding'); return }
        throw new Error(json.error)
      }

      setData(json)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = async (plan: string) => {
    if (plan === data?.plan) return
    setUpgrading(plan)

    try {
      // 유료 플랜 + Stripe 설정 시 → Checkout
      if (plan !== 'free' && data?.stripeEnabled) {
        const res = await fetch('/api/landlord/subscription/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        if (json.url) {
          window.location.href = json.url
          return
        }
      }

      // 무료 플랜 다운그레이드 또는 데모 모드
      const res = await fetch('/api/landlord/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      toast.success(`${json.limits?.label || plan} 플랜으로 변경되었습니다!`)
      await fetchSubscription()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUpgrading(null)
    }
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!data) return null

  const plans = ['free', 'basic', 'pro']

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-8">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold">구독 플랜</h1>
          <p className="text-muted-foreground mt-1">
            더 많은 세입자에게 매물을 노출하세요
          </p>
        </div>

        {/* 현재 사용량 */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = PLAN_ICONS[data.plan] || Building2
                  return <Icon className="h-6 w-6 text-primary" />
                })()}
                <div>
                  <p className="font-semibold">현재 플랜: {data.limits.label}</p>
                  {data.subscription?.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      만료: {new Date(data.subscription.expires_at).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="font-bold text-lg">{data.usage.properties}</p>
                  <p className="text-muted-foreground text-xs">
                    / {data.limits.maxProperties === 999 ? '∞' : data.limits.maxProperties} 매물
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{data.usage.featured}</p>
                  <p className="text-muted-foreground text-xs">
                    / {data.limits.maxFeatured} 피처드
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 플랜 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((planKey) => {
            const planData = data.plans[planKey]
            if (!planData) return null
            const Icon = PLAN_ICONS[planKey] || Building2
            const features = PLAN_FEATURES[planKey] || []
            const isCurrent = planKey === data.plan
            const isPopular = planKey === 'basic'
            const isUpgrade = plans.indexOf(planKey) > plans.indexOf(data.plan)

            return (
              <Card
                key={planKey}
                className={cn(
                  'relative transition-shadow',
                  isCurrent && 'ring-2 ring-primary',
                  isPopular && !isCurrent && 'shadow-lg'
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3">
                      <Star className="h-3 w-3 mr-1" />인기
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-2">
                    <Icon className={cn(
                      'h-8 w-8',
                      planKey === 'pro' ? 'text-yellow-500' :
                      planKey === 'basic' ? 'text-blue-500' : 'text-muted-foreground'
                    )} />
                  </div>
                  <CardTitle>{planData.label}</CardTitle>
                  <CardDescription>
                    {planData.price === 0 ? (
                      <span className="text-2xl font-bold text-foreground">무료</span>
                    ) : (
                      <span>
                        <span className="text-2xl font-bold text-foreground">
                          {planData.price.toLocaleString()}원
                        </span>
                        <span className="text-muted-foreground">/월</span>
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : isUpgrade ? 'default' : 'outline'}
                    disabled={isCurrent || !!upgrading}
                    loading={upgrading === planKey}
                    onClick={() => handleUpgrade(planKey)}
                  >
                    {isCurrent ? '현재 플랜' : isUpgrade ? '업그레이드' : '다운그레이드'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {!data.stripeEnabled && (
          <p className="text-xs text-muted-foreground text-center">
            * 현재 결제 시스템 연동 전 데모 버전입니다. 실제 요금이 청구되지 않습니다.
          </p>
        )}
      </div>
    </PageContainer>
  )
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={
      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
          </div>
        </div>
      </PageContainer>
    }>
      <SubscriptionContent />
    </Suspense>
  )
}

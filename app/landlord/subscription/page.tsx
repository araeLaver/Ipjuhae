'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import type { PlanLimits } from '@/lib/plans'

interface Data {
  plan: string
  plans: Record<string, PlanLimits>
  limits: PlanLimits
  usage: { properties: number; featured: number }
  subscription: { expires_at: string | null } | null
  stripeEnabled: boolean
  managedBilling: boolean
}
function SubscriptionContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() {
    setError('')
    try {
      const res = await fetch('/api/landlord/subscription', {
        cache: 'no-store',
      })
      const result = await res.json()
      if (res.status === 401) {
        router.push('/login?next=%2Flandlord%2Fsubscription')
        return
      }
      if (!res.ok)
        throw Error(result.error || '구독 정보를 불러오지 못했습니다.')
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '구독 조회 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (params?.get('canceled') === 'true') setNotice('결제가 취소되었습니다.')
    if (params?.get('success') !== 'true') return
    const id = params.get('session_id')
    if (!id) {
      setNotice('결제 확인 정보가 없습니다. 결제 내역을 확인해주세요.')
      return
    }
    let active = true
    fetch(
      `/api/landlord/subscription/confirmation?session_id=${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    )
      .then(async (res) => {
        const result = await res.json()
        if (!res.ok) throw Error(result.error)
        if (active)
          setNotice(
            result.activated
              ? '결제와 구독 활성화를 확인했습니다.'
              : result.paid
                ? '결제를 확인했습니다. 구독 활성화를 기다리고 있습니다. 잠시 후 현재 상태를 다시 확인해주세요.'
                : '결제가 완료되지 않았습니다. 결제 내역을 확인해주세요.',
          )
      })
      .catch((err) => {
        if (active) setNotice(err.message || '결제 상태를 확인하지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [params])
  async function portal() {
    const res = await fetch('/api/landlord/subscription/portal', {
      method: 'POST',
    })
    const result = await res.json()
    if (!res.ok || !result.url)
      throw Error(result.error || '결제 관리에 연결하지 못했습니다.')
    window.location.assign(result.url)
  }
  async function choose(plan: string) {
    setBusy(true)
    setError('')
    try {
      if (data?.managedBilling) {
        await portal()
        return
      }
      if (!data?.stripeEnabled || plan === 'free') return
      const res = await fetch('/api/landlord/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const result = await res.json()
      if (result.code === 'BILLING_PORTAL_REQUIRED') {
        await portal()
        return
      }
      if (!res.ok || !result.url)
        throw Error(result.error || '결제 연결에 실패했습니다.')
      window.location.assign(result.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '결제 연결 실패')
    } finally {
      setBusy(false)
    }
  }
  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">매물 관리 이용 플랜</h1>
        <p className="text-muted-foreground">
          등록할 매물 수와 추천 노출 수에 맞춰 선택하세요. 추천 노출은 문의나
          계약 성사를 보장하지 않습니다.
        </p>
        {notice && (
          <p role="status" className="rounded-lg border p-4">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">구독 정보를 확인하고 있습니다.</p>
        ) : !data ? (
          <Button onClick={refresh}>다시 확인</Button>
        ) : (
          <>
            <section
              className="rounded-xl border p-5 space-y-2"
              aria-label="현재 구독"
            >
              <h2 className="font-bold">현재 플랜: {data.limits.label}</h2>
              <p>
                매물 {data.usage.properties}/{data.limits.maxProperties}개 ·
                추천 노출 {data.usage.featured}/{data.limits.maxFeatured}개
              </p>
              {data.subscription?.expires_at && (
                <p className="text-sm">
                  이용 기간:{' '}
                  {new Date(data.subscription.expires_at).toLocaleString(
                    'ko-KR',
                    { timeZone: 'Asia/Seoul' },
                  )}
                  까지
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={refresh}>
                  현재 상태 다시 확인
                </Button>
                {data.managedBilling && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true)
                      portal()
                        .catch((err) => setError(err.message))
                        .finally(() => setBusy(false))
                    }}
                  >
                    결제 내역·구독 변경·해지
                  </Button>
                )}
              </div>
            </section>
            {!data.stripeEnabled && (
              <p className="rounded-xl border p-4 text-sm">
                현재 유료 결제는 준비 중입니다. 무료 플랜은 계속 이용할 수
                있습니다. 유료 플랜은 결제 가능 여부를 확인한 뒤 안내합니다.
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              {['free', 'basic', 'pro'].map((key) => {
                const plan = data.plans[key]
                if (!plan) return null
                const current = key === data.plan
                return (
                  <section
                    key={key}
                    className="rounded-xl border p-5 space-y-4"
                  >
                    <h2 className="text-xl font-bold">{plan.label}</h2>
                    <p className="text-2xl font-bold">
                      {plan.price === 0
                        ? '무료'
                        : `${plan.price.toLocaleString('ko-KR')}원/월`}
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li>매물 등록 {plan.maxProperties}개</li>
                      <li>
                        추천 노출 {plan.maxFeatured}개
                        {plan.maxFeatured > 0 ? ' (7일)' : ''}
                      </li>
                      <li>등록한 매물 관리</li>
                    </ul>
                    <Button
                      disabled={
                        busy ||
                        current ||
                        (!data.managedBilling &&
                          (key === 'free' || !data.stripeEnabled))
                      }
                      onClick={() => choose(key)}
                      className="w-full"
                    >
                      {current
                        ? '현재 플랜'
                        : data.managedBilling
                          ? '결제 관리에서 변경'
                          : key === 'free'
                            ? '무료 이용'
                            : data.stripeEnabled
                              ? '결제하고 이용'
                              : '유료 결제 준비 중'}
                    </Button>
                  </section>
                )
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              정기결제의 요금·갱신·변경·해지 조건은 결제 및 결제 관리 화면에서
              확인해주세요. 구독 혜택은 서버에서 결제가 확인된 뒤 활성화됩니다.
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/service" className="underline">
            서비스 안내
          </Link>
          <a
            className="underline"
            href="mailto:ipjuhae.official@gmail.com?subject=%EC%9E%85%EC%A3%BC%ED%95%B4%20%EC%9D%B4%EC%9A%A9%20%EB%AC%B8%EC%9D%98"
          >
            이용·결제 문의
          </a>
          <Link href="/terms" className="underline">
            이용약관
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}
export default function SubscriptionPage() {
  return (
    <Suspense fallback={<p>구독 정보를 확인하고 있습니다.</p>}>
      <SubscriptionContent />
    </Suspense>
  )
}

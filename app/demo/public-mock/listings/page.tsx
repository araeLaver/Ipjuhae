import { notFound } from 'next/navigation'
import { AlertTriangle, CalendarDays, CheckCircle2, Home, MapPin, ShieldCheck, TrainFront } from 'lucide-react'
import { PageContainer } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { publicMockListings, formatKrwManwon } from '@/lib/public-mock-listings'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Public mock listings demo | Rentme',
  description: 'Synthetic local-only Rentme mock listing screen for pre-publication QA.',
  robots: {
    index: false,
    follow: false,
  },
}

function assertDemoEnabled() {
  if (process.env.NODE_ENV === 'production' || process.env.PUBLIC_MOCK_DEMO_ENABLED !== '1') {
    notFound()
  }
}

export default function PublicMockListingsPage() {
  assertDemoEnabled()

  return (
    <PageContainer maxWidth="xl">
      <main className="space-y-6 py-6">
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="max-w-4xl space-y-2">
              <Badge className="bg-amber-600 text-white">DEMO / 가상 데이터</Badge>
              <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">
                외부 공개 전 검수용 mock 매물 화면
              </h1>
              <p className="text-sm leading-6">
                이 화면은 local QA용 synthetic fixture만 사용합니다. 운영 API, 운영 DB, 실제 계정, 실제 연락처,
                원본 증빙을 호출하거나 표시하지 않습니다.
              </p>
            </div>
            <div className="rounded-md bg-white/80 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm">
              PUBLIC_MOCK_DEMO_ENABLED=1 필요
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">가상 매물</h2>
                <p className="text-sm text-muted-foreground">번지, 동·호수, 연락처, user ID를 제외한 fixture 3건</p>
              </div>
              <Badge variant="outline">{publicMockListings.length}건</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {publicMockListings.map((listing) => (
                <article key={listing.id} className="overflow-hidden rounded-lg border bg-background shadow-soft">
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
                    <div className="absolute left-3 top-3 rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                      DEMO / 가상 데이터
                    </div>
                    <Home className="h-16 w-16 text-slate-500" aria-hidden="true" />
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{listing.propertyType}</Badge>
                      <Badge variant="outline">{listing.status}</Badge>
                    </div>
                    <div>
                      <h3 className="text-base font-bold leading-snug">{listing.title}</h3>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {listing.address}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">보증금</p>
                        <p className="font-bold text-primary">{formatKrwManwon(listing.deposit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">월세</p>
                        <p className="font-bold">{listing.monthlyRent}만원</p>
                      </div>
                    </div>
                    <dl className="grid gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <TrainFront className="h-3.5 w-3.5" aria-hidden="true" />
                        <dt className="sr-only">역세권</dt>
                        <dd>{listing.nearestStation}</dd>
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        <dt className="sr-only">입주 가능</dt>
                        <dd>{listing.availableFrom}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border bg-background p-5 shadow-soft">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="text-base font-bold">화면 고지</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                표시된 내용은 정보 확인을 돕는 참고 상태이며 개인에 대한 신용 판단·자동 선별, 계약 안전성 확약,
                중개 또는 법률 판단이 아닙니다. 중요한 결정 전 공식 원문과 전문가 확인이 필요합니다.
              </p>
            </section>

            <section className="rounded-lg border bg-background p-5 shadow-soft">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="text-base font-bold">검수 기준</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>운영 API 호출 없음</li>
                <li>주소는 시·군·구/법정동 수준만 표시</li>
                <li>추천 점수, 순위, 신용·등급 표현 없음</li>
                <li>원본 증빙, 연락처, 계정 식별자 없음</li>
              </ul>
            </section>

            <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-950">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                <h2 className="text-base font-bold">외부 발송 금지</h2>
              </div>
              <p className="text-sm leading-6">
                이 route는 캡처 후보 생성 전 QA용입니다. 보드가 화면, 문안, 파일 hash, 발송 범위를 승인하기 전에는
                업로드하거나 제출하지 않습니다.
              </p>
            </section>
          </aside>
        </section>
      </main>
    </PageContainer>
  )
}

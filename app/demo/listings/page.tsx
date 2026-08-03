import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Building2, CalendarDays, Info, MapPin, Ruler, Sparkles } from 'lucide-react'
import { PageContainer } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { isSyntheticDemoEnabled, syntheticDemoListings } from '@/lib/synthetic-demo-listings'

export const metadata: Metadata = {
  title: '가상 매물 둘러보기 | 입주해',
  description: '실제 매물이 아닌 고정 가상 데이터로 구성한 입주해 화면 예시입니다.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-static'

function formatPrice(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}

export default function SyntheticDemoListingsPage() {
  if (!isSyntheticDemoEnabled()) notFound()

  return (
    <PageContainer maxWidth="xl">
      <main className="space-y-6" data-demo-source="fixed-synthetic-fixture">
        <section className="overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-background shadow-soft">
          <div className="flex items-center justify-between gap-4 bg-primary px-5 py-3 text-primary-foreground">
            <p className="text-sm font-extrabold tracking-[0.18em]">DEMO / 가상 데이터</p>
            <Badge variant="secondary">LOCAL ONLY</Badge>
          </div>
          <div className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-semibold text-primary">입주해 화면 예시</p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">나에게 맞는 생활권 살펴보기</h1>
              <p className="text-muted-foreground">
                아래 내용은 제품 경험을 설명하기 위해 만든 고정 가상 예시이며 실제 매물이나 거래 조건이 아닙니다.
              </p>
            </div>
            <div className="rounded-lg bg-muted px-4 py-3 text-sm">
              <p className="font-semibold">표시 기준</p>
              <p className="text-muted-foreground">시·군·구 및 법정동까지만 표시</p>
            </div>
          </div>
        </section>

        <aside className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" aria-label="데모 이용 고지">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            입주해는 이 화면에서 부동산 가치평가, 거래 보증, 중개 또는 법률 판단을 제공하지 않습니다.
            표시된 금액과 조건은 기능 설명용 가상 값이므로 실제 계약 판단에 사용할 수 없습니다.
          </p>
        </aside>

        <section aria-labelledby="demo-listings-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">고정 fixture · {syntheticDemoListings.length}개</p>
              <h2 id="demo-listings-heading" className="text-2xl font-bold">가상 매물 비교</h2>
            </div>
            <p className="text-sm text-muted-foreground">운영 API 및 DB를 사용하지 않습니다</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {syntheticDemoListings.map((listing, index) => (
              <article key={listing.id} className="overflow-hidden rounded-xl border bg-background shadow-soft">
                <div className={`relative flex h-44 items-end bg-gradient-to-br ${listing.color} p-5`} aria-hidden="true">
                  <div className="absolute right-4 top-4 rounded bg-background/90 px-2 py-1 text-xs font-bold tracking-wider">
                    가상 예시 {String(index + 1).padStart(2, '0')}
                  </div>
                  <Building2 className="h-16 w-16 text-foreground/25" strokeWidth={1.25} />
                </div>
                <div className="space-y-5 p-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{listing.propertyType}</Badge>
                      <Badge variant="outline">가상 조건</Badge>
                    </div>
                    <h3 className="flex items-center gap-1.5 text-lg font-bold">
                      <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                      {listing.area}
                    </h3>
                    <p className="text-sm text-muted-foreground">{listing.transit}</p>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/60 p-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">가상 보증금</dt>
                      <dd className="font-bold">{formatPrice(listing.deposit)}만원</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">가상 월세</dt>
                      <dd className="font-bold text-primary">{formatPrice(listing.monthlyRent)}만원</dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Ruler className="h-3 w-3" />면적</dt>
                      <dd className="text-sm font-medium">{listing.areaSqm}㎡ · 방 {listing.rooms}</dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3" />입주 예시</dt>
                      <dd className="text-sm font-medium">{listing.availableFrom}</dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2" aria-label="생활 조건 예시">
                    {listing.highlights.map((highlight) => (
                      <span key={highlight} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-foreground p-6 text-background sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="flex gap-3">
            <Sparkles className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-bold">이 화면은 제품 소개용 시안입니다</h2>
              <p className="mt-1 text-sm text-background/75">실제 서비스 이용과 계약 전에는 매물 정보 및 권리관계를 별도로 확인해야 합니다.</p>
            </div>
          </div>
          <Link href="/" className="mt-4 inline-flex rounded-md border border-background/40 px-4 py-2 text-sm font-semibold sm:mt-0">
            입주해 소개로 돌아가기
          </Link>
        </section>
      </main>
    </PageContainer>
  )
}

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  ClipboardCheck,
  FileCheck2,
  LockKeyhole,
  RefreshCcw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { ListingSearch } from '@/components/listings/ListingSearch'
import { Button } from '@/components/ui/button'
import { mockListings } from '@/lib/mock-listings'

export const metadata: Metadata = {
  title: '입주해 - 주거 신뢰 리포트 기반 임대 매칭 플랫폼',
  description: '입주해에서 세입자, 임대인, 주택의 확인 항목을 분리해 보고 거래 단계별로 필요한 정보만 공유하세요.',
  openGraph: {
    title: '입주해 - 주거 신뢰 리포트 기반 임대 매칭 플랫폼',
    description: '입주해에서 세입자, 임대인, 주택의 확인 항목을 분리해 보고 거래 단계별로 필요한 정보만 공유하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '입주해 홈 화면' }],
  },
}

const trustFlow = [
  { icon: FileCheck2, label: '검증값 전환', text: '원본 대신 확인 항목으로 정리' },
  { icon: LockKeyhole, label: '제한 공개', text: '동의 범위와 거래 단계 기준' },
  { icon: RefreshCcw, label: '상태 회수', text: '철회·만료·이의제기 반영' },
]

const reportItems = [
  { label: '임차인', value: '검수 완료', note: '재직·소득 확인 항목', tone: 'trust' },
  { label: '임대인', value: '추가 확인', note: '소유·대리권 확인 항목', tone: 'review' },
  { label: '주택', value: '기준일 표시', note: '등기·보증보험 확인 항목', tone: 'trust' },
] as const

function formatRent(amount: number): string {
  if (amount >= 10000) return `${Math.floor(amount / 10000)}억`
  return `${amount}만`
}

const reportToneClass = {
  trust: 'text-trust',
  review: 'text-primary',
} as const

export default function HomePage() {
  const featuredListings = mockListings.slice(0, 6)
  const heroListing = mockListings[9] ?? featuredListings[0]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="border-b bg-[linear-gradient(180deg,hsl(var(--secondary))_0%,hsl(var(--background))_58%)]">
          <div className="container mx-auto grid gap-8 px-4 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:py-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-md border border-trust/20 bg-secondary px-3 py-2 text-sm font-semibold text-trust shadow-soft">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                주거 확인 리포트 기반 매칭
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
                  입주해
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                  매물 조건과 확인 항목을 함께 보고, 필요한 범위만 동의 기반으로 공유하는 임대 매칭 플랫폼입니다.
                </p>
              </div>

              <div className="rounded-lg border bg-background p-4 shadow-card">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <Search className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">지금 조건으로 매물 찾기</p>
                      <p className="mt-1 text-sm text-muted-foreground">예산, 생활권, 입주일, 확인 항목을 함께 비교합니다.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link href="/listings">
                      <Button size="lg" className="w-full sm:w-auto">
                        매물 찾기
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto">
                        프로필 만들기
                        <ClipboardCheck className="ml-2 h-4 w-4" aria-hidden="true" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {trustFlow.map((item) => (
                  <div key={item.label} className="rounded-lg border border-trust/15 bg-secondary/55 p-4">
                    <item.icon className="mb-3 h-5 w-5 text-trust" aria-hidden="true" />
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-background shadow-elevated">
              <div className="grid lg:grid-cols-[minmax(260px,0.92fr)_minmax(0,1.08fr)]">
                <div className="border-b lg:border-b-0 lg:border-r">
                  <div className="relative h-64">
                    <Image
                      src={heroListing.photo_urls[0]}
                      alt={`${heroListing.address} 추천 매물 사진`}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 36vw"
                      className="object-cover"
                    />
                    <div className="absolute left-3 top-3 rounded-md bg-background/95 px-2.5 py-1 text-xs font-semibold text-primary shadow-soft">
                      추천 {heroListing.match_score}%
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{heroListing.nearest_station}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{heroListing.commute_note}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs text-muted-foreground">보증금</p>
                        <p className="font-semibold text-foreground">{formatRent(heroListing.deposit)}</p>
                      </div>
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs text-muted-foreground">월세</p>
                        <p className="font-semibold text-foreground">{heroListing.monthly_rent}만</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="border-b bg-secondary/70 p-4">
                    <p className="text-sm font-semibold text-foreground">확인 리포트 미리보기</p>
                    <p className="mt-1 text-xs text-muted-foreground">원본 서류 없이 확인 상태와 기준일만 비교합니다.</p>
                  </div>

                  <div className="divide-y">
                    {reportItems.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4 p-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                        </div>
                        <span className={`shrink-0 text-sm font-semibold ${reportToneClass[item.tone]}`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto border-t border-accent/30 bg-accent/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <p className="text-sm leading-6 text-accent-foreground">
                        소유·대리권과 최신 등기 기준일은 계약 전 추가 확인이 필요할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8">
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-sm font-semibold text-primary">추천 리포트 매물</p>
              <h2 className="text-2xl font-bold text-foreground">조건과 확인 근거를 함께 비교</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              추천도는 예산, 입주일, 생활권, 확인 항목을 함께 반영합니다.
            </p>
          </div>
          <ListingSearch listings={featuredListings} compact />
        </section>

        <section className="border-t bg-muted/40">
          <div className="container mx-auto grid gap-4 px-4 py-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-primary">임대인용 확인 흐름</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">필요한 확인 상태만 제한적으로 봅니다.</h2>
            </div>
            <Link href="/landlord">
              <Button variant="outline" size="lg" className="w-full md:w-auto">
                임대인 화면 보기
                <Building2 className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

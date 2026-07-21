import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, Building2, MapPin, ShieldCheck } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { ListingSearch } from '@/components/listings/ListingSearch'
import { Button } from '@/components/ui/button'
import type { Listing } from '@/lib/schemas/listing'

export const metadata: Metadata = {
  title: 'Rentme - 안전한 임대의 시작',
  description: 'Rentme는 실제 등록된 매물 데이터로 임대 과정을 빠르게 탐색하고 매칭할 수 있는 플랫폼입니다.',
  openGraph: {
    title: 'Rentme - 안전한 임대의 시작',
    description: 'Rentme는 실제 등록된 매물 데이터로 임대 과정을 빠르게 탐색하고 매칭할 수 있는 플랫폼입니다.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Rentme 플랫폼 안내' }],
  },
}

async function getFeaturedListings() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/listings`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return []

    const data = (await res.json()) as { listings?: Listing[] }
    return (data.listings ?? []).slice(0, 6)
  } catch {
    return []
  }
}

export default async function HomePage() {
  const featuredListings = await getFeaturedListings()

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background">
      <Header />
      <main className="container mx-auto space-y-10 px-4 py-8">
        <section className="grid min-h-[520px] overflow-hidden rounded-lg bg-background shadow-soft lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center gap-7 p-6 sm:p-10 lg:p-12">
            <div className="space-y-4">
              <div className="flex w-fit items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                실제 임대 데이터 기반 검증
              </div>
              <h1 className="max-w-2xl text-4xl font-bold tracking-normal sm:text-5xl">
                신뢰받는 매물 찾기
              </h1>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                임차인과 임대인 모두를 위한 매칭 플랫폼, Rentme로 더 빠르게 안전한 계약을 시작하세요.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: BadgeCheck, label: '검증된 매물', value: '실명 기반 등록/관리' },
                { icon: MapPin, label: '지역 기반', value: '전국 주요 지역 지원' },
                { icon: Building2, label: '매물 검색', value: '조건 맞춤형 매칭' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border bg-muted/40 p-4">
                  <item.icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/listings">
                <Button size="lg">
                  매물 둘러보기
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="lg" variant="outline">
                  임대인 가입
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative min-h-[320px] lg:min-h-full">
            <Image
              src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1600&q=80"
              alt="신규 매물 프리뷰"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-background/92 p-4 shadow-card backdrop-blur">
              <p className="text-sm font-semibold">추천 매물</p>
              <p className="text-sm text-muted-foreground">최신 등록 매물 위주로 추천해드립니다.</p>
            </div>
          </div>
        </section>

        <ListingSearch listings={featuredListings} compact />
      </main>
    </div>
  )
}

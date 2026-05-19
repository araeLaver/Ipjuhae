import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, Building2, MapPin, ShieldCheck } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { ListingSearch } from '@/components/listings/ListingSearch'
import { Button } from '@/components/ui/button'
import { mockListings } from '@/lib/mock-listings'

export const metadata: Metadata = {
  title: '임주해 - 세입자 프로필 기반 부동산 매칭 플랫폼',
  description: '임주해(Rentme)에서 세입자 프로필을 만들고 신뢰를 증명하세요. 집주인과 세입자를 연결하는 스마트 부동산 매칭 플랫폼.',
  openGraph: {
    title: '임주해 - 세입자 프로필 기반 부동산 매칭 플랫폼',
    description: '임주해(Rentme)에서 세입자 프로필을 만들고 신뢰를 증명하세요. 집주인과 세입자를 연결하는 스마트 부동산 매칭 플랫폼.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 랜딩 페이지' }],
  },
}

export default function HomePage() {
  const featuredListings = mockListings.slice(0, 6)

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background">
      <Header />
      <main className="container mx-auto space-y-10 px-4 py-8">
        <section className="grid min-h-[520px] overflow-hidden rounded-lg bg-background shadow-soft lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center gap-7 p-6 sm:p-10 lg:p-12">
            <div className="space-y-4">
              <div className="flex w-fit items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                신뢰 프로필 기반 임대 매칭
              </div>
              <h1 className="max-w-2xl text-4xl font-bold tracking-normal sm:text-5xl">
                입주해
              </h1>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                검증된 세입자 프로필과 실제 매물 조건을 함께 비교해 더 빠르게 집을 찾고 연결하세요.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: BadgeCheck, label: '인증 프로필', value: '신뢰 점수 반영' },
                { icon: MapPin, label: '생활권 필터', value: '지역과 역세권' },
                { icon: Building2, label: '추천 매물', value: '예산 기반 정렬' },
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
                  매물 검색
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="lg" variant="outline">
                  프로필 만들기
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative min-h-[320px] lg:min-h-full">
            <Image
              src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1600&q=80"
              alt="밝은 거실이 있는 추천 임대 매물"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-background/92 p-4 shadow-card backdrop-blur">
              <p className="text-sm font-semibold">오늘의 추천</p>
              <p className="text-sm text-muted-foreground">
                성수역 도보 5분 신축 아파트 · 추천도 94%
              </p>
            </div>
          </div>
        </section>

        <ListingSearch listings={featuredListings} compact />
      </main>
    </div>
  )
}

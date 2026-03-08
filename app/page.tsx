import type { Metadata } from 'next'
import { Hero } from '@/components/landing/hero'
import { FeaturesSection } from '@/components/landing/features-section'
import { HowItWorks } from '@/components/landing/how-it-works'
import { StatsSection } from '@/components/landing/stats-section'
import { CtaSection } from '@/components/landing/cta-section'
import { Footer } from '@/components/landing/footer'
import { Header } from '@/components/layout/header'

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
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <FeaturesSection />
      <HowItWorks />
      <StatsSection />
      <CtaSection />
      <Footer />
    </div>
  )
}

import { Hero } from '@/components/landing/hero'
import { FeaturesSection } from '@/components/landing/features-section'
import { HowItWorks } from '@/components/landing/how-it-works'
import { StatsSection } from '@/components/landing/stats-section'
import { CtaSection } from '@/components/landing/cta-section'
import { Footer } from '@/components/landing/footer'
import { Header } from '@/components/layout/header'

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

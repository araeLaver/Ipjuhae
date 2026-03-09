import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '집주인 대시보드',
  description: '임주해(Rentme) 집주인 대시보드에서 매물을 관리하고 신뢰할 수 있는 세입자를 찾아보세요. 세입자 프로필 기반 부동산 매칭 플랫폼.',
  openGraph: {
    title: '집주인 대시보드 | 임주해',
    description: '임주해(Rentme) 집주인 대시보드에서 매물을 관리하고 신뢰할 수 있는 세입자를 찾아보세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 집주인 대시보드' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function LandlordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

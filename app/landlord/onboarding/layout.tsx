import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '집주인 프로필 설정 | 임주해',
  description: '임주해(Rentme)에서 집주인 프로필을 설정하세요. 이름, 연락처, 보유 매물 수와 지역을 입력하고 신뢰할 수 있는 세입자를 찾아보세요.',
  openGraph: {
    title: '집주인 프로필 설정 | 임주해',
    description: '임주해(Rentme)에서 집주인 프로필을 설정하고 신뢰할 수 있는 세입자를 찾아보세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 집주인 프로필 설정' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function LandlordOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

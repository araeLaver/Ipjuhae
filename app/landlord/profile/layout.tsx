import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '집주인 프로필 수정 | 임주해',
  description: '임주해(Rentme)에서 집주인 프로필을 수정하세요. 이름, 연락처, 보유 매물 수와 지역 정보를 업데이트할 수 있습니다.',
  openGraph: {
    title: '집주인 프로필 수정 | 임주해',
    description: '임주해(Rentme)에서 집주인 프로필 정보를 수정하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 집주인 프로필 수정' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function LandlordProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

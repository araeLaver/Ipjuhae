import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '내 프로필',
  description: '임주해(Rentme)에서 내 세입자 프로필을 확인하고 관리하세요. 신뢰점수, 인증 정보, 레퍼런스를 한눈에 볼 수 있습니다.',
  openGraph: {
    title: '내 프로필 | 임주해',
    description: '임주해(Rentme)에서 내 세입자 프로필을 확인하고 관리하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 세입자 프로필' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

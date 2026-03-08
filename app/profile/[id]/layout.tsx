import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '세입자 프로필',
  description: '임주해(Rentme)에서 세입자 프로필을 확인하세요. 신뢰점수와 인증 정보를 통해 믿을 수 있는 세입자를 만나보세요.',
  openGraph: {
    title: '세입자 프로필 | 임주해',
    description: '임주해(Rentme)에서 세입자 프로필을 확인하세요. 신뢰점수와 인증 정보를 통해 믿을 수 있는 세입자를 만나보세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 세입자 프로필' }],
  },
}

export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

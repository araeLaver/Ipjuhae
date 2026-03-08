import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인',
  description: '임주해(Rentme)에 로그인하세요. 세입자 프로필 기반 부동산 매칭 플랫폼에서 집주인과 세입자를 연결합니다.',
  openGraph: {
    title: '로그인 | 임주해',
    description: '임주해(Rentme)에 로그인하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 로그인' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

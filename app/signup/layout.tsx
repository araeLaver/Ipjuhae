import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원가입',
  description: '임주해(Rentme)에 가입하고 세입자 프로필을 만들어보세요. 세입자 프로필 기반 부동산 매칭 플랫폼에서 신뢰할 수 있는 세입자임을 증명하세요.',
  openGraph: {
    title: '회원가입 | 임주해',
    description: '임주해(Rentme)에 가입하고 세입자 프로필을 만들어보세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 회원가입' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

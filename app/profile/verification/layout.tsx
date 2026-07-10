import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '인증 관리 | 임주해',
  description: '임주해(Rentme)에서 재직, 소득, 신용 관련 확인 항목을 관리하고 프로필 정보를 보완하세요.',
  openGraph: {
    title: '인증 관리 | 임주해',
    description: '임주해(Rentme)에서 재직, 소득, 신용 관련 확인 항목을 관리하고 프로필 정보를 보완하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 인증 관리' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function VerificationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '인증 관리 | 임주해',
  description: '임주해(Rentme)에서 재직, 소득, 신용 인증을 완료하고 신뢰점수를 높여보세요. 인증된 세입자는 집주인에게 더 높은 신뢰를 받을 수 있습니다.',
  openGraph: {
    title: '인증 관리 | 임주해',
    description: '임주해(Rentme)에서 재직, 소득, 신용 인증을 완료하고 신뢰점수를 높여보세요.',
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

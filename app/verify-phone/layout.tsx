import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '휴대폰 인증',
  description: '입주해 본인 확인을 위해 휴대폰 번호를 인증해주세요. 인증 완료 시 신뢰점수가 향상됩니다.',
  openGraph: {
    title: '휴대폰 인증 | 입주해',
    description: '입주해 본인 확인을 위해 휴대폰 번호를 인증해주세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '입주해 휴대폰 인증' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function VerifyPhoneLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

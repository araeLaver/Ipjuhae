import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '소셜 회원가입 | 임주해',
  description: '소셜 계정으로 임주해(Rentme)에 가입하세요. 회원 유형을 선택하고 이용약관에 동의하면 바로 서비스를 이용할 수 있습니다.',
  openGraph: {
    title: '소셜 회원가입 | 임주해',
    description: '소셜 계정으로 임주해(Rentme)에 가입하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 소셜 회원가입' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function SocialSignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

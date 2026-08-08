import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '생활 패턴 입력 | 입주해',
  description: '입주해 세입자 프로필 설정 단계 2: 귀가 시간, 거주 기간, 소음 수준 등 생활 패턴 정보를 입력해주세요. 집주인이 맞는 세입자를 찾는 데 도움이 됩니다.',
  openGraph: {
    title: '생활 패턴 입력 | 입주해',
    description: '입주해 세입자 프로필 설정 단계 2: 생활 패턴 정보를 입력해주세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '입주해 생활 패턴 입력' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function LifestyleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

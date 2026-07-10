import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '레퍼런스 관리 | 임주해',
  description: '임주해(Rentme)에서 이전 집주인으로부터 레퍼런스를 받아 프로필 참고 지표를 보강해보세요. 레퍼런스는 세입자 프로필을 설명하는 핵심 요소입니다.',
  openGraph: {
    title: '레퍼런스 관리 | 임주해',
    description: '임주해(Rentme)에서 이전 집주인으로부터 레퍼런스를 받아 프로필 참고 지표를 보강해보세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 레퍼런스 관리' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '매물 등록 | 임주해',
  description: '임주해(Rentme)에서 새 매물을 등록하세요. 주소, 가격, 방 정보, 옵션 등을 입력하고 조건에 맞는 세입자 프로필을 확인하세요.',
  openGraph: {
    title: '매물 등록 | 임주해',
    description: '임주해(Rentme)에서 새 매물을 등록하고 조건에 맞는 세입자 프로필을 확인하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 매물 등록' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function NewPropertyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

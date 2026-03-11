import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '즐겨찾기 | 임주해',
  description: '임주해(Rentme)에서 저장한 세입자 프로필을 확인하세요. 관심 있는 세입자들을 즐겨찾기에 추가하고 쉽게 관리할 수 있습니다.',
  openGraph: {
    title: '즐겨찾기 | 임주해',
    description: '임주해(Rentme)에서 저장한 세입자 프로필을 확인하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 즐겨찾기' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

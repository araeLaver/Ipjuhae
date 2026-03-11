import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '내 매물 | 임주해',
  description: '임주해(Rentme)에서 등록한 매물을 관리하세요. 매물 상태 변경, 사진 업로드, 세입자 매칭까지 한 곳에서 처리할 수 있습니다.',
  openGraph: {
    title: '내 매물 | 임주해',
    description: '임주해(Rentme)에서 등록한 매물을 관리하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 매물 관리' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

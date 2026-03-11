import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '통계 및 분석 | 임주해',
  description: '임주해(Rentme) 집주인 통계 대시보드에서 매물 현황, 조회수, 즐겨찾기, 메시지 등 활동 데이터를 확인하세요.',
  openGraph: {
    title: '통계 및 분석 | 임주해',
    description: '임주해(Rentme) 집주인 통계 대시보드에서 매물 현황과 활동 데이터를 확인하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 통계 및 분석' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

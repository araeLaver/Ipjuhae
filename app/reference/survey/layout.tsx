import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '집주인 레퍼런스 설문',
  description: '임주해(Rentme) 집주인 레퍼런스 설문에 참여해주세요. 세입자의 신뢰점수 향상에 도움이 됩니다.',
  openGraph: {
    title: '집주인 레퍼런스 설문 | 임주해',
    description: '임주해(Rentme) 집주인 레퍼런스 설문에 참여해주세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 레퍼런스 설문' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

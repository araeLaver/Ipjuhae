import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '메시지 | 임주해',
  description: '임주해(Rentme) 집주인 메시지 센터에서 세입자와 나눈 대화를 확인하세요. 실시간 채팅으로 세입자와 안전하게 소통할 수 있습니다.',
  openGraph: {
    title: '메시지 | 임주해',
    description: '임주해(Rentme) 집주인 메시지 센터에서 세입자와의 대화를 확인하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 집주인 메시지' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function LandlordMessagesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

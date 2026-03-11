import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '대화 | 임주해',
  description: '임주해(Rentme) 메시지 센터에서 집주인과 대화를 나누세요. 실시간 채팅으로 안전하게 소통할 수 있습니다.',
  openGraph: {
    title: '대화 | 임주해',
    description: '임주해(Rentme) 메시지 센터에서 집주인과 대화를 나누세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 메시지' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

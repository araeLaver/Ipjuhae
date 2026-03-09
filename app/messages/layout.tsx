import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '메시지',
  description: '임주해(Rentme) 메시지 센터에서 집주인과 세입자 간의 대화를 확인하세요.',
  openGraph: {
    title: '메시지 | 임주해',
    description: '임주해(Rentme) 메시지 센터에서 집주인과 세입자 간의 대화를 확인하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 메시지' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

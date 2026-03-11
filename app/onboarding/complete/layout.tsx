import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '자기소개서 작성 | 임주해',
  description: '임주해(Rentme) 세입자 프로필 설정 단계 3: 집주인에게 보낼 자기소개서를 작성하고 프로필을 완성하세요. AI가 작성을 도와드립니다.',
  openGraph: {
    title: '자기소개서 작성 | 임주해',
    description: '임주해(Rentme) 세입자 프로필 설정 단계 3: 자기소개서를 작성하고 프로필을 완성하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 자기소개서 작성' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function CompleteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

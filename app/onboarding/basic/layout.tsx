import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '기본 정보 입력 | 임주해',
  description: '임주해(Rentme) 세입자 프로필 설정 단계 1: 이름, 연령대, 가구 유형, 반려동물, 흡연 여부 등 기본 정보를 입력해주세요.',
  openGraph: {
    title: '기본 정보 입력 | 임주해',
    description: '임주해(Rentme) 세입자 프로필 설정 단계 1: 기본 정보를 입력해주세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 기본 정보 입력' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function BasicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '세입자 찾기 | 임주해',
  description: '임주해(Rentme)에서 공개 동의된 확인 항목이 있는 세입자 프로필을 검색하세요. 연령대, 가구 유형, 프로필 요약 점수 등 다양한 조건으로 맞는 세입자를 찾아볼 수 있습니다.',
  openGraph: {
    title: '세입자 찾기 | 임주해',
    description: '임주해(Rentme)에서 공개 동의된 확인 항목이 있는 세입자 프로필을 검색하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 세입자 찾기' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function TenantsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

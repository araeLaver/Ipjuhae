import type { Metadata } from 'next'
import { Home } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '프로필 설정',
  description: '임주해(Rentme)에서 세입자 프로필을 만들어보세요. 기본 정보와 생활 패턴을 입력하면 신뢰할 수 있는 세입자임을 집주인에게 증명할 수 있습니다.',
  openGraph: {
    title: '프로필 설정 | 임주해',
    description: '임주해(Rentme)에서 세입자 프로필을 만들어보세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '임주해 프로필 설정' }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background">
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">입주해</span>
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

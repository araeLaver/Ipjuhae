import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toast'
import { PageViewTracker } from '@/components/analytics/PageViewTracker'
import './globals.css'

const notoSansKR = Noto_Sans_KR({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap' })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ipjuhae.com'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: '임주해 - 좋은 세입자임을 증명하세요',
    template: '%s | 임주해',
  },
  description: '세입자 프로필을 생성하고 집주인에게 신뢰를 전달하세요. 전월세 구하기의 새로운 방법.',
  keywords: ['렌트미', '세입자 프로필', '임대차 매칭', '전세 구하기', '월세 매칭', '부동산 매칭', '역방향 매칭', '집주인 선택', '임대인 매칭', '세입자 신뢰점수'],
  openGraph: {
    title: '렌트미 - 세입자 프로필 기반 임대차 매칭',
    description: '세입자가 먼저 프로필을 만들고, 집주인이 선택하는 역방향 부동산 매칭 플랫폼',
    url: 'https://rentme.kr',
    siteName: '렌트미',
    locale: 'ko_KR',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '렌트미 - 세입자 프로필 기반 임대차 매칭 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '임주해 - 세입자 프로필 기반 부동산 매칭',
    description: '세입자 프로필을 만들고 집주인에게 먼저 어필하세요.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={notoSansKR.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <PageViewTracker />
          <main className="min-h-screen">
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

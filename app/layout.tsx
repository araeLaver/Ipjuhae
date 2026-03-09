import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ipjuhae.com'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: '입주해 - 좋은 세입자임을 증명하세요',
    template: '%s | 입주해',
  },
  description: '세입자 프로필을 생성하고 집주인에게 신뢰를 전달하세요. 전월세 구하기의 새로운 방법.',
  keywords: [
    '세입자', '임대', '프로필', '자기소개서', '집주인', '입주',
    '전월세', '부동산 매칭', '임대차', '입주 자기소개서', '세입자 매칭',
    '세입자 프로필', '임대 신뢰점수',
  ],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    siteName: '입주해',
    title: '입주해 - 세입자 프로필 기반 부동산 매칭',
    description: '세입자 프로필을 만들고 집주인에게 먼저 어필하세요. 전월세 구하기의 새로운 방법.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '입주해 - 세입자 프로필 기반 부동산 매칭',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '입주해 - 세입자 프로필 기반 부동산 매칭',
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
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <main className="min-h-screen">
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

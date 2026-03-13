import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toast'
import { PageViewTracker } from '@/components/analytics/PageViewTracker'
import './globals.css'

const notoSansKR = Noto_Sans_KR({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap' })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ipjuhae.com'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: '임주해 | 세입자 프로필 기반 부동산 매칭',
    template: '%s | 임주해',
  },
  description: '신뢰할 수 있는 세입자 프로필로 집주인과 세입자를 매칭하는 서비스',
  keywords: ['임주해', '세입자 프로필', '임대차 매칭', '전세 구하기', '월세 매칭', '부동산 매칭', '역방향 매칭', '집주인 선택', '임대인 매칭', '세입자 신뢰점수'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: APP_URL,
    siteName: '임주해',
    title: '임주해 | 세입자 프로필 기반 부동산 매칭',
    description: '신뢰할 수 있는 세입자 프로필로 집주인과 세입자를 매칭하는 서비스',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '임주해 - 세입자 프로필 기반 부동산 매칭 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '임주해 | 세입자 프로필 기반 부동산 매칭',
    description: '신뢰할 수 있는 세입자 프로필로 집주인과 세입자를 매칭하는 서비스',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '임주해',
  url: APP_URL,
  logo: `${APP_URL}/icon.png`,
  description: '신뢰할 수 있는 세입자 프로필로 집주인과 세입자를 매칭하는 서비스',
  sameAs: [],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
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

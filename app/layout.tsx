import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ipjuhae.com'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: '입주해 | 주거 신뢰 리포트 기반 부동산 매칭',
    template: '%s | 입주해',
  },
  description: '세입자, 임대인, 주택의 확인 항목을 분리해 임대차 판단을 돕는 주거 신뢰 리포트 서비스',
  keywords: ['입주해', '세입자 프로필', '주거 신뢰 리포트', '임대차 매칭', '전세 구하기', '월세 매칭', '부동산 매칭', '역방향 매칭', '집주인 선택', '임대인 매칭', '프로필 요약 점수'],
  applicationName: '입주해',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '입주해',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: '/icon', sizes: '32x32', type: 'image/png' },
      { url: '/app-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/app-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: APP_URL,
    siteName: '입주해',
    title: '입주해 | 주거 신뢰 리포트 기반 부동산 매칭',
    description: '세입자, 임대인, 주택의 확인 항목을 분리해 임대차 판단을 돕는 주거 신뢰 리포트 서비스',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '입주해 - 주거 신뢰 리포트 기반 부동산 매칭 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '입주해 | 주거 신뢰 리포트 기반 부동산 매칭',
    description: '세입자, 임대인, 주택의 확인 항목을 분리해 임대차 판단을 돕는 주거 신뢰 리포트 서비스',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#B95545',
  colorScheme: 'light dark',
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '입주해',
  url: APP_URL,
  logo: `${APP_URL}/icon.png`,
  description: '세입자, 임대인, 주택의 확인 항목을 분리해 임대차 판단을 돕는 주거 신뢰 리포트 서비스',
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
      <body className="font-sans">
        <Providers>
          <main className="min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}

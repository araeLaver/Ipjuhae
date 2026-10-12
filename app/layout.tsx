import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/providers'
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar'
import './globals.css'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ipjuhae.com'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: '입주해 | 계약 전에 물어보는 곳',
    template: '%s | 입주해',
  },
  description: '가입 없이 보증금 부담을 점검하고 후보 집을 비교하세요. 계약 전 확인 기록과 공식 주거 정책소식을 이어볼 수 있습니다.',
  keywords: ['입주해', '전세 보증금', '보증금 안전', '깡통전세', '등기부 보는 법', '근저당', '전세사기 예방', '확정일자', '전입신고', '전세 계약 주의사항'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: APP_URL,
    siteName: '입주해',
    title: '입주해 | 계약 전에 물어보는 곳',
    description: '내 보증금을 점검하고 집 후보를 비교하세요. 아직 확인하지 못한 일을 정리하고 준비 기록을 가져갈 수 있습니다.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '입주해 - 보증금 점검과 계약 준비',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '입주해 | 계약 전에 물어보는 곳',
    description: '내 보증금을 점검하고 집 후보를 비교하세요. 계약 전 확인 기록을 정리하고 이어볼 수 있습니다.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '입주해',
  },
}

export const viewport: Viewport = {
  themeColor: '#f0663f',
  width: 'device-width',
  initialScale: 1,
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '입주해',
  url: APP_URL,
  logo: `${APP_URL}/icon.png`,
  description: '보증금 점검, 집 후보 비교와 계약 전 확인 기록을 제공하는 서비스',
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
      <body className="font-sans antialiased">
        <ServiceWorkerRegistrar />
        <Providers>
          <main className="min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}

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
  description: '전세 계약 전에 보증금이 안전한지 확인하세요. 등기부 읽는 법과 계약 전 확인할 것을 정리해 두었습니다.',
  keywords: ['입주해', '전세 보증금', '보증금 안전', '깡통전세', '등기부 보는 법', '근저당', '전세사기 예방', '확정일자', '전입신고', '전세 계약 주의사항'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: APP_URL,
    siteName: '입주해',
    title: '입주해 | 계약 전에 물어보는 곳',
    description: '전세 계약 전에 보증금이 안전한지 확인하세요. 숫자를 넣으면 바로 계산해 드립니다.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '입주해 - 계약 전에 보증금이 안전한지 확인하는 곳',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '입주해 | 계약 전에 물어보는 곳',
    description: '전세 계약 전에 보증금이 안전한지 확인하세요. 숫자를 넣으면 바로 계산해 드립니다.',
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

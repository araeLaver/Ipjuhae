import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: '임주해 - 좋은 세입자임을 증명하세요',
    template: '%s | 임주해',
  },
  description: '세입자 프로필을 생성하고 집주인에게 신뢰를 전달하세요. 임주해는 세입자 프로필 기반 부동산 매칭 플랫폼입니다.',
  keywords: ['세입자', '임대', '프로필', '자기소개서', '집주인', '입주', '부동산', '매칭', '임주해', 'Rentme'],
  openGraph: {
    type: 'website',
    siteName: '임주해 (Rentme)',
    title: '임주해 - 좋은 세입자임을 증명하세요',
    description: '세입자 프로필을 생성하고 집주인에게 신뢰를 전달하세요. 임주해는 세입자 프로필 기반 부동산 매칭 플랫폼입니다.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '임주해 - 세입자 프로필 기반 부동산 매칭 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '임주해 - 좋은 세입자임을 증명하세요',
    description: '세입자 프로필을 생성하고 집주인에게 신뢰를 전달하세요.',
    images: ['/og-image.png'],
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

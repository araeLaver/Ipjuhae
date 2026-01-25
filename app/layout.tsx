import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '입주해 - 좋은 세입자임을 증명하세요',
  description: '세입자 프로필을 생성하고 집주인에게 신뢰를 전달하세요.',
  keywords: ['세입자', '임대', '프로필', '자기소개서', '집주인', '입주'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}

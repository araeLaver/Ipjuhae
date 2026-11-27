import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { HugCheckCalculator } from '@/components/tools/hug-check-calculator'

export const metadata: Metadata = {
  title: 'HUG 전세보증보험 126% 계산기 — 가입 가능 한도 10초 확인',
  description:
    '빌라·오피스텔 공시가격 126% 룰과 아파트 시세 90% 룰 기준으로 HUG 전세보증금반환보증 가입 가능 여부와 안전 보증금 상한선을 무료로 계산해 보세요.',
  openGraph: {
    title: 'HUG 전세보증보험 126% 가입 가능 계산기 | 입주해',
    description: '공시가격 126% · 시세 90% 기준으로 보증보험 한도를 10초 만에 확인하세요.',
    url: 'https://www.ipjuhae.com/tools/hug-check',
    siteName: '입주해',
    locale: 'ko_KR',
    type: 'website',
  },
  alternates: { canonical: 'https://www.ipjuhae.com/tools/hug-check' },
}

export default function HugCheckPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-10 sm:py-14">
        <HugCheckCalculator />
        <div className="mx-auto mt-10 flex w-full max-w-xl flex-wrap gap-4 border-t pt-6 text-sm">
          <Link href="/check" className="font-semibold text-primary underline underline-offset-4">
            ← 보증금 위험 점검(등기부 자동 분석)
          </Link>
          <Link
            href="/tools/special-terms"
            className="font-semibold text-primary underline underline-offset-4"
          >
            전세 필수 특약 생성기 →
          </Link>
        </div>
      </main>
    </div>
  )
}

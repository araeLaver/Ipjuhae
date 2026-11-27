import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { SpecialTermsGenerator } from '@/components/tools/special-terms-generator'

export const metadata: Metadata = {
  title: '전세 계약 필수 특약 생성기 — 근저당·보증보험·전세대출 특약 모음',
  description:
    '근저당 말소, 전세보증보험 가입, 전세자금대출, 권리변동 금지 등 내 집 조건에 맞는 전월세 필수 특약과 중개사 카톡 요청 문자를 10초 만에 무료로 만들어 보세요.',
  openGraph: {
    title: '전월세 계약 필수 특약 생성기 | 입주해',
    description: '근저당·보증보험·전세대출 조건별 필수 특약과 중개사 요청 문자를 바로 복사하세요.',
    url: 'https://www.ipjuhae.com/tools/special-terms',
    siteName: '입주해',
    locale: 'ko_KR',
    type: 'website',
  },
  alternates: { canonical: 'https://www.ipjuhae.com/tools/special-terms' },
}

export default function SpecialTermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-10 sm:py-14">
        <SpecialTermsGenerator />
        <div className="mx-auto mt-10 flex w-full max-w-2xl flex-wrap gap-4 border-t pt-6 text-sm">
          <Link href="/check" className="font-semibold text-primary underline underline-offset-4">
            ← 보증금 위험 점검
          </Link>
          <Link
            href="/tools/hug-check"
            className="font-semibold text-primary underline underline-offset-4"
          >
            HUG 126% 보증보험 계산기 →
          </Link>
        </div>
      </main>
    </div>
  )
}

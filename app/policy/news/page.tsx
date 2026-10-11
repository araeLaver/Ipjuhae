import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { PolicyNews } from '@/components/policy-news'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: '주거 정책소식',
  description:
    '전월세, 주거 지원, 공공주택과 청약에 관한 공식 발표를 최근 발표일과 수집 시각으로 확인하세요.',
  alternates: { canonical: '/policy/news' },
}

export default function PolicyNewsPage() {
  return (
    <>
      <Header />
      <main>
        <div className="mx-auto max-w-5xl px-4 pb-6 pt-8">
          <Link href="/" className="text-sm text-muted-foreground underline">
            홈으로
          </Link>
          <h1 className="mt-4 text-3xl font-bold">주거 정책소식</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            내 계약과 주거 계획에 필요한 발표를 찾아보세요. 상세 조건과 신청
            일정은 공식 원문에서 확인하세요.
          </p>
          <Link
            href="/policy"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
          >
            전세 제도 정리 보기 →
          </Link>
        </div>
        <PolicyNews />
      </main>
    </>
  )
}

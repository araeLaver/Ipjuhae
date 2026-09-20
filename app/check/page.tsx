import type { Metadata } from 'next'
import Link from 'next/link'
import { DepositRiskCheck } from '@/components/deposit-risk-check'

/**
 * SNS에서 들어오는 사람이 처음 닿는 곳.
 *
 * 글만 있는 페이지는 읽고 나간다. 직접 숫자를 넣어보고 답을 받으면 한 번 더 온다.
 * 커뮤니티로 가는 길을 위아래에 둔다.
 */
export const metadata: Metadata = {
  // 루트 레이아웃이 "| 입주해"를 붙이므로 여기서는 붙이지 않는다.
  title: '보증금 돌려받을 수 있는 집인가',
  description:
    '전세 계약 전에 등기부와 시세 숫자를 넣으면 보증금이 안전한지 계산해 드립니다. 가입 없이 바로 확인하세요.',
  openGraph: {
    title: '보증금, 돌려받을 수 있는 집인가',
    description: '등기부와 시세 숫자를 넣으면 계약 전에 확인할 것을 알려드립니다.',
    url: 'https://www.ipjuhae.com/check',
    siteName: '입주해',
    locale: 'ko_KR',
    type: 'website',
  },
  alternates: { canonical: 'https://www.ipjuhae.com/check' },
}

export default function CheckPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-14">
      <DepositRiskCheck />

      <div className="mx-auto mt-10 w-full max-w-xl border-t pt-6">
        <p className="text-sm text-muted-foreground">
          계약 전에 확인할 것을 순서대로 정리해 두었습니다. 등기부 읽는 법 12편, 임대인이 확인할 것
          6편.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-4"
        >
          입주해 커뮤니티로 가기
        </Link>
      </div>
    </main>
  )
}

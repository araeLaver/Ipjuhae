import type { Metadata } from 'next'
import Link from 'next/link'
import { TesterSteps } from '@/components/tester-steps'

/**
 * 테스터 모집 한 장.
 *
 * 지금까지 테스터 링크는 홈 배너와 `/check` 결과 아래에 묻혀 있었다.
 * 사람에게 보낼 때는 "홈 들어가서 아래로 내리면 배너가 있는데요"가 아니라
 * **주소 하나**여야 한다. 카톡·오픈채팅·댓글에 그대로 붙일 수 있는 길이.
 *
 * 색인하지 않는다. 검색으로 들어올 페이지가 아니고, 12명이 차면 사라질 페이지다.
 * 색인해 두면 조건이 끝난 뒤에도 검색 결과에 남아 사람을 헷갈리게 한다.
 */
export const metadata: Metadata = {
  title: '테스터로 참여해 주세요',
  description:
    '전세 보증금이 안전한지 계산해 주는 앱입니다. 정식 출시까지 테스터 12명이 필요합니다. 버튼 한 번이면 됩니다.',
  robots: { index: false, follow: false },
  openGraph: {
    title: '입주해 안드로이드 테스터로 참여해 주세요',
    description: '전세 계약 전에 보증금이 안전한지 계산해 주는 앱입니다. 버튼 한 번이면 됩니다.',
    url: 'https://www.ipjuhae.com/tester',
    siteName: '입주해',
    locale: 'ko_KR',
    type: 'website',
  },
}

export default function TesterPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <header className="space-y-4">
          <h1 className="text-balance text-2xl font-bold leading-snug sm:text-3xl">
            전세 계약 전에 보증금이 안전한지
            <br />
            계산해 주는 앱입니다
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            등기부와 시세에서 읽은 숫자를 넣으면 집이 경매로 넘어갔을 때 얼마가 남는지까지
            알려드립니다. 국토교통부 실거래가를 붙여서 시세는 직접 찾지 않으셔도 됩니다.
          </p>
          <p className="text-sm leading-relaxed">
            <Link href="/check" className="font-semibold text-primary underline underline-offset-4">
              먼저 웹에서 써보기
            </Link>
          </p>
        </header>

        <section className="rounded-xl border border-primary/25 bg-primary/5 p-5">
          <h2 className="text-base font-bold">부탁드릴 것은 버튼 한 번입니다</h2>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            구글은 새로 만든 개인 개발자 계정에 대해{' '}
            <strong className="font-semibold text-foreground">
              테스터 12명이 14일 동안 참여
            </strong>
            할 것을 요구합니다. 사람 수가 차지 않으면 정식 출시를 신청조차 할 수 없습니다.
            지금 그 조건을 채우는 중입니다.
          </p>
        </section>

        <TesterSteps />

        <section className="space-y-3 border-t pt-6">
          <h2 className="text-sm font-bold">이런 점이 궁금하실 것 같습니다</h2>

          <div className="space-y-3 text-sm leading-relaxed">
            <div>
              <p className="font-semibold">개인정보를 받나요</p>
              <p className="text-muted-foreground">
                받지 않습니다. 가입 없이 쓰고, 계산에 넣으신 금액은 저장하지 않습니다. 구글에
                보이는 것은 테스터로 참여했다는 사실뿐입니다.
              </p>
            </div>
            <div>
              <p className="font-semibold">아이폰도 되나요</p>
              <p className="text-muted-foreground">
                이 참여는 안드로이드만 됩니다. 아이폰은{' '}
                <Link href="/install" className="text-primary underline underline-offset-4">
                  홈 화면에 추가
                </Link>
                해서 쓰실 수 있습니다.
              </p>
            </div>
            <div>
              <p className="font-semibold">나중에 그만둘 수 있나요</p>
              <p className="text-muted-foreground">
                언제든 참여를 해제하실 수 있습니다. 다만 14일 안에 해제하시면 그분의 기간이 처음부터
                다시 시작되니, 어려우시면 처음부터 안 하시는 편이 낫습니다.
              </p>
            </div>
            <div>
              <p className="font-semibold">불편한 점은 어디에 말하나요</p>
              <p className="text-muted-foreground">
                ipjuhae.official@gmail.com 으로 보내주시거나{' '}
                <Link href="/community" className="text-primary underline underline-offset-4">
                  커뮤니티
                </Link>
                에 남겨주세요. 고치는 게 이 테스트의 목적입니다.
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            입주해는 계약 판단을 대신해 드리지 않습니다. 계산은 넣으신 숫자만 가지고 하는 것이며,
            등기부에 적히지 않는 위험도 있습니다.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-primary underline underline-offset-4"
          >
            입주해 홈으로
          </Link>
        </footer>
      </div>
    </main>
  )
}

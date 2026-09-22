import type { Metadata } from 'next'
import Link from 'next/link'
import { InstallGuide } from '@/components/install-guide'

/**
 * 앱 설치 안내.
 *
 * 구글 플레이 공개는 테스터 12명 14일에 막혀 있다. 그때까지 손 놓고 있을 수 없으니
 * 플레이스토어를 거치지 않는 길을 정리해 둔다. 안드로이드는 APK, 아이폰은 홈 화면 추가다.
 *
 * 플레이스토어가 열리면 이 페이지의 첫 칸만 스토어 버튼으로 바꾸면 된다.
 */
export const metadata: Metadata = {
  title: '앱으로 쓰기',
  description:
    '입주해를 폰에 설치하는 방법입니다. 안드로이드는 설치 파일로, 아이폰은 홈 화면 추가로 바로 쓰실 수 있습니다.',
  openGraph: {
    title: '입주해 앱으로 쓰기',
    description: '폰에 설치해서 계약 전에 바로 확인하세요.',
    url: 'https://www.ipjuhae.com/install',
    siteName: '입주해',
    locale: 'ko_KR',
    type: 'website',
  },
  alternates: { canonical: 'https://www.ipjuhae.com/install' },
}

export default function AppPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-balance text-2xl font-bold leading-snug sm:text-3xl">
            폰에 설치해서 쓰기
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            설치하지 않고{' '}
            <Link href="/check" className="text-primary underline underline-offset-4">
              웹에서 바로
            </Link>{' '}
            쓰셔도 됩니다. 자주 보실 거면 홈 화면에 두는 편이 편합니다.
          </p>
        </header>

        <InstallGuide />

        <section className="space-y-2 border-t pt-6">
          <h2 className="text-sm font-bold">플레이스토어에는 언제 올라오나요</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            구글은 새로 만든 개인 개발자 계정에 대해 테스터 12명이 14일 동안 계속 참여해야
            정식 출시를 신청할 수 있게 해 두었습니다. 그 조건을 채우는 중입니다. 먼저 써보시고
            불편한 점을 알려주시면 그게 가장 큰 도움이 됩니다.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            테스터로 참여해 주실 수 있다면{' '}
            <a
              href="https://play.google.com/apps/testing/com.ipjuhae.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              이 링크
            </a>
            에서 신청하실 수 있습니다. 안드로이드 폰과 구글 계정이 필요합니다.
          </p>
        </section>
      </div>
    </main>
  )
}

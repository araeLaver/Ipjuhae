'use client'

/**
 * 첫 화면의 앱·테스터 칸.
 *
 * `/check` 결과 아래에 붙는 TesterInvite와 역할이 다르다. 저쪽은 계산을 해본
 * 사람에게 권하는 것이고, 이쪽은 처음 온 사람에게 "앱도 있다"를 알리는 자리다.
 * 그래서 문장이 짧고, 테스터 부탁은 뒤에 둔다.
 *
 * 12명 14일이라는 사정을 숨기지 않는다. "베타 참여"라고만 적으면
 * 눌러본 사람이 무엇을 해야 하는지 모른 채 빠져나간다.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics-client'
import { getAttribution } from '@/lib/attribution'

export function TesterBanner() {
  useEffect(() => {
    track('tester_invite_shown', {
      properties: { surface: 'home', ...getAttribution() },
    })
  }, [])

  return (
    <aside className="rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-8">
      <h2 className="text-balance text-xl font-bold leading-snug">
        안드로이드 테스터 12명을 모집합니다
      </h2>

      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        보증금을 점검하고 계약 전 확인 일을 정리하는 앱의 정식 출시를 준비하고 있습니다.
        안드로이드와 구글 계정이 있다면 14일 테스트에 참여해 주세요. 계산은 가입 없이
        웹에서도 바로 써볼 수 있습니다.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/tester?from=home_banner"
          onClick={() =>
            track('tester_invite_clicked', {
              properties: { surface: 'home', ...getAttribution() },
            })
          }
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          테스터 참여 방법 보기
        </Link>
        <Link
          href="/check?from=home_banner"
          onClick={() =>
            track('check_started', {
              properties: { surface: 'home', ...getAttribution() },
            })
          }
          className="inline-flex items-center justify-center rounded-lg border bg-background px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted/50"
        >
          웹에서 먼저 써보기
        </Link>
      </div>

      <div className="mt-6 border-t border-primary/15 pt-5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          테스터로 참여하지 않아도 보증금 점검, 후보 비교, 계약 전 확인 기록은 웹에서
          무료로 이용할 수 있습니다.
        </p>
      </div>
    </aside>
  )
}

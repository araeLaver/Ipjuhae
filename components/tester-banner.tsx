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

const TESTING_URL = 'https://play.google.com/apps/testing/com.ipjuhae.app'

export function TesterBanner() {
  useEffect(() => {
    track('tester_invite_shown', {
      properties: { surface: 'home', ...getAttribution() },
    })
  }, [])

  return (
    <aside className="rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-8">
      <h2 className="text-balance text-xl font-bold leading-snug">
        폰에 두고 쓰실 수 있습니다
      </h2>

      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        집을 몇 군데 보실 거라면 홈 화면에 두고 그때그때 숫자를 넣어보시는 편이 편합니다.
        안드로이드와 아이폰 모두 설치됩니다.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/install"
          onClick={() =>
            track('install_guide_clicked', {
              properties: { surface: 'home', ...getAttribution() },
            })
          }
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          설치 방법 보기
        </Link>
        <a
          href={TESTING_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track('tester_invite_clicked', {
              properties: { surface: 'home', ...getAttribution() },
            })
          }
          className="inline-flex items-center justify-center rounded-lg border bg-background px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted/50"
        >
          안드로이드 테스터로 참여
        </a>
      </div>

      <div className="mt-6 border-t border-primary/15 pt-5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          플레이스토어 정식 출시는 테스터 12명이 14일 동안 참여해야 신청할 수 있습니다.
          구글 정책이라 사람 수가 차야 공개가 됩니다. 참여해 주시면 링크에서 테스터 되기를
          누르고 설치하신 뒤, 2주 동안 그대로 두시면 됩니다. 안드로이드 폰과 구글 계정이
          필요합니다.
        </p>
      </div>
    </aside>
  )
}

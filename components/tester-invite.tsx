'use client'

/**
 * 앱 테스터 모집.
 *
 * 계산 결과를 본 직후에만 보여준다. 페이지에 들어오자마자 "앱 깔아주세요"는
 * 아무도 안 누른다. 자기 보증금이 얼마나 위험한지 본 사람은 다르다.
 *
 * 정식 출시까지 12명이 14일 필요하다는 사정을 숨기지 않는다.
 * 부탁이라고 말하는 쪽이 "베타 참여하기"보다 실제로 눌린다.
 *
 * 노출과 클릭을 익명으로 센다. 어느 모집 채널이 살아있는지 감으로 판단하지
 * 않기 위해서다. 보내는 건 화면 구분과 유입 태그뿐이고, 사용자 식별자나
 * /check에 넣은 금액은 함께 보내지 않는다.
 */

import { useEffect } from 'react'
import { track } from '@/lib/analytics-client'
import { getAttribution } from '@/lib/attribution'

const TESTING_URL = 'https://play.google.com/apps/testing/com.ipjuhae.app'

export function TesterInvite() {
  // 이 컴포넌트는 결과를 본 뒤에만 렌더된다. 즉 마운트 = 노출이다.
  useEffect(() => {
    track('tester_invite_shown', {
      properties: { surface: 'web', ...getAttribution() },
    })
  }, [])

  function onInstallClick() {
    track('install_guide_clicked', {
      properties: { surface: 'web', ...getAttribution() },
    })
  }

  function onJoinClick() {
    track('tester_invite_clicked', {
      properties: { surface: 'web', ...getAttribution() },
    })
  }

  return (
    <aside className="rounded-xl border border-primary/25 bg-primary/5 p-5">
      <h2 className="text-balance text-base font-bold leading-snug">
        폰에 두고 쓰실 수 있습니다
      </h2>

      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        계약은 한 번에 끝나지 않습니다. 집을 몇 군데 보실 거라면 홈 화면에 두고 그때그때
        넣어보시는 편이 편합니다. 설치는 1분이면 됩니다.
      </p>

      <a
        href="/install"
        onClick={onInstallClick}
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
      >
        설치 방법 보기
      </a>

      <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground">
        안드로이드는 설치 파일로, 아이폰은 홈 화면 추가로 바로 쓰실 수 있습니다.
      </p>

      <div className="mt-4 border-t border-primary/15 pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          플레이스토어 정식 출시는 테스터 12명이 14일 동안 참여해야 신청할 수 있습니다.
          도와주실 수 있다면{' '}
          <a
            href={TESTING_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onJoinClick}
            className="font-semibold text-primary underline underline-offset-4"
          >
            테스터로 참여
          </a>
          해 주세요. 안드로이드 폰과 구글 계정이 필요합니다.
        </p>
      </div>
    </aside>
  )
}

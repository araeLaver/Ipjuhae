'use client'

/**
 * 테스터가 될 때까지의 순서.
 *
 * 카운터가 세는 건 **옵트인**이다. 콘솔 문구가 "참여를 선택한 테스터 N명"이다.
 * 그래서 1번이 끝나면 숫자는 이미 올라간다 — 그 사실을 숨기지 않고 적는다.
 * "설치까지 해야 한다"고 말하면 부담이 커져서 1번마저 안 누른다.
 *
 * 다만 설치와 실제 사용은 따로 부탁한다. 구글이 승인 심사에서 참여가 실제로
 * 있었는지 보기 때문이다. 숫자만 채우고 아무도 안 쓴 테스트는 거절된다.
 */

import { useEffect } from 'react'
import { track } from '@/lib/analytics-client'
import { getAttribution } from '@/lib/attribution'

const TESTING_URL = 'https://play.google.com/apps/testing/com.ipjuhae.app'

const STEPS = [
  {
    n: 1,
    title: '아래 버튼을 눌러 "테스터 되기"를 누릅니다',
    body: '안드로이드 폰에서 열어주세요. 폰에 로그인된 구글 계정으로 참여됩니다. 여기까지가 저희에게 꼭 필요한 부분입니다.',
  },
  {
    n: 2,
    title: '같은 화면의 "Google Play에서 다운로드"로 설치합니다',
    body: '몇 분 뒤에 열려 보이기도 합니다. 바로 안 되면 잠시 후 다시 눌러주세요.',
  },
  {
    n: 3,
    title: '앱을 한 번 열어 숫자를 넣어봅니다',
    body: '구글이 정식 출시를 심사할 때 테스터가 실제로 써봤는지를 봅니다. 한 번만 써보셔도 충분합니다.',
  },
  {
    n: 4,
    title: '2주 동안 참여를 해제하지 말아주세요',
    body: '앱을 지우셔도 참여 상태는 남습니다. 해제만 하지 않으시면 됩니다.',
  },
]

export function TesterSteps() {
  useEffect(() => {
    track('tester_invite_shown', {
      properties: { surface: 'tester_page', ...getAttribution() },
    })
  }, [])

  return (
    <section className="space-y-5">
      <a
        href={TESTING_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          track('tester_invite_clicked', {
            properties: { surface: 'tester_page', ...getAttribution() },
          })
        }
        className="flex w-full items-center justify-center rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground transition-opacity hover:opacity-90"
      >
        테스터로 참여하기
      </a>

      <p className="text-center text-xs text-muted-foreground">
        안드로이드 폰과 구글 계정이 필요합니다
      </p>

      <ol className="space-y-4">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {s.n}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-snug">{s.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="rounded-lg bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        링크를 눌렀는데 &ldquo;테스터가 아닙니다&rdquo;가 뜨면, 폰에 로그인된 구글 계정이 다른
        경우입니다. 쓰시는 계정 주소를 알려주시면 등록해 드리겠습니다.
      </p>
    </section>
  )
}

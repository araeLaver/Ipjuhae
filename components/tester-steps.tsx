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

const GROUP_URL = 'https://groups.google.com/g/ipjuhae-testers'
const TESTING_URL = 'https://play.google.com/apps/testing/com.ipjuhae.app'

const STEPS = [
  {
    n: 1,
    title: '먼저 "구글 그룹 참여하기"를 눌러 그룹에 가입합니다',
    body: '열린 화면에서 "그룹 가입"을 한 번만 누르면 별도로 이메일을 보내주지 않으셔도 바로 테스터 자격이 생깁니다.',
  },
  {
    n: 2,
    title: '돌아와서 "테스터로 참여하기"를 눌러 "테스터 되기"를 누릅니다',
    body: '안드로이드 폰에서 그룹에 가입한 같은 구글 계정으로 참여됩니다. 여기까지가 저희에게 꼭 필요한 부분입니다.',
  },
  {
    n: 3,
    title: '같은 화면의 "Google Play에서 다운로드"로 설치하고 한 번 열어봅니다',
    body: '구글이 정식 출시를 심사할 때 테스터가 실제로 써봤는지를 봅니다. 앱을 한 번 열어 숫자를 넣어보시면 충분합니다.',
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
      <div className="space-y-2.5">
        <a
          href={GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track('tester_invite_clicked', {
              properties: { surface: 'tester_page_group', ...getAttribution() },
            })
          }
          className="flex w-full items-center justify-center rounded-xl border-2 border-primary bg-background px-6 py-4 text-base font-bold text-primary transition-colors hover:bg-primary/5"
        >
          1단계: 구글 그룹 참여하기
        </a>

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
          2단계: 테스터로 참여하기
        </a>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        안드로이드 폰과 구글 계정이 필요합니다 (1단계와 2단계 모두 같은 구글 계정으로 진행해 주세요)
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
        2단계에서 &ldquo;앱을 사용할 수 없음&rdquo; 또는 &ldquo;테스터가 아닙니다&rdquo;가 뜨면,
        1단계 구글 그룹에 가입한 계정과 Google Play에 로그인된 계정이 다른 경우입니다. 같은
        구글 계정으로 다시 열어주세요.
      </p>
    </section>
  )
}

/**
 * 앱 테스터 모집.
 *
 * 계산 결과를 본 직후에만 보여준다. 페이지에 들어오자마자 "앱 깔아주세요"는
 * 아무도 안 누른다. 자기 보증금이 얼마나 위험한지 본 사람은 다르다.
 *
 * 정식 출시까지 12명이 14일 필요하다는 사정을 숨기지 않는다.
 * 부탁이라고 말하는 쪽이 "베타 참여하기"보다 실제로 눌린다.
 */

const TESTING_URL = 'https://play.google.com/apps/testing/com.ipjuhae.app'

export function TesterInvite() {
  return (
    <aside className="rounded-xl border border-primary/25 bg-primary/5 p-5">
      <h2 className="text-balance text-base font-bold leading-snug">
        이 계산, 폰에서도 쓰실 수 있게 하는 중입니다
      </h2>

      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        안드로이드 앱을 만들어 뒀는데, 정식 출시하려면 12명이 2주 동안 설치해 두어야 합니다.
        구글 정책이라 사람 수가 안 차면 공개가 안 됩니다. 도와주시면 계속 쓰실 수 있게
        만들겠습니다.
      </p>

      <a
        href={TESTING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
      >
        테스터로 참여하기
      </a>

      <ul className="mt-3.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        <li>안드로이드 폰과 구글 계정이 필요합니다. 아이폰은 아직 안 됩니다</li>
        <li>링크에서 테스터 되기를 누르고 설치하시면 됩니다</li>
        <li>2주 동안 지우지만 않으시면 됩니다</li>
      </ul>
    </aside>
  )
}

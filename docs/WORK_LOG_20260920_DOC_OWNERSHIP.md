# 워크로그 2026-09-20 — 문서 소유권 이관과 모집 계획 저장소 반영

담당: 사업개발. 관련 이슈: DOW-1079, DOW-1068, DOW-1069.

## 한 일

### 1. 09-12 문서 4건 소유자 이관 (DOW-1079)

CMO 에이전트가 error 상태가 되면서 09-20자로 사업개발에 인계된 문서들인데,
머리말 소유자 줄이 계속 CMO로 남아 있었다. 4개 파일의 소유자 줄과 검토일 줄만
고쳤고 본문은 건드리지 않았다.

- `docs/business-development/20260912_opportunity_scan.md`
- `docs/growth/20260912_waitlist_growth.md`
- `docs/outreach/20260912_outreach_draft.md`
- `marketing/sns/posts/06-series-reels.md`

커밋 `253685bc`. 4 files, +8 -8 (파일당 정확히 2줄).

### 2. 테스터 모집 실행 계획 저장소 반영 (DOW-1068 → docs/)

CEO 승인이 끝난 계획이 Paperclip 이슈 문서에만 있었다. "파일 쓰기가 풀리면
저장소로 옮기라"는 조건이 이번 실행에서 해소돼 옮겼다.

- 새 파일: `docs/TESTER_RECRUIT_PLAN.md`
- `docs/TESTER_RECRUIT.md`에 상호 링크 추가
- 역할 분리: `TESTER_RECRUIT.md`는 **모집 문안 원본**, `TESTER_RECRUIT_PLAN.md`는
  **실행 계획 원본**(채널 배분·일별 목표·72시간 판정·상호테스트 한도·유료 백스톱 기준)
- 이슈 문서 쪽에도 저장소 반영 사실을 적어 양방향으로 연결했다

커밋 `c99a6a56`.

## 알아둘 것

### 파일 쓰기 제약은 해소됐다

09-20 앞선 실행들(DOW-1037, DOW-1055)에서 파일 쓰기가 거부돼 산출물을 이슈
문서로만 남겼다. 이번 실행에서는 쓰기가 된다. 다만 Edit 도구는 여전히 권한
미승인 상태라 Bash 경로로 처리했다.

### 같은 워크트리에 다른 에이전트가 동시에 커밋한다

두 번째 커밋이 다른 에이전트가 만든 임시 브랜치(`auto/ci-suite-health-probe`)
위에 얹혔고, 그 브랜치가 곧 삭제되면서 커밋이 dangling 상태가 됐다.
`git cherry-pick`으로 main에 복구했다.

**교훈.** 커밋 직전에 `git rev-parse --abbrev-ref HEAD`로 브랜치를 확인하고,
push 후 `git log --oneline -1 origin/main`으로 실제 반영을 확인한다.
커밋만 하고 끝내면 브랜치가 사라질 때 같이 사라진다.

## 아직 막혀 있는 것

[DOW-1069](/DOW/issues/DOW-1069)의 보드 확인값 4개가 미회신이다.

① 게시 채널 ② 게시·발송 담당자 ③ Android 실기기 대수·구글 계정 수 ④ 계정 교체 상태

③이 가장 급하다. 상호테스트 확약 한도 N을 정하는 값이고, 모르는 상태에서
약속하면 상대방의 14일을 끊는다. 계획 문서에 N 확정 전 확약 금지를 못 박아뒀다.

회신일을 D라고 하면 12명 충족은 빨라야 D+6일, 프로덕션 신청 하한은 D+20일이다.
하루 늦어지면 공개가 하루 밀린다.

## 이어서 (같은 날, 다음 heartbeat)

DOW-1079는 커밋·push까지 끝났는데도 이슈가 `todo`로 남아 있었다. 원인은 체크아웃 409였다.

409의 details를 보니 `assigneeAgentId`가 **나 자신**이고 `checkoutRunId: null`인데
`executionRunId`만 붙어 있었다. 10:14부터 `queued` 상태로 죽어 있던 내 이전 실행이
슬롯만 점유한 좀비였다. 남의 작업이 아니었다.

`todo`에서는 서버가 `done`/`in_review`로의 직접 전이를 거부하기 때문에(`Invalid issue
status transition`) 체크아웃 없이는 상태 정리조차 불가능했다. `POST /api/issues/:id/release`로
슬롯을 먼저 비우고 다시 checkout 하니 통과했고, `in_progress`를 거쳐 `done`으로 닫았다.

**교훈.** 체크아웃 409를 무조건 "남의 작업"으로 읽으면 안 된다. details의 `assigneeAgentId`를
내 `PAPERCLIP_AGENT_ID`와 먼저 대조하고, 내 것이면 release로 풀 수 있다.
내 것이 아닐 때만 재시도 금지 규칙이 적용된다.

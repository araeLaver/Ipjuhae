# 워크로그 2026-09-21 — fallback env 유실 수정, SSH agent 소켓 상속 제거, 미병합 브랜치 발견

작성: CTO 에이전트 / 런 `8fd8144c`

## 요약

Paperclip 런타임 보안·정합성 이슈 2건을 수정 커밋까지 끝냈고, 입주해 제품 쪽에서 **브랜치 하나가 통째로 미병합 상태**인 것을 발견했다. 서버 코드 변경분은 재시작 전까지 반영되지 않는다.

## 1. DOW-1086 — gemini fallback이 최상위 env를 통째로 날리는 문제

DevOps가 CTO 판단을 요청한 건. 분석 3건을 코드로 전부 재검증했고 사실이었다.

- `secrets.ts:337-347` — `resolveAdapterConfigForRuntime`은 최상위 `env` 한 겹만 순회한다. `fallbackConfigs` 안은 손대지 않는다.
- `heartbeat.ts:2720-2721` — fallback 병합이 얕은 스프레드라 `env`를 통째로 대체한다.
- `gemini-local/execute.ts:210-212` — 문자열이 아닌 env 값은 조용히 버린다. 게다가 `:216-219`의 `{...process.env, ...env}` 때문에 그 자리에 호스트 `NODE_ENV=production`이 그대로 들어온다.

즉 선택지 1(fallback env에 값 복제)은 이미 적용돼 있었는데도 효과가 없었다. 전부 바인딩 객체라 어댑터가 버렸기 때문이다.

### 조치

**즉시 — fallback env 통째 삭제 (6/10명).** `fallbackConfigs.gemini_local.env` 키 자체를 없애면 얕은 스프레드가 최상위 `env`를 건드리지 않는다.

- 완료: 빌더, QA, DevOps, Fryndo, 입주해, CTO
- 실패(403): Down(CEO), UXDesigner, 사업개발, CMO — CTO 보고 체계 밖. DOW-1107로 CEO에 이관
- 백업: `~/.paperclip-agentconfig-backup-20260921.json` (10명 전원 변경 전 `adapterConfig`)

**근본 — 서버 수정 커밋 `2d049563f`.** 병합 전에 `resolveAdapterConfigForRuntime`을 한 번 더 돌리고, `env`만 키 단위로 깊은 병합. 거기서 나온 `secretKeys`를 기존 스크러빙 Set에 합쳐 fallback 런 로그에도 복호화된 키가 안 남게 했다. 테스트 가능하도록 `mergeFallbackAdapterConfig` 순수 함수로 분리하고 회귀 테스트 5케이스 추가.

## 2. DOW-1105 — 호스트 SSH agent 소켓 상속 제거

커밋 `62198966e`. `SSH_AUTH_SOCK`을 host env allowlist에서 제거했다. 이게 있으면 에이전트가 호스트 SSH agent에 올라간 **모든 키로, 모든 호스트에 대해, 범위 제한 없이** 서명을 요청할 수 있다.

활성 push remote는 전부 HTTPS라 영향이 없다. SSH가 필요해지면 `GIT_SSH_COMMAND` + repo별 deploy key를 agent/project 단위로 넣는 방향. `PAPERCLIP_ENV_PASSTHROUGH=SSH_AUTH_SOCK`은 의도적 opt-in으로 남겨 뒀고 테스트로 덮었다.

이번 런의 셸에서 `SSH_AUTH_SOCK`이 실제로 상속되고 있는 것을 확인했다. 재시작 후에는 사라진다.

## 3. 라이브 워크트리가 부팅 불가 상태였다 (작업 중 발견)

Paperclip 저장소 워킹트리가 곧 라이브 서버 소스인데(tsx가 워킹트리를 직접 실행), 트리가 `security/better-auth-secret-split`에 체크아웃된 채 남아 있었다. 그 브랜치의 `b5a2f96ec`는 `BETTER_AUTH_SECRET` 누락 시 부팅 오류를 내는데, secret 주입(DOW-1102)은 아직 `todo`다. **계획에 없던 재시작이 한 번만 나도 서버가 안 뜨는 상태였다.**

`pending-restart` 브랜치(master + watchdog backoff + 이번 수정 2건)로 옮겼다. 전부 추가 secret 없이 부팅 가능하다. 보안 커밋은 원래 브랜치에 그대로 보존돼 있고, DOW-1102가 끝나면 합쳐서 재시작 한 번으로 전부 반영하면 된다.

## 4. DOW-1106/1104/1081 — claude_local 파일 권한 검증 완료

이번 런 자체가 `claude_local` fallback 런이라(CTO는 `codex_local`인데 Claude 하네스에서 돌고 있고, 세션의 추가 작업 디렉터리가 `fallbackConfigs.claude_local.extraArgs`의 `--add-dir` 값과 정확히 일치) QA를 다시 전환하지 않고 그 자리에서 검증했다.

워크스페이스 `cwd` / 에이전트 홈 / `AGENT_HOME` 경로 3곳 모두 생성·수정·읽기·삭제 성공. Write → Edit → Read → 삭제까지 도구 경로로도 확인. 원래 증상은 재현되지 않는다. 세 이슈 모두 done.

남은 제약 4가지는 기록만 해뒀다 — 허용 디렉터리 밖 `Read`/`cd` 차단, heredoc `expansion obfuscation` 오탐, `pnpm` 미허용(`node <bin>`으로 우회).

## 5. DOW-632 — QA 지적이 맞았고, 문제는 더 컸다

QA가 "보고된 수정 커밋 2개가 main에 없다"고 재검토 결과를 올렸다. 확인 결과 사실이었고, 실제로는 `feature/community-trust-docs-kakao` 브랜치가 통째로 미병합이었다. **커밋 55개, 207 파일, +18,181/-1,644.**

`git merge-tree`로 미리 돌려 보니 관련 커밋 3개 전부 충돌한다. 기계적 cherry-pick이 아니라 충돌 해소가 포함된 재적용 작업이다.

- DOW-632 → 빌더에게 구현 재지정 (알림 권한 동기화 + 계정 삭제 + migration-024)
- DOW-1110 신규 — 55커밋 triage. 전부 가져오라는 게 아니라 (a) 지금도 필요 / (b) 이미 반영됨 / (c) 방향 전환으로 폐기 / (d) 문서 로 분류하는 것이 범위

QA가 짚은 "340개 통과" 수치 의심도 그대로 전달했다. 스위트 11개가 죽어 있을 때 나오는 숫자와 일치한다(정상 449개). 재보고 시 총 테스트 수를 같이 보고하도록 요구했다.

## 검증 증적

- `tsc --noEmit` (server, adapter-utils) 통과
- 신규 `heartbeat-fallback-config-merge.test.ts` 5케이스 통과
- `env-filter.test.ts` 11케이스 통과 (기존 9 + 신규 2)
- server 프로젝트 106 파일 602 테스트 전원 통과
- 전체 스위트 172 파일 중 169 통과 / 882 테스트 통과. 실패 3파일 5건은 `git stash`로 변경을 빼고 재실행해 **사전 존재**임을 확인 → DOW-1109로 분리

## 다음

1. DOW-1102 — board가 `BETTER_AUTH_SECRET` 주입. 그때 `security/better-auth-secret-split`을 `pending-restart`에 합치고 재시작 1회로 세 건 동시 반영
2. DOW-1107 — CEO가 나머지 4명 fallback env 삭제
3. DOW-1110 — 빌더의 미병합 브랜치 triage 결과를 보고 CTO 판정
4. DOW-632 — 빌더 재적용 후 QA 재검토

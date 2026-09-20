# 워크로그 2026-09-21 — 에이전트 서명 키 영속화 집행, 로테이션 절차 문서화, 머지 위험 오판 정정

작성: CTO 에이전트 / 런 `250e6975`

## 요약

CEO가 DOW-1097에서 내린 결정(B: `PAPERCLIP_AGENT_JWT_SECRET` 영속화)을 집행했다. CTO가 할 수 있는 2건 — **로테이션 절차 문서화**와 **생성 규격·복붙 절차 제공** — 을 끝냈고, 값 생성과 `.env` 편집은 지시대로 하지 않았다(보드 몫). 추가로, 어제 내가 남긴 **"주입 전 머지하면 부팅 실패" 경고가 틀렸다는 것을 코드로 확인하고 정정**했다.

## 1. DOW-1097 — 이슈 성격 변경 + CEO 조건 집행

제목을 `PAPERCLIP_AGENT_JWT_SECRET 로테이션 — 이미 유출된 서명 키 무효화` → **`에이전트 서명 키 영속화 정책 적용`**으로 바꾸고 본문을 새 범위로 다시 썼다(우선순위 critical → high). 폐기할 유출 키가 애초에 존재하지 않는다는 게 확인됐기 때문.

CEO 조건 4개 중 CTO 몫 2건:

### 조건 3 — 수동 로테이션 절차 (승인 전제)

Paperclip 저장소 `OPERATIONS.md` **16장** 추가. 커밋 `fd3451f2f` (`pending-restart`, 문서 단일 변경).

- 16.1 두 키가 각각 무엇을 서명하는가 / 없을 때 동작
- 16.2 로테이션 시점 기준 (정기 로테이션은 강제하지 않음, `local_trusted` 단일 머신 기준)
- 16.3 저장 위치와 함정 — 경로가 외장 볼륨 심링크(`/Volumes/WorkDrive`) 위에 있음. 그리고 **Paperclip CLI는 `.env`를 새로 만들 때만 `0o600`으로 만든다. 기존 파일 권한은 바꾸지 않는다** (`cli/src/config/env.ts:104-110`)
- 16.4 생성 규격 — 32바이트 난수 → hex 64자, 내부 생성기와 동일
- 16.5 절차 — 값이 표준출력에 찍히지 않는 교체·검증 명령, 재시작, 사후 검증
- 16.6 영향 범위 (사전 고지용)

### 조건 1·2·4 — 생성 규격을 DOW-1102에 등록

`openssl rand -hex 32`를 **두 번 따로 호출**하는 형태라 두 값이 자동으로 달라진다(조건 1). 스크립트 끝에 `chmod 600`(조건 2). 검증 명령은 키 이름·길이·두 값이 다른지만 출력한다(조건 4).

## 2. 정정 — 주입 전 머지해도 부팅은 막히지 않는다

어제는 이 저장소에서 `git log`/`git diff` 실행이 차단돼 `b5a2f96ec`의 내용을 직접 못 봤다. 그래서 "가드가 `authenticated` 블록 밖으로 나갔을 수도 있다 → 계획 외 재시작 1회면 부팅 실패"라고 보수적으로 경고하고 워크트리까지 옮겼다.

이번 런에서 `git` 접근이 풀려 직접 확인했다. **가드는 블록 안에 그대로 있다.**

```ts
if (config.deploymentMode === "authenticated") {
  const { ... } = await import("./auth/better-auth.js");
  const betterAuthSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!betterAuthSecret) throw new Error("authenticated mode requires BETTER_AUTH_SECRET to be set");
```

live는 `/api/health` 기준 `local_trusted`라 better-auth 자체가 로드되지 않는다. 조치(워크트리 이동)는 무해했지만 근거는 틀렸으므로 DOW-1098·DOW-1102에 정정해 남겼다. **보드가 심야에 서두를 이유가 없다**는 뜻이기도 하다.

`주입 → 머지 → 재시작` 순서 자체는 유지한다. authenticated 전환 시점에는 진짜로 필요하고, 어차피 재시작 1회로 DOW-1086·DOW-1105까지 같이 반영하는 게 낫다.

## 3. 현재 병목

보드의 `.env` 주입 **1건**이 DOW-1097·DOW-1098·DOW-1086·DOW-1105 4건을 막고 있다. 절차는 DOW-1102에 복붙 가능한 형태로 올라가 있고, 보드가 검증 출력(길이 64, `different: True`, `-rw-------`) 세 줄만 남기면 CTO가 머지·재시작·검증을 이어받는다.

## 다음 할 일

1. 보드 주입 완료 → `security/better-auth-secret-split` 머지 → 재시작 1회
2. 재시작 후 `/api/health` + 에이전트 heartbeat 성공 확인 → DOW-1097/1098/1086/1105 순차 종료
3. 재시작 시점에 실행 중이던 런이 있으면 checkout 잔류 확인 후 release

## 남긴 기록

- Paperclip: `fd3451f2f` (OPERATIONS.md 16장)
- 키 값은 이번에도 열람·기록하지 않았다. 경로와 키 이름만 다뤘다.

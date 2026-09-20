# 워크로그 2026-09-21 — 재시작이 이미 일어났다: DOW-1086·DOW-1105 종료, 병목 4건 → 2건

작성: CTO 에이전트 / 런 `73c321e5`

## 요약

"보드의 `.env` 주입 1건이 4개 이슈를 막고 있다"는 어제 판단이 **절반만 맞았다.** 서버가 `2026-09-21 04:11:20`에 이미 재시작됐고, 그때 워킹트리가 `pending-restart`였던 덕에 거기 있던 수정 2건이 이미 live에 반영돼 있었다. 확인 후 DOW-1086·DOW-1105를 종료했다. 남은 병목은 DOW-1097·DOW-1098 두 건이다.

## 1. 발견 — 재시작 시각이 커밋보다 나중이다

| 항목 | 시각 |
| --- | --- |
| `2d049563f` fallback env resolve + deep-merge | 03:37:02 |
| `62198966e` SSH_AUTH_SOCK allowlist 제거 | 03:44:48 |
| **서버 프로세스 기동 (pid 69002)** | **04:11:20** |
| `fd3451f2f` OPERATIONS.md 16장 (문서) | 04:22:06 |

기동 이후 변경된 파일은 `OPERATIONS.md` 하나뿐(`git diff --name-only 62198966e..HEAD`). 즉 지금 돌고 있는 서버는 두 수정을 포함한 코드다.

## 2. 검증 — 형태가 아니라 행위로

### DOW-1105 (SSH_AUTH_SOCK)

- 에이전트 셸(이 런): `SSH_AUTH_SOCK` **없음**
- 서버 프로세스 env(`ps eww -p 69002`): `SSH_AUTH_SOCK` **있음**

호스트엔 소켓이 있는데 에이전트로는 안 넘어온다 = 차단이 실제로 작동. 코드상으로도 `server-utils.ts`에서 해당 이름은 "왜 일부러 뺐는지" 설명 주석(258–262행)에만 남아 있고 `INHERITED_ENV_ALLOWLIST`(265행)엔 없다.

### DOW-1086 (gemini fallback env)

- 전체 **10명** 에이전트 `adapterConfig`를 API로 재확인: 최상위 `env` 5키(`NODE_ENV`/`PATH`/`SHELL`/`SSL_CERT_DIR`/`SSL_CERT_FILE`) 유지, `fallbackConfigs.gemini_local.env` 전원 부재. (CEO가 DOW-1107로 체계 4명 적용 완료)
- 근본 수정 `2d049563f`는 04:11 기동에 포함.
- 에이전트 셸 실측 `NODE_ENV=development` — 호스트 `production` 유출 재발 없음.

설정과 코드 양쪽으로 막혀 있어 `done` 처리.

## 3. 주입 지점 재확인 (보드 절차가 맞는지)

`.env` 경로 결정 경로를 코드로 다시 따라갔다.

- `server/src/config.ts:27-37` — 모듈 로드 시 `resolvePaperclipEnvPath()`와 `cwd/.env` 두 곳을 `override:false`로 읽는다
- `server/src/paths.ts` — `PAPERCLIP_CONFIG` → 조상 `.paperclip/config.json` 탐색 → 기본값
- 실측: 서버 env에 `PAPERCLIP_CONFIG`/`PAPERCLIP_HOME`/`PAPERCLIP_INSTANCE_ID` 없음, cwd는 `paperclip/server`, 조상 `.paperclip/config.json` 전부 부재, `paperclip/server/.env`·`paperclip/.env`도 없음

⇒ 주입 지점은 `/Users/down/.paperclip/instances/default/.env` 로 확정. DOW-1102에 올린 절차가 맞다. 파일은 아직 없으며 새로 생성된다(그래서 절차의 `umask 077` + `chmod 600`이 실제로 필요하다 — CLI의 0600 생성은 CLI가 만들 때만 적용된다).

## 4. CEO 결정의 근거가 실측으로 재현됨

CEO가 DOW-1097에서 B(영속화)를 택한 근거는 "A는 재시작마다 run JWT를 무효화해 heartbeat가 중간에 죽는다"였다. **04:11 재시작에서 그대로 일어났다** — 이 런의 wake reason이 `process_lost_retry`다. 다만 checkout 잔류는 없었다(`in_progress` 2건 모두 재시작 이후 갱신된 정상 실행).

## 5. 남은 병목

보드의 `.env` 주입 1건이 이제 **DOW-1097·DOW-1098 두 건만** 막는다. 주입 후 CTO가 `security/better-auth-secret-split` 머지 → 재시작 1회 → `/api/health`·보드 로그인·에이전트 heartbeat 확인.

## 남긴 기록

- Paperclip 이슈: DOW-1105 done, DOW-1086 done, DOW-1097·DOW-1098·DOW-1102 코멘트 갱신
- DOW-1086은 이전 런의 좀비 실행 때문에 checkout 409 → `release` 후 재checkout으로 해소
- secret 값은 이번에도 열람·기록하지 않았다. 키 이름과 존재 여부만 확인했다.

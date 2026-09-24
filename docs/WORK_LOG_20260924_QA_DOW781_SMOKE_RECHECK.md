# DOW-781 출시 후보 QA smoke 재검증 — 차단 해제 후 전량 재실행

- 일자: 2026-09-24
- 담당: QA
- 상태: 이전 차단 5건 전부 해소, No-Go → 조건부 Go

## 배경

DOW-781은 2026-08-17에 **High / No-Go**로 멈춰 있었습니다. 차단 원인은 제품 결함이 아니라
QA runner에서 대상 DB로 도달하는 경로가 없다는 것이었습니다.

- `ipjuhae-db` 컨테이너의 host port가 publish되지 않음 (`NetworkSettings.Ports = {}`)
- host 5432는 다른 프로젝트 Postgres가 점유
- `127.0.0.1`로 치환하면 `lib/db.ts`의 SSL 분기에 걸려 `server does not support SSL connections`

오늘 머지된 **DOW-1156**(`docs/LOCAL_DB_SETUP.md`, `scripts/bootstrap-local-db.mjs`)이
docker 없이 Homebrew Postgres를 쓰는 로컬 검증 경로를 열어 차단이 해소됐습니다.

## 실행 환경

```
DATABASE_URL=postgresql://<사용자>@localhost:5432/ipjuhae_db   # host는 반드시 localhost
DB_SCHEMA=ipjuhae
NODE_ENV=production, PORT=3201
LAUNCH_SMOKE_TOKEN=<셸 변수로만 주입, 기록 안 함>
```

## 결과

| 항목 | 8/17 | 9/24 | 비고 |
| --- | --- | --- | --- |
| `npm run test:run` | 통과 (40 files / 414) | **통과 (65 files / 648)** | exit 0 |
| `NODE_ENV=production npm run build` | 정지 → 이후 통과 | **통과** | exit 0 |
| `db/migrate.ts --plan` | 실패 (ENOTFOUND db) | **통과** | `known=49 applied=49 pending=0` |
| `trust:smoke` | 실패 (DATABASE_URL 없음) | **통과** | `ok:true, tables=16, policies=12, triggers=3` |
| `/api/health` | 실패 | **200** | |
| `/api/listings` | 실패 | **200** | |
| `/trust-center`, `/trust/evidence`, `/trust/transactions` | 200 | **200** | |
| `/api/v1/data-score` 미인증 | 401 | **401** | 인증 경계 정상 |
| `/`, `/home` | 미확인 | **200** | 커뮤니티 전환 후 진입점 |
| `npm run launch:smoke` | 2/5 | **HTTP 체크 5/5 (실패 0)** | 아래 주의 참고 |
| `npm run smoke:public` | 미실행 | **17/17 통과** | exit 0 |

## 주의 — launch:smoke exit=1의 정체

HTTP 체크 5개는 전부 통과했지만 종료 코드는 1입니다. `/api/launch/smoke` 본문의
`REQUIRED_CHECKS` 중 3건이 false이기 때문입니다.

- `email` — `EMAIL_PROVIDER`/SMTP 미설정
- `storage` — `STORAGE_PROVIDER`가 s3 아님
- `runtime_env` — 런타임 필수 env 일부 누락

이 3건은 **제품 회귀가 아니라 로컬 RC 하네스의 env 미주입**입니다. 근거: DOW-1131이
운영 토큰으로 돌린 launch:smoke는 `exit 0`, known gap 2건(sms, verification)뿐입니다
(`docs/WORK_LOG_20260924_DEVOPS_DOW1131_PROD_SMOKE.md`).

따라서 **로컬 경로로는 email/storage/runtime_env를 검증할 수 없습니다.** 이 3건의 판정
근거는 운영 토큰 실행(DOW-1131)에 남겨 둡니다.

## 재현 절차

```bash
# 1) DB (최초 1회)
/opt/homebrew/opt/postgresql@16/bin/createdb -U "$USER" ipjuhae_db
DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db" DB_SCHEMA=ipjuhae npm run db:bootstrap

# 2) DB 의존 체크
DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db" DB_SCHEMA=ipjuhae npx tsx db/migrate.ts --plan
DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db" DB_SCHEMA=ipjuhae npm run trust:smoke

# 3) RC 서버 + smoke (같은 셸 변수로 토큰 주입)
NODE_ENV=production npm run build
PORT=3201 NODE_ENV=production ... node server.js
LAUNCH_SMOKE_BASE_URL=http://localhost:3201 npm run launch:smoke
npm run smoke:public
```

## 판정

**조건부 Go.** 8/17 No-Go 사유였던 DB 기반 trust 기능과 launch smoke 핵심 체크는 전부 통과했습니다.
남은 조건은 email/storage/runtime_env의 운영 env 주입이며, 이는 DOW-1131/DOW-912 트랙입니다.

## 검증 중 관찰

워크트리에 다른 에이전트의 미커밋 변경(community post view, login, comments route)이 있었습니다.
이번 판정은 그 변경이 포함된 상태의 결과이며, 648개 테스트는 그 상태에서 전부 통과했습니다.
이 로그는 `docs/` 파일 1개만 커밋합니다.

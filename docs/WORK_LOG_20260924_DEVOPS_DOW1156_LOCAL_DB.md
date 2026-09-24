# 2026-09-24 DevOps — DOW-1156 로컬 검증 DB 경로 복구

## 배경

DOW-362에서 QA가 비운영 end-to-end 검증을 시도했으나 환경이 뜨지 않았고, blocker owner가 DevOps로 지목됐다. QA 관측: `docker`/`colima` 미실행, 5432 점유, 붙으면 `role "ipjuhae" is not permitted to log in`.

## 확인한 사실

- `colima`는 설치돼 있으나 미실행(`brew services list` → `colima none`). docker daemon 없음.
- **5432 점유자는 Homebrew `postgresql@16`** (PID 3268, `/opt/homebrew/var/postgresql@16`). `127.0.0.1`·`::1`에만 listen.
- **Paperclip 서버 DB가 아니다.** Paperclip은 `@embedded-postgres` 인스턴스를 **54329** 포트로 띄운다(PID 4090, `~/.paperclip/instances/default/db`). 5432 인스턴스에는 `portfolio`, `ipjuhae_e2e`, `realtime_voice`만 있다. 즉 이 포트를 두고 "회사 DB라 못 건드린다"는 제약은 없다.
- 그 인스턴스의 role `ipjuhae`는 존재하되 `rolcanlogin = false`. QA가 본 에러의 정확한 원인이다. DB `ipjuhae_db`는 아예 없었다.
- `docker-compose.yml:40`은 이미 `${POSTGRES_HOST_PORT:-5432}`를 지원한다. 포트 충돌은 코드 수정 없이 피할 수 있었는데 문서에 없어서 QA가 알 수 없었다.

## 선택한 경로

role/비밀번호를 새로 만들지 않고, **이미 떠 있는 native postgres에 로컬 trust 인증으로 붙는다.** 로컬 접속은 비밀번호가 필요 없어 문서·티켓에 secret을 남기지 않아도 된다. host를 `localhost`로 쓰면 `lib/db.ts:8`·`db/migrate.ts:212`의 SSL 분기가 꺼지므로 **DOW-1152를 기다리지 않아도 된다.**

## 막혀 있던 두 번째 벽 — migration-035

빈 DB에 migration을 돌리면 39/49에서 멈춘다.

```
[failed] migration-035-approve-admin-gate.sql
[migration-error] admin account ipjuhae.official@gmail.com not found; sign up first, then re-run
```

035는 운영자 admin 계정 행이 있다고 가정하고 없으면 일부러 실패하도록 짜여 있다(`db/migration-035-approve-admin-gate.sql:8-10`). 운영 DB에는 그 행이 있어 드러나지 않았고, 신규 로컬 DB에서만 터진다. `users` 테이블의 NOT NULL은 `id`·`email` 둘뿐이라 자리표시자 한 줄로 통과한다.

## 만든 것

- `scripts/bootstrap-local-db.mjs` — migrate 실행 → 035 admin 게이트에서 막히면 자리표시자 행 삽입 → 이어서 적용. 가드 2겹: host가 로컬이 아니면 중단(운영 DB 방지), `127.0.0.1`이면 SSL 분기를 알려 주고 중단. 멱등.
- `package.json`에 `db:bootstrap` 추가.
- `docs/LOCAL_DB_SETUP.md` — 절차 문서. compose를 굳이 쓸 때의 `POSTGRES_HOST_PORT=5433` 우회와, app 컨테이너가 DOW-1152 전까지 붙지 못한다는 제약도 명시.

## 검증

throwaway DB(`ipjuhae_db_check`)를 만들어 처음부터 돌리고 지웠다.

| 항목 | 결과 |
| --- | --- |
| 가드: host `db.example.com` | 중단, rc=1 |
| 가드: host `127.0.0.1` | SSL 분기 안내 후 중단, rc=1 |
| 빈 DB 부트스트랩 | rc=0, `_migrations` **49행** |
| `db/migrate.ts --plan` 재실행 | `pending=0` |
| `scripts/trust-platform-smoke.mjs` | `ok:true`, tables 16, models 3종(tenant·landlord·property), policies 12, triggers 3 |
| 부트스트랩 멱등 재실행 | rc=0, `pending=0` |
| `npx eslint scripts/bootstrap-local-db.mjs` | 클린 |

작업용 `ipjuhae_db`도 같은 상태로 남겨 뒀다(49/49, trust smoke ok). QA가 바로 쓸 수 있다.

**이것으로 QA가 "실행 불가"라고 적었던 경로가 열렸다.** DOW-362에서 커버되지 않는다고 명시한 잔여 위험(route 테스트가 DB를 mock 해서 SQL 계층 결함을 못 잡는 문제)을 실제 DB로 재검증할 수 있다.

## 남은 것

- QA 재검증 대기. `docs/LOCAL_DB_SETUP.md` 절차대로 `db:bootstrap` → `trust:smoke` → trust route happy path.
- DOW-1152(SSL 분기 결함)는 여전히 유효하다. 이 경로는 우회일 뿐 수정이 아니다. compose app 컨테이너는 그게 닫혀야 뜬다.
- 자리표시자 admin은 이메일만 있는 빈 계정이라 로그인 시나리오는 별도 시드가 필요하다.

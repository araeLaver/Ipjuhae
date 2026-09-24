# 로컬 검증 DB 구성 (docker 없이)

QA·개발이 운영 DB를 건드리지 않고 migration·trust smoke·route happy path를 **실제 DB에 태워** 확인하기 위한 절차입니다. 근거: DOW-1156, DOW-362.

`docker compose up -d` 경로는 이 머신에서 아직 막혀 있습니다 — colima(docker daemon)가 실행 중이 아니고, host 5432는 이미 다른 Postgres가 점유 중입니다. 아래 경로는 docker를 기다리지 않습니다.

SSL 분기 결함(DOW-1152)은 닫혔습니다. `lib/db-ssl.mjs`가 hostname으로 판단하므로 `localhost`·`127.0.0.1`·compose 서비스명 `db` 어느 쪽으로 써도 동작합니다.

## 1. Postgres 준비

Homebrew Postgres를 씁니다. 이미 떠 있으면 그대로 쓰면 됩니다.

```bash
brew services list | grep postgresql        # postgresql@16 started 확인
/opt/homebrew/opt/postgresql@16/bin/createdb -U "$USER" ipjuhae_db
```

로컬 Postgres는 `127.0.0.1`·`::1`에만 listen하고 로컬 접속은 trust 인증이라, **비밀번호가 필요 없습니다.** 문서·티켓에 secret을 남기지 않는 이유입니다.

## 2. migration 전량 적용

```bash
DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db" \
DB_SCHEMA=ipjuhae \
npm run db:bootstrap
```

`db:bootstrap`은 `db/migrate.ts`를 돌리고, `migration-035-approve-admin-gate.sql`이 요구하는 운영자 admin 계정 행이 없으면 **로컬 전용 자리표시자**(`users(email)` 한 줄)를 넣은 뒤 이어서 적용합니다. 035는 계정이 없으면 일부러 실패하도록 설계돼 있어서, 신규 로컬 DB에서는 이 단계가 없으면 39/49에서 멈춥니다.

안전장치:

- `DATABASE_URL`의 host가 로컬이 아니면 즉시 중단합니다. 운영 DB에는 돌지 않습니다.
- 이미 적용된 DB에 다시 돌려도 안전합니다(`pending=0`).

기대 결과: `[complete] All pending migrations were applied.` / `_migrations` 49행.

## 3. 확인

```bash
DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db" DB_SCHEMA=ipjuhae \
  npx tsx db/migrate.ts --plan                    # pending=0 (읽기 전용)

DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db" DB_SCHEMA=ipjuhae \
  node scripts/trust-platform-smoke.mjs
```

trust smoke 기대 결과:

```json
{"ok":true,"tables":16,"models":[{"subject_type":"landlord","count":1},{"subject_type":"property","count":1},{"subject_type":"tenant","count":1}],"policies":12,"triggers":[...3건]}
```

## 4. 앱을 이 DB로 띄우기

`.env.local`에 아래를 넣고 `npm run dev`를 씁니다. host는 `localhost`든 `127.0.0.1`이든 됩니다.

```
DATABASE_URL=postgresql://<사용자>@localhost:5432/ipjuhae_db
DB_SCHEMA=ipjuhae
```

## compose 경로를 굳이 쓸 때

host 5432 충돌은 코드 수정 없이 피할 수 있습니다. `docker-compose.yml`이 `POSTGRES_HOST_PORT` 오버라이드를 지원합니다.

```bash
colima start
POSTGRES_HOST_PORT=5433 docker compose up -d db
```

app 컨테이너까지 띄울 때는 `.env.local`의 `DATABASE_URL` host를 compose 서비스명 `db`로 씁니다. 컨테이너 안에서 `localhost`는 app 자신을 가리키므로 DB에 닿지 않습니다.

```
DATABASE_URL=postgresql://ipjuhae:<POSTGRES_PASSWORD>@db:5432/ipjuhae_db
```

compose DB는 stock `postgres:16-alpine`이라 TLS가 없는데, `db`는 SSL 없이 붙는 호스트로 판단되므로 그대로 동작합니다(DOW-1152). 판단을 덮어써야 하면 `DATABASE_SSL=disable`을 명시합니다.

## 알려진 제약

- 자리표시자 admin 행은 이메일만 있는 빈 계정입니다. 로그인이 필요한 시나리오는 별도 시드가 필요합니다.
- 이 절차는 **로컬 전용**입니다. 운영 DB에는 어떤 단계도 적용하지 않습니다.

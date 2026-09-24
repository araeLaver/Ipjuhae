# DOW-1152 — DB SSL 판단을 hostname 기준으로 교체

날짜: 2026-09-24
담당: 입주해 에이전트

## 무엇이 문제였나

DB 연결 6곳이 "연결 문자열에 `localhost`라는 **문자열**이 들어있는가"로 SSL 여부를 정했다.

```ts
ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: ... }
```

같은 곳을 가리키는 `127.0.0.1`, 그리고 compose 서비스명 `db`는 이 매칭에 걸리지 않아 SSL이 켜졌다. compose DB는 stock `postgres:16-alpine`이라 TLS가 없어서 연결이 끊겼다.

```
Error: The server does not support SSL connections
```

`docker-compose.yml`에 적힌 `docker compose up -d`가 문서대로 해도 app이 DB에 못 붙던 이유다. 운영(Fly)은 원격 DB라 분기가 맞게 떨어져서 오래 안 보였다.

## 무엇을 했나

`lib/db-ssl.mjs` 하나로 판단을 모았다. 판단 순서:

1. `DATABASE_SSL` 환경변수 (명시적 스위치, 최우선)
2. `PGSSLMODE` 환경변수 (libpq 관례)
3. 연결 문자열의 `?sslmode=` 쿼리
4. hostname 자동 판단 — loopback(`localhost`/`127.0.0.1`/`::1`/`host.docker.internal`) 또는 **점 없는 단일 라벨 호스트**(compose 서비스명 `db` 등)면 SSL을 끈다. 공인 DNS에는 단일 라벨 이름이 없으므로 컨테이너 네트워크 내부로 본다.

`.ts`와 `node`로 직접 도는 `.mjs` 스크립트가 같이 써야 해서 일부러 plain ESM(`.mjs`)으로 뒀다. TS 쪽은 `allowJs` + JSDoc으로 타입이 잡힌다(`tsc --noEmit` 통과 확인).

### 교체한 곳 (6곳 전부)

| 파일 | 비고 |
|---|---|
| `lib/db.ts` | **앱 런타임 pool.** 유일하게 `rejectUnauthorized`가 `isProduction` |
| `db/migrate.ts` | |
| `scripts/trust-platform-smoke.mjs` | |
| `scripts/seed-matches.ts` | |
| `scripts/seed-community-guides.mjs` | 로컬 분기만 `undefined`였음 → `false`로 통일 |
| `e2e/global-setup.ts` | 티켓에 없던 추가 발견. `PLAYWRIGHT_DATABASE_URL` 사용 |

### 버그 때문에 생겼던 우회 제거

- `scripts/bootstrap-local-db.mjs` — "host가 `127.0.0.1`이면 중단" 가드를 뺐다. 운영 DB 차단 가드는 그대로 두되 `isLocalDatabaseHost()`를 쓴다.
- `__tests__/db/trust-routes-real-db.test.ts` — `host !== 'localhost'` 가드를 `isLocalDatabaseHost()`로 교체.

### 문서

- `.env.example` / `.env.local.example` — `DATABASE_SSL` 설명, compose용 `@db:5432` 예시, `POSTGRES_HOST_PORT` 추가
- `docker-compose.yml` 머리주석 — `.env.local`에 필요한 최소 두 줄, SSL 판단 근거
- `docs/LOCAL_DB_SETUP.md` — "host는 반드시 localhost" 제약 문구 전부 정정, compose app 컨테이너 절차 추가

## 검증

운영 코드 기준선 확인은 CI에 넘긴다(로컬 `next build`는 이 저장소에서 기준선부터 실패한다).

| 항목 | 결과 |
|---|---|
| `npx vitest run` 전량 | **679 passed / 0 failed** (신규 `__tests__/lib/db-ssl.test.ts` 31건 포함) |
| `npx tsc --noEmit` | 통과 |
| `npx next lint` (변경 파일) | No ESLint warnings or errors |
| 티켓 재현 ①: `DATABASE_URL=…@127.0.0.1:5432/ipjuhae_db npx tsx db/migrate.ts --plan` | `rc=0`, `known=49 applied=49 pending=0` |
| 티켓 재현 ②: 같은 URL로 `node scripts/trust-platform-smoke.mjs` | `rc=0`, `{"ok":true,"tables":16,…}` |
| 대조군: 위에 `DATABASE_SSL=require`를 얹음 | `rc=1`, `The server does not support SSL connections` — 스위치가 실제로 동작함을 확인 |
| 가드: `DATABASE_URL=…@prod.example.com` 으로 `db:bootstrap` | `rc=1`, `로컬 DB에서만 실행할 수 있습니다` |

대조군을 일부러 넣은 이유: 재현 ①②가 통과하는 것만으로는 "SSL이 꺼져서 붙었다"인지 "원래 붙었다"인지 갈리지 않는다. 강제로 켰을 때 원래 에러가 그대로 나와야 분기가 살아 있는 것이다.

## 운영 영향

없다. 운영 `DATABASE_URL`의 host는 점이 있는 원격 호스트라 `{ rejectUnauthorized: isProduction }`으로 떨어진다 — 이전과 같은 값이다. `PGSSLMODE=require`가 설정돼 있어도 `require`는 호출부의 검증 강도를 따르므로 운영에서 `rejectUnauthorized`가 느슨해지지 않는다(테스트로 고정).

## 남긴 것

- `__tests__/db/trust-routes-real-db.test.ts`는 DOW-1156에서 온 **아직 커밋되지 않은** 파일이라 이 커밋에 넣지 않았다. 가드 수정분은 워킹트리에 남아 있으니 그 파일을 커밋하는 쪽이 같이 가져가면 된다.
- 이 머신의 compose 기동 자체(colima 미실행 + host 5432 점유)는 별개 blocker다. DOW-362에 적혀 있다.

## CTO 기술 검토 — **코드 승인**. push(=배포) 결정은 CEO로 올립니다

보고 내용을 그대로 믿지 않고 제가 직접 돌려 확인했습니다.

### 제가 직접 확인한 것

| 확인 항목 | 결과 |
|---|---|
| `npx vitest run __tests__/lib/db-ssl.test.ts` | **PASS 31 / FAIL 0** |
| `npx tsc --noEmit` | **통과** |
| `npx next build` — webpack 컴파일 단계 | **통과** (그 뒤 프리렌더 단계에서 기준선 실패로 멈춤) |
| `.next/server/app/api/health/route.js`에 `lib/db-ssl.mjs` 번들 여부 | **포함됨** — API 라우트 다수 청크에서 확인 |
| CI 구성(`.github/workflows/ci.yml`) | lint · typecheck · test · build. **e2e는 CI에 없음** |
| `fly.toml` `[env]` | `PGSSLMODE` · `DATABASE_SSL` **없음** |

### 코드 검토 의견

`lib/db-ssl.mjs`의 판단 순서(`DATABASE_SSL` → `PGSSLMODE` → `?sslmode=` → hostname)와 호출부 6곳 교체를 전부 읽었습니다. 설계에 이견 없습니다. 특히 두 가지가 맞게 되어 있습니다.

- **`require`가 인증서 검증을 느슨하게 만들지 않습니다.** `sslFromMode`가 `require`에서 호출부 기본값을 그대로 돌려주고, `lib/db.ts`는 `isProduction`(=true)을 넘깁니다. 운영에서 검증이 꺼지는 경로가 없습니다.
- **URL 파싱에 실패하면 SSL을 켭니다.** `getDatabaseHostname`이 null이면 SSL on으로 떨어집니다. fail-safe 방향이 맞습니다.

### 제가 따로 따져본 운영 리스크 — 모두 해소

1. **`.mjs`를 Next 런타임 코드(`lib/db.ts`)가 import하는 게 이 저장소 최초입니다.** 선례가 없어 `next build`를 직접 돌렸습니다. 이 저장소의 로컬 빌드는 원래 프리렌더 단계에서 깨지는데(`useContext` null — 이번 변경과 무관), **그 지점까지 갔다는 것 자체가 컴파일과 청크 생성이 끝났다는 뜻**입니다. 실제로 번들 산출물에서 헬퍼 코드를 찾아 확인했습니다. webpack 해석 문제 없습니다.
2. **운영 동작 변화 없음.** 운영 `DATABASE_URL`의 host는 점이 있는 원격 호스트라 자동 판단이 SSL on + 인증서 검증으로 떨어집니다. 변경 전과 같은 값입니다.
3. **새로 생긴 입력 경로는 `PGSSLMODE` 하나입니다.** `fly.toml` `[env]`에 없습니다. Fly secrets 쪽은 이 셸에 flyctl 토큰이 없어 직접 확인하지 못했습니다 — 다만 저장소 어디에도 `PGSSLMODE`를 설정하는 코드가 없어 의도적으로 넣었을 가능성은 낮다고 봅니다. 배포 후 `/api/health`로 확인하면 끝나는 사안입니다.

### 남는 지적 1건 — push 차단 사유는 아닙니다

QA가 [DOW-1178](/DOW/issues/DOW-1178)에서 찾은 `e2e/header-mobile.spec.ts:54`의 `getByRole('alert')` strict mode violation은 **다른 커밋(`640dfc2f`)의 문제**이고, **CI가 e2e를 돌리지 않으므로 CI를 빨갛게 만들지 않습니다.** 다만 그 locator 때문에 55~57행(재시도 흐름)이 한 번도 실행된 적이 없습니다 — 회귀 테스트가 실제로는 회귀를 못 막고 있는 상태라 별도로 정리하겠습니다.

### 판정

**코드는 승인합니다.** 다만 `lib/db.ts`가 운영 런타임이고 main push는 CI 성공 시 Fly 프로덕션 자동 배포로 이어지므로, [DOW-1133](/DOW/issues/DOW-1133)에서 고정된 기준에 따라 **배포 결정은 CEO 몫**입니다. 제 권한으로 승인하지 않고 올립니다.

결정 요청 이슈를 따로 만들어 CEO에게 배정합니다. 이 이슈는 결정이 나올 때까지 `in_review`로 제가 들고 있습니다 — 지금 재배정하면 [DOW-1160](/DOW/issues/DOW-1160)의 잠김 버그를 밟습니다.

# 2026-09-21 QA — DOW-362 7월 readiness smoke, 실행 가능한 부분 집행

대상: [DOW-362](/DOW/issues/DOW-362) (2026-07-13 생성, 이후 blocked 유지)
연관: [DOW-366](/DOW/issues/DOW-366) (Fly/DB admin 확인 요청), [DOW-781](/DOW/issues/DOW-781),
[DOW-637](/DOW/issues/DOW-637) (모바일/staging 접속값 인계)

## 왜 지금 집행했나

DOW-362는 7월 13일 이후 두 blocker로 멈춰 있었다. 그 중 **절반은 토큰 없이도 확인
가능한 항목**이었는데, `npm run launch:smoke`가 `LAUNCH_SMOKE_TOKEN`을 전제로
설계돼 있어 전부 함께 멈춰 있었다. 토큰 없이 확인 가능한 범위를 분리해 집행했다.

## 실행 결과 — 운영 공개 표면 17개 체크 전부 통과

`node scripts/public-surface-smoke.mjs https://www.ipjuhae.com` (신규, 이 커밋)

| 분류 | 체크 | 결과 |
| --- | --- | --- |
| 공개 표면 | health(`database: ok`), listings, properties, community posts | 4/4 통과 |
| 입력 validation | login / signup / phone — 유효하지 않은 입력만 전송 | 3/3 통과 (400 + 한글 오류) |
| 보호 게이트 | launch/smoke 토큰(403), admin(403), `/auth/me`(401), 계정삭제(401), cron(401), CSRF(403 `CSRF_INVALID`) | 6/6 통과 |
| trust 표면 보호 | access-logs, consent/events, references, references/verify | 4/4 통과 (401) |

**운영은 살아 있고 보호도 걸려 있다.** `/api/launch/smoke`가 토큰 없이 403을 돌려주는
것 자체가 DOW-362 범위 항목("admin route protection", "secret은 설정 여부만 확인")의
통과 증거다 — 운영에 `LAUNCH_SMOKE_TOKEN` 게이트가 실제로 동작한다.

스크립트가 헛통과하지 않는지 음성 검증했다. base URL을 존재하지 않는 prefix로 주면
9건이 404로 실패한다.

## 시작 조건 2개의 현행성 — 1개는 낡았다

- **smoke 대상 URL**: 7월 DevOps 제공값 `https://www.ipjuhae.com` 그대로 유효하다.
- **"DB migration 31개 적용 확인"**: **낡았다.** 현재 `db/migrate.ts` 활성 목록은
  `schema.sql` 1개 + SQL migration **48개 = 49개 항목**이다(마지막
  `migration-044-community-reports.sql`). 7월 기준 31개, DOW-366 기준 35개였다.
  숫자를 못 박는 방식이 두 달 만에 세 번 틀렸으므로, 확인 기준을 **"`db/migrate.ts`
  활성 목록과 운영 `ipjuhae._migrations`의 차집합이 0"** 으로 바꾸기를 제안한다.
  숫자 대신 차집합이면 다음 migration이 추가돼도 기준이 낡지 않는다.

## 여전히 실행 불가 — owner 명시

| 항목 | 필요한 것 | owner |
| --- | --- | --- |
| `npm run launch:smoke` 전체 | `LAUNCH_SMOKE_TOKEN` 주입 또는 권한 환경에서의 실행 결과 | 보드/Fly admin (DOW-366) |
| 운영 DB migration 적용 evidence | Fly/DB admin | 보드/Fly admin (DOW-366) |
| 인증이 필요한 happy path (consent 생성, access log 조회, dispute, trust report) | 운영 또는 staging 테스트 계정 | 보드/DevOps (DOW-637) |

`flyctl`은 설치돼 있지만 **QA 에이전트 셸에서는 실행에 권한 승인이 필요하다**
(`flyctl version`도 차단됨). 즉 DOW-366의 `fly secrets list` 확인은 QA가 대신할 수
없다. owner는 그대로 보드/Fly admin이다.

## 새로 찾은 것 1 — 7월 evidence 7개 파일 중 5개가 main에 없다

7월 코멘트의 증거는 다음 7개 파일이었다.

```
__tests__/api/mvp-smoke.test.ts            존재 (3 test)
__tests__/api/references.test.ts           존재 (7 test)
__tests__/api/access-logs.test.ts          없음
__tests__/api/reference-disputes.test.ts   없음
__tests__/api/report-aggregates.test.ts    없음
__tests__/api/public-profile-consent.test.ts 없음
__tests__/api/trade-condition-hints.test.ts  없음
```

7월 보고값 "7개 파일 / 30개 test"는 **main에서 재현되지 않는다**(2개 파일 / 10개 test).
없는 5개는 미병합 브랜치 `feature/community-trust-docs-kakao` 쪽 자산으로 보인다
(브랜치 triage 결론: 코드는 main이 재구현했고 문서·자산 일부가 유실).

결과로 **route 수준 커버리지 공백**이 남아 있다. 전체 테스트 트리(52개 파일)에서
`/api/access-logs`, `/api/consent/events`, reference dispute, trust report aggregate를
route로 태우는 테스트는 0건이다. `__tests__/lib/trust-engine-*.test.ts`가 lib 수준만
덮는다. 이번 smoke로 **보호(401)는 확인했지만 happy path는 확인 수단이 없다.**

- 위험도: 중. 해당 route는 인증 게이트가 살아 있고 공개 노출은 없다. 다만 회귀를
  잡을 자동 수단이 없으므로, 계정 접근이 열리는 시점(DOW-637)에 route 테스트를
  먼저 세우는 것이 맞다.

## 새로 찾은 것 2 — `/risk`는 살아 있는 공개 페이지인데 비교 자료가 fixture다

범위 밖에서 발견했다. 별도 이슈로 올린다.

`https://www.ipjuhae.com/risk`(라이브, 200)는 `/api/rental-risk/brief`를 호출한다.
그 route는 인증 없이 열려 있고, 비교 대상 거래를 **`fixtures/rental-risk-sample.ts`**
에서 가져온다 — 단지 2곳, 거래 12건(은마아파트 84.43㎡, 보증금 51,000~62,000만원,
2025-09~2026-07)이 전부다.

- 그 한 조합을 입력하면 `sampleCount: 12`, `depositPercentile: 100`,
  `depositMedianDifferenceRate: 0.327`, `sampleAdequacy: high`로 **수치가 나온다.**
  직접 확인했다.
- 그 밖의 모든 주소·면적은 `scope: insufficient`, `sampleCount: 0` → 화면은
  "판단할 표본이 부족합니다".
- 페이지 문구는 "시세 비교 · **시험판**" + "같은 단지 같은 평형의 최근 **실거래**와
  비교해 보증금 위치를 알려드려요"다. API `limitations`도 "**공개 거래자료**에는
  동·호와 임대인 정보가 포함되지 않습니다"라고 쓴다.
- 즉 **"시험판"은 붙어 있지만, 비교 자료가 합성 fixture라는 사실은 어디에도 없다.**
  은마아파트 84㎡를 입력한 사용자는 만들어진 숫자를 실거래 비교 결과로 받는다.

판정: 오인표현 위험. 기능 결함이 아니라 **문구/데이터 출처 표기** 문제이고, 라이브
공개 페이지라 노출 중이다. 권장은 둘 중 하나다.

1. fixture를 쓰는 동안 UI와 API 응답에 "샘플 데이터" 표기를 넣는다(`sourceAsOf`
   옆에 `sourceKind: "sample"` 같은 필드 + 화면 배지).
2. 실거래 데이터가 연결될 때까지 `/risk`를 비공개로 두거나 입력 단계에서 명시한다.

owner 판단은 CTO에게 넘긴다.

## 남긴 것

- `scripts/public-surface-smoke.mjs` (신규) + `npm run smoke:public`
  - 토큰 없이 도는 17개 체크. `launch:smoke`가 토큰 때문에 멈춰도 이쪽은 항상 돈다.
  - 공개 표면 응답 + **보호 게이트 동작**을 함께 본다. 후자는 "토큰이 없다"는 사실을
    체크 대상으로 뒤집은 것이다.
- 로컬 `node scripts/prelaunch-check.mjs`: 16개 항목 미주입으로 실패(7월과 동일,
  운영 secret은 Fly에 있고 QA 셸에는 없다). 이 실패는 운영 상태에 대한 정보가 아니다.
- 전체 회귀: `npx vitest run` 536 pass / 0 fail / 1 skipped(DOW-1123 고정분).
- push는 하지 않았다. 같은 기준을 유지한다.

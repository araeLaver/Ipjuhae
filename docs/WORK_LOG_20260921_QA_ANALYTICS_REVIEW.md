# 워크로그 2026-09-21 — DOW-1067 앱 익명 계측 재검수 (QA)

담당: QA / 대상 커밋: `830da030` → 검수 중 추가 `280fa9d9`

## 무엇을 검수했나

[DOW-1067](https://github.com/araeLaver/Ipjuhae) `/check` 결과 화면 → 테스터 전환 익명 계측 3종.
직전 검수에서 **앱 3종이 프로덕션 CSRF에서 403으로 전량 버려지는 건**을 블로커로 되돌렸고,
입주해가 `x-mobile-client` 헤더를 붙여 고친 뒤 재검수를 요청한 건이다.

재검수 요청 4항목: (1) 앱에서 실제로 행이 쌓이는가 (2) `/check`의 `page_view`가 계정과 분리됐는가
(3) `/admin/analytics` 30일 표가 날짜별로 읽히는가 (4) 비로그인 경로 회귀.

## 결과 — 기능 4항목 전부 통과, 문구 1건 되돌림

### 1. 앱 3종 — 통과 (세 겹으로 나눠 확인)

입주해가 "헤더를 붙이면 라우트까지 간다"까지만 확인했다고 스스로 밝혀서, 그 뒤를 나눠 봤다.

- **실제로 나가는 요청**: esbuild로 `mobile/src/services/analytics.ts`를 번들하고
  `expo-constants`만 셔임으로 바꿔 `trackAnonymous()`를 호출, 요청을 캡처했다.
  `x-mobile-client: true`가 실제로 실리고 `Authorization`·`Cookie`·`credentials`는 없다.
  본문은 `surface`/`level`/`from`뿐이고 `session_id`가 없다.
- **미들웨어**: 프로덕션에서 독립 재확인. 헤더 있으면 200, 없으면 `403 CSRF_INVALID`.
  저장되지 않는 이름(`qa_probe_not_a_real_event`)만 써서 분석 데이터는 건드리지 않았다.
- **라우트 → 실물 DB**: 스크래치 Postgres에 `migration-016` 원문으로 테이블을 만들고
  `lib/auth`만 mock, `lib/db`는 실물로 라우트를 호출. **로그인 상태에서도** 3종 모두
  `user_id`/`session_id`가 `NULL`. 금액·식별자를 끼워 넣어도 `surface`/`level`만 남았다.
- **배선**: `DepositCheckScreen` result effect, `TesterInvite` 마운트/`onPress`, 결과 후에만 렌더.

못 한 것: 실제 기기에서 Expo 빌드를 돌리지는 않았다. 다만 "다른 호스트로 나갈 가능성"은
`eas.json`에 env 주입이 없음을 확인해 닫았다.

### 2. `/check` page_view — 통과

| 보낸 것 | 저장된 `path` | `user_id` | `session_id` |
| --- | --- | --- | --- |
| `/check?token=secret#frag` | `/check` | NULL | NULL |
| `/check/result/abc123` | `/check` | NULL | NULL |
| `/` | `/` | 있음 | 있음 |
| `/checkout` | `/checkout` | 있음 | 있음 |

랜딩이 계정과 함께 남는 것까지 확인했다 — `/admin/waitlist`가 그 행으로 채널별 방문을 센다.
`trackServer` 호출처 8곳을 전수 확인해 `/check`의 `page_view`를 서버에서 따로 쏘는 경로가
없음도 봤다. `/CHECK`·`/Check`는 프로덕션 404라 익명 판정 우회 경로가 아니다.

### 3. 완료 기준 — 통과

`app/admin/analytics/page.tsx`의 SQL 원문을 뽑아 스크래치 DB에서 실행. KST 기준 날짜별로
`result_viewed`/`invite_shown`/`invite_clicked` 3열이 한 행으로 읽히고 30일 밖은 빠진다.

### 4. 비로그인 경로 — 통과

프로덕션 `/check`·`/check?from=cafe` 모두 200, 리다이렉트·로그인 유도 없음.
배포 번들 `app/check/page-92b606c86c59be19.js`에 3종 이름 모두 존재.

## 🟡 되돌린 것 — 개인정보처리방침 문구

`app/privacy/page.tsx` 2항의 "서비스 이용 통계 … 익명으로 집계하며 계정 정보와 함께
저장하지 않습니다"가 **이용 통계 전반**에 대한 약속으로 읽힌다. 실제로는 `/check`와 깔때기
3종만 익명이고, 랜딩 포함 그 밖의 `page_view`와 `profile_*`은 `user_id`와 함께 저장된다.

랜딩이 계정과 함께 남는 건 의도한 동작(`/admin/waitlist`가 의존)이므로, 고칠 대상은
동작이 아니라 문장이다. 권장 문안을 달아 입주해에게 되돌렸다. 기능 블로커는 아니다.

## QA가 커밋한 것 — `280fa9d9` (테스트 코드만)

입주해가 "행위 검증이 아니라 형태 검증"이라고 스스로 밝힌 약점을 닫았다.

`__tests__/mobile/analytics-runtime.test.ts` (6개) — `trackAnonymous()`를 실제로 호출해
나가는 요청을 검사한다. vitest transform을 태우면 `mobile/tsconfig.json`이
`expo/tsconfig.base`를 해석하려다 `mobile/node_modules`가 없는 CI에서 깨지므로,
esbuild로 직접 번들해 그 경로를 피했다. Expo는 설치하지 않는다.

**뮤테이션으로 이빨을 확인했다** — `analytics.ts`에서 `x-mobile-client` 줄을 일시적으로
떼자 정확히 그 테스트가 빨개졌고 원본은 복구했다.

`esbuild`는 vitest 전이 의존으로 이미 있었지만 호이스팅에 기대지 않도록 `devDependencies`에
명시했다. 제품 코드는 건드리지 않았다.

전체 501개 통과, `tsc --noEmit`·`lint` 통과, CI(`35532239609`) 전부 초록.

## 참고 — 블로커 아님

1. **깔때기 표가 웹/앱·유입 채널로 나뉘지 않는다.** 완료 기준(날짜별 3개 숫자)은 충족이지만,
   "어느 모집 채널이 살아있나"는 표만 봐서 알 수 없다. 데이터는 `properties`에 다 있다.
2. **`mobile/app.json`의 `extra.apiUrl`이 죽은 설정이다.** 코드가 읽는 키는 `extra.apiBaseUrl`
   (`analytics.ts:21`, `apiClient.ts:15`). 두 값이 우연히 같아 지금은 무해하고 이번 티켓이 만든
   문제도 아니지만, `apiClient.ts:10` 주석대로 하면 안 덮인다. 스테이징으로 돌리려다 조용히
   프로덕션을 때릴 수 있는 자리다.

## 검증 흔적 정리

스크래치 DB(`ipjuhae_qa1067b`)와 임시 스크립트는 전부 삭제했다. 프로덕션 분석 데이터는
저장되지 않는 이벤트 이름만 써서 오염시키지 않았다.

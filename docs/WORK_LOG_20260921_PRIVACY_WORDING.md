# 워크로그 2026-09-21 — 개인정보처리방침 이용 통계 문구 정정 (DOW-1067 마지막 1건)

## 배경

DOW-1067(`/check` 결과 화면 → 테스터 전환 익명 계측 3종) QA 재검수에서 기능 4항목은
전부 통과했다. 되돌아온 것은 코드가 아니라 `app/privacy/page.tsx`의 **문장 하나**였다.

## 무엇이 어긋나 있었나

2항 수집 항목의 문장이 이렇게 적혀 있었다.

> 서비스 이용 통계: 화면 조회·버튼 클릭 횟수와 유입 경로 태그(UTM 등). 익명으로
> 집계하며 계정 정보·기기 식별자와 함께 저장하지 않습니다

"이용 통계" **전반**이 익명이라고 읽힌다. 실제 동작은 그렇지 않다.

| 이벤트 | 실제 저장 |
| --- | --- |
| `check_result_viewed` / `tester_invite_shown` / `tester_invite_clicked` | `user_id`·`session_id` 모두 `NULL` |
| `/check` 경로의 `page_view` | `ANONYMOUS_PATHS` 판정으로 `NULL` |
| 랜딩(`/`)·그 밖 경로의 `page_view` | **`user_id`·`session_id`와 함께 저장** |
| `profile_complete` / `profile_submitted` | **`user_id`와 함께 저장** |

QA가 스크래치 Postgres에 `migration-016-analytics-events.sql` 원문으로 테이블을 만들고
실물 행으로 확인한 결과다. 익명 판정 로직은 `lib/analytics-events.ts` 한 곳
(`resolveAnonymousProperties`)에 모여 있다.

## 왜 동작이 아니라 문장을 고쳤나

랜딩의 `page_view`가 계정·세션과 함께 남는 것은 **의도한 동작**이다.
`/admin/waitlist`가 `properties->>'path' = '/'` 행으로 채널별 방문을 센다.
여기를 익명화하면 대기열 채널 통계가 깨진다.

즉 고칠 대상은 고지의 정확성이다. 지금 문장은 이용자에게 실제보다 강한 보호를
약속하고 있었다.

## 바꾼 것

`app/privacy/page.tsx` 한 곳, 문장 하나.

> 서비스 이용 통계: 화면 조회·버튼 클릭 횟수와 유입 경로 태그(UTM 등). 기기
> 식별자는 만들지 않습니다. 보증금 위험 점검(/check) 화면의 이용 기록은 계정과
> 연결하지 않고 익명으로만 집계하며, 그 밖의 화면에서는 로그인하신 경우 계정과
> 함께 저장될 수 있습니다

QA 권장 문안을 그대로 썼다. 바로 아래 문단(`/check`는 로그인 없이, 금액 미전송,
계정 미연결)은 실제 동작과 정확히 일치하므로 건드리지 않았다.

## 검증

| 항목 | 결과 |
| --- | --- |
| `tsc --noEmit` | 통과 |
| `npm run test:run` | 53개 파일 **501개 전부 통과** |
| 커밋 | `cf4abab4` (`origin/main`) |

제품 코드는 한 줄도 건드리지 않았다. 계측 동작은 재검수받은 `280fa9d9` 그대로다.

## 남긴 것 — 블로커 아님

QA가 참고로 올린 두 건은 이 티켓에서 닫지 않았다.

1. `/admin/analytics` 깔때기 표가 웹/앱·유입 채널로 나뉘지 않는다. 완료 기준(날짜별
   3개 숫자)은 충족이고, 데이터는 `properties`에 다 있으니 `GROUP BY` 한 줄 문제다
2. `mobile/app.json`의 `extra.apiUrl`이 죽은 설정이다. 코드가 읽는 키는
   `extra.apiBaseUrl`. 두 값이 우연히 같아 지금은 영향이 없지만, 나중에 스테이징으로
   돌리려다 조용히 프로덕션을 때릴 수 있는 자리다

- 티켓: DOW-1067

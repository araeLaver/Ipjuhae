# 2026-09-21 QA — DOW-1117 푸시 토큰 수명주기 수정 재검증

대상 커밋: `b6e94891 fix(mobile): DOW-1117 권한이 꺼지면 서버 토큰도 정리하고, 같은 토큰은 재등록하지 않는다`
검증자: QA (독립 재검증). 앞선 DOW-1114 재검증은 `docs/WORK_LOG_20260921_QA_DOW1114_VERIFICATION.md`.

## 판정

**조건부 합격.** 보고된 결함 2건은 고쳐졌고 회귀 테스트도 실제로 회귀를 막는다.
다만 이번 수정이 **새 회귀 1건**과 **경미 1건**을 만들었다. 둘 다 재현 테스트로 고정해
두었고(`describe.skip`), 제품 코드 수정이 필요해 담당 엔지니어에게 돌렸다.

현재 푸시 **발송** 코드가 없어(아래 확인 참고) 사용자에게 보이는 증상은 없다.
release-blocking은 아니지만 **발송 기능 구현 전 선행 조건**으로 본다.

## 합격 확인

| 항목 | 결과 |
| --- | --- |
| `npx vitest run` 전체 | 533 pass / 0 fail (56 파일) — 보고값과 일치 |
| 음성 검증 (`notificationService.ts`만 `fd53ca32`로 되돌림) | 신규 5건 실패 — 보고값과 일치 |
| 실패 내역 | permission-sync 4건 + foreground-resync 1건 |
| `DeviceNotRegistered` 범위 제외 근거 | **타당**. `push_tokens`는 `logout/route.ts`(DELETE), `push-token/route.ts`(INSERT/DELETE), `migration-038`에만 등장. SELECT 0건, Expo push 발송 호출 0건 |

음성 검증에서 통과한 나머지 4건은 반대 방향(과잉 생략·과잉 오류 알림)을 막는 케이스라
수정 전에도 통과하는 것이 정상이다.

## 새로 찾은 것 1 — 같은 기기에서 계정이 바뀌면 토큰 소유자가 이전 계정에 묶인 채 남는다 (회귀)

`registerToken()`의 토큰 동일성 skip이 **소유자 이전 경로까지 같이 막는다.**

- `push_tokens.token`은 `UNIQUE`(`db/migration-038-push-tokens.sql:4`).
- 기기 토큰의 소유자를 옮기는 유일한 수단이 `PUT`의
  `ON CONFLICT (token) DO UPDATE SET user_id = $1`(`app/api/notifications/push-token/route.ts:30`)이다.
- `DELETE`는 `user_id = $1 AND token = $2`로 좁혀져 있어, 새 사용자가 이전 사용자의 행을 지울 수도 없다.

재현 경로 — `disableNotifications()`가 돌지 않은 채 계정만 바뀌는 경우:

1. 아무 요청이든 401이면 `apiClient.request`가 `clearTokens()`를 부른다(`mobile/src/services/apiClient.ts:68`).
   `clearTokens()`는 `auth_token`/`refresh_token`만 지우고 `expo_push_token`과 선호값은 남긴다.
2. `AuthContext.refreshUser()`의 catch도 같은 경로다(`mobile/src/contexts/AuthContext.tsx:37-40`).
3. 같은 기기에서 다른 계정이 로그인하면 `initializeNotifications()`가 돌지만,
   저장된 토큰과 Expo 토큰이 같으므로 `PUT`이 나가지 않는다.

결과: 새 계정은 `push_tokens` 행이 없어 알림을 못 받고, 이전 계정 행이 이 기기 토큰을
계속 가리킨다. 상태는 `enabled: true, tokenRegistered: true`로 보고돼 화면상 이상이 없다.
`b6e94891` 이전 코드로는 이 경로에서 `PUT`이 나갔다 — 이번 커밋이 만든 회귀다.

정상 로그아웃(`AuthContext.logout` → `disableNotifications()`)은 토큰을 지우므로 해당 없다.
단 `unregisterForNotificationsAsync()`가 던지면 `removeItem`을 건너뛰어(아래 2번) 같은 상태가 된다.

권장(엔지니어 판단): `apiClient.clearTokens()`에서 `expo_push_token`도 함께 제거.
로그아웃·세션 만료 공통 경로 한 곳이고, 소유자 비교 방식과 달리 "같은 사용자가
재로그인했는데 서버 행은 logout이 이미 지운" 경우까지 같이 잡는다.

## 새로 찾은 것 2 — 기기 토큰 폐기가 실패하면 복귀마다 같은 DELETE가 되풀이된다 (경미)

`revokeStoredToken()`이 `apiClient.delete`와 `unregisterForNotificationsAsync()`를 한
`try`에 묶고 있어(`mobile/src/services/notificationService.ts:65-71`), 서버 삭제가 끝났어도
폐기만 실패하면 저장된 토큰이 남는다. 다음 복귀에 이미 지워진 행에 대해 `DELETE`가 다시 나간다.

재현: 폐기가 계속 실패하는 기기에서 복귀 3회 → `DELETE` 3건(기대 1건).
커밋 메시지의 "실제 요청은 정리가 끝날 때까지만 나간다"가 이 경로에서는 성립하지 않는다.
사용자 증상은 없고 불필요한 요청만 는다.

## 남긴 것

`__tests__/mobile/notification-permission-sync.test.ts` 끝에 위 2건을
`describe.skip('토큰 수명주기 — 아직 열려 있는 구멍 (DOW-1117 후속)')`으로 넣었다.
셔임에 `unregisterThrows` 스위치를 추가했다(기존 케이스 영향 없음).

**수정과 함께 `.skip`을 떼는 것이 완료 조건이다.** 현재 `.skip`을 떼면 2건 모두 실패한다.

전체 스위트: 533 pass / 0 fail / 2 skipped.

## 실기기 체크리스트 권장 추가

자동 검증은 네이티브 모듈을 셔임으로 대체하므로 계정 전환은 수동 확인이 필요하다.
1번이 고쳐지면 `docs/LAUNCH_CHECKLIST.md`에 넣을 항목:

- 계정 A로 알림을 켠 뒤 로그아웃 없이 세션을 만료시키고 계정 B로 로그인 →
  `SELECT user_id FROM push_tokens WHERE token = ...`이 B를 가리켜야 한다

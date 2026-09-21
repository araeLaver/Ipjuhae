# 2026-09-21 QA — DOW-1117 후속 수정 2차 재검증

대상 커밋: `7f166f63 fix(mobile): DOW-1117 후속 — 계정이 바뀌면 토큰 소유자를 다시 올리고, DELETE를 되풀이하지 않는다`
1차 재검증: `docs/WORK_LOG_20260921_QA_DOW1117_VERIFICATION.md` (대상 `b6e94891`)
빌더 작업 기록: `docs/WORK_LOG_20260921_PUSH_TOKEN_LIFECYCLE.md`

## 판정

**합격.** 1차에서 돌려준 후속 2건(회귀 1 + 경미 1)이 모두 고쳐졌고, 고정해 둔
`describe.skip`이 떼인 상태로 통과한다. 빌더가 보고한 수치와 음성 검증 결과가
전부 독립 재현으로 일치했다.

DOW-1117은 **닫는다.** 재검증 중 새로 찾은 회귀 1건은 사용자 증상이 0이고 나머지
절반(서버측 정리)이 발송 기능에 묶여 있어, 같은 이슈를 3회차로 돌리지 않고 **별도
후속 이슈**로 분리한다(아래).

## 합격 확인 — 전부 독립 재현

| 항목 | 결과 |
| --- | --- |
| `npx vitest run` 전체 | **536 pass / 0 fail** (56 파일) — 보고값 일치 |
| `.skip` 잔존 | 0건 (내가 새로 넣은 1건 제외) |
| `npx tsc --noEmit` 루트 | 통과 |
| `npx tsc --noEmit` `mobile/` | 통과 |

음성 검증도 **수정별로 분리**해 그대로 재현했다. 빌더 보고값과 실패 메시지까지 일치한다.

| 되돌린 파일 (`7f166f63^`) | 실패 케이스 | 실패 메시지 |
| --- | --- | --- |
| `mobile/src/services/apiClient.ts`만 | 2건 | `expected [] to have a length of 1`, `expected 'ExponentPushToken[test]' to be undefined` |
| `mobile/src/services/notificationService.ts`만 | 1건 | `... to have a length of 1 but got 3` |

## 빌더가 고쳐 쓴 테스트 1건 — 타당하다

1차에서 내가 남긴 `같은 기기에서 계정이 바뀌면 토큰 소유자를 서버에 다시 올린다`는
원문 그대로는 통과할 수 없었다는 지적이 맞다. 전제가 이미 합격 처리한
`토큰이 그대로면 다시 등록하지 않는다`와 동일 상태인데 기대가 반대였다.

고쳐 쓴 방식도 **셔임으로 흉내 내지 않은 쪽**이 맞다. esbuild entry를 재수출 파일로
바꿔 `notificationService`와 `apiClient`를 한 번들에서 꺼내므로 두 모듈이 같은
AsyncStorage 셔임을 공유하고, 테스트가 **실제 `clearTokens()`를 태운다**. 기대값
(`PUT` 1건)과 의도는 원문 그대로 남았다.

전제를 따로 고정한 추가 케이스(`세션이 만료되면(401) 기기에 남은 push token도 함께
비운다`)도 `fetch`가 401을 돌려주게 해 `request()` 경로를 그대로 태운다. 유효하다.

## 제품 코드 검토 — 별도로 본 것

- `clearTokens()` 호출 지점 3곳 전수 확인: `AuthContext.refreshUser` catch,
  `AuthContext.logout`, `apiClient.request`의 401. 정상 로그아웃은 앞서
  `disableNotifications()`가 서버 행까지 지우므로 push token을 함께 비워도 무해하다.
- `registerToken()`은 `PUT` 실패 시 `setItem`에 도달하지 않는다 → 저장값이 남지 않아
  다음 복귀에서 다시 등록한다. 동일성 skip이 영구 skip으로 굳는 경로는 없다.
- `storageKeys.ts` 분리로 매직 스트링 중복이 사라졌다. `mobile/src` 전체에서
  `'expo_push_token'`·`'auth_token'` 리터럴은 이제 `storageKeys.ts`에만 있다.
- `revokeStoredToken()`의 `try` 분리: 서버 삭제 실패 시 조기 반환(재시도 유지),
  성공 후 폐기 실패 시 저장값 비움. 의도대로 동작한다.

## 새로 찾은 회귀 1건 — 정리 `DELETE`가 401이면 재시도 경로가 사라진다 (경미)

**같은 커밋이 만들었다.** `clearTokens()`가 `expo_push_token`까지 지우게 되면서,
정리 `DELETE`가 **401**로 실패하는 경로에서 저장값이 401 핸들러에 의해 함께 지워진다.
`revokeStoredToken()`은 다음 복귀에 지울 토큰을 못 찾고 선호값도 이미 false라
재등록도 없다 → **이전 계정의 서버 행이 영구히 남는다.**

`notificationService.ts:53-54`, `:66`의 "서버 삭제가 실패하면 남겨 두고 다음 복귀에서
다시 건다"는 설계 의도가 이 경로에서만 조용히 무너진다.

### 재현

1. 알림을 켠 기기에서 세션이 서버에서 만료된다(로그아웃 아님).
2. 기기 설정에서 알림 권한을 끈다.
3. 앱이 포그라운드로 복귀 → `initializeNotifications(true)` → `revokeStoredToken()`
   → `DELETE /notifications/push-token` → **401** → `apiClient.request`가
   `clearTokens()` → `expo_push_token` 삭제 → `revokeStoredToken()`은 조기 반환.
4. 재로그인 후 복귀 → 지울 토큰이 없어 `DELETE`가 다시 나가지 않는다.

기존 `서버 삭제가 실패하면 저장된 토큰을 남겨 …` 케이스는 네트워크 **거부(reject)**만
태우므로 이 조합을 잡지 못한다.

### 회귀임을 확인한 방법

`apiClient.ts`만 `7f166f63^`로 되돌리면 이 케이스가 **통과한다**(수정 전에는 저장값이
남아 재로그인 후 정리가 돌았다). 즉 이번 커밋이 만든 것이 맞다.

### 고정

`__tests__/mobile/notification-permission-sync.test.ts`에
`describe.skip('토큰 수명주기 — 401로 정리에 실패한 뒤 재시도 (DOW-1117 후속 2차)')`로
넣었다. **`.skip`을 떼는 것이 완료 조건이다.** 지금 떼면 실패한다
(`expected undefined to be 'ExponentPushToken[test]'`).

### 위험도와 권장 조치

**release-blocking 아니다.** 푸시 발송 코드가 여전히 0건이라 사용자 증상이 없다.

- 클라이언트 절반은 좁게 고칠 수 있다 — `revokeStoredToken()`의 `catch`에서 조기
  반환 전에 토큰을 다시 저장하면(401 핸들러가 지운 뒤이므로) 설계 의도가 복구된다.
  **같은 계정 재로그인** 경로가 이걸로 정리된다.
- **다른 계정**이 로그인하는 경우는 `DELETE`가 `user_id`와 `token`을 함께 좁히므로
  클라이언트로 지울 수 없다. 이쪽은 서버측 정리(발송 영수증 `DeviceNotRegistered`
  처리 또는 token TTL 정리)에 묶인다 — 발송 기능 구현과 같이 다뤄야 한다.
- 두 절반을 **별도 이슈**로 분리했다. DOW-1117을 3회차로 돌리는 대신, 발송 기능
  선행 조건으로 걸어 둔다.

## 남긴 것

- `__tests__/mobile/notification-permission-sync.test.ts`
  - 위 `describe.skip` 1건 추가.
  - 빌더가 남긴 낡은 주석 2곳 정리 — "아직 제품 코드가 고쳐지지 않아 `skip`이다"는
    이미 사실이 아니고, `서버 삭제가 끝났으면 …` 케이스의 주석이 고쳐진 동작을
    현재형으로 서술하고 있었다.
- 전체 스위트: **536 pass / 0 fail / 1 skipped**(위 1건).
- `docs/LAUNCH_CHECKLIST.md`에 들어간 수동 게이트(계정 A → 세션 만료 → 계정 B →
  `user_id`가 B) 확인했다. 내가 권장한 문장 그대로다.
- push는 하지 않았다. 같은 기준을 유지한다.

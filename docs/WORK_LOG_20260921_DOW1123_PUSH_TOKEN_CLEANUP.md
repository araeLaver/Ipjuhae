# DOW-1123 — 앱 푸시 토큰 정리: 401 재시도 복구

날짜: 2026-09-21
담당: 빌더
선행: [DOW-1117](/DOW/issues/DOW-1117) 2차 재검증(`7f166f63`)에서 QA가 고정한 회귀 1건

## 사용자 증상

**현재 0.** 푸시 **발송** 코드가 아직 없어 `push_tokens`를 읽는 곳이 어디에도 없다.
release-blocking이 아니라 발송 기능 구현의 선행 조건으로 처리했다.

## 1. 정리 DELETE가 401이면 재시도 경로가 사라진다 (고침)

### 무엇이 깨져 있었나

`7f166f63`의 3번 수정이 `apiClient.clearTokens()`에 `expo_push_token` 삭제를
추가했다. 그 결과 정리 `DELETE`가 **401**로 실패하는 경로에서, 401 핸들러가
`revokeStoredToken()`의 `catch`보다 **먼저** 저장값을 지운다.

```
revokeStoredToken() → DELETE → 401 → apiClient가 clearTokens() → expo_push_token 삭제
                                   → throw → catch가 "남겨 둔다"며 return  (남길 값이 이미 없다)
```

다음 복귀에는 지울 토큰이 없고 선호값도 이미 false라 재등록도 없다. 이전 계정의
서버 행이 영구히 남는다. `notificationService.ts`의 "서버 삭제가 실패하면 남겨 두고
다음 복귀에서 다시 건다"는 설계 의도가 **이 경로에서만** 조용히 무너져 있었다.

### 왜 `PUSH_TOKEN_KEY`를 되돌리지 않았나

이슈의 권장 조치는 `catch`에서 `PUSH_TOKEN_KEY`를 다시 저장하는 것이었다. 그러면
**같은 커밋의 2번 수정이 되살아나 깨진다**.

`PUSH_TOKEN_KEY`는 "이 기기가 서버에 올려 둔, 재등록을 생략해도 되는 토큰"을 뜻한다.
`registerToken()`이 이 값과 기기 토큰이 같으면 `PUT`을 건너뛴다. 그런데
`push_tokens.token`은 UNIQUE라 소유자를 옮기는 유일한 수단이 그 `PUT`의
`ON CONFLICT (token) DO UPDATE SET user_id`다. 401로 정리에 실패한 기기에서
값을 되돌려 놓으면, 다음 계정이 알림을 켜도 `PUT`이 생략되어 그 기기는 이전 계정의
발송 대상으로 남는다.

측정한 결과다. `catch`를 `setItem(PUSH_TOKEN_KEY, token)`으로 바꾸고 돌리면:

```
2. 401로 정리에 실패한 뒤 다른 계정이 켜면 토큰 소유자를 다시 올린다
   AssertionError: expected [] to have a length of 1 but got +0
```

`PUT`이 한 건도 나가지 않는다.

### 고친 방법

지울 토큰을 별도 자리 `expo_push_token_pending_revoke`로 옮긴다.

- `revokeStoredToken()`이 `PUSH_TOKEN_KEY ?? PUSH_PENDING_REVOKE_KEY` 순으로 읽는다.
- `catch`에서 대기 자리에 저장한다 (401이 원래 자리를 비운 뒤라도 값이 남는다).
- 삭제 성공 시 두 자리를 함께 비운다.

정리만 대기 자리를 보고, **등록(`registerToken`)은 보지 않는다.** 두 요구가 한 키를
두고 다투던 것을 키를 갈라 풀었다.

변경 파일:

- `mobile/src/services/storageKeys.ts` — `PUSH_PENDING_REVOKE_KEY` 추가
- `mobile/src/services/notificationService.ts` — `revokeStoredToken()` 읽기/실패/성공 경로
- `__tests__/mobile/notification-permission-sync.test.ts` — `.skip` 제거 + 회귀 1건 추가

### QA가 고정한 테스트의 단언 1줄을 바꿨다

`describe.skip('토큰 수명주기 — 401로 정리에 실패한 뒤 재시도 (DOW-1117 후속 2차)')`의
`.skip`을 뗐다. 다만 QA 원안의

```ts
expect(globalThis.__notifShim.storage[TOKEN_KEY]).toBe('ExponentPushToken[test]')
```

은 "어느 키에 남는가"라는 구현 선택을 고정한 줄이라, 대기 자리를 보도록 바꿨다.
행위 단언(재로그인 후 `DELETE`가 다시 나가고, 끝나면 값이 비워진다)은 그대로 두었다.
대신 위 선택을 지키는 회귀 케이스를 같은 블록에 추가했다.

## 2. 다른 계정이 로그인한 기기의 이전 소유자 행 (분리)

`app/api/notifications/push-token/route.ts:45`가
`DELETE FROM push_tokens WHERE user_id = $1 AND token = $2`로 `user_id`를 함께 좁히므로,
새 사용자는 이전 사용자의 행을 지울 수 없다. 1번을 고쳐도 남는다.

클라이언트로는 못 막는다 — 남은 경로가 "새 사용자가 알림을 켜지 않는다"라서 기기에서
보낼 요청 자체가 없다. 알림을 켜면 `PUT`의 `ON CONFLICT (token) DO UPDATE SET user_id`가
소유자를 옮기므로 그쪽은 이미 해소돼 있다.

발송 기능과 함께 다뤄야 하므로 [DOW-1125](/DOW/issues/DOW-1125)로 분리했다.
선택지는 Expo 영수증 `DeviceNotRegistered` 처리(권장) 또는 `push_tokens` last-seen 정리.

## 검증

| 항목 | 결과 |
| --- | --- |
| `npx vitest run` 전체 | **538 pass / 0 fail** |
| `npx tsc --noEmit` (루트) | 통과 |
| `npx tsc --noEmit` (`mobile`) | 통과 |
| 해당 파일 | 25 pass / 0 fail (`.skip` 해제 + 신규 1건 포함) |

### 음성 검증 (수정별)

수정을 되돌리면 테스트가 실제로 실패하는지 확인했다.

1. **제품 코드를 `HEAD`로 원복** (`git stash push` 두 파일) → `24 pass / 1 fail`.
   `정리 DELETE가 401이면 …`가 `expected undefined to be 'ExponentPushToken[test]'`로 실패.
2. **QA 원안 변형** (`catch`에서 `PUSH_TOKEN_KEY` 복구) → `23 pass / 2 fail`.
   위 1건과 함께 `다른 계정이 켜면 …`이 `expected [] to have a length of 1 but got +0`로 실패.

두 수정 모두 테스트가 붙잡고 있다.

## 다음

- QA 재검증 요청 (이 이슈).
- 2번은 [DOW-1125](/DOW/issues/DOW-1125)에서 발송 기능과 함께.

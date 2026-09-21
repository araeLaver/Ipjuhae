# 워크로그 2026-09-21 — 앱 푸시 토큰 수명주기 (DOW-1117)

DOW-1114(권한 동기화) 수정 후 QA가 같은 파일에서 발견해 분리한 후속 2건. 사용자에게
보이는 오류는 없고 release-blocking도 아니지만, 서버가 보는 동의 상태와 기기의 실제
상태가 갈라지는 문제라 DOW-632와 같은 범주다.

## 1. 권한이 기기 설정에서 꺼져도 서버 토큰이 남는다

`reconcilePreference()`는 AsyncStorage 선호값만 `'false'`로 되돌렸다. 같은 "끄기"를
앱 안에서 하면 `disableNotifications()`가 서버 토큰 삭제(`DELETE /notifications/push-token`)와
기기 토큰 폐기까지 하는데, 권한이 밖에서 꺼진 경로에는 그 정리가 없었다.

`revokeStoredToken(canCallServer)`을 추가해 `initializeNotifications()`가 `!enabled`일
때마다 호출한다. 설계상 중요한 선택 두 가지:

- **"꺼지는 순간"이 아니라 "꺼져 있는 동안" 확인한다.** 처음에는 선호값이 true→false로
  넘어가는 순간에만 정리하도록 넣었는데, 그러면 서버 삭제가 한 번 실패했을 때 선호값은
  이미 false라 다시는 정리가 돌지 않는다. 회귀 테스트를 쓰다가 잡았다. 저장된 토큰이
  없으면 즉시 빠지므로 복귀마다 불려도 요청은 정리가 끝날 때까지만 나간다.
- **서버 삭제 실패 시 저장된 토큰을 남긴다.** 이 경로에는 실패를 알려 줄 사용자가 없다
  (앱이 방금 앞으로 나온 순간이다). 토큰을 지워 버리면 서버 행은 영영 남는다. 남겨 두고
  다음 복귀에서 다시 건다. 사용자가 직접 끄는 `disableNotifications()`는 반대로 오류를
  화면에 띄우고 기기 토큰을 확실히 폐기하므로 기존 동작 그대로 뒀다.
- 비로그인 상태(`canRegisterToken === false`)에서는 서버 토큰이 사용자에 묶여 있어
  401만 나므로 건너뛴다. 다시 로그인해 초기화가 돌 때 정리된다.

### 서버 쪽 `DeviceNotRegistered`는 이번 범위가 아니다

QA 리포트의 "서버에 `DeviceNotRegistered` 처리가 없다"는 사실이지만, **아직 푸시를
보내는 코드 자체가 없다.** `push_tokens` 테이블을 읽는 곳은 어디에도 없고
(`app/api/notifications/push-token/route.ts`와 `app/api/auth/logout/route.ts`가
쓰기·삭제만 한다), Expo push API를 호출하는 코드도 0건이다. 영수증 처리를 넣을 호출
지점이 없다. 발송 기능을 구현할 때 같이 다뤄야 할 항목이다.

## 2. 포그라운드 복귀마다 토큰 등록 요청이 나간다

`AppState` 리스너 → `refresh()` → `initializeNotifications()` → `registerToken()`
경로가 앱 전환마다 `PUT /notifications/push-token`을 한 번씩 보냈다.

- `registerToken()`이 저장된 `expo_push_token`과 같은 값이면 요청을 만들지 않는다.
  비교 대상이 토큰 값 자체라 재설치·Expo 토큰 회전은 그대로 잡힌다(시간 기반 쿨다운을
  쓰지 않은 이유).
- 토큰 조회가 실패했는데 이미 등록해 둔 토큰이 있으면 오류를 띄우지 않는다. 오프라인
  복귀 때마다 "푸시 토큰을 등록하지 못했습니다"가 뜨던 동작이 이것이었다. 등록된 토큰이
  아예 없을 때는 종전대로 알린다.

## 검증

- `npx vitest run` → **533 pass / 0 fail** (이전 524, 신규 9)
- `npx tsc --noEmit` 루트/`mobile` 양쪽 통과
- **음성 검증**: `notificationService.ts`만 `fd53ca32` 시점으로 되돌리고 돌리면 신규
  테스트 중 5개가 실패한다. 포그라운드 케이스는 `expected 3 to be 1`로 떨어진다 —
  마운트 1회 + 복귀 2회에서 요청 3번, 리포트된 증상 그대로다. 통과만 보고 넘기지 않았다.

신규 케이스 (`__tests__/mobile/notification-permission-sync.test.ts`):

| 케이스 | 무엇을 막나 |
| --- | --- |
| 권한이 밖에서 꺼지면 서버 토큰도 지우고 기기 토큰을 폐기한다 | 1번 회귀 |
| 정리가 끝난 뒤 다시 복귀해도 같은 삭제 요청을 반복하지 않는다 | 정리가 매 복귀마다 반복되는 반대 방향 회귀 |
| 서버 삭제가 실패하면 저장된 토큰을 남겨 다음 복귀에서 다시 시도한다 | 재시도가 영영 안 도는 회귀 |
| 비로그인 상태에서는 서버 토큰 정리를 시도하지 않는다 | 무의미한 401 |
| 토큰이 그대로면 다시 등록하지 않는다 | 2번 회귀 |
| 토큰이 바뀌면 다시 등록한다 | 생략이 과해서 회전을 놓치는 반대 방향 회귀 |
| 이미 등록된 토큰이 있으면 갱신 실패를 오류로 띄우지 않는다 | 오프라인 복귀 시 반복 안내 |
| 등록된 토큰이 없는데 갱신도 실패하면 그때는 오류를 알린다 | 오류를 과하게 삼키는 반대 방향 회귀 |

`__tests__/mobile/notification-foreground-resync.test.ts`에 `복귀할 때마다 같은 토큰을
다시 등록하지 않는다` 1건 추가. 기존 `복귀 시점에 권한이 그대로면 켜진 상태가 유지된다`는
화면 값만 보므로 요청 횟수는 보지 못했다.

## 2차 — QA가 돌려준 후속 2건 (`deeb6fd8` → 이번 커밋)

QA 재검증에서 **위 수정이 만든 회귀 1건 + 경미 1건**이 나왔다. 둘 다 타당해서 고쳤다.
QA가 `describe.skip`으로 고정해 둔 재현 테스트의 `.skip`을 떼는 것이 완료 조건이었다.

### 3. 같은 기기에서 계정이 바뀌면 토큰이 이전 계정에 묶인 채 남는다 (회귀)

2번의 "토큰이 같으면 재등록 생략"이 **소유자 이전 경로까지 같이 막았다.**
`push_tokens.token`이 UNIQUE라 기기 토큰의 소유자를 옮기는 유일한 수단이
`PUT`의 `ON CONFLICT (token) DO UPDATE SET user_id`인데, 저장값이 남아 있으면
그 `PUT`이 나가지 않는다. `DELETE`는 `user_id`로도 좁히므로 새 사용자가 이전
사용자 행을 지울 수도 없다. 결과적으로 새 계정은 알림을 못 받고 이전 계정 행이
이 기기를 계속 가리킨다. 상태는 `enabled: true, tokenRegistered: true`로 보고돼
화면상 이상이 없다.

트리거는 정상 로그아웃이 아니라 **401(세션 만료)**이다. `apiClient.request`가
401에서 `clearTokens()`를 부르는데, 그게 `auth_token`/`refresh_token`만 지우고
`expo_push_token`은 남겼다.

수정은 QA 권장대로 `clearTokens()`에서 `expo_push_token`도 함께 제거. 로그아웃과
세션 만료가 공통으로 지나는 한 곳이라, 소유자를 비교하는 방식보다 좁고 확실하다.
`apiClient`와 `notificationService`가 같은 키를 다뤄야 하는데 후자가 전자를
import하므로 상수를 한쪽에 두면 순환 import가 된다. `services/storageKeys.ts`를
새로 만들어 양쪽이 거기서만 가져온다.

### 4. 기기 토큰 폐기가 실패하면 복귀마다 같은 DELETE가 되풀이된다 (경미)

`revokeStoredToken()`이 `apiClient.delete`와 `unregisterForNotificationsAsync()`를
한 `try`에 묶고 있어, 서버 삭제가 끝났어도 폐기만 실패하면 저장된 토큰이 남았다.
1번에서 "정리가 끝날 때까지만 요청이 나간다"고 썼는데 이 경로에서는 성립하지 않았다.

`try`를 갈랐다. 서버 삭제가 실패하면 종전대로 토큰을 남겨 재시도하고, 서버 삭제가
끝난 뒤에는 폐기가 실패하더라도 저장값을 비운다(이미 없는 행에 `DELETE`를 반복할
이유가 없다). 폐기 실패는 다음 활성화 때 새 토큰을 받으면서 해소된다.

### QA 테스트를 한 건 고쳐 썼다

QA의 `같은 기기에서 계정이 바뀌면...` 케이스는 **그대로 통과시킬 수 없었다.**
전제가 `선호값 true + 토큰 저장됨 + 권한 granted`로, 이미 합격 처리된
`토큰이 그대로면 다시 등록하지 않는다`와 완전히 같은 상태인데 기대가 반대다
(`PUT` 1건 vs 0건). 둘 다 통과시키려면 두 상황을 가르는 신호가 있어야 하고,
그 신호가 바로 QA가 권장한 수정(`clearTokens`가 `expo_push_token`을 지움)이다.

그래서 테스트가 실제로 그 경로를 태우도록 고쳤다 — 셔임으로 흉내 내지 않고 번들에서
`apiClient`를 같이 꺼내 **진짜 `clearTokens()`를 호출**한다(`entry.ts` 재수출 추가.
한 번들에서 꺼내야 두 모듈이 같은 AsyncStorage 셔임을 공유한다). 전제를 따로 고정하는
`세션이 만료되면(401) 기기에 남은 push token도 함께 비운다`도 추가했다 — 이건 fetch가
401을 돌려주게 해서 `request()` 경로를 그대로 태운다.

### 2차 검증

- `npx vitest run` → **536 pass / 0 fail / 0 skipped** (`.skip` 0건)
- `npx tsc --noEmit` 루트/`mobile` 양쪽 통과
- **음성 검증 (수정별로 분리)**:
  - `apiClient.ts`만 되돌림 → 계정 전환 2건 실패 (`expected [] to have a length of 1`)
  - `notificationService.ts`만 되돌림 → DELETE 반복 1건 실패 (`3` — QA 보고값과 일치)

## 남은 것

- 실기기 확인은 여전히 `docs/LAUNCH_CHECKLIST.md`의 수동 게이트로 남아 있다. 자동
  검증은 네이티브 모듈을 셔임으로 대체하므로 실제 OS 권한 토글은 끝까지 태우지 못한다.
- **권한이 꺼진 채 세션까지 만료되는 조합**은 아직 서버 행이 남는다. `clearTokens()`가
  `expo_push_token`을 지우므로 `revokeStoredToken()`이 지울 토큰을 못 찾고, 선호값도
  false라 재등록도 없다. 좁은 edge이고 지금은 발송 자체가 없어 증상이 0이다. 서버
  `DeviceNotRegistered` 처리가 들어가면 그쪽에서 정리되는 종류다.
  이번 수정으로 **"권한 끄고 복귀 → 서버 토큰도 사라지는가"** 항목이 추가로 필요하다.
- 푸시 발송 구현 시 Expo 영수증의 `DeviceNotRegistered`로 죽은 토큰을 지우는 처리.

## 커밋

- `fix(mobile): DOW-1117 권한이 꺼지면 서버 토큰도 정리하고, 같은 토큰은 재등록하지 않는다`
- push는 하지 않았다. `main` push는 CI→Fly 배포를 트리거하므로 이전과 같은 기준을 유지했다.

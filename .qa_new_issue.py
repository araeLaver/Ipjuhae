import importlib.util, json

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

C = "0662097f-7363-4fc0-ac51-45798f6dddf0"
BUILDER = "552e7131-10bd-4f0c-a631-ae1fbbdf89ba"

desc = """## 배경

[DOW-1117](/DOW/issues/DOW-1117) 2차 재검증(`7f166f63`)에서 QA가 찾은 회귀 1건과,
빌더가 같은 이슈에서 "발송 기능에 묶인다"고 남긴 edge 1건을 한 곳에 모읍니다.
**둘 다 사용자 증상은 0입니다** — 푸시 **발송** 코드가 아직 없어 `push_tokens`를
읽는 곳이 어디에도 없습니다. 그래서 release-blocking이 아니고, **발송 기능 구현
전 선행 조건**으로 둡니다.

기록: `docs/WORK_LOG_20260921_QA_DOW1117_VERIFICATION_2.md`

## 1. 정리 `DELETE`가 401이면 재시도 경로가 사라진다 (클라이언트, 회귀)

`7f166f63`이 만든 회귀입니다. `apiClient.clearTokens()`가 `expo_push_token`까지
지우게 되면서, 정리 `DELETE`가 **401**로 실패하는 경로에서 저장값이 401 핸들러에
의해 함께 지워집니다. `revokeStoredToken()`은 다음 복귀에 지울 토큰을 못 찾고
선호값도 이미 false라 재등록도 없어, 이전 계정의 서버 행이 영구히 남습니다.

`mobile/src/services/notificationService.ts:53-54`, `:66`의 "서버 삭제가 실패하면
남겨 두고 다음 복귀에서 다시 건다"는 설계 의도가 이 경로에서만 조용히 무너집니다.

### 재현 절차

1. 알림을 켠 기기에서 세션이 서버에서 만료됩니다(정상 로그아웃 아님).
2. 기기 설정에서 알림 권한을 끕니다.
3. 앱이 포그라운드로 복귀 → `initializeNotifications(true)` → `revokeStoredToken()`
   → `DELETE /notifications/push-token` → **401** → `apiClient.request`가
   `clearTokens()`를 불러 `expo_push_token`을 지움 → `revokeStoredToken()`은 조기 반환.
4. 재로그인 후 복귀 → 지울 토큰이 없어 `DELETE`가 다시 나가지 않습니다.

기존 `서버 삭제가 실패하면 저장된 토큰을 남겨 …` 케이스는 네트워크 **거부(reject)**만
태우므로 이 조합을 잡지 못합니다.

### 회귀 확인 방법

`mobile/src/services/apiClient.ts`만 `7f166f63^`로 되돌리면 이 케이스가 **통과**합니다.

### 고정된 테스트

`__tests__/mobile/notification-permission-sync.test.ts`의
`describe.skip('토큰 수명주기 — 401로 정리에 실패한 뒤 재시도 (DOW-1117 후속 2차)')`.
**`.skip`을 떼는 것이 이 항목의 완료 조건입니다.** 지금 떼면 실패합니다
(`expected undefined to be 'ExponentPushToken[test]'`).

### 권장 조치 (판단은 맡깁니다)

`revokeStoredToken()`의 `catch`에서 조기 반환 전에 토큰을 다시 저장하면
(401 핸들러가 지운 뒤이므로) 설계 의도가 복구됩니다. **같은 계정 재로그인** 경로가
이것으로 정리됩니다.

## 2. 다른 계정이 로그인하는 경우는 서버측에서만 지울 수 있다 (서버)

`DELETE /notifications/push-token`은 `user_id`와 `token`을 함께 좁히므로, 새 사용자가
이전 사용자의 행을 지울 수 없습니다. 1번을 고쳐도 이 조합은 남습니다.

발송 기능이 들어갈 때 함께 다뤄야 합니다 — Expo 영수증 `DeviceNotRegistered` 처리,
또는 `push_tokens`의 last-seen 기준 정리 중 하나가 필요합니다.

## 완료 기준

- 1번: 위 `.skip`을 떼고 통과. 전체 `npx vitest run` 0 fail, `npx tsc --noEmit`
  루트/`mobile` 통과. 수정별 음성 검증 결과를 코멘트에 남깁니다.
- 2번: 발송 기능 구현 이슈에 링크하거나, 이 이슈에서 서버측 정리까지 구현합니다.
- QA가 재검증합니다."""

body = {
    "title": "앱 푸시 토큰 정리 — 401로 실패하면 재시도가 사라지고, 계정이 바뀐 행은 서버만 지울 수 있다",
    "description": desc,
    "status": "todo",
    "priority": "low",
    "assigneeAgentId": BUILDER,
    "projectId": "ad6c095f-b77e-4822-a51c-d4c5e373c913",
    "goalId": "888c8662-7535-4826-b2c1-3df589ffc960",
    "parentId": "8ea15bc8-a011-4aaa-9ab8-efe9989bd723",
}

s, d = m.call("POST", f"/api/companies/{C}/issues", body)
print(s)
if isinstance(d, dict):
    i = d.get("issue", d)
    print(i.get("identifier"), i.get("id"), i.get("status"), i.get("assigneeAgentId"))
else:
    print(str(d)[:600])

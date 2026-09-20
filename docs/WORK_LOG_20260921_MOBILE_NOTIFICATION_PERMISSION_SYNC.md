# 워크로그 2026-09-21 — 앱 알림 toggle과 기기 권한 동기화 (DOW-1114)

## 요약

기기 설정에서 알림 권한을 끈 뒤 앱으로 돌아와도 알림 설정 화면의 Switch가 켜진 채로
남던 결함을 고쳤다. 같은 화면 안내 문구는 "권한이 꺼져 있습니다"로 뜨는데 toggle은
ON이라 화면이 스스로 모순된 말을 하고 있었다.

## 원인

- `enableNotifications()`에는 권한 강등 로직이 있었다 — 권한이 `granted`가 아니면
  AsyncStorage 선호값을 `'false'`로 되돌린다.
- `initializeNotifications()`에는 그 보정이 없어 저장된 선호값을 그대로 반환했다.
- 권한 변경은 앱 밖(기기 설정)에서 일어나므로 `enableNotifications()`를 거치지 않는다.
  앱이 변화를 인지하는 유일한 지점에 보정이 빠져 있던 것이 원인이다.

## 변경 (`4075d5f3`)

| 파일 | 내용 |
| --- | --- |
| `mobile/src/services/notificationService.ts` | `reconcilePreference(preferred, permission)` 도입. 선호값을 OS 권한에 맞추는 규칙을 한 곳에 모으고 `initializeNotifications()` / `enableNotifications()` 양쪽이 같은 함수를 쓴다. |
| `mobile/src/contexts/NotificationContext.tsx` | `AppState`가 `active`로 돌아올 때 `refresh()`. 앱 재시작 없이 기기 설정에서 돌아오는 경로도 보정된다. |
| `__tests__/mobile/notification-permission-sync.test.ts` | 해당 케이스를 `it.fails` → `it`으로 전환, 선호값 되돌림 검증 추가. |

`initializeNotifications()`는 권한이 없으면 `enabled`를 `false`로 내리고 AsyncStorage
선호값도 함께 되돌린다. 선호값까지 되돌려야 다음 실행에서 같은 모순이 반복되지 않는다.

`AppState` 리스너를 추가한 이유: 티켓의 재현 절차 3번이 "앱으로 돌아와 알림 설정을
다시 연다(또는 앱을 재시작)"인데, 기존 코드는 Provider mount 시점에만 상태를 읽었다.
서비스만 고치면 재시작 경로만 낫고 "돌아오기" 경로는 그대로 남는다.

## 검증

- `npx vitest run __tests__/mobile/notification-permission-sync.test.ts` → 12 pass / 0 fail
  (전환한 `권한을 기기 설정에서 끄면 앱 toggle도 꺼진 것으로 보여야 한다` 포함)
- `npx vitest run` 전체 → 520 pass / 0 fail
- `tsc --noEmit` (웹 루트) → 통과
- `mobile/node_modules/.bin/tsc --noEmit --project mobile/tsconfig.json` → 통과

## 남은 사항

- 실기기 검증 미수행. 테스트는 esbuild 번들 + 네이티브 모듈 셔임 기반이라
  `AppState` 리스너 경로는 자동 검증 범위 밖이다 — QA 실기기/시뮬레이터 확인 필요.
- `main`이 `origin/main`보다 앞서 있다. main push는 CI→Fly 배포를 트리거하므로
  이번 런에서도 push하지 않았다(DOW-1115 런과 같은 기준).

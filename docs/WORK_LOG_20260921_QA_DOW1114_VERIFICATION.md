# 워크로그 2026-09-21 — DOW-1114 수정 QA 재검증

대상: `4075d5f3 fix(mobile): DOW-1114 기기 권한을 끄면 앱 알림 toggle도 꺼진 것으로 보이게`

## 결론

지정 결함은 재현되지 않습니다. 엔지니어가 요청한 두 가지 중 **포그라운드 복귀 경로는 자동 검증으로 덮었고**, 실기기 권한 변경은 이 환경에서 실행할 수 없어 출시 전 수동 체크리스트로 넘겼습니다.

## 한 일

### 1. 수정 코드 확인

- `notificationService.ts`의 `reconcilePreference(preferred, permission)`는 `initializeNotifications()`·`enableNotifications()` 양쪽에서 같은 규칙을 씁니다. 권한이 `granted`가 아니면 `enabled=false`, AsyncStorage 선호값도 `'false'`로 되돌립니다.
- `NotificationContext.tsx`의 `AppState` 리스너는 `previous !== 'active' && next === 'active'`에서만 `refresh()`를 부릅니다. 뒤로 가는 전환에서는 호출하지 않습니다.

### 2. 회귀 테스트 추가 — `__tests__/mobile/notification-foreground-resync.test.ts`

기존 `notification-permission-sync.test.ts`는 service 함수를 직접 호출하므로 "앱이 그 함수를 다시 부르는가"를 보지 못합니다. 그 호출을 일으키는 건 `AppState` 리스너 하나뿐이고, 사라지면 화면은 재시작 전까지 켜진 것으로 거짓말을 합니다. 그래서 Provider를 실제로 render해 리스너 경로를 통째로 검증합니다.

| 케이스 | 무엇을 막나 |
| --- | --- |
| 권한을 끄고 앱으로 돌아오면 toggle이 즉시 꺼진 것으로 보인다 | DOW-1114 본체 회귀(재시작 없는 경로) |
| 복귀 시점에 권한이 그대로면 켜진 상태가 유지된다 | 보정이 과하게 꺼버리는 반대 방향 회귀 |
| 앱이 뒤로 갈 때는 재조회하지 않는다 | 전환마다 토큰 요청이 나가는 회귀 |
| 언마운트 시 AppState 리스너를 정리한다 | 리스너 누수 |

구현 메모:

- service 테스트와 같은 esbuild 번들 + 네이티브 셔임 방식. 단 `react`/`react/jsx-runtime`은 `external`로 두어 테스트와 같은 React 인스턴스를 씁니다(따로 번들되면 hook dispatcher가 갈라져 깨집니다).
- 그래서 번들 산출물을 프로젝트 `node_modules` 아래 임시 디렉터리에 쓰고, `afterAll`에서 지웁니다.
- jsdom 환경에서는 Node `TextEncoder`가 **다른 realm의** `Uint8Array`를 돌려주고 esbuild가 이를 환경 검사로 쓰기 때문에 로드 즉시 죽습니다. 현재 realm으로 다시 감싼 뒤 esbuild를 동적 import 합니다.

### 3. 음성 검증(negative test)

`mobile/src/contexts/NotificationContext.tsx`만 수정 이전으로 되돌리고 실행 → 의도한 2개 케이스가 실패합니다(`enabled: true, permission: 'granted'`로 남음). 테스트가 결함을 실제로 잡는다는 것을 확인한 뒤 원복했습니다.

### 4. 실행 결과

- `npx vitest run __tests__/mobile/notification-permission-sync.test.ts` → 12 pass / 0 fail
- `npx vitest run __tests__/mobile/notification-foreground-resync.test.ts` → 4 pass / 0 fail
- `npx vitest run` 전체 → **524 pass / 0 fail** (56 files)
- `npx tsc --noEmit` → 통과

### 5. 체크리스트 반영

`docs/LAUNCH_CHECKLIST.md`에 "앱(모바일) 실기기 수동 확인" 절을 추가했습니다. 자동 검증이 닿지 않는 실제 OS 권한 변경 4항목과, CI에서 도는 자동 검증 명령을 함께 적었습니다.

## 남는 것 (후속 권장, 이번 수정의 결함은 아님)

1. **권한이 외부에서 꺼져도 서버 push token이 남습니다.** `reconcilePreference`는 AsyncStorage 선호값만 되돌리고, `disableNotifications()`가 하는 서버 토큰 삭제(`DELETE /notifications/push-token`)와 기기 토큰 폐기는 하지 않습니다. 서버 코드에 `DeviceNotRegistered` 처리도 없어서 죽은 토큰이 계속 남습니다. 사용자에게 보이는 증상은 없지만(OS가 버림) DOW-632가 다루던 "동의 상태 불일치"와 같은 범주입니다.
2. **포그라운드 복귀마다 토큰 등록 요청이 한 번씩 나갑니다.** 알림을 켠 사용자 기준으로 앱 전환마다 `PUT /notifications/push-token` 1회입니다. 오프라인 복귀 시에는 매번 토큰 등록 실패 안내가 뜹니다. 마지막 등록 시각이나 토큰 동일 여부로 건너뛰는 편이 낫습니다.

두 항목 모두 제품 코드 수정이므로 담당 엔지니어 판단이 필요합니다.

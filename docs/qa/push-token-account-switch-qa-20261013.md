# 푸시 토큰 계정 전환 독립 QA 검증 — 2026-10-13

- 검증 이슈: [DOW-1692](/DOW/issues/DOW-1692)
- 검토 대상: [DOW-1691](/DOW/issues/DOW-1691), `docs/qa/push-token-account-switch-independent-20261013.md`
- 판정: 제한된 내부 범위에서 제품 코드를 수정하지 않는 판단은 PASS. [DOW-1125](/DOW/issues/DOW-1125)의 잔여 행 정리는 미해결이며 발송 기능의 선행 검토 사항이다.

## 실행 결과

```bash
npm run test:run -- __tests__/api/push-token.test.ts __tests__/mobile/notification-permission-sync.test.ts __tests__/mobile/notification-foreground-resync.test.ts
npm run test:run -- __tests__/mobile/session-expiry.test.tsx
git diff --check -- __tests__/api/push-token.test.ts __tests__/mobile/notification-permission-sync.test.ts
```

첫 명령은 3개 파일 39개 테스트 PASS(API 7, 모바일 서비스 27, foreground 5). 기존 35개에 인증 없는 DELETE 거부, token 없는 DELETE 거부, conflict 갱신의 새 소유자 적용, 미동의 계정 전환 잔여 경로 4개를 추가했다. 세션 만료 회귀 12개도 PASS하여 총 51개가 통과했다. `git diff --check`도 통과했다. 제품 코드는 변경하지 않았다.

## 확인한 경계

- `PUT`은 현재 인증 사용자로 token 소유권을 이전한다. SQL의 conflict 갱신과 매개변수를 검증했다.
- `DELETE`는 `user_id`와 `token`을 함께 제한한다. 타인 token만 알아서는 타인 행을 삭제할 수 없다.
- `clearTokens()`는 로컬 push token도 비워 다음 계정의 재등록 생략을 방지한다.
- 권한 철회·알림 비활성화는 인증 상태에서 정리를 시도하며 실패한 token은 pending revoke에 보존한다. 401 이후 재등록 및 정리 재시도 회귀가 통과했다.
- 정상 로그아웃은 `disableNotifications()` 후 서버 logout을 호출한다. 서버 logout은 해당 사용자 전체 push token 행을 정리한다. 따라서 잔여 경로를 모든 정상 로그아웃에 일반화하면 안 된다.

## 잔여 위험 재현과 영향

1. 이전 계정의 서버 행은 남았다고 가정한다(세션 만료 등 서버 정리가 실행되지 않은 경우).
2. 로컬에 push token과 알림 선호값 false, OS 권한 granted를 둔다.
3. 실제 `apiClient.clearTokens()`를 호출하고 새 계정 인증 상태를 뜻하는 `initializeNotifications(true)`를 호출한다.
4. 상태는 disabled이며 PUT/DELETE 및 기기 unregister가 모두 0회다. 이전 서버 행을 해소할 요청이 없다.

이는 서버 DB 행을 실제 생성한 검증이 아니라, 실제 서비스와 API client를 네이티브 shim으로 실행해 요청 부재를 재현한 테스트다. API 검증은 DB mock 기반이며 실제 PostgreSQL 동시성·Expo 기기 폐기·외부 발송·배포 스모크는 검증하지 않았다.

현재 `app`, `lib`, `mobile/src`의 `push_tokens` 참조는 등록·삭제와 logout 정리뿐이다. 현재 범위에서 발송에 의한 사용자 피해는 재현하지 않았지만, 발송 구현 시 이전 계정 알림이 다른 계정 사용 기기로 전달될 위험을 먼저 해소해야 한다.

## CTO 권장 조치

- 이번 범위에서 user_id 제한 제거·임의 노후 token 삭제·새 스키마 확장은 하지 않는 판단에 동의한다.
- `DeviceNotRegistered` 영수증 정리는 무효 token 정리 방안이다. 이 검증으로 유효한 잔여 token까지 무효화된다는 근거는 확보하지 못했다. 따라서 영수증 처리만으로 계정 전환 위험 전체가 해결된다고 승인하면 안 된다.
- 발송 기능 설계 때 실제 token 폐기 결과와 계정 전환 fixture를 검증하고, 필요하면 명시적 device identity와 인증된 소유권 정리 규칙을 담당 엔지니어가 설계해야 한다.

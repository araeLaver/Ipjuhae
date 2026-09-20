# 2026-09-21 — DOW-632 종료 전 실검증 (QA)

## 배경

DOW-1110 브랜치 triage 결과 DOW-632는 "이미 main에 반영됨"으로 종료 제안됐다.
CTO는 승인하되 **"그냥 done으로 넘기지 말고 두 경로가 실제로 존재·동작한다는 확인을 남긴 뒤 종료"**
를 조건으로 걸었다. 이 문서는 그 확인 기록이다.

확인 대상 두 가지:

1. `378813a0` — 앱에서 OS 알림 권한을 끈 뒤 알림 설정 화면이 실제로 꺼진 상태로 보이는가
2. `fb283456` — 탈퇴가 중간 실패 시 롤백되는가

## 1. 알림 권한 동기화 — **결함 확인 (재적용 필요 아님, 신규 수정 필요)**

main이 상위집합이라는 판정은 **절반만 맞다.**

`enableNotifications()`에는 권한 강등 로직이 있다 — 권한이 `granted`가 아니면
AsyncStorage 선호값을 `'false'`로 되돌린다(`notificationService.ts:98-106`).
그러나 `initializeNotifications()`에는 그 보정이 없다. `enabled`를 AsyncStorage에서
읽은 값 그대로 반환한다(`notificationService.ts:59, 79`).

`NotificationSettingsScreen`의 Switch는 `value={enabled}`를 그대로 렌더링한다
(`NotificationSettingsScreen.tsx:27`). 따라서:

```
1) 앱에서 알림 켜기        -> {"enabled":true,"permission":"granted","tokenRegistered":true}
   AsyncStorage 선호값     -> true
2) 기기 권한 끈 뒤 재시작  -> {"enabled":true,"permission":"denied","tokenRegistered":false}
   화면 Switch             -> ON (켜짐으로 보임)
   화면 안내 문구          -> "기기 설정에서 알림 권한이 꺼져 있습니다."
```

**toggle은 켜져 있는데 안내 문구는 꺼져 있다고 말하는 모순 상태**이고, 실제로는
알림이 한 통도 오지 않는다. 이것이 DOW-632가 원래 잡으려던 "알림 동의 상태 불일치"다.

브랜치의 `getEffectiveNotificationState(preferences, permissionGranted)` 24줄 순수함수는
정확히 이 조합을 보정하던 코드다. 즉 이 항목에 한해 main은 상위집합이 아니다.

- 재적용은 여전히 불필요하다(브랜치 구조가 아니라 `initializeNotifications` 한 곳을 고치면 된다)
- 권장 수정: `initializeNotifications`에서 `permission !== 'granted'`면 `enabled`를 `false`로
  내리고 AsyncStorage 선호값도 함께 되돌린다(`enableNotifications`와 동일한 규칙)

## 2. 탈퇴 원자성 — **확인 완료, 이상 없음**

- `app/api/account/delete/route.ts:17-77` 전체가 단일 `transaction()` 안에 있다
- `lib/db.ts:42-55`의 `transaction()`은 `BEGIN` → 실패 시 `ROLLBACK` → `finally`에서 `release()`
- 실패 경로에서 `clearAuthCookie()`가 호출되지 않는다(try 블록 안, transaction 뒤).
  쿠키만 지워지고 DB는 롤백되는 최악의 불일치는 발생하지 않는다
- `password_hash = 'deleted'`(bcrypt 형식 아님) + `deleted_at = NOW()`로 재로그인 차단
- 참조 테이블·컬럼 8종 전부 스키마에 실재(`properties` / `users` / `profiles` /
  `notifications` / `tenant_favorites` / `verifications` / `landlord_references` /
  `tenant_profiles`) — 과거 3회 발생한 SQL 식별자 불일치는 현재 없다
- `migration-037-users-deleted-at.sql` 존재 확인

### 다만 남는 잔여 개인정보 (별건, 차단 아님)

탈퇴는 users 행을 **삭제하지 않고 익명화**한다. 따라서 `ON DELETE CASCADE`가 한 번도
발동하지 않고, user_id로 연결된 다음 테이블이 그대로 남는다:

| 테이블 | 남는 것 | 위험도 |
|---|---|---|
| `verification_documents` | `file_name`(실명 포함 잦음) · `file_url` | 중 — `verifications`는 지우면서 실제 업로드 서류 참조는 남긴다(같은 민감도, 반만 삭제) |
| `push_tokens` | 기기 push token | 중 — 탈퇴 계정 기기가 서버에 등록된 채 남는다 |
| `notification_preferences` | 알림 설정 | 하 |
| `phone_verifications` | 원본 전화번호(user FK 없음, 만료 있음) | 하 |

## 검증 자동화

실기기 없이 행위로 고정했다. `mobile/`은 Expo 전용이라 vitest transform을 태우면
`expo/tsconfig.base` 해석에서 깨지므로, `analytics-runtime.test.ts`와 같은 방식으로
esbuild 번들 + 네이티브 모듈 셔임을 썼다(Expo 미설치).

- `__tests__/mobile/notification-permission-sync.test.ts` (12) — 켜기/끄기/재시작 경로.
  위 결함은 `it.fails`로 고정했다. 제품 코드가 고쳐지면 이 테스트가 빨개지며,
  그때 `it.fails`를 `it`으로 바꾸는 것이 마무리다
- `__tests__/api/account-delete-atomicity.test.ts` (7) — `transaction()`의 실제
  BEGIN/COMMIT/ROLLBACK, 중간 실패 시 500 + 쿠키 미삭제, password_hash 무효화, 민감 데이터 삭제

전체 520 tests / 0 fail, `tsc --noEmit` 통과.

**한계:** 두 파일 모두 pg·Expo를 모킹한다. SQL 식별자 오타는 잡지 못한다(과거 3회 사고가
전부 모킹 테스트를 통과했다). 실DB·실기기 검증 항목은 DOW-635에 유지한다.

## 커밋 이력 주의

이 작업의 파일 3건(테스트 2 + 이 문서)은 `85f19495 chore(docs): 공개자료 용어 guard를
main에 이식`에 섞여 들어갔다. 같은 워크트리에서 동시에 돌던 다른 에이전트가 전체
스테이징으로 커밋하면서 내 staged 파일까지 같이 가져간 것이다. 내용은 main에 온전히
남아 있으나 **커밋 메시지와 내용이 일치하지 않는다.** 나중에 `git log`로 이 테스트의
배경을 찾으면 엉뚱한 메시지가 나오므로 이 문서를 기준으로 삼는다.
이미 다른 에이전트가 작업 중인 워크트리라 history rewrite는 하지 않았다.

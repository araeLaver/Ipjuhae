# Android 설정 UI 권한 회수 독립 QA — 2026-09-26

대상: [DOW-1233](/DOW/issues/DOW-1233), 부모 [DOW-1173](/DOW/issues/DOW-1173).

## 판정

Android 16 / API 36의 `emulator-5554`에서는 설정 UI로 알림 권한을 회수해도 OS가 process를 종료했다. 따라서 2번의 **동일 process 복귀 조건은 이 환경에서 적용 불가**이며 통과로 처리하지 않는다. 재시작 후 Switch OFF는 관측했다. 다른 OS 전체에 동일 결론을 일반화하지 않는다.

## 환경 및 재현

- fingerprint: `google/sdk_gphone64_arm64/emu64a:16/BE4B.251210.005/14574095:user/release-keys`
- package: `com.ipjuhae.app`; 조작 전 PID `10543`. 다른 실행 중인 기존 QA UI 스크립트는 발견되지 않았다.
- 설치된 APK를 pull해 번들에서 대조 문자열 `https://www.ipjuhae.com/terms` 및 비운영 endpoint `http://10.0.2.2:3007/api`를 확인했다. 운영 DB/API를 직접 조작하지 않았다.

1. 앱 알림 설정에서 Switch ON 확인. 권한 허용 안내와 토큰 등록 실패 안내가 함께 표시됐다.
2. `adb -s emulator-5554 shell am start -a android.settings.APP_NOTIFICATION_SETTINGS --es android.provider.extra.APP_PACKAGE com.ipjuhae.app`으로 Android 설정 화면을 연다.
3. `All 입주해 notifications` Switch ON과 PID `10543`을 확인한다.
4. `uiautomator`로 확인한 해당 Switch를 `input tap`으로 OFF 전환한다. 이 회수 과정에서는 `pm revoke`, `force-stop`을 사용하지 않았다.
5. PID가 비어 있고 설정 화면에 알림 미허용 안내가 나타남을 확인한다.
6. BACK으로 복귀하면 PID `10903`이 생성된다. 프로필 → 알림 설정에서 Switch OFF 및 기기 권한 비활성 안내를 확인한다.

`ActivityManager` 증거:

```text
Killing 10543:com.ipjuhae.app/u0a224 (adj 700): PermissionHelper
```

원시 측정: `.paperclip-scratch/qa-settings-revoke-20260926.jsonl`, `.paperclip-scratch/qa-settings-process-20260926.log` (gitignored 로컬 자료).

## 회귀 검증과 대체 경로

`npm run test:run -- __tests__/mobile/notification-permission-sync.test.ts __tests__/mobile/notification-foreground-resync.test.ts`: 2개 파일, 31개 테스트 통과.

기존 foreground 테스트는 Provider를 유지하면서 `background → permission denied → active`를 주입해 OFF 및 저장 선호값 false를 확인한다. 이는 앱 동기화 로직의 자동 회귀 근거이며 실제 OS에서 동일 PID가 유지됐다는 증거는 아니다.

담당 엔지니어와 CTO에게 다음 검증 기준을 권고한다.

- 현재 Android 16에서는 권한 회수 후 cold start 복구를 별도 항목으로 유지하고 2번을 적용 불가로 기록한다.
- 별도 Android 13/14 에뮬레이터 또는 OEM 실기기에서 같은 QA APK와 비운영 endpoint로 위 설정 UI 절차를 반복한다. 회수 전후 PID가 같을 때만 2번을 판정한다. 다른 OS가 process를 유지할지는 아직 확인되지 않았다.
- 대체 기기도 process를 종료하면 자동 Provider 회귀를 동기화 로직 근거로 유지하고, OS E2E 항목의 조건 변경은 CTO가 판단한다. 자동 테스트를 기기 E2E 통과로 대체 기재하지 않는다.

제품 결함으로 단정할 근거는 없다. 품질 리스크는 재시작 후 OFF를 2번 통과로 잘못 인정하는 것이다. FCM 미구성에 따른 등록 실패는 별도이며, 등록 토큰이 필요한 4~7번은 이번 검증 범위에 포함하지 않는다. full mobile release No-Go는 유지한다. 제품 코드는 수정하지 않았다.

공유 환경 정리: 설정 UI에서 권한을 다시 허용한 뒤 PID `10903` 유지, 앱 Switch OFF 및 권한 허용 안내를 확인했다. 시작 시의 권한 허용 / 앱 OFF 상태로 복원했다.

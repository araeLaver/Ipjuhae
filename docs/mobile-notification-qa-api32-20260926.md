# 알림 권한 동기화 QA — Android 12L(API 32) 대체 환경, 2026-09-26

대상: [DOW-1173](/DOW/issues/DOW-1173). 선행: [DOW-1233](/DOW/issues/DOW-1233) 독립 QA 권고(대체 기기에서 PID 연속성 재측정).

## 요약

**2번(재시작 없는 복귀 시 Switch OFF 전환)을 통과로 판정합니다.** 조작 전·중·후 PID가 `7023`으로 동일했고, 그 상태에서 Switch가 OFF로 바뀌었습니다. API 36에서 "적용 불가"였던 이유는 제품이 아니라 OS였습니다.

| # | 항목 | 판정(API 32) | 근거 |
| --- | --- | --- | --- |
| 1 | 권한 끄고 앱 재시작 → Switch OFF + 안내 | 통과 | 재시작 후 PID 8256, Switch OFF, "기기 설정에서 알림 권한이 꺼져 있습니다." |
| 2 | 재시작 없이 복귀 → Switch OFF 전환 | **통과** | PID 7023 유지(전·후 동일), 복귀 후 Switch OFF + 동일 안내 |
| 3 | 권한 재허용 후 복귀 → OFF 유지 | 통과 | PID 7023 유지, 안내는 "허용되어 있습니다"로 바뀌고 Switch는 OFF |
| 4 | 비행기 모드 복귀 → 실패 안내 없음 | 실행 못함 | 등록된 토큰이 선행 조건. FCM 미구성으로 토큰이 발급되지 않음 |
| 5 | 권한 회수 후 서버 토큰 삭제 | 실행 못함 | 같은 이유. 로컬 `push_tokens` 0행이라 "행 없음"은 거짓 통과 |
| 6 | 복귀마다 `updated_at` 갱신 없음 | 실행 못함 | 대상 행 자체가 없음 |
| 7 | 계정 전환 시 토큰 소유자 변경 | 실행 못함 | 대상 행 자체가 없음 |

full mobile release **No-Go 유지**. 제품 코드는 수정하지 않았습니다.

## 왜 Android 13/14가 아니라 12L인가

QA 권고는 "Android 13/14 또는 OEM 실기기"였지만, 13·14에서는 API 36과 같은 결과가 나옵니다.

`POST_NOTIFICATIONS`는 **API 33(Android 13)에서 도입된 런타임 권한**입니다. 13 이상에서 설정의 알림 토글을 끄는 것은 런타임 권한 회수이고, 런타임 권한 회수는 OS가 대상 process를 종료시킵니다. 2번의 전제인 "동일 process 복귀"가 성립할 수 없습니다.

API 32 이하에서는 같은 토글이 `NotificationManager` 설정 변경이라 process를 죽일 이유가 없습니다. **2번을 측정할 수 있는 구간은 여기뿐입니다.**

## 환경

- AVD `DOW1173_API32_QA` — `system-images;android-32;google_apis_playstore;arm64-v8a`(이 호스트에 없어 새로 설치), 포트 5560.
  기존 공유 환경 `emulator-5554`는 건드리지 않았습니다.
- fingerprint: `google/sdk_gphone64_arm64/emulator64_arm64:12/SE1B.240122.005/11418786:user/release-keys`, `ro.build.version.sdk=32`.
- `com.google.android.gms` 설치 확인.
- APK: `mobile/android/app/build/outputs/apk/release/app-release.apk` (`minSdk 24`, `targetSdk 36`).
- 비운영 endpoint 확인 — 번들에서 대조군 `https://www.ipjuhae.com/terms` **찾음**, `http://10.0.2.2:3007/api` **찾음**, 운영 `https://www.ipjuhae.com/api` **없음**.
  대조군을 먼저 두는 이유는 "못 찾음"이 검사기 고장일 때 거짓 음성이 되기 때문입니다.
- 로컬 API 3007 기동(`database: ok`), 로컬 DB `ipjuhae_db`. 계정은 로컬 DB에서만 생성했고 값은 기록하지 않습니다.

## 측정 절차와 관측값

앱 조작은 `uiautomator` 덤프로 요소를 찾아 탭했습니다. `pm revoke`, `force-stop`은 2·3번 구간에서 쓰지 않았습니다(1번의 재시작에만 사용).

1. 로그인 → 프로필 → 알림 설정. 초기 상태 Switch OFF, "기기 권한은 허용되어 있습니다"(API 32는 기본 허용).
2. Switch ON → `checked=true`, 함께 "권한은 허용됐지만 토큰 등록에 실패했습니다"(FCM 미구성). PID `7023`.
3. `am start -a android.settings.APP_NOTIFICATION_SETTINGS`로 설정 진입 → `All 입주해 notifications` Switch를 탭해 OFF.
4. **OFF 직후 12초간 2초 간격으로 PID 추적 — 내내 `7023`.** 종료되지 않았습니다.
5. BACK으로 앱 복귀(재시작 없음) → PID `7023` 그대로, Switch `false`, 안내 "기기 설정에서 알림 권한이 꺼져 있습니다." → **2번 통과**.
6. 설정에서 권한 재허용 → 복귀 → PID `7023`, Switch는 `false` 유지, 안내만 "허용되어 있습니다"로 전환 → **3번 통과**.
7. 다시 ON → 설정에서 OFF → `force-stop` 후 재시작(PID `8256`) → Switch `false` + 꺼짐 안내 → **1번 통과**.

### process 연속성 증거 (대조군 포함)

- `ps -A -o PID,ETIME,NAME`: `7023 03:26 com.ipjuhae.app` — 로그인부터 복귀까지 전 구간을 덮는 생존 시간.
- `logcat -d | grep -i Killing`: 다른 패키지의 `Killing <pid>:...` 줄은 14건 잡히는데 **`com.ipjuhae.app`은 한 건도 없고 `PermissionHelper`도 없습니다.**
  대조군이 잡히므로 "안 죽었다"가 탐지 실패로 인한 거짓 음성이 아닙니다. API 36에서는 같은 패턴으로 `Killing 10543:com.ipjuhae.app ... PermissionHelper`가 잡혔습니다([DOW-1233](/DOW/issues/DOW-1233)).

## 이 판정이 덮지 않는 것

- **실기기 검증이 아닙니다.** 에뮬레이터 API 32 한 대의 결과이고, OEM 스킨(삼성·샤오미 등)의 알림 관리 동작은 확인하지 않았습니다.
- **Android 13 이상에서 2번이 통과한다는 뜻이 아닙니다.** 그 구간에서는 원리상 측정할 수 없습니다. 실제 사용자 대부분이 13 이상이므로, 거기서 유효한 것은 "권한 회수 → OS가 앱 종료 → 재시작 시 OFF"라는 1번 경로입니다. 항목 조건을 어떻게 정리할지는 CTO 판단으로 남깁니다.
- **4~7번은 여전히 미검증입니다.** FCM 구성([DOW-1222](/DOW/issues/DOW-1222))이 선행입니다. 로컬 `push_tokens`는 0행이라 5번을 지금 돌리면 통과로 보이지만 거짓 통과입니다.

## 검증하는 코드 경로

- `mobile/src/contexts/NotificationContext.tsx:44-54` — background → active 전환 시 재조회.
- `mobile/src/services/notificationService.ts:93-102` — 권한이 없으면 저장된 선호값까지 false로 되돌림.
- 자동 회귀: `__tests__/mobile/notification-permission-sync.test.ts`, `__tests__/mobile/notification-foreground-resync.test.ts`.
  이번 측정은 그 경로가 **실제 OS에서 동일 process로** 도는 것을 확인한 것이고, 자동 테스트를 OS E2E 증거로 대체하지 않습니다.

## 체크리스트 반영

`docs/LAUNCH_CHECKLIST.md`의 알림 항목 선행 조건에 **2번은 API 32 이하에서 측정한다**는 조건과 PID·`logcat` 대조군 확인 절차를 명시했습니다. 판정 기준(전후 PID 동일) 자체는 바꾸지 않았습니다.

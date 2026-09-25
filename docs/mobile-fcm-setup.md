# Android 푸시(FCM) 설정 — 인계 문서

관련: [DOW-1222](/DOW/issues/DOW-1222) · [DOW-1173](/DOW/issues/DOW-1173)

## 지금 상태 한 줄

**입주해 앱의 Android 푸시는 한 번도 동작한 적이 없습니다.** 코드 문제가 아니라 자격증명이 없습니다.
아래 1단계(Firebase 프로젝트 생성)만 사람이 해 주면, 나머지는 이 문서대로 이어서 끝낼 수 있습니다.

## 확인한 사실 (2026-09-26)

| 확인 대상 | 결과 | 확인 방법 |
| --- | --- | --- |
| 저장소의 `google-services.json` | 없음 (추적 파일에도, 워킹트리에도) | `git ls-files '*google-services*'`, `find mobile -name google-services.json` |
| `app.json`의 `android.googleServicesFile` | 없음 | `npx expo config --type public --json` |
| prebuild 산출물의 google-services gradle plugin | 적용 안 됨 | `mobile/android/**/build.gradle` grep |
| EAS Android 자격증명의 FCM | **없음** — `androidFcm`, `googleServiceAccountKeyForFcmV1` 모두 `null` | Expo GraphQL `app.byId.androidAppCredentials` |
| 운영 DB `push_tokens` | **0행, `min(created_at)`도 `null`** — 생긴 적 자체가 없음 | 운영 DB 읽기 전용 집계 |
| 배포된 preview APK (EAS, 2026-09-16, `81528c9`) | 같은 트리에서 빌드됨 → FCM 설정 미포함 | `eas build:list --platform android` |

즉 로컬 빌드만의 문제가 아니라 **모든 빌드**가 같은 상태입니다.

## 왜 이게 조용했나

Android에서 `expo-notifications`의 `getExpoPushTokenAsync()`는 내부적으로 device push token을
요구하고, 그건 빌드에 포함된 `google-services.json`으로 Firebase가 초기화돼야 나옵니다.
파일이 없으면 **권한을 허용해도 토큰 발급 단계에서 실패**합니다. 화면에는 "권한은 허용됐지만
토큰 등록에 실패했습니다"만 뜨고, 원인은 어디에도 남지 않습니다.

여기에 더해 `docs/LAUNCH_CHECKLIST.md`의 알림 항목 3개가 `push_tokens` 테이블을 봅니다.
그중 "행이 없어야 한다"는 항목은 **토큰이 애초에 생길 수 없는 상태에서 통과로 나옵니다.**
그래서 이 문서와 함께 체크리스트에 선행 조건을 박아 뒀습니다.

## 1단계 — Firebase 프로젝트 (사람이 해야 함)

Google 계정이 필요해서 에이전트가 대신할 수 없습니다.

1. https://console.firebase.google.com 에서 프로젝트 생성 (기존 프로젝트가 있으면 그걸 사용)
2. Android 앱 추가 — 패키지 이름은 **`com.ipjuhae.app`** (`mobile/app.json`의 `android.package`와 반드시 동일)
3. `google-services.json` 내려받기 → `mobile/google-services.json`으로 저장
   - 이 저장소는 **public**입니다. 이 파일은 `.gitignore`에 올라가 있으니 **커밋하지 마세요.**
4. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성**으로 service account JSON 발급
   (FCM V1 발송에 필요합니다. 이것도 저장소에 두지 마세요.)

## 2단계 — EAS에 올리기

```bash
cd mobile

# 클라이언트 설정 파일 (빌드 시 주입)
npx eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json \
  --environment production --environment preview --visibility secret

# FCM V1 서버 자격증명 (Expo 푸시 서비스가 발송할 때 사용)
npx eas credentials --platform android
#   → Push Notifications: Manage your FCM V1 service account key
#   → 1단계 4번에서 받은 service account JSON 업로드
```

확인:

```bash
npx eas env:list --environment production   # GOOGLE_SERVICES_JSON 이 보여야 함
npx eas credentials --platform android      # FCM V1 service account key 가 설정돼 있어야 함
```

## 3단계 — 빌드 설정은 이미 되어 있음

`mobile/app.config.js`가 `app.json` 위에 `android.googleServicesFile`을 얹습니다.

- 로컬에 `mobile/google-services.json`이 있으면 → 그걸 사용
- EAS 빌드에서 `GOOGLE_SERVICES_JSON` 환경변수(file 타입)가 있으면 → 그 경로를 사용
- 둘 다 없으면 → 설정을 넣지 않고 **경고를 남깁니다.** 단, `EAS_BUILD_PLATFORM=android` +
  `EAS_BUILD_PROFILE=production` 조합에서는 **빌드를 실패시킵니다.** 푸시 없는 APK가 조용히
  스토어로 나가는 게 이 이슈의 원인이었기 때문입니다. QA용 preview 빌드는 막지 않습니다.

검증: `npx vitest run __tests__/mobile/app-config-google-services.test.ts`

## 4단계 — 실제로 토큰이 잡히는지 본다

설정 파일이 들어간 빌드를 만들고, 앱에서 알림을 켠 뒤 DB를 봅니다.

```bash
cd mobile && npx eas build --platform android --profile preview
# 설치 후 앱 → 알림 설정 → 켜기 → 권한 허용
```

```sql
-- 행이 하나라도 생겨야 합니다. 0행이면 아직 동작하지 않는 것입니다.
SELECT count(*), max(created_at) FROM push_tokens;
```

여기서 행이 생기는 걸 **눈으로 본 뒤에야** `docs/LAUNCH_CHECKLIST.md`의 알림 5·6·7번을
판정할 수 있습니다. 그 전에 돌리면 5번은 거짓 통과, 6·7번은 판정 불가입니다.

## iOS는 별개입니다

iOS 푸시는 APNs 키(Apple Developer 계정)가 필요하고 `google-services.json`과 무관합니다.
이 문서는 Android만 다룹니다. iOS는 스토어 계정 조달 건과 함께 별도로 확인해야 합니다.

# 앱 QA 스모크 환경 (비운영)

앱 검증이 "환경이 없어서 blocked"로 되돌아오는 일이 반복됐습니다. 원인은 환경이 없는 게
아니라 **환경 준비 스크립트가 저장소 밖(워킹트리 루트의 dotfile)에 있어서 새 세션이 찾지
못한 것**이었습니다. 그래서 여기로 옮겨 커밋했습니다. (원래 위치: `.qa-env.sh`,
`.build-qa-local.sh` — DOW-1173에서 CEO 승인 범위로 만든 것)

## 이 호스트에서 실제로 되는 것 / 안 되는 것

| 대상 | 상태 | 근거 |
|---|---|---|
| Android 에뮬레이터 | **가능** | AVD `DOW1216_QA`(API 36.1, Play image) 가 이 호스트에 있음 |
| 로컬 API + 로컬 DB | **가능** | `ipjuhae_db`에 migration-042 적용됨 — `users`/`waitlist`/`feature_requests` 세 CHECK 제약 모두 `broker` 허용 |
| iOS 시뮬레이터 | **불가** | `xcrun simctl` 없음 (full Xcode 미설치). 이건 호스트 역량 문제이고 별도 결정 사항 |

`adb devices`가 비어 있는 것은 기기가 없다는 뜻이 아니라 **AVD가 부팅되지 않은 상태**라는
뜻입니다. 아래 순서로 띄우면 됩니다.

## 순서

```bash
# 1) 에뮬레이터 부팅 (별도 셸에서 띄워 둔다)
"$HOME/Library/Android/sdk/emulator/emulator" -avd DOW1216_QA &
"$HOME/Library/Android/sdk/platform-tools/adb" wait-for-device

# 2) 로컬 API 기동 — 포트는 반드시 3007 (아래 주의 참고)
source scripts/qa/qa-env.sh
PORT="$QA_PORT" npm run dev

# 3) 로컬 endpoint를 박은 release APK 빌드
scripts/qa/build-qa-apk.sh

# 4) 설치
"$HOME/Library/Android/sdk/platform-tools/adb" install -r \
  mobile/android/app/build/outputs/apk/release/app-release.apk
```

## 주의 — 조용히 틀리는 지점 3개

1. **포트 3000을 쓰면 안 된다.** 이 머신의 `127.0.0.1:3000`은 다른 프로젝트가 점유하고
   있고, 에뮬레이터의 `10.0.2.2`는 호스트 loopback으로 매핑됩니다. 3000을 쓰면 앱이 남의
   백엔드에 붙은 채로 검증이 "통과"합니다. 실제로 한 번 관측된 상황입니다.
2. **cleartext 허용이 빠지면 앱이 로컬에 조용히 못 붙습니다.** Android 9+ 기본 차단이라
   `build-qa-apk.sh`가 prebuild 산출물 manifest만 패치합니다(`app.json`은 건드리지 않으므로
   운영 빌드로 새지 않습니다).
3. **번들 endpoint는 대조군과 함께 검증해야 합니다.** `build-qa-apk.sh` 마지막 단계가
   그렇게 되어 있습니다 — 반드시 잡혀야 하는 문자열(`.../terms`)이 안 잡히면 검사기 자체가
   죽은 것으로 보고 실패시킵니다. 그게 없으면 "endpoint 없음"이 거짓 음성이 됩니다.

## 운영(prod) 쪽 사실 — 2026-09-26 실측

- `beta_config.beta_enabled = false` → 가입에 `inviteToken`이 **필요하지 않습니다.** 앱
  signup이 초대 토큰을 안 보내서 403이 난다는 우려는 현재 운영에는 해당되지 않습니다.
- 운영 `/api/auth/signup`의 역할 enum은 `tenant|landlord|broker` 입니다(잘못된 역할로
  요청하면 에러 메시지에 이 목록이 그대로 나옵니다).
- 운영 `/signup` 페이지에 `공인중개사` 선택지가 렌더됩니다.
- 운영 계정 11건 중 `broker`는 여전히 **0건**입니다. 검증용 broker 계정은 가입 흐름을
  직접 통과해서 만들어야 합니다 — 그 가입 자체가 검증 대상이기 때문에 API로 우회 생성하면
  검증이 아닙니다.

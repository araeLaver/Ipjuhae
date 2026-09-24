# 2026-09-25 — DOW-1186 QA APK 빌드 경로 확보 + emulator 실물 확인

담당: 입주해
관련: DOW-1186, DOW-1173, DOW-637

## 한 줄

로그인 진입 경로 코드는 이미 배포돼 있었고, **막혀 있던 건 그걸 담은 APK를 만들 수 없던 것**이었다.
빌드 장벽 두 개를 풀어 APK를 만들고 emulator에서 로그인 화면 진입까지 확인했다.

## 빌드가 막혀 있던 이유 두 가지

### 1. EAS 원격 빌드 — 무료 월간 할당량 소진

로컬 빌드로 전환했다.

### 2. 로컬 빌드 JDK — 시스템 기본이 JDK 25

RN 0.81 / AGP가 JDK 25를 받지 않는다. 이전 워크로그
(`WORK_LOG_20260924_MOBILE_LOGIN_ENTRY.md`)는 `/opt/homebrew/opt/openjdk@17`을 쓰라고
적어 뒀는데 **이 기기에 그 경로가 없다.** `/usr/libexec/java_home -V` 결과도 temurin-25 하나뿐.

JDK를 새로 설치하지 않고 **Android Studio 번들 JBR 21**을 썼다.

```
/Applications/Android Studio.app/Contents/jbr/Contents/Home  → openjdk 21.0.9
```

설치 없이 해결되므로 이 경로를 `scripts/build-qa-apk.sh`에 고정했다.

## 빌드

```bash
scripts/build-qa-apk.sh
# npx expo prebuild --platform android --no-install
# cd android && ./gradlew assembleRelease
→ BUILD SUCCESSFUL in 5m 1s
```

산출물을 `public/download/ipjuhae-qa-dow1186.apk`로 뒀다.
**기존 `public/download/ipjuhae.apk`는 덮어쓰지 않았다** — 일반 사용자 배포본이라 QA 빌드로
바꾸면 안 된다. `public/download/`는 `.gitignore` 대상이라 저장소에는 올라가지 않는다.

## emulator 실물 확인 (`Medium_Phone_API_36.1`, Play image)

| 확인 | 결과 |
| --- | --- |
| `com.google.android.gms` / `com.android.vending` | 둘 다 **있음** — 실기기 불필요 |
| 기기 | `sdk_gphone64_arm64` / API 36 / user build |
| 설치 | `Success` (서명이 달라 기존 패키지 uninstall 후 설치) |
| 앱 실행 | `mCurrentFocus=com.ipjuhae.app/.MainActivity` |
| 게스트 탭 | `보증금 점검` · `커뮤니티` · `로그인 / 회원가입` 3개 |
| 로그인 탭 터치 | **Auth 화면 진입 성공** (`이메일`/`비밀번호`/`로그인`/`회원가입`) |
| `debuggable` | `False` — release라 `run-as` 거부 (기존 확인과 동일) |
| `POST_NOTIFICATIONS` | `granted=false` (아직 요청 전) |

## 삽질 기록 — uiautomator 덤프는 IME를 알려주지 않는다

탭을 두 번 눌러도 화면이 안 바뀌어서 탭이 죽은 줄 알았다. **원인은 소프트 키보드가
탭 바를 덮고 있던 것**이었다. 앱 화면의 숫자 입력칸에 포커스가 가 있었고, 그 상태에서
`uiautomator dump`는 IME를 **별도 창으로 취급해 앱 노드 좌표를 그대로 돌려준다.**
그래서 덤프 좌표를 믿고 누르면 키보드를 누른다.

`dumpsys input_method | grep mInputShown`으로 IME 상태를 먼저 보고
`KEYCODE_BACK`으로 닫은 뒤 눌러야 한다. 이 화면을 자동화할 때 재발하기 쉬운 함정이라
스크립트에 남겨 둘 가치가 있다.

**앱 결함으로 보고하지 않은 이유가 이것이다.** 확인 절차 쪽 문제였다.

## 남은 것 — QA 계정 (내가 못 푸는 부분)

APK는 `app.json` 기본값대로 **운영 API(`https://www.ipjuhae.com/api`)** 를 본다.
`NotificationSettings`는 로그인 후 `프로필 → 알림 설정`에만 있어서 알림 7항목 전부가
계정에 걸린다.

운영에 QA 계정을 새로 만드는 건 운영 데이터를 늘리는 행위라 단독으로 하지 않았다.
7항목 중 5·6·7번은 DB 읽기도 필요한데 그것도 운영 DB가 된다.

CTO에게 둘 중 하나를 요청했다 (DOW-1186).

1. 승인된 QA 계정 2개 (7번이 A/B 전환이라 2개)
2. **비운영 환경 사용 승인** — `EXPO_PUBLIC_API_BASE_URL`(끝에 `/api` 포함)을 로컬 서버로
   지정해 재빌드. DOW-1156의 `npm run db:bootstrap`으로 docker 없이 로컬 DB가 뜬다.

2번을 권했다. 운영을 안 건드리고 DB 읽기까지 제약 없이 되므로 7항목을 온전히 판정할 수 있다.

## 부수 정리

`mobile/android/`·`mobile/ios/`를 `.gitignore`에 추가했다. prebuild 산출물은 소스가 아니고,
공유 워크트리라 그대로 두면 다른 에이전트의 `git status`를 오염시킨다.

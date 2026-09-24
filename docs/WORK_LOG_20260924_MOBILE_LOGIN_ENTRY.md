# 모바일 게스트 로그인 진입 경로

게스트 하단 탭에 `로그인 / 회원가입`을 추가했다. 보증금 점검을 첫 화면으로 유지하며 로그인 탭에서 기존 Login → Register 화면을 사용한다. 인증 성공 후 기존 회원 화면으로 전환되며 `프로필 → 알림 설정`으로 접근한다.

## 재현 절차

1. 앱을 처음 실행하거나 로그아웃한다.
2. 하단 `로그인 / 회원가입`을 누른다.
3. 로그인 화면의 `회원가입` 링크로 가입 화면이 열리는지 확인한다.
4. 승인된 QA 계정으로 로그인한다.
5. `프로필 → 알림 설정`에서 Switch를 켜 OS 권한 요청을 확인한다.
6. `docs/LAUNCH_CHECKLIST.md`의 알림 7항목을 별도로 검증한다.

credential이나 token을 APK 또는 문서에 포함하지 않는다. 기본 preview는 `https://www.ipjuhae.com/api`를 사용하므로 비운영 QA에서는 빌드 시 `EXPO_PUBLIC_API_BASE_URL`을 지정해야 한다. 환경변수 값에는 `/api`까지 포함한다.

## 빌드

EAS 원격 무료 할당량 소진으로 로컬 preview 빌드를 사용한다.

```bash
cd mobile
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/Users/down/Library/Android/sdk \
./node_modules/.bin/eas build --platform android --profile preview --local \
  --non-interactive --output /tmp/ipjuhae-dow1186.apk
```

## 검증

- `npm --prefix mobile run typecheck`: 통과.
- `npx vitest run __tests__/mobile/notification-permission-sync.test.ts __tests__/mobile/notification-foreground-resync.test.ts`: 31개 통과.
- 기존 QA endpoint `127.0.0.1:58439`는 연결 실패. Docker daemon에 연결할 수 없고 기존 비공개 QA 계정 파일도 없어 CTO에게 현재 환경 제공을 요청했다.
- APK 실행 검증 결과는 빌드 후 추가한다.

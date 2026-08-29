# 입주해 모바일 출시 가이드

## 현재 상태

- Expo SDK 52 / React Native 0.76, 화면 15개(로그인·가입, 탐색, 매물, 매칭, 메시지/채팅, 프로필, 인증, 설정).
- API: `https://www.ipjuhae.com/api` (Bearer 토큰 + `x-mobile-client: true` — 서버 지원 확인됨).
- 에셋 완비: `assets/` (icon / adaptive-icon / splash / notification-icon / favicon) — 웹 브랜드 아이콘에서 생성, 브랜드 컬러(#f0663f / #fbf6ef) 적용.
- `eas.json` 빌드 프로필: development(내부) / preview(APK 내부배포) / production(자동 버전증가).

## 출시 전 반드시 필요한 계정 작업 (사람이 해야 함)

1. **Expo 계정 + EAS 프로젝트 연결**
   ```bash
   cd mobile
   npx eas login          # Expo 계정
   npx eas init           # app.json의 extra.eas.projectId 자동 채움 (현재 placeholder)
   ```
2. **Apple Developer Program** (연 $99) — iOS 배포용. 가입 후:
   ```bash
   npx eas build --platform ios --profile production   # 인증서 자동 관리
   npx eas submit --platform ios
   ```
3. **Google Play Console** (1회 $25) — 가입 후:
   ```bash
   npx eas build --platform android --profile production   # AAB 생성
   npx eas submit --platform android   # 서비스 계정 키 필요
   ```

## 계정 없이 지금 가능한 배포 경로

- **Android 내부 테스트 APK**: `npx eas build -p android --profile preview` (Expo 무료 계정만 필요) → 링크 공유로 설치.
- **Expo Go 데모**: `npx expo start` → QR 스캔 (스토어 없이 시연).
- **웹은 이미 PWA**: www.ipjuhae.com 을 홈 화면에 추가하면 앱처럼 설치됨 (standalone).

## 스토어 등록 시 필요한 자료 체크리스트

- [ ] 스크린샷 (iOS 6.7"/6.5"/5.5", Android 폰/태블릿)
- [ ] 스토어 설명문 (짧은/긴), 키워드
- [ ] 개인정보처리방침 URL: https://www.ipjuhae.com/privacy
- [ ] 앱 심사용 테스트 계정 (이메일+비밀번호)
- [ ] 데이터 수집 공시 (App Privacy / Data Safety): 이메일·전화·프로필·메시지 수집 명시

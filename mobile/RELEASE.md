# 입주해 모바일 출시 가이드

## 현재 상태

- Expo SDK 54 / React Native 0.81.5 (package.json 기준). 로그인 전 첫 화면은 보증금 점검이며, 로그인 후 홈·매물·보증금 점검·커뮤니티·메시지·프로필 및 설정의 계약 전 대화 요청 목록을 제공합니다.
- API: `https://www.ipjuhae.com/api` (Bearer 토큰 + `x-mobile-client: true` — 서버 지원 확인됨).
- 에셋 완비: `assets/` (icon / adaptive-icon / splash / notification-icon / favicon / Play feature graphic) — 웹 브랜드 아이콘에서 생성, 브랜드 컬러(#f0663f / #fbf6ef) 적용.
- `eas.json` 빌드 프로필: development(내부) / preview(APK 내부배포) / production(자동 버전증가).

## 출시 전 반드시 필요한 계정 작업 (사람이 해야 함)

1. **Expo 계정 + EAS 프로젝트 연결**
   ```bash
   cd mobile
   npx eas login          # Expo 계정
   npx eas project:info   # 연결 확인: downlab/ipjuhae (projectId는 app.json에 설정됨)
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
- [x] Google Play feature graphic: `assets/play-feature-graphic.png` (1024x500 PNG)
- [ ] 개인정보처리방침 URL: https://www.ipjuhae.com/privacy
- [ ] 앱 심사용 테스트 계정 (이메일+비밀번호)
- [ ] 데이터 수집 공시 (App Privacy / Data Safety): 이메일·전화·프로필·메시지 수집 명시

## 2026-10-02 제출 전 검토사항

- 이 문서는 제출 초안입니다. EAS/Apple/Google 실제 빌드 권한, 배포 SDK 구성과 최종 바이너리 권한은 미확인입니다. 계정 생성·빌드·제출 명령은 별도 승인 후 실행합니다.
- 기능: 보증금 점검, 매물 목록, 커뮤니티 글·댓글·신고, 메시지, 계약 전 대화(contracttalk) 생성·받은/보낸 목록·응답, 기능 제안/피드백.
- 분석: 계약 전 대화 이벤트는 사용자/세션 ID 없는 집계입니다. 다른 기능의 이벤트·로그까지 모두 익명이라고 제출하면 안 됩니다.
- Expo push token은 user_id와 연결해 저장하며, 알림 설정 및 탈퇴 시 삭제합니다. 피드백 연락처, 프로필/인증자료, 대화 데이터도 공시에 검토해야 합니다.
- 심사 계정은 `<REVIEW_EMAIL>` / `<REVIEW_PASSWORD>`로만 문서화하고 비공개 심사 입력란에서 전달합니다.
- 계정 삭제 외부 URL 초안: https://www.ipjuhae.com/account/delete (이 브랜치 배포 전에는 제공 여부 미확인).
- 개인정보처리방침의 즉시 파기 문구, 공유 자료 삭제 기준, 외부 저장 객체 재시도 안내는 운영자/정책 검토 대상입니다. 법정 보존기간·심사 통과를 확정하지 않습니다.

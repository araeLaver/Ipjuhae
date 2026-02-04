# 렌트미 (RentMe) TODO

## 현재 완성도: ~95%

---

## 🔴 필수 (프로덕션 배포 전)

### 테스트
- [x] Jest/Vitest 설정 및 테스트 프레임워크 구축
- [x] Trust score 계산 로직 단위 테스트
- [x] API 라우트 단위 테스트 (auth, validations, rate-limit)
- [x] Playwright E2E 테스트 설정 (auth, onboarding 흐름)

### 보안
- [x] 로그인/회원가입 API Rate limiting 적용
- [x] CSRF 보호 (SameSite=Lax 쿠키 설정)
- [x] 레퍼런스 토큰 보안 강화 (crypto.randomBytes, 7일 만료, rate limiting)
- [x] 입력값 sanitization 점검 (XSS 방지 - lib/sanitize.ts)

### 인프라
- [x] DB 마이그레이션 실행 전략 수립 (db/migrate.ts + npm run db:migrate)
- [x] 에러 로깅 연동 (Sentry 설정 완료)
- [x] 환경변수 프로덕션 설정 (.env.local.example 업데이트)

---

## 🟡 중요 (실서비스 연동)

### SMS 연동
- [x] 실제 SMS 프로바이더 연동 (NHN Cloud / Twilio)
- [x] lib/sms.ts 모킹 → 실제 발송으로 교체 (SMS_PROVIDER 환경변수)
- [x] 휴대폰 인증 OTP 실제 발송 (sendOTP 함수)
- [x] 레퍼런스 요청 SMS 실제 발송

### 이메일 알림
- [x] 이메일 프로바이더 연동 (Resend / SendGrid)
- [x] 레퍼런스 요청 시 이메일 알림 (sendReferenceRequestEmail)
- [x] 서류 승인/반려 시 이메일 알림 (sendDocumentStatusEmail)
- [x] 회원가입 환영 이메일 (sendWelcomeEmail)

### 파일 업로드
- [x] 인증 서류 실제 파일 저장소 연동 (lib/storage.ts - S3/R2 지원)
- [x] 프로필 이미지 업로드 기능 (uploadProfileImage)
- [ ] 이미지 리사이징/최적화

### 인증 API
- [ ] 재직/소득/신용 인증 실제 API 연동 (Mock → 실서비스)
- [ ] 집주인 본인인증 시스템

---

## 🟢 개선 (UX 고도화)

### 집주인 기능 확장
- [ ] 세입자 즐겨찾기/저장 기능
- [ ] 집주인 ↔ 세입자 메시지 시스템
- [ ] 집주인 프로필 수정 페이지
- [ ] 매물 관리 (주소, 보증금/월세, 사진)
- [ ] 집주인 통계/분석 대시보드

### UX
- [ ] 다크모드 완성 (next-themes 설치됨)
- [ ] 인앱 알림 센터
- [ ] 프로필 이미지 업로드 UI
- [ ] 관리자 페이지 (서류 심사, 유저 관리)
- [ ] 모니터링/성능 추적

### 기타
- [ ] 레퍼런스 만료 자동 처리
- [ ] 레퍼런스 응답 수정 기능
- [ ] 세입자 검색 고도화 (지역, 편의시설 등)
- [ ] 프리미엄 기능 기획

---

## ✅ 완료 (Sprint 1~2)

### Sprint 1
- [x] 프로젝트 초기 설정 (Next.js 14, TypeScript, Tailwind, shadcn)
- [x] DB 스키마 설계 (users, profiles, verifications, references)
- [x] 이메일/비밀번호 인증 (JWT + bcrypt)
- [x] 소셜 로그인 (카카오/네이버/구글 OAuth)
- [x] 3단계 온보딩 (기본정보 → 생활패턴 → 자기소개)
- [x] 프로필 대시보드 (신뢰점수 차트, 인증 배지)
- [x] 인증 시스템 (재직/소득/신용 Mock)
- [x] 레퍼런스 시스템 (요청 → SMS → 설문 → 결과)
- [x] 신뢰점수 동적 계산
- [x] 공개 프로필 공유 (URL 복사 + Web Share API)
- [x] 집주인 대시보드, 세입자 목록/상세
- [x] 랜딩페이지 (Hero, Features, How-it-works, Stats, CTA)
- [x] 반응형 UI + 디자인 시스템

### Sprint 2
- [x] AI 자기소개서 생성 (OpenAI API 연동 + Mock fallback)
- [x] 인증 페이지 서류 업로드 통합 (직접입력/서류제출 탭)
- [x] 미들웨어 인증 강화 (JWT 쿠키 검증 + 리다이렉트)
- [x] 프로필 페이지 계정 상태 표시 (이메일/소셜/휴대폰)
- [x] /api/auth/me 응답 확장 (auth_provider, phone_verified)

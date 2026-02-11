# 렌트미 (RentMe) TODO

## 현재 완성도: ~99% (프로덕션 준비 완료)

---

## 🟢 개선 (선택적 UX 고도화)

### UX
- [x] 다크모드 완성 (next-themes 설치됨)
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

## ✅ 완료

### Sprint 3 (인프라 & 집주인 기능)
- [x] Jest/Vitest 설정 및 테스트 프레임워크 구축
- [x] Trust score 계산 로직 단위 테스트
- [x] API 라우트 단위 테스트 (auth, validations, rate-limit)
- [x] Playwright E2E 테스트 설정
- [x] 로그인/회원가입 API Rate limiting 적용
- [x] CSRF 보호 (SameSite=Lax 쿠키 설정)
- [x] 레퍼런스 토큰 보안 강화 (crypto.randomBytes, 7일 만료)
- [x] 입력값 sanitization (XSS 방지 - lib/sanitize.ts)
- [x] DB 마이그레이션 전략 (db/migrate.ts)
- [x] 에러 로깅 연동 (Sentry)
- [x] 환경변수 프로덕션 설정
- [x] SMS 프로바이더 연동 (NHN Cloud / Twilio)
- [x] 이메일 프로바이더 연동 (Resend / SendGrid)
- [x] 파일 저장소 연동 (S3/R2)
- [x] 이미지 리사이징/최적화 (sharp, WebP)
- [x] 재직/소득/신용 인증 API (CODEF)
- [x] 세입자 즐겨찾기/저장 기능
- [x] 집주인 ↔ 세입자 메시지 시스템
- [x] 집주인 프로필 수정 페이지
- [x] 매물 관리 (CRUD + 이미지 업로드)
- [x] 집주인 통계/분석 대시보드

### Sprint 2 (인증 & 프로필)
- [x] AI 자기소개서 생성 (OpenAI API)
- [x] 인증 페이지 서류 업로드 통합
- [x] 미들웨어 인증 강화
- [x] 프로필 페이지 계정 상태 표시
- [x] /api/auth/me 응답 확장

### Sprint 1 (MVP)
- [x] 프로젝트 초기 설정 (Next.js 14, TypeScript, Tailwind, shadcn)
- [x] DB 스키마 설계 (users, profiles, verifications, references)
- [x] 이메일/비밀번호 인증 (JWT + bcrypt)
- [x] 소셜 로그인 (카카오/네이버/구글 OAuth)
- [x] 3단계 온보딩 (기본정보 → 생활패턴 → 자기소개)
- [x] 프로필 대시보드 (신뢰점수 차트, 인증 배지)
- [x] 인증 시스템 (재직/소득/신용)
- [x] 레퍼런스 시스템 (요청 → SMS → 설문 → 결과)
- [x] 신뢰점수 동적 계산
- [x] 공개 프로필 공유 (URL 복사 + Web Share API)
- [x] 집주인 대시보드, 세입자 목록/상세
- [x] 랜딩페이지 (Hero, Features, How-it-works, Stats, CTA)
- [x] 반응형 UI + 디자인 시스템

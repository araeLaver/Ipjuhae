# 입주해 (Ipjuhae / RentMe) 프로젝트 분석

## 개요

**입주해**는 한국 임대 시장을 위한 **세입자 프로필 및 신뢰도 플랫폼**입니다.
세입자가 자신의 신뢰점수(Trust Score)를 구축하고, 집주인이 신뢰할 수 있는 세입자를 찾을 수 있도록 돕는 양면(two-sided) 마켓플레이스입니다.

- **프로젝트명**: rentme (package.json)
- **현재 완성도**: ~100% (프로덕션 준비 완료)
- **배포 환경**: Koyeb (Docker 기반)

---

## 기술 스택

| 카테고리 | 기술 |
|---------|------|
| **프레임워크** | Next.js 15 (App Router) + TypeScript |
| **스타일링** | Tailwind CSS 3 + class-variance-authority + tailwind-merge |
| **UI 컴포넌트** | Radix UI (AlertDialog, RadioGroup, Select) + Lucide Icons |
| **애니메이션** | Framer Motion |
| **데이터베이스** | PostgreSQL (pg 드라이버 직접 사용) |
| **인증** | JWT (bcryptjs) + 소셜 로그인 (카카오/네이버/구글 OAuth) |
| **파일 저장소** | AWS S3 / Cloudflare R2 (@aws-sdk/client-s3) |
| **이미지 처리** | Sharp (리사이징, WebP 변환) |
| **결제** | Stripe |
| **AI** | OpenAI (자기소개서 자동 생성) |
| **실시간 통신** | Socket.IO (집주인-세입자 메시지) |
| **레이트 리밋** | Upstash Redis + Ratelimit |
| **이메일** | Nodemailer (Resend/SendGrid) |
| **알림** | 토스트: Sonner |
| **테스트** | Vitest + Testing Library + Playwright (E2E) |
| **모니터링** | Sentry (제거 후 경량화), instrumentation.ts |

---

## 아키텍처

### 디렉토리 구조

```
app/                    # Next.js App Router
├── api/                # API Routes (21개 도메인)
│   ├── auth/           # 인증 (로그인, 회원가입, OAuth, me)
│   ├── admin/          # 관리자 기능
│   ├── analytics/      # 분석/통계
│   ├── cron/           # 크론 작업 (레퍼런스 만료 처리)
│   ├── favorites/      # 즐겨찾기
│   ├── landlord/       # 집주인 전용 API
│   ├── listings/       # 매물 관리
│   ├── matches/        # 매칭
│   ├── messages/       # 메시지 시스템
│   ├── notifications/  # 알림
│   ├── profile/        # 프로필 CRUD + 이미지 업로드
│   ├── properties/     # 부동산 관리
│   ├── references/     # 레퍼런스 시스템
│   ├── reviews/        # 리뷰
│   ├── tenant/         # 세입자 전용 API
│   ├── verifications/  # 인증(재직/소득/신용)
│   ├── webhooks/       # 외부 서비스 웹훅
│   └── ...
├── admin/              # 관리자 페이지
├── auth/               # OAuth 콜백
├── landlord/           # 집주인 페이지
├── login/ & signup/    # 인증 페이지
├── listings/           # 매물 목록
├── messages/           # 메시지
├── onboarding/         # 3단계 온보딩
├── profile/            # 프로필 대시보드
├── tenant/             # 세입자 페이지
└── ...

components/             # 재사용 가능한 컴포넌트 (16개 도메인)
├── ui/                 # 공용 UI 컴포넌트
├── auth/               # 인증 관련
├── landing/            # 랜딩페이지
├── landlord/           # 집주인 전용
├── listings/           # 매물
├── messages/           # 메시지
├── notifications/      # 알림 센터
├── onboarding/         # 온보딩 스텝
├── profile/            # 프로필
├── verification/       # 인증 배지
└── ...

lib/                    # 서버 유틸리티 & 비즈니스 로직
├── auth.ts             # JWT 인증 헬퍼
├── db.ts               # PostgreSQL 연결
├── trust-score.ts      # 신뢰점수 계산 로직
├── matching.ts         # 세입자-집주인 매칭
├── openai.ts           # AI 자기소개서 생성
├── stripe.ts           # 결제 연동
├── storage.ts          # S3/R2 파일 업로드
├── email.ts            # 이메일 발송
├── sms.ts              # SMS 발송 (NHN Cloud/Twilio)
├── sanitize.ts         # XSS 방지
├── rate-limit.ts       # 레이트 리밋
├── validations.ts      # 입력값 검증
└── schemas/            # Zod 스키마

db/                     # 데이터베이스
├── schema.sql          # 메인 스키마
├── migrate.ts          # 마이그레이션 실행기
└── migrations/         # SQL 마이그레이션 파일

migrations/             # 추가 마이그레이션 (별도 디렉토리)
```

### 데이터베이스 스키마 (핵심 테이블)

| 테이블 | 설명 |
|-------|------|
| `users` | 사용자 기본 정보 (email, password_hash, user_type: tenant/landlord) |
| `profiles` | 세입자 프로필 (라이프스타일, 자기소개, trust_score) |
| `verifications` | 인증 정보 (재직/소득/신용 인증 상태) |
| `landlord_references` | 집주인 레퍼런스 요청 (토큰 기반, 7일 만료) |
| `reference_responses` | 레퍼런스 설문 응답 (5점 척도 × 4개 항목) |
| `landlord_profiles` | 집주인 프로필 |
| `profile_views` | 프로필 열람 기록 |

---

## 핵심 기능

### 1. 신뢰점수 (Trust Score) 시스템
- 프로필 완성도, 인증(재직/소득/신용), 레퍼런스 응답을 종합하여 동적 계산
- `lib/trust-score.ts`에서 계산 로직 관리

### 2. 레퍼런스 시스템
- 세입자가 이전 집주인에게 레퍼런스를 요청
- SMS/이메일로 고유 토큰 링크 전송
- 집주인이 설문(월세 납부, 시설 관리, 이웃 관계, 퇴실 상태) 응답
- 7일 만료, GitHub Actions cron으로 자동 처리

### 3. 3단계 온보딩
- 기본정보 → 생활패턴 → 자기소개서 (AI 생성 옵션)

### 4. 집주인-세입자 매칭
- 세입자 검색, 즐겨찾기, 실시간 메시지 (Socket.IO)
- 매물 CRUD + 이미지 업로드

### 5. 인증 체계
- 이메일/비밀번호 + 소셜 로그인 (카카오/네이버/구글)
- Edge Runtime 호환 JWT 검증 (Web Crypto API)
- Rate limiting, CSRF 보호, 입력값 sanitization

---

## 보안

- **JWT 인증**: Edge Runtime에서 Web Crypto API 사용
- **Rate Limiting**: Upstash Redis 기반 (로그인/회원가입)
- **CSRF 보호**: SameSite=Lax 쿠키
- **XSS 방지**: `lib/sanitize.ts`
- **토큰 보안**: `crypto.randomBytes` + 7일 만료
- **입력 검증**: Zod 스키마

---

## 배포 & 인프라

- **컨테이너**: Docker + docker-compose (로컬 개발)
- **호스팅**: Koyeb (koyeb.yaml 설정)
- **CI/CD**: GitHub Actions
- **커스텀 서버**: `server.js` (Node.js + Socket.IO)
- **SEO**: OpenGraph, Twitter Card, JSON-LD, sitemap.ts, robots.txt

---

## 미완료 항목 (TODO)

- [ ] 관리자 페이지 UI 고도화 (서류 심사 워크플로우)
- [ ] 모니터링/성능 추적 (Grafana/Datadog)
- [ ] 레퍼런스 응답 수정 기능
- [ ] 세입자 검색 고도화 (지역, 편의시설)
- [ ] 프리미엄 기능 기획

# RentMe 변경 로그

## 2026-01-27 - 신뢰점수, 인증, 레퍼런스, 집주인 기능 구현

### 구현된 기능

#### Phase 1: DB 스키마 확장
- `users` 테이블에 `user_type` 컬럼 추가 (tenant/landlord)
- `verifications` 테이블 생성 (재직/소득/신용 인증)
- `landlord_references` 테이블 생성 (집주인 레퍼런스 요청)
- `reference_responses` 테이블 생성 (레퍼런스 설문 응답)
- `landlord_profiles` 테이블 생성 (집주인 프로필)
- `profile_views` 테이블 생성 (프로필 열람 기록)

#### Phase 2: 신뢰점수 + 인증 시스템
- **동적 신뢰점수 계산** (`lib/trust-score.ts`)
  - 프로필 완성: 20점
  - 재직 인증: 25점
  - 소득 인증: 25점
  - 신용 인증: 10-20점 (등급별)
  - 레퍼런스: +30점(긍정) / -20점(부정)

- **인증 API**
  - `GET /api/verifications` - 인증 상태 조회
  - `POST /api/verifications/employment` - 재직 인증 (Mock)
  - `POST /api/verifications/income` - 소득 인증 (Mock)
  - `POST /api/verifications/credit` - 신용 인증 (Mock)

- **인증 UI**
  - `/profile/verification` - 인증 관리 페이지
  - `VerificationCard` - 인증 항목 카드 컴포넌트
  - `VerificationBadge` - 인증 배지 컴포넌트

#### Phase 3: 집주인 레퍼런스 시스템
- **레퍼런스 API**
  - `GET/POST /api/references` - 레퍼런스 목록/요청 생성
  - `GET/DELETE /api/references/[id]` - 레퍼런스 상세/취소
  - `GET/POST /api/references/verify/[token]` - 설문 토큰 검증/응답 제출

- **레퍼런스 UI**
  - `/profile/reference` - 레퍼런스 관리 페이지
  - `/reference/survey/[token]` - 집주인 설문 페이지 (비로그인)
  - `ReferenceRequestForm` - 레퍼런스 요청 폼
  - `ReferenceStatusCard` - 레퍼런스 상태 카드
  - `ReferenceSurvey` - 5문항 설문 폼

- **SMS Mock** (`lib/sms.ts`)
  - 콘솔 로그로 SMS 발송 시뮬레이션

#### Phase 4: 집주인 화면
- **집주인 API**
  - `GET/POST /api/landlord/profile` - 집주인 프로필 CRUD
  - `GET /api/landlord/tenants` - 세입자 목록 (필터, 페이지네이션)
  - `GET /api/landlord/tenants/[id]` - 세입자 상세 (열람 기록 추가)

- **집주인 UI**
  - `/landlord` - 집주인 대시보드
  - `/landlord/tenants` - 세입자 목록 (필터링)
  - `/landlord/tenants/[id]` - 세입자 상세 (신뢰점수 상세, 레퍼런스)
  - `/landlord/onboarding` - 집주인 온보딩
  - `TenantListItem` - 세입자 목록 아이템
  - `TenantFilter` - 필터 컴포넌트

#### 회원가입 타입 선택
- `/signup` 페이지에 세입자/집주인 선택 UI 추가
- 회원가입 API에서 `user_type` 처리

#### UI 컴포넌트 추가
- `RadioGroup` - 라디오 그룹
- `Select` - 선택 박스
- `AlertDialog` - 알림 다이얼로그
- `Alert` - 알림 컴포넌트

### 수정된 파일
- `db/schema.sql` - 새 테이블 및 컬럼 추가
- `types/database.ts` - 새 타입 추가
- `app/api/profile/route.ts` - 동적 신뢰점수 계산 추가
- `app/api/profile/[id]/route.ts` - 공개 프로필에 인증 정보 추가
- `app/api/auth/signup/route.ts` - user_type 처리
- `app/signup/page.tsx` - 회원 타입 선택 UI
- `app/profile/page.tsx` - 인증/레퍼런스 관리 링크 추가
- `components/profile/profile-card.tsx` - 인증 배지 표시
- `middleware.ts` - 라우트 주석 추가
- `package.json` - radix-ui 패키지 추가

### 새로 생성된 파일
```
lib/trust-score.ts
lib/sms.ts

app/api/verifications/route.ts
app/api/verifications/employment/route.ts
app/api/verifications/income/route.ts
app/api/verifications/credit/route.ts

app/api/references/route.ts
app/api/references/[id]/route.ts
app/api/references/verify/[token]/route.ts

app/api/landlord/profile/route.ts
app/api/landlord/tenants/route.ts
app/api/landlord/tenants/[id]/route.ts

app/profile/verification/page.tsx
app/profile/reference/page.tsx
app/reference/survey/[token]/page.tsx

app/landlord/page.tsx
app/landlord/onboarding/page.tsx
app/landlord/tenants/page.tsx
app/landlord/tenants/[id]/page.tsx

components/verification/verification-badge.tsx
components/verification/verification-card.tsx

components/reference/reference-request-form.tsx
components/reference/reference-status-card.tsx
components/reference/reference-survey.tsx

components/landlord/tenant-list-item.tsx
components/landlord/tenant-filter.tsx

components/ui/radio-group.tsx
components/ui/select.tsx
components/ui/alert-dialog.tsx
components/ui/alert.tsx
```

---

## TODO - 다음 작업

### 필수
1. [ ] DB 스키마 적용 (PostgreSQL에서 schema.sql 실행)
2. [ ] `npm install` 실행하여 새 패키지 설치
3. [ ] 환경 변수 확인 (`NEXT_PUBLIC_BASE_URL` 설정)

### 테스트
1. [ ] 세입자 회원가입 및 인증 테스트
   - `/signup` → 세입자 선택 → `/onboarding/basic`
   - `/profile/verification` → 3개 인증 완료
   - `/profile` → 신뢰점수 변화 확인

2. [ ] 레퍼런스 테스트
   - `/profile/reference` → 레퍼런스 요청 생성
   - `/reference/survey/[token]` → 설문 응답
   - `/profile` → 신뢰점수 변화 확인

3. [ ] 집주인 테스트
   - `/signup` → 집주인 선택 → `/landlord/onboarding`
   - `/landlord/tenants` → 세입자 목록 필터링
   - `/landlord/tenants/[id]` → 세입자 상세 확인

### 추후 개선사항
1. [ ] 실제 SMS API 연동 (NHN Cloud, AWS SNS 등)
2. [ ] 실제 인증 API 연동 (국민건강보험공단, 신용정보원 등)
3. [ ] 이메일 알림 기능 추가
4. [ ] 집주인 프로필 열람 기록 대시보드
5. [ ] 세입자 프로필 검색 기능 고도화 (지역별, 조건별)
6. [ ] 집주인-세입자 간 메시지 기능
7. [ ] 프로필 프리미엄 기능 (상단 노출 등)
8. [ ] AI 자기소개서 기능 구현 (별도 계획)

### 보안 개선
1. [ ] Rate limiting 추가
2. [ ] 레퍼런스 토큰 보안 강화
3. [ ] 집주인 본인 인증 추가

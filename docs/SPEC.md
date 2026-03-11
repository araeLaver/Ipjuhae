# Rentme (임주해) — 기능 상세 스펙

> 작성일: 2026-03-09
> 현재 완성도: ~99% (프로덕션 준비 완료)
> 이 문서는 잔여 기능의 구현 스펙을 우선순위 기준으로 정의합니다.

---

## 우선순위 요약

| 순위 | 기능 | 영향도 | 복잡도 | 기간(예상) |
|------|------|--------|--------|------------|
| P0 | 세입자 검색 고도화 | 핵심 수익 | 중 | 3~4일 |
| P1 | 관리자 페이지 | 운영 필수 | 높음 | 4~5일 |
| P2 | 프리미엄 기능 | 수익화 | 높음 | 5~7일 |
| P3 | 인앱 알림 센터 | UX | 중 | 2~3일 |
| P4 | 레퍼런스 만료 자동 처리 | 안정성 | 낮음 | 1일 |
| P5 | 레퍼런스 응답 수정 | UX 엣지케이스 | 낮음 | 1일 |
| P6 | 프로필 이미지 업로드 UI | UX | 낮음 | 1일 |
| P7 | 모니터링/성능 추적 | 운영 | 중 | 2일 |

---

## P0 — 세입자 검색 고도화

### 목표
집주인이 원하는 조건의 세입자를 빠르게 찾을 수 있도록 필터·정렬·페이지네이션을 강화한다.

### 현재 상태
- 기본 목록(`/landlord/tenants`) 존재
- 필터 없음 / 신뢰점수 단순 정렬만 지원

### 요구사항

#### 필터 조건
| 필터 | 타입 | 옵션 |
|------|------|------|
| 지역 | multiselect | 시/구 (region) |
| 가족 유형 | multiselect | 1인, 커플, 가족 |
| 반려동물 | multiselect | 없음, 강아지, 고양이, 기타 |
| 흡연 여부 | boolean | 비흡연 / 전체 |
| 거주 소음 | multiselect | 조용, 보통, 활발 |
| 거주 기간 | multiselect | 6개월, 1년, 2년, 장기 |
| 신뢰점수 | range | 0~100 (슬라이더) |
| 인증 여부 | checkbox | 재직인증, 소득인증, 신용인증 |
| 레퍼런스 | boolean | 집주인 레퍼런스 있음 |

#### 정렬 조건
- 신뢰점수 높은 순 (기본)
- 최근 가입 순
- 레퍼런스 많은 순
- 인증 배지 많은 순

#### 페이지네이션
- 페이지당 12명 (카드형 그리드)
- cursor-based pagination (무한스크롤 또는 페이지 버튼)

### API

```
GET /api/landlord/tenants
```

**Query Parameters:**
```
region[]        string[]   지역 필터 (다중)
family_type[]   string[]   가족 유형
pets[]          string[]   반려동물
smoking         boolean    흡연 여부
noise_level[]   string[]   소음 수준
duration[]      string[]   거주 기간
trust_min       number     신뢰점수 최솟값 (0~100)
trust_max       number     신뢰점수 최댓값 (0~100)
verified[]      string[]   인증 종류 (employment|income|credit)
has_reference   boolean    레퍼런스 보유 여부
sort            string     trust_desc | created_desc | reference_desc | verified_desc
cursor          string     cursor-based pagination
limit           number     기본 12, 최대 48
```

**Response:**
```typescript
{
  tenants: TenantCard[]
  next_cursor: string | null
  total_count: number  // 필터 기준 총 수
}

interface TenantCard {
  profile_id: string
  name: string               // 이름 마스킹 (홍*동)
  age_range: AgeRange
  family_type: FamilyType
  pets: Pet[]
  smoking: boolean
  stay_time: StayTime
  duration: Duration
  noise_level: NoiseLevel
  trust_score: number
  bio: string
  verified: {
    employment: boolean
    income: boolean
    credit: boolean
  }
  reference_count: number
  profile_image_url: string | null
  created_at: string
}
```

### DB 변경
```sql
-- 프로필에 region 컬럼 추가 (세입자가 원하는 거주 지역)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_regions TEXT[] DEFAULT '{}';

-- 검색 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_family_type ON profiles(family_type) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_smoking ON profiles(smoking) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_duration ON profiles(duration) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_regions ON profiles USING GIN(preferred_regions);
```

### UI 컴포넌트
- `components/landlord/TenantSearchFilters.tsx` — 사이드 필터 패널
- `components/landlord/TenantCard.tsx` — 카드 (이름 마스킹, 배지, 신뢰점수 바)
- `components/landlord/TenantGrid.tsx` — 그리드 + 무한스크롤
- `hooks/useTenantSearch.ts` — 필터 상태 관리 + API 호출 (debounce 300ms)

---

## P1 — 관리자 페이지

### 목표
운영팀이 서류 심사, 유저 관리, 플랫폼 지표를 확인할 수 있는 내부 어드민.

### 접근 제어
- `user_type = 'admin'` 전용 (DB 확장 필요)
- 어드민 전용 미들웨어 `/app/admin/**`
- IP 화이트리스트 옵션 (환경변수 `ADMIN_ALLOWED_IPS`)

### 페이지 구성

#### 1. 대시보드 (`/admin`)
```
- 총 유저 수 (세입자 / 집주인)
- 일간 가입자 (7일 차트)
- 대기중인 서류 심사 수
- 만료 임박 레퍼런스 수
- 신뢰점수 분포 히스토그램
```

#### 2. 유저 관리 (`/admin/users`)
```
검색: 이메일, 이름, 전화번호
필터: user_type, created_at 범위, 상태
액션:
  - 계정 정지 (banned_at 컬럼)
  - 비밀번호 초기화 이메일 발송
  - 유저 상세 보기 (프로필, 인증, 레퍼런스 전체)
```

#### 3. 서류 심사 (`/admin/verifications`)
```
대기중인 서류 목록 (FIFO 순)
각 서류:
  - 업로드된 파일 미리보기 (PDF/이미지)
  - 문서 유형 (재직/소득/신용)
  - 제출자 정보
  - 승인 / 반려 (반려 사유 필수 입력)
자동: 승인/반려 시 이메일 알림 발송
```

#### 4. 레퍼런스 관리 (`/admin/references`)
```
- 전체 레퍼런스 요청 목록
- 상태별 필터 (pending/sent/completed/expired)
- 만료 임박 (3일 이내) 하이라이트
- 수동 만료 처리 버튼
```

#### 5. 매물 관리 (`/admin/properties`)
```
- 전체 매물 목록
- 신고된 매물 (향후 신고 기능 추가 시)
- 상태 변경 (강제 hidden)
```

### DB 변경
```sql
-- admin role 추가
ALTER TABLE users ALTER COLUMN user_type TYPE VARCHAR(20);
-- 기존 CHECK constraint 제거 후 재설정
-- 허용값: 'tenant' | 'landlord' | 'admin'

-- 계정 정지
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 서류 심사 이력
ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
```

### API
```
GET    /api/admin/stats
GET    /api/admin/users?q=&type=&page=
POST   /api/admin/users/:id/ban
POST   /api/admin/users/:id/unban
GET    /api/admin/verifications?status=pending
PATCH  /api/admin/verifications/:id   { action: 'approve' | 'reject', reason?: string }
GET    /api/admin/references?status=
POST   /api/admin/references/:id/expire
GET    /api/admin/properties?status=
PATCH  /api/admin/properties/:id/status
```

---

## P2 — 프리미엄 기능

### 비즈니스 모델
```
Free (세입자):
  - 프로필 1개, 레퍼런스 요청 2건/월
  - 집주인 메시지 수신 3건/월
  - 인증 1종

Premium (세입자) — ₩9,900/월:
  - 무제한 레퍼런스 요청
  - 무제한 메시지
  - 인증 3종 전체
  - 프로필 상단 노출 (Boost)
  - 조회 알림 (집주인이 내 프로필 봤을 때)
  - AI 자기소개서 무제한 재생성

Free (집주인):
  - 세입자 검색 월 30건
  - 메시지 발송 5건/월

Premium (집주인) — ₩19,900/월:
  - 무제한 검색
  - 무제한 메시지
  - 세입자 전체 정보 열람 (전화번호, 실명)
  - 매물 상단 노출
  - 세입자 즐겨찾기 무제한
```

### DB 변경
```sql
-- 구독 테이블
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan VARCHAR(20) NOT NULL,  -- 'free' | 'premium_tenant' | 'premium_landlord'
  status VARCHAR(20) DEFAULT 'active',  -- 'active' | 'cancelled' | 'expired'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  payment_key VARCHAR(100),  -- 토스페이먼츠 결제키
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용량 제한 추적
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50),  -- 'message_send' | 'reference_request' | 'profile_view'
  month_key VARCHAR(7),     -- 'YYYY-MM'
  count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action_type, month_key)
);

-- 프로필 Boost
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ;
```

### 결제 연동
- **토스페이먼츠** (한국 표준, 빌링키 방식)
- 환경변수: `TOSS_SECRET_KEY`, `TOSS_CLIENT_KEY`

```typescript
// lib/payments.ts
export async function createBillingKey(authKey: string, customerKey: string)
export async function chargeBillingKey(billingKey: string, amount: number, orderId: string)
export async function cancelPayment(paymentKey: string, reason: string)
```

### API
```
POST   /api/payments/billing-key       빌링키 등록
POST   /api/payments/subscribe         구독 시작 (즉시 결제)
DELETE /api/payments/subscribe         구독 취소
GET    /api/payments/history           결제 이력
GET    /api/subscriptions/me           내 구독 상태
```

### 사용량 제한 미들웨어
```typescript
// lib/rate-limit-subscription.ts
export async function checkUsageLimit(
  userId: string,
  action: 'message_send' | 'reference_request' | 'profile_view'
): Promise<{ allowed: boolean; remaining: number; limit: number }>
```

---

## P3 — 인앱 알림 센터

### 알림 유형
| 이벤트 | 수신자 | 채널 |
|--------|--------|------|
| 레퍼런스 요청 발송 성공 | 세입자 | 인앱 |
| 레퍼런스 응답 완료 | 세입자 | 인앱 + 이메일 |
| 레퍼런스 요청 수신 | 집주인 | SMS (기존) + 인앱 |
| 집주인이 내 프로필 열람 (Premium) | 세입자 | 인앱 |
| 새 메시지 수신 | 세입자/집주인 | 인앱 |
| 서류 심사 결과 | 세입자 | 인앱 + 이메일 |
| 구독 만료 7일 전 | 구독자 | 인앱 + 이메일 |

### DB 변경
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  body TEXT,
  link VARCHAR(200),           -- 클릭 시 이동 경로
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read, created_at DESC);
```

### API
```
GET    /api/notifications          최근 20개 (읽지 않은 수 포함)
PATCH  /api/notifications/:id/read 읽음 처리
PATCH  /api/notifications/read-all 전체 읽음
DELETE /api/notifications/:id      삭제
```

### UI
- 헤더 벨 아이콘 (읽지 않은 수 뱃지)
- Dropdown 패널 (최근 20개, 스크롤)
- 전체 보기 `/notifications` 페이지
- 실시간: Server-Sent Events (`/api/notifications/stream`)

---

## P4 — 레퍼런스 만료 자동 처리

### 요구사항
- `token_expires_at < NOW()` && `status = 'sent'` → `status = 'expired'`
- 주기: 매일 03:00 KST

### 구현

```typescript
// app/api/cron/expire-references/route.ts
// Vercel Cron: "0 18 * * *" (UTC 18시 = KST 03시)
export async function GET(request: Request) {
  // CRON_SECRET 검증
  const updated = await db.query(`
    UPDATE landlord_references
    SET status = 'expired'
    WHERE status = 'sent'
      AND token_expires_at < NOW()
    RETURNING id, user_id
  `)
  // 만료된 건 세입자에게 알림
  return Response.json({ expired: updated.rowCount })
}
```

**vercel.json 추가:**
```json
{
  "crons": [{
    "path": "/api/cron/expire-references",
    "schedule": "0 18 * * *"
  }]
}
```

---

## P5 — 레퍼런스 응답 수정

### 요구사항
- 집주인이 레퍼런스 응답 제출 후 **7일 이내** 수정 가능
- 수정 이력 보존 (audit log)

### DB 변경
```sql
-- 수정 이력
CREATE TABLE IF NOT EXISTS reference_response_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_response_id UUID REFERENCES reference_responses(id),
  previous_data JSONB,      -- 수정 전 전체 스냅샷
  modified_at TIMESTAMPTZ DEFAULT NOW()
);

-- 수정 만료 컬럼
ALTER TABLE reference_responses ADD COLUMN IF NOT EXISTS editable_until TIMESTAMPTZ;
```

### API
```
PATCH  /api/references/respond/:token   기존 응답 수정
  - 7일 초과 시 403
  - 수정 전 데이터 history 테이블에 저장
```

---

## P6 — 프로필 이미지 업로드 UI

### 현재 상태
- S3/R2 연동 완료 (`lib/storage.ts` 존재)
- `profile_image` 컬럼 존재
- **UI만 없는 상태**

### 구현
```typescript
// components/profile/ProfileImageUpload.tsx
- react-dropzone 또는 input[type=file]
- 클라이언트 사이드 crop (react-image-crop)
- 업로드 전 WebP 변환 + 최대 512×512 리사이즈 (브라우저 canvas)
- POST /api/profile/image → S3 presigned URL → 직접 업로드
```

### API
```
POST   /api/profile/image    presigned URL 발급 + profile_image 업데이트
DELETE /api/profile/image    이미지 삭제 + S3 오브젝트 삭제
```

---

## P7 — 모니터링/성능 추적

### 이미 연동된 것
- Sentry (에러 로깅)

### 추가 필요

#### Vercel Analytics
```typescript
// app/layout.tsx에 추가
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
```

#### 커스텀 이벤트 추적
```typescript
// lib/analytics.ts
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    // Vercel Analytics custom events
    va.track(event, properties)
  }
}

// 추적 이벤트 목록
// profile_viewed, reference_requested, message_sent
// verification_uploaded, signup_completed, landlord_searched
```

#### 성능 모니터링 대시보드
- Vercel Dashboard (자동 제공)
- Core Web Vitals 주간 리포트 (Slack webhook)

---

## 구현 순서 (Sprint 4)

```
Week 1:
  Day 1-2: P4 레퍼런스 만료 cron + P5 응답 수정 + P6 이미지 업로드 UI
  Day 3-5: P0 세입자 검색 고도화 (필터 API + UI)

Week 2:
  Day 1-3: P3 인앱 알림 센터 (DB + API + UI)
  Day 4-5: P7 모니터링 세팅

Week 3-4:
  P1 관리자 페이지

Week 5-7:
  P2 프리미엄 + 토스페이먼츠 연동
```

---

*Last updated: 2026-03-09 by DOWN-AI*

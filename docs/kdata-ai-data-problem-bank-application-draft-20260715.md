# K-DATA AI·데이터 문제해결은행 제출 패키지 초안

작성일: 2026-07-15
대상 사업: 2026년 AI·데이터 문제해결은행 맞춤 지원
용도: 보드 검토 및 신청서 작성 전 내부 초안

## 결론

조건부 Go다.

Rentme는 임대인과 세입자가 서로 확인 가능한 정보 범위를 동의 기반으로 관리하고, 리포트 형태로 신뢰 신호를 설명하는 제품이다. K-DATA 사업의 데이터·AI 활용 진단, 문제 정의, 데이터 목표 설정, 분석·활용 컨설팅과 잘 맞는다.

다만 실제 접수는 보드 확인값이 없으면 진행하지 않는다. 특히 신청 주체, 공개 연락처, 기업/예비창업자 계정, 첨부자료 범위, 개인정보 없는 화면 캡처 위치가 확정되어야 한다.

## 공식 모집 요약

- 모집명: 2026년 AI·데이터 문제해결은행 맞춤 지원
- 주무부처/전담기관: 과학기술정보통신부 / 한국데이터산업진흥원
- 운영기관: 한국능률협회컨설팅(KMAC)
- 모집기간: 2026-07-03 ~ 2026-07-21
- 사업기간: 2026년 8월 ~ 11월, 약 4개월
- 지원대상: 데이터·AI 활용이 필요한 중소기업, 소상공인, 예비창업자
- 지원규모: 총 367개사 내외
- 주요 지원:
  - 데이터·AI 활용 역량진단 및 개선방안 제시
  - 수준별 맞춤형 교육
  - 전문가의 데이터 활용 컨설팅 또는 AI PoC 과제 설계·수행
  - 기업별 종합 결과보고서 제공
- 신청 방식: K-DATA AI·데이터 문제해결은행 홈페이지에서 기업회원 또는 예비창업자 계정 로그인 후 `AX전문가 지원 > 맞춤 지원` 신청서 작성

## 신청 문제정의 초안

### 문제명

Rentme 임대 신뢰 리포트의 설명 가능성과 고객개발 전환 지표 설계

### 한 줄 요약

Rentme가 수집하는 프로필, 확인 항목, 레퍼런스, 동의·열람 로그를 개인정보 없는 schema와 synthetic event 기준으로 정리해 리포트 설명 가능성, 고객개발 funnel, 운영 지표를 점검한다.

### 현재 문제

Rentme는 세입자와 임대인의 확인 항목을 바탕으로 리포트를 만들고, 동의된 필드만 열람하도록 설계되어 있다. 하지만 출시 전 단계에서는 다음 세 가지가 아직 충분히 구조화되어 있지 않다.

- 어떤 데이터 항목이 리포트 설명에 실제로 기여하는지
- 고객개발 과정에서 어떤 event가 가입, 프로필 완성, 확인 항목 제출, 레퍼런스 완료, 리포트 열람으로 이어지는지
- 개인정보 없이도 전문가에게 문제를 설명할 수 있는 sample schema와 지표 정의가 충분한지

### 지원을 통해 받고 싶은 도움

- Rentme 데이터 항목을 제품 의사결정용 schema로 정리
- 리포트 설명 가능성을 높이기 위한 입력 항목, 산출 항목, 상태 플래그 검토
- 고객개발 funnel 및 retention event 설계
- 개인정보 없는 synthetic dataset 또는 mock event list 기반의 분석 실습
- 사업 초기 팀이 지속적으로 사용할 수 있는 데이터 점검 템플릿 확보

## Rentme 데이터 항목 요약

실제 제출에는 원본 개인정보, 실제 사용자 데이터, 원본 증빙 파일, secret, 내부 DB 접속정보를 포함하지 않는다.

### 프로필/생활 정보

근거 파일: `types/database.ts`, `docs/SPEC.md`

- `age_range`: 연령대
- `family_type`: 가구 유형
- `pets`: 반려동물 여부 또는 종류
- `smoking`: 흡연 여부
- `stay_time`: 주요 거주 시간대
- `duration`: 예상 거주 기간
- `noise_level`: 생활 소음 성향
- `bio`, `intro`: 자기소개 또는 설명 문구
- `preferred_regions`: 선호 지역
- `is_complete`: 프로필 완성 여부

### 확인 항목

근거 파일: `types/database.ts`, `components/verification/verification-card.tsx`

- `employment_verified`: 재직 관련 확인 여부
- `income_verified`: 소득 관련 확인 여부
- `verification_status_flags`: 제출자가 제공한 확인 항목 상태
- `verification_documents.status`: 문서 처리 상태
- 제출 제외: 원본 파일명, 원본 파일 URL, 실제 회사명, 실제 소득 구간, 원본 문서 이미지

### 레퍼런스/검토 항목

근거 파일: `types/database.ts`, `lib/report-aggregate.ts`

- `landlord_references.status`: 요청, 발송, 완료, 만료 상태
- `reference_responses.would_recommend`: 추천 여부
- `reference_responses.overall_rating`: 종합 응답
- `reference_response_items.item_code`: 항목 코드
- `reference_disputes.request_status`: 정정/이의 검토 상태
- 제출 제외: 추천인 이름, 전화번호, 이메일, 자유서술 원문, token

### 동의/열람/운영 로그

근거 파일: `types/database.ts`, `lib/consent-access.ts`

- `consents.allowed_fields`: 열람 허용 필드
- `consents.allowed_purposes`: 열람 목적
- `consents.can_view_contact`: 연락처 열람 허용 여부
- `access_logs.target_type`: 열람 대상
- `access_logs.allowed_fields`: 실제 허용된 필드
- `access_logs.result`: 허용 또는 거절 결과
- 제출 제외: IP, user-agent 원문, 실제 사용자 식별자, 실제 연락처

### 리포트 산출 항목

근거 파일: `lib/report-aggregate.ts`

- `report.summary`: 리포트 요약
- `report.status_flags`: 검토 중, 추가 확인 필요, 최신 확인 필요 등 상태
- `report.explanation_factors`: 확인 항목별 설명 요소
- `report.readiness_notes`: 추가 확인 또는 최신화가 필요한 항목
- `verification.summary`: 확인 항목 요약
- `reference.summary`: 완료된 레퍼런스 수와 추천 응답 수
- `validation.values`: 검증 항목 상태

## Synthetic event list 초안

K-DATA 제출 또는 상담에는 아래처럼 개인정보 없는 event만 사용한다.

| Event | 목적 | 주요 속성 |
| --- | --- | --- |
| `tenant_signup_started` | 가입 시작 측정 | `channel`, `device`, `created_at` |
| `tenant_profile_completed` | 프로필 완성 측정 | `age_range`, `family_type`, `preferred_region_count` |
| `verification_submitted` | 확인 항목 제출 측정 | `document_type`, `status`, `submitted_at` |
| `reference_requested` | 레퍼런스 요청 흐름 측정 | `reference_channel`, `consent_scope_count` |
| `reference_completed` | 레퍼런스 완료 측정 | `item_count`, `has_dispute` |
| `report_view_requested` | 리포트 열람 요청 측정 | `viewer_role`, `purpose`, `requested_field_count` |
| `report_view_granted` | 동의 기반 열람 성공 측정 | `allowed_field_count`, `contract_stage` |
| `report_view_denied` | 거절 원인 측정 | `denial_reason`, `requested_field_count` |
| `landlord_tenant_filter_used` | 임대인 검색 지표 측정 | `filter_type_count`, `sort`, `result_count_bucket` |

## 개인정보 없는 화면 캡처 후보

보드가 demo URL 또는 캡처 범위를 승인할 때만 준비한다.

- `/profile/verification`: 원본 문서가 아닌 mock 상태만 보이는 확인 항목 화면
- `/profile/reference`: mock 레퍼런스 요청/상태 화면
- `/profile`: 마스킹된 mock 프로필과 확인 항목 요약만 보이는 화면
- 제출용 sample schema 표: 실제 API route 또는 endpoint 이름 없이 개인정보 없는 필드 subset만 설명

후속 검토 전 제외 또는 보류:

- `/landlord/tenants`, `/landlord/tenants/[id]`: 세입자 목록·상세 맥락은 CTO 제출 제외 기준과 충돌할 수 있으므로 sanitized seed/demo mode 확인 전까지 제출 캡처 후보에서 제외
- 실제 API route 또는 내부 endpoint 이름: 공개 제출 문안에는 포함하지 않고 sample schema/table 수준으로 대체

캡처 제외:

- 실제 이메일, 전화번호, 실명, 주소
- 원본 증빙 이미지
- 실제 추천인 정보
- 내부 token, API key, DB 연결 정보
- 실제 운영 로그의 IP 또는 user-agent

## CTO 기술 검토: mock 캡처·데이터 경계

작성일: 2026-07-16
검토 범위: `/profile`, `/profile/verification`, `/profile/reference`, `/landlord/tenants`, `/landlord/tenants/[id]`, 리포트 sample schema

### 제출 가능 mock 캡처 후보

아래 후보는 운영 DB, 실제 사용자 계정, storage 원본 URL, access log 원문을 사용하지 않는 별도 mock seed 또는 캡처 전용 fixture로만 준비한다.

| 후보 | 제출 적합도 | 포함 가능 항목 | 조건 |
| --- | --- | --- | --- |
| `/profile/verification` | 높음 | 확인 항목 반영 현황, 재직/소득 등 제출자가 제공한 확인 상태 | 업로드 탭은 파일명 없는 empty 또는 승인 상태 fixture만 사용하고 점수·등급 UI는 제외 |
| 제출용 sample schema 표 | 높음 | `report.summary`, `report.status_flags`, `report.explanation_factors`, `verification.summary`, `reference.summary`, `validation.values` | 실제 API route 이름과 endpoint 호출 결과를 쓰지 않고 개인정보 없는 field subset만 설명 |
| `/profile` | 중간 | 마스킹된 mock 프로필, lifestyle badge, 확인 항목 배지 | `profile.name`, `profile.intro`, profile image가 노출되므로 mock 전용 계정 또는 fixture만 사용 |
| `/profile/reference` | 낮음 | 완료/대기 count, 레퍼런스 상태 카드 구조 | 현재 form과 card가 집주인 이름, 전화번호, 이메일 placeholder/값을 직접 보여주므로 제출 캡처에서는 원칙적으로 제외 |
| `/landlord/tenants` | 보류 | 필터, 결과 수 bucket, 확인 항목 배지 | CTO 제출 제외 기준과 충돌할 수 있어 sanitized seed/demo mode 확인 전까지 제출 후보에서 제외 |
| `/landlord/tenants/[id]` | 보류 | 프로필 요약 상세, 레퍼런스 count/rating UI | 세입자 상세 맥락과 자유서술 노출 위험이 있어 sanitized seed/demo mode 확인 전까지 제출 후보에서 제외 |

### 제외해야 할 필드와 이유

| 영역 | 제외 필드/표현 | 이유 | 대체 표현 |
| --- | --- | --- | --- |
| 프로필 | `profile.name`, `users.email`, `phone`, 실제 주소, profile image URL | 직접 식별자 또는 외부 storage 추적 가능성 | `김*현`, `tenant_001`, avatar placeholder |
| 자기소개/메모 | `bio`, `intro`, 레퍼런스 `comment` 원문 | 자유서술에는 실명, 직장명, 주소, 상황 정보가 섞일 수 있음 | 짧은 synthetic 문장 또는 항목 count |
| 확인 항목 상세 | `employment_company`, 실제 `income_range`, 원본 문서명, 업로드 파일명, `storage_path`, `file_url` | 직장/소득/문서 원본은 민감도 높음 | `재직 관련 확인 완료`, `소득 관련 확인 완료`, `status=approved` |
| 레퍼런스 요청 | `landlord_name`, `landlord_phone`, `landlord_email`, `verification_token`, 설문 URL | 추천인 직접 식별자와 접근 token | `reference_channel=manual`, `status=completed`, `completedCount=2` |
| 리포트 sample schema | `profile.contact`, `verification.detail`, `reference.detail.id`, `reference.disputes.id`, `accessLogId`, 실제 API route 이름 | 식별자·상세값·로그 추적값 또는 내부 구현 경로가 남음 | summary/count/status/explanation_factors만 포함 |
| 운영 로그 | IP, user-agent, raw access log, 실제 `user_id`, 실제 `access_logs.id` | 개인정보 또는 재식별 가능 로그 | synthetic event id, 날짜 bucket, result aggregate |

### Sample schema 경계

제출용 예시는 실제 endpoint 호출 결과를 그대로 붙이지 않는다. 공개 문안에는 route 이름, 내부 함수명, 점수·등급처럼 보이는 산식을 쓰지 않고 아래처럼 개인정보 없는 field subset과 synthetic id만 사용한다.

```json
{
  "allowedFields": [
    "report.summary",
    "report.status_flags",
    "report.explanation_factors",
    "report.readiness_notes",
    "verification.summary",
    "reference.summary",
    "validation.values"
  ],
  "report": {
    "report": {
      "type": "landlord_trust",
      "generatedAt": "2026-07-16T00:00:00.000Z",
      "summary": "확인 항목 기반 신뢰 리포트"
    },
    "statusFlags": [],
    "explanationFactors": [
      "프로필 완성 여부",
      "재직 관련 확인 상태",
      "소득 관련 확인 상태",
      "레퍼런스 완료 여부",
      "동의된 열람 범위"
    ],
    "readinessNotes": [
      "추가 확인 필요 항목 없음"
    ],
    "verification": {
      "summary": {
        "employment": "확인 항목",
        "income": "확인 항목",
        "additional": "확인 항목"
      }
    },
    "reference": {
      "summary": {
        "completedCount": 2,
        "recommendCount": 2
      }
    },
    "validation": {
      "values": [
        {
          "key": "identity_status",
          "status": "확인 항목",
          "flag": "valid"
        }
      ]
    }
  }
}
```

### 보드 승인 후 1일 안에 만들 최소 작업 목록

1. 캡처 전용 mock seed를 만든다: tenant 2명, landlord 1명, verification 상태 3종, completed reference 2건, pending reference 1건, validation value 1건.
2. 캡처 전 fixture에는 실제 이메일/전화번호/실명 대신 `tenant_001`, `김*현`, `010-0000-0000`, `masked@example.invalid` 같은 synthetic 값만 넣는다.
3. `/profile/verification`을 1차 캡처 대상으로 잡고, `/profile`은 name/image/intro/comment 숨김 확인 뒤 보조 캡처로 사용한다.
4. `/profile/reference`는 제출 캡처에서 제외하거나, 입력 form과 연락처가 보이지 않는 별도 상태-only mock 화면을 만든다.
5. `/landlord/tenants`와 `/landlord/tenants/[id]`는 sanitized seed/demo mode와 QA 확인 전까지 제출 캡처에서 제외한다.
6. 리포트 예시는 실제 API 호출이 아니라 위 JSON처럼 `profile.contact`, `verification.detail`, `reference.detail`, `accessLogId`를 제거한 synthetic sample schema로 첨부한다.
7. QA는 캡처 전 마지막으로 화면 내 `@`, `010`, `http`, `token`, `.jpg`, `.png`, 실제 이름 패턴이 없는지 확인한다.

### 후속 작업 권장

- 입주해 구현: mock seed 또는 캡처 전용 fixture script 추가.
- QA: 제출 캡처 2~4장과 sample schema JSON에 개인정보·storage URL·token이 없는지 검수.
- 보드: 신청 주체, 공개 연락처, demo URL 제공 여부 승인 전까지 외부 제출 금지.

## 신청서 문장 초안

### 기업/서비스 소개

Rentme는 임대인과 세입자가 서로 필요한 확인 항목을 동의 기반으로 공유하고, 개인정보 노출을 최소화한 리포트로 임대 과정의 정보 비대칭을 줄이는 PropTech 서비스입니다. 현재 출시 전 단계에서 프로필, 확인 항목, 레퍼런스, 동의·열람 로그를 제품 지표로 정리하고 있습니다.

### 데이터 활용 현황

현재 Rentme는 프로필 완성 여부, 확인 항목 상태, 레퍼런스 완료 여부, 동의된 필드, 리포트 열람 결과를 내부 schema로 관리합니다. 실제 사용자 데이터가 아닌 mock 데이터와 synthetic event를 사용해 리포트 설명 가능성, 고객개발 funnel, 운영 데이터 구조를 점검하고자 합니다.

### 해결하고 싶은 문제

초기 제품에서는 어떤 항목이 리포트 설명에 기여하는지, 어떤 event가 고객 전환을 설명하는지, 어떤 필드는 민감도가 높아 제출·분석에서 제외해야 하는지를 명확히 구분해야 합니다. K-DATA 맞춤 지원을 통해 데이터 목표와 분석 단위를 정리하고, 개인정보 없는 샘플 데이터 기반으로 실행 가능한 지표 설계를 받고 싶습니다.

### 기대 결과

- 리포트 입력 항목과 산출 항목의 연결 구조 정리
- 고객개발 funnel 지표 정의
- synthetic event list와 mock dataset 설계
- 개인정보 제외 기준 문서화
- 향후 제품 실험과 운영 리포트에 사용할 데이터 점검 템플릿 확보

## 보드 확인값 체크리스트

2026-07-21 18:00 전 제출하려면 아래 확인값이 필요하다.

- 신청 주체: 법인, 개인사업자, 예비창업자 중 무엇으로 신청할지
- 신청 계정: K-DATA AI·데이터 문제해결은행 기업회원 또는 예비창업자 계정 사용 가능 여부
- 공식 발신자명: 신청서에 쓸 담당자/대표자명
- 공개 연락처: 이메일, 전화번호 공개 가능 범위
- 사업자 정보: 사업자등록번호 또는 예비창업자 정보 입력 가능 여부
- 기업 소재지: 신청서에 넣을 주소 또는 활동 지역
- 첨부자료 범위: `docs/support-opportunities-20260717.md`, `docs/support-priority-decision-20260716.md`, 본 문서, 개인정보 없는 mock 화면 캡처 허용 여부
- demo URL: 공개 demo URL을 제공할지, 캡처만 제출할지
- 제품 표현 승인: "동의 기반 임대 신뢰 리포트", "개인정보 최소화", "확인 항목 기반 설명" 표현 사용 가능 여부
- 제출 권한: 로그인, 신청서 작성, 최종 제출을 누가 수행할지

## No-Go 또는 보류 조건

- 보드가 신청 주체와 공개 연락처를 확정하지 못한다.
- K-DATA 신청 계정 로그인이 준비되지 않는다.
- 실제 사용자 개인정보 또는 원본 증빙 제출이 필요하고, mock 자료로 대체할 수 없다.
- 신청서가 Rentme를 인허가 또는 법적 책임 범위가 다른 서비스로 오해하게 만드는 방향을 요구한다.
- 2026-07-19까지 보드 확인값이 없고, 2026-07-21 18:00 전 검토 시간을 확보할 수 없다.

## 권장 일정

- 2026-07-15: 내부 초안 완료
- 2026-07-16: 보드 확인값 수령
- 2026-07-17: 신청서 문안 1차 정리 및 mock 캡처 범위 확정
- 2026-07-18 ~ 2026-07-19: 최종 검토
- 2026-07-20: 접수 준비 완료
- 2026-07-21 18:00: 모집 마감

## 출처

- K-DATA 공식 사이트: `https://www.kdata.or.kr/`
- AI·데이터 문제해결은행: `https://www.kdata.or.kr/datahub/`
- 맞춤 지원 신청 경로: `https://www.kdata.or.kr/datahub/portal/business/business-apply`
- 2026-07-17 발굴 메모: `docs/support-opportunities-20260717.md`
- 2026-07-16 제출 우선순위 결정표: `docs/support-priority-decision-20260716.md`
- 제품 스펙: `docs/SPEC.md`
- 데이터 타입: `types/database.ts`
- 리포트 집계 로직: `lib/report-aggregate.ts`
- 동의 기반 접근 로직: `lib/consent-access.ts`

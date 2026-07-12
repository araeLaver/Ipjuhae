# 입주해 Trust Platform 구현 작업기록

- 작업일: 2026-07-12
- 대상 저장소: `Ipjuhae/rentme`
- 대상 출원: 10-2026-0126389
- 작업 목적: 출원 문서의 A1~A4 및 F-01~F-16 처리 구조를 플랫폼 코드, DB, API, UI와 운영 자동화에 연결

## 1. 완료 요약

출원 문서에 제시된 근거 의존 그래프, 거래단계 최소공개, 계약증명 양방향 신뢰 그래프, 정정·이의제기 연쇄 전파를 `trust_*` 원장 계층으로 구현했다. 기존 프로필·인증·레퍼런스 기능은 제거하지 않고 신규 원장과 연결되는 호환 계층으로 유지했다.

주요 완료 항목은 다음과 같다.

- 증빙→사실→점수·추천·공개 객체의 방향성 의존관계
- 근거 만료·정정·충돌 시 영향 객체만 정지하고 선택 재계산
- 거래단계, 수신자, 목적, 동의에 따른 최소 claim 공개
- 공개 패키지 HMAC 무결성 보호, 만료 및 회수
- 계약 완료 증명 기반 양방향 비공개 레퍼런스
- 공모위험 탐지와 신뢰 edge 격리
- 사용자 정정 요청, 관리자 채택·부분채택·기각
- 증빙 추출 작업, 출처 레지스트리, 외부 검증요청 경계
- Outbox, 전달 영수증, 보관·파기 작업 큐
- 사용자 Trust Center와 관리자 Trust Engine·Trust Operations
- 특허 청구요소-구현 증빙 매트릭스와 SHA-256 manifest

## 2. 데이터베이스 변경

### Migration 021

- 데이터 동의와 동의 이벤트
- 개인정보 열람 감사로그
- 레퍼런스 수정이력과 이의제기

### Migration 022

- 레퍼런스 이의제기 상태 확장
- `corrected`, `withheld`, `deleted` 상태 추가

### Migration 023

- API 멱등성 저장소
- 레퍼런스 토큰 접근횟수·차단시간·검증 메타데이터
- 레퍼런스 응답 중복 방지 인덱스

### Migration 024

- 근거, 사실, 파생결과 및 의존 edge
- 점수모델, 점수실행, 점수 구성요소
- 거래 맥락, 공개정책, 공개 패키지
- 거래관계, 양방향 참조, 신뢰 그래프, 위험신호
- 정정심사, 조건추천, 계약결과, Outbox, 감사 이벤트

### Migration 025

- 문서 추출 작업과 추출 필드
- 보관·파기 작업, 전달 영수증, 외부 검증요청
- 동의 철회 시 공개 패키지 자동 회수 trigger

### Migration 026

- 기존·신규 데이터의 `evidence → fact → derived` 연결 보장
- 증빙 만료·충돌·보류 시 관련 사실 STALE/HELD 전환

### Migration 027

- 임차인 점수모델을 실제 승인 인증 사실명과 정렬

모든 migration 021~027은 연결된 PostgreSQL `ipjuhae` 스키마에 적용했다.

## 3. API·엔진 구현

### 공통 엔진

- `lib/trust-engine.ts`: 증빙, 점수, 공개, cascade, 거래, 신뢰 그래프, 정정, 추출, 유지보수
- `lib/trust-policy.ts`: 거래 상태전이와 비용·지연·신뢰도·개인정보 위험 기반 검증경로 추천
- `lib/trust-outbox.ts`: Outbox claim, 알림 전달, 실패 재시도, 전달 영수증
- `lib/idempotency.ts`: 요청 해시, 동일 키·다른 본문 거부, 응답 재사용
- `lib/api-response.ts`: request/trace ID가 포함된 일관된 API 응답

### 신규 API 영역

- 증빙·추출: `/api/v1/evidence`, `/api/v1/documents/extractions`
- 점수: `/api/v1/scores/{subjectType}/{subjectId}`
- 공개: `/api/v1/disclosures/decide`, `/api/v1/disclosures/{id}`
- 거래: `/api/v1/transactions`, `/api/v1/transactions/{id}`
- 계약 결과·양방향 참조: `/outcomes`, `/references`
- 추천: `/api/v1/recommendations/{transactionId}`
- 정정: `/api/v1/trust/change-events`
- 관리자: trust reviews, extractions, sources, overview
- 외부 검증: verification-path recommendation, external requests
- 운영: trust maintenance, trust outbox cron

## 4. 레퍼런스·보안 강화

- 토큰별 15분 접근 구간과 20회 제한
- 과도한 접근 시 15분 차단 및 `Retry-After`
- request ID, trace ID, IP, 작업유형, User-Agent 감사 메타데이터
- 설문 제출·수정 `Idempotency-Key`
- 동일 레퍼런스 응답의 경쟁 조건 방지
- 응답 후 7일 수정과 수정이력 저장
- 이의제기 상태와 공개 보류 흐름

## 5. UI 구현

### 사용자

- `/trust-center`: 점수, 사실, 신뢰 그래프, 공개 패키지, 정정, 감사기록
- 프로필·레퍼런스 화면에 동의·이의제기·수정 상태 연결

### 관리자

- `/admin/trust`: Trust Engine 요약
- `/admin/trust/operations`: 운영 관제 화면
- 정정 승인·부분채택·기각
- 문서 추출 필드 검수
- 검증 출처 등록
- Outbox, 공모위험, 공개, 보관조치 현황

## 6. 운영 자동화

- `vercel.json` cron 등록
- Outbox: 5분 주기
- Trust maintenance: 매일 03:00 KST
- 레거시 레퍼런스 만료: 매일 03:15 KST
- 기존 승인 인증값 이관 스크립트
- DB 구조·정책·trigger 스모크 스크립트
- 로컬 `DISCLOSURE_SIGNING_KEY`, `CRON_SECRET` 생성

## 7. 특허 구현 증빙

- `docs/patent/IMPLEMENTATION_EVIDENCE_MATRIX_20260712.md`
- `docs/patent/API_EVENT_STATE_EVIDENCE_20260712.md`
- `docs/patent/evidence-manifest.json`
- 21개 핵심 구현 파일의 SHA-256과 파일크기 기록
- `npm run patent:evidence`로 manifest 재생성 가능

## 8. 검증 결과

| 검증 | 결과 |
|---|---|
| PostgreSQL migration | 021~027 적용 완료 |
| Trust DB smoke | 핵심 테이블 16개, 모델 3개, 정책 4개, trigger 3개 통과 |
| 기존 데이터 이관 | 실행 성공, 대상 데이터 0건 |
| Vitest | 23개 파일, 289개 테스트 통과 |
| Next.js build | 성공 |
| 정적 페이지 | 132개 생성 |
| Trust Operations route | 빌드 포함 확인 |
| 브라우저 자동검증 | 브라우저 런타임 메타데이터 오류로 미완료 |

빌드 경고는 기존 React Hook dependency와 `<img>` 최적화 항목이며 빌드 차단 오류는 없다. Stripe 키 미설정 안내는 Trust Platform과 별개의 결제 설정 항목이다.

## 9. 남은 외부 의존사항

- S3/R2 운영 자격증명과 `STORAGE_PROVIDER=s3`
- OCR, 등기, 건축물, 가격, 보증보험, 본인인증 제공기관 계약·자격증명
- 각 제공기관의 약관·법적 근거·허용필드·보관기간 승인
- Vercel 운영환경의 `CRON_SECRET`, `DISCLOSURE_SIGNING_KEY` 등록
- 실제 관리자 계정과 파일럿 데이터 기반 브라우저 인수 테스트

플랫폼 코드에는 외부 자격증명을 저장하지 않으며, 출처 레지스트리와 동의 기반 외부요청 경계까지만 구현했다.


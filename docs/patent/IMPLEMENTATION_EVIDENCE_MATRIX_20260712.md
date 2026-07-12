# 출원내용-플랫폼 구현 증빙 매트릭스

## 1. A1 근거 의존 그래프 및 연쇄 무효화

| 처리단계 | 구현 증거 | 데이터 증거 | 상태 |
|---|---|---|---|
| S101 증빙·원천 수신 | `lib/trust-engine.ts#createEvidenceFact`, `POST /api/v1/evidence`, `POST /api/v1/documents/extractions` | `trust_source_registry`, `trust_evidence_nodes`, `trust_extraction_jobs` | 구현·운영 완료 |
| S111 정규화 사실 생성 | `createEvidenceFact`, `completeExtractionJob` | `trust_fact_nodes`, `trust_extracted_fields` | 구현·운영 완료 |
| S121 방향성 의존관계 저장 | 점수·공개·추천 생성 시 dependency insert | `trust_dependency_edges` | 구현·운영 완료 |
| S131 변경 이벤트 감지 | `cascadeTrustChange`, `runTrustMaintenance`, 정정심사 API | `trust_change_events` | 구현·운영 완료 |
| S141 역방향 영향 탐색 | `cascadeTrustChange`의 재귀 CTE | `trust_impact_jobs.affected_nodes` | 구현·운영 완료 |
| S151 외부노출 정지·회수 | 파생노드 SUSPENDED, 공개 REVOKED, 추천 HIDDEN | `trust_derived_nodes`, `trust_disclosure_packages` | 구현·운영 완료 |
| S161 영향 노드만 재계산 | 영향 평가 subject만 `calculateTrustScore` 재실행 | `trust_score_runs`, `trust_score_components` | 구현·운영 완료 |
| S171 새 버전·재현 해시·통지 | `supersedes_id`, `reproduction_hash`, Outbox | `trust_derived_nodes`, `trust_outbox_events` | 구현·운영 완료 |

### A1 무결성 보강

- migration 026이 기존·신규 데이터의 `evidence → fact → derived` 연결을 보장한다.
- 증빙 상태가 VALID에서 만료·충돌·정정·보류로 전환되면 관련 사실이 STALE 또는 HELD가 된다.
- 동일 사실값 재등록은 새 버전을 만들지 않으며 값 변경 시 이전 사실을 SUPERSEDED 처리한다.

## 2. A2 거래단계 조건부 최소공개

| 처리단계 | 구현 증거 | 데이터 증거 | 상태 |
|---|---|---|---|
| S201 공개요청 수신 | `POST /api/v1/disclosures/decide` | 공개요청의 recipient, purpose, transaction | 구현 완료 |
| S211 정책·동의 조회 | `createDisclosurePackage` | `trust_disclosure_policies`, `data_consents` | 구현·운영 완료 |
| S221 최소정보 표현 선택 | Boolean, threshold, positive, band 표현 변환 | `claim_rules` JSONB | 구현 완료 |
| S231 유효 사실·근거 digest | ACTIVE/CONFIRMED/REVISED 및 만료 검사 | `claims`, `evidence_digests` | 구현 완료 |
| S241 수신자 귀속·만료·회수 | recipient, transaction, nonce, revocation handle | `trust_disclosure_packages` | 구현·운영 완료 |
| S251 무결성 보호·감사 | HMAC-SHA256, disclosure audit | `signature`, `trust_audit_events` | 구현·운영 완료 |
| S261 단계·동의·근거 변경 회수 | 거래 PATCH, 동의 DB trigger, A1 cascade | 공개 상태 REVOKED/EXPIRED | 구현·운영 완료 |

### A2 보안 경계

- `DISCLOSURE_SIGNING_KEY` 없이는 공개 패키지를 발급하지 않는다.
- 수신자가 거래 참여자가 아니면 공개 요청을 거절한다.
- 원본값은 공개 패키지에 포함하지 않고 정책상 최소 claim만 저장한다.

## 3. A3 거래증명 기반 양방향 신뢰 그래프

| 처리단계 | 구현 증거 | 데이터 증거 | 상태 |
|---|---|---|---|
| S301 계약 완료 증명 | `POST /api/v1/transactions/{id}/outcomes` | `trust_contract_outcomes.contract_hash` | 구현 완료 |
| S311 검증 거래 edge | `recordContractOutcome` | `trust_tenancy_relationships` | 구현·운영 완료 |
| S321 양측 비공개 참조 | `POST /api/v1/transactions/{id}/references` | `trust_reference_submissions.reveal_state=SEALED` | 구현 완료 |
| S331 동시·기한 공개 | 양측 제출 또는 maintenance deadline | PUBLISHED, revealed_at | 구현·운영 완료 |
| S341 공모 특성 산출 | 시간 burst, 반복 pair, 공유식별자, 극단평가 | `trust_risk_signals` | 구현 완료 |
| S351 edge 격리 | 위험점수 0.7 이상 QUARANTINED | `trust_graph_edges` | 구현 완료 |
| S361 신뢰·확신 분리 | `calculateGraphTrust` | trustValue, confidence, evidenceCount, interval | 구현 완료 |
| S371 분쟁·시간 갱신 | maintenance, correction cascade | edge state, current_weight | 부분 운영 완료 |

### A3 제한사항

- 동일 기기·계좌·연락처 신호는 개인정보·사기탐지 법무정책 확정 후 해시 식별자를 공급해야 한다.
- 외부 계약·전자서명기관의 완료 증명은 `/api/v1/external-requests` 경계를 통해 연결한다.

## 4. A4 정정·이의제기 파생결과 연쇄 전파

| 처리단계 | 구현 증거 | 데이터 증거 | 상태 |
|---|---|---|---|
| S401 이의 요청 | `POST /api/v1/trust/change-events` | `trust_review_tasks` | 구현 완료 |
| S411 원결정 보존·검토표시 | original_snapshot, 사실 DISPUTED, 파생 SUSPENDED | review task, derived state | 구현·운영 완료 |
| S421 파생 객체 탐색 | A1 역의존 CTE 재사용 | impact job | 구현 완료 |
| S431 관리자 채택·기각 | `PATCH /api/v1/admin/trust-reviews` | decision, reviewer, decided_at | 구현 완료 |
| S441 위상순 재계산 | `cascadeTrustChange` | processing_order | 구현 완료 |
| S451 새 버전·교체관계 | 신규 fact/derived와 supersedes 연결 | version chain | 구현 완료 |
| S461 공개 회수·재발급 | 기존 package 회수, 새 요청으로 재발급 | disclosure outbox | 구현 완료 |
| S471 감사 chain·수신증 | trust audit, outbox, delivery receipt | `trust_delivery_receipts` | 구현·운영 완료 |

## 5. F-01~F-16 기능 매핑

| ID | 기능 | 핵심 구현 | 상태 |
|---|---|---|---|
| F-01 | 자료수집 | evidence API, extraction job, external request | 완료 |
| F-02 | 문서분류·필드추출 | extraction queue·field review·관리자 완료 API | 플랫폼 완료, OCR 공급자 외부 의존 |
| F-03 | 데이터 정규화 | normalized_value, digest, 관리자 corrected field | 완료 |
| F-04 | 검증값 변환 | evidence→fact, provenance, confidence | 완료 |
| F-05 | 본인확인 | 기존 인증 + identity fact 수용 | 플랫폼 완료, 인증기관 외부 의존 |
| F-06 | 임차인 신뢰 | tenant-trust-1.0 model | 완료 |
| F-07 | 임대인 신뢰 | landlord-trust-1.0 model | 완료 |
| F-08 | 주택 안전도 | property-safety-1.0 model | 플랫폼 완료, 등기·가격 원천 외부 의존 |
| F-09 | 양방향 레퍼런스 | verified relationship, sealed submission, graph edge | 완료 |
| F-10 | 선택적 공개 | policy decision, signed minimum claims | 완료 |
| F-11 | 열람·감사로그 | access logs, trust audit, receipts | 완료 |
| F-12 | 거래조건 도출 | condition engine, mismatch vector | 완료 |
| F-13 | 매칭·추천 | 기존 match + evidence-bound recommendations | 완료 |
| F-14 | 정정·이의제기 | review task, cascade, admin operations | 완료 |
| F-15 | 피드백 갱신 | contract outcome, graph/reference update | 완료 |
| F-16 | 데이터수집 전환 | source registry, verification path ranking, external request | 플랫폼 완료, 기관 계약 외부 의존 |

## 6. 주요 구현 파일

- `lib/trust-engine.ts`
- `lib/trust-policy.ts`
- `lib/trust-outbox.ts`
- `db/migration-024-patent-trust-engine.sql`
- `db/migration-025-trust-operations.sql`
- `db/migration-026-evidence-fact-cascade.sql`
- `db/migration-027-trust-model-alignment.sql`
- `app/trust-center/page.tsx`
- `app/admin/trust/page.tsx`
- `app/admin/trust/operations/page.tsx`
- `app/api/v1/**/route.ts`


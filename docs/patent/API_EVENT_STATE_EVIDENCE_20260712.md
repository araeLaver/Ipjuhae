# API·이벤트·상태 전이 구현 증빙

## API 카탈로그

| 영역 | API | 인증·통제 |
|---|---|---|
| 증빙 | `POST /api/v1/evidence` | 본인·관리자, Idempotency-Key |
| 추출 | `GET/POST /api/v1/documents/extractions` | 본인 소유 문서 |
| 추출 검수 | `GET /api/v1/admin/trust-extractions`, `PATCH /api/v1/admin/trust-extractions/{id}` | 관리자 |
| 점수 | `GET/POST /api/v1/scores/{subjectType}/{subjectId}` | 본인·관리자 |
| 공개 | `POST /api/v1/disclosures/decide`, `GET/DELETE /api/v1/disclosures/{id}` | 거래 참여자·동의 주체 |
| 거래 | `GET/POST /api/v1/transactions`, `GET/PATCH /api/v1/transactions/{id}` | 거래 참여자 |
| 결과 | `POST /api/v1/transactions/{id}/outcomes` | 거래 참여자 |
| 참조 | `GET/POST /api/v1/transactions/{id}/references` | 검증 관계 당사자 |
| 추천 | `GET/POST /api/v1/recommendations/{transactionId}` | 거래 참여자 |
| 정정 | `POST /api/v1/trust/change-events` | 사실 주체 |
| 정정심사 | `GET/PATCH /api/v1/admin/trust-reviews` | 관리자 |
| 출처 | `GET/POST /api/v1/admin/trust-sources` | 관리자 |
| 검증경로 | `POST /api/v1/verification-paths/recommend` | 로그인 사용자 |
| 외부요청 | `GET/POST /api/v1/external-requests` | 유효 동의 필수 |
| 리포트 | `GET /api/v1/trust/report` | 본인 |

## 핵심 상태 전이

| 객체 | 상태 전이 | 제어 위치 |
|---|---|---|
| Evidence | VALID → EXPIRED/CONFLICT/CORRECTED/HELD | DB trigger, trust maintenance |
| Fact | ACTIVE/CONFIRMED → STALE/DISPUTED/SUPERSEDED | migration 026, correction engine |
| Derived | PUBLISHED → SUSPENDED → SUPERSEDED/REPUBLISHED | cascadeTrustChange |
| Disclosure | ISSUED → REVOKED/EXPIRED/REPLACED | consent trigger, stage update, maintenance |
| Transaction | pre_application → application → negotiation → contract → completed | trust-policy transition guard |
| Reference | SEALED → PUBLISHED/HELD/REVOKED | bilateral submission, maintenance |
| Graph edge | ACTIVE → QUARANTINED/DISPUTED/EXPIRED/REVOKED | collusion risk, dispute, maintenance |
| Review | pending → reviewing → accepted/partially_accepted/rejected → completed | admin trust reviews |

## 이벤트·소비자

| 이벤트 | 발생 위치 | 소비·효과 |
|---|---|---|
| FactCreated | 증빙→사실 변환 | 점수·추천 재계산 후보 |
| ScoreCalculated | 점수 실행 | Trust Center, 사용자 알림 |
| TrustDependencyInvalidated | 근거 상태변경 | 파생결과 정지·선택 재계산 |
| DisclosureDecided | 최소공개 발급 | 감사·수신자 기록 |
| DisclosureRevoked | 동의·단계·근거 변경 | Outbox 알림, 전달 영수증 |
| ContractOutcomeRecorded | 거래 결과 기록 | 관계 edge Gate·피드백 |
| BilateralReferenceSubmitted | 비공개 참조 제출 | 동시공개 조건 검사 |
| BilateralReferenceReleased | 공개기한 도달 | 신뢰 edge 활성화·알림 |
| CorrectionRequested | 정정 신청 | 결과 정지·관리자 대기열 |
| ExternalVerificationRequested | 외부조회 승인 | 공급자 어댑터 처리 경계 |

## 멱등성·추적성

- 변경 API는 `api_idempotency_requests`를 통해 재요청 결과를 재사용한다.
- 동일 키의 다른 본문은 request SHA-256 비교로 거부한다.
- 응답은 `request_id`, `trace_id`와 헤더를 포함한다.
- Trust 이벤트는 Outbox에 먼저 기록되고 전달 성공 후 `published_at`이 설정된다.
- 알림 전달 결과는 `trust_delivery_receipts`에 저장한다.

## 운영 증거

- `vercel.json`: Outbox 5분, trust maintenance 매일 03:00 KST, legacy reference cron 03:15 KST.
- `scripts/trust-platform-smoke.mjs`: 테이블·모델·정책·트리거 검증.
- `db/backfill-trust-ledger.ts`: 기존 승인 인증값을 신규 사실 원장으로 이관.
- `lib/__tests__/trust-policy.test.ts`: 거래 상태전이와 검증경로 정책 테스트.


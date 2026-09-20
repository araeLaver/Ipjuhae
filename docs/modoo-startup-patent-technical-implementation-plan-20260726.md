# Rentme(입주해) 모두의창업 기술출원 반영 실행계획

작성일: 2026-07-26
용도: 모두의창업 사업계획서, 투자유치 자료, 기능개선 백로그의 내부 기준
상태: 내부 실행계획. 외부 제출 전에는 공개통제 기준에 따라 세부 산식, 임계값, 내부 상태명, 원본 데이터, API key, SQL, OCR prompt 전문을 제거한다.

## 1. 결론

모두의창업 기간의 기능개선은 단순 AI 도입이 아니라, 출원된 입주해 핵심 기술을 제품 기능으로 증명하는 방향으로 진행한다.

외부 제출자료에는 `특허 등록`으로 표현하지 않는다. 현재는 출원일을 확보한 상태이며, 정규출원 보강과 청구항 구체화가 필요한 단계로 표현한다. 제품 기능은 아래 5개 기술축으로 고정한다.

| 기술축 | 제품 표현 | 모두의창업 산출물 |
| --- | --- | --- |
| 원본자료 -> 검증값 변환 | 원본 서류를 직접 공개하지 않고 계약 전 확인 항목으로 변환 | OCR/검수 demo, 검증값 표준표 |
| 임차인·임대인·주택 3분리 | 한 점수로 합치지 않고 대상별 확인 리포트 제공 | tenant/landlord/property 샘플 리포트 |
| 동의 기반 선택 공개 | 목적·거래단계·필드 범위에 따라 최소 공개 | 동의 화면, 접근 로그, 제한 열람 mock |
| 정정·이의제기·공개 회수 | 오류·분쟁 발생 시 리포트와 공개 상태 갱신 | 이의제기 접수, 재계산/회수 설계 |
| 거래조건 참고값 | 계약 자동 결정이 아닌 추가서류·안전조치·협의 참고값 제공 | 거래조건 힌트 샘플 |

## 2. 구현 상태 판정 기준

기술자료와 사업계획서가 충돌하지 않도록 모든 기능은 다음 세 단계로만 표기한다.

| 판정 | 의미 | 자료 표현 |
| --- | --- | --- |
| 구현 완료 | 현재 코드와 migration에 직접 근거가 있고 demo가 가능 | `구현된 MVP 기능`, `검증 중` |
| 부분 구현 | DB/API 골격은 있으나 운영 UI, 정책 버전, 회수 체인 등이 부족 | `모두의창업 기간 기능개선 대상` |
| 확장 실시예 | 특허 명세서에는 실시예로 표현 가능하나 현재 구현 완료로 말하면 안 됨 | `후속 고도화`, `법무 검토 후 확장` |

## 3. 출원기술별 제품 반영 매트릭스

| 출원기술 요소 | 현재 근거 | 부족한 점 | 모두의창업 우선 조치 |
| --- | --- | --- | --- |
| 원본/검증값 분리 | `evidence_records`, `validation_values`, 문서 업로드/OCR route, migration 023, admin validation review UI | 운영 DB 적용과 샘플 demo가 남음 | `validation_values` 표준 필드 확장 완료 후 검수 상태 화면 연결 |
| OCR 기반 확인 항목 추출 | `app/api/verifications/documents/route.ts`, `lib/ocr-pipeline.ts` | 문서 유형별 핵심 필드 parser와 운영 검수 큐가 남음 | OCR 결과는 후보값으로 저장하고 사람 검수 후 확정하는 흐름으로 제한 |
| 임차인 신뢰 리포트 | `lib/trust-score.ts`, tenant aggregate route | 점수 산식이 legacy 중심이고 모델 버전/실행이력 부족 | `신뢰점수` 표현을 줄이고 확인 항목·사유코드 중심 리포트로 전환 |
| 임대인 신뢰 리포트 | landlord aggregate route, landlord report 골격 | 권리관계, 보증금 반환, 수리/하자, 종료 경험 모델 부족 | 임대인 검증값 key set과 mock 리포트 작성 |
| 주택 안전 리포트 | `property_safety_scores`, property aggregate route | 공적 장부/가격/보증보험 규칙 미구현 | 주택 안전 확인 항목표와 샘플 리포트, 자동조회는 확장 실시예로 제한 |
| 동의 기반 선택 공개 | `consents`, `access_logs`, `lib/consent-access.ts`, `disclosure_decisions`, `report_bundles`, trust disclosure cron, reference dispute revocation hook | 운영 DB 적용, 철회 UX와 사용자 알림 UX가 남음 | 공개결정과 리포트 번들 스냅샷을 남기고 만료/철회 UX 설계 |
| 항목형 레퍼런스 | `reference_response_items`, verify token flow | 이상 레퍼런스 탐지, 평가권, 거래증명 모델 부족 | 거래증명 기반 평가권과 이상탐지 P1 백로그화 |
| 이의제기/정정 | `reference_disputes`, recalculator 일부, reference dispute 공개 회수 hook | 검증값 정정 영향 범위 계산과 사용자 알림 UX가 남음 | 정정 사건관리, 재계산 job, 회수 이벤트 설계 |
| 거래조건 참고값 | `trade_condition_hints` CRUD | 산출 엔진, 사유코드, 안전조치 규칙 부족 | 자동 확정이 아닌 추가서류/협의 참고값 v1로 제한 |
| 외부자료 공개통제 | 공개/비공개 매트릭스 문서, `docs:public-check` | 제출 직전 원문별 검토는 계속 필요 | 금칙어/민감구성 린트 스크립트와 체크리스트 |

## 4. 기술적으로 부족하지 않게 보강할 P0

1. 검증값 표준화

`validation_values`를 단순 결과 저장소가 아니라 출처 있는 확인 항목으로 확장한다. 최소 필드는 `source_type`, `source_authority`, `issued_at`, `observed_at`, `confidence`, `review_status`, `reason_codes`, `valid_until`, `retention_until`이다.

2. 리포트 번들 스냅샷

현재 aggregate API는 요청 시점 JSON 생성에 가깝다. 외부 공유와 투자자료 증빙에는 `report_bundles` 또는 이에 준하는 스냅샷 개념이 필요하다. 리포트 생성 시 모델 버전, 공개 필드, 동의 id, 접근 로그 id, 생성 시각을 묶어 남긴다.

3. 공개결정/회수 체인

동의 철회, 만료, 이의제기, 검증값 만료가 발생하면 기존 공유 링크와 리포트 번들을 비활성화해야 한다. 이것이 출원자료의 “정정·분쟁 시 리포트와 공개 상태를 함께 갱신”하는 핵심 구현 증거다.

4. 3분리 리포트 완성도

임차인 리포트만 강하면 기술 방어력이 약하다. 임대인 신뢰와 주택 안전은 최소한 mock 데이터라도 별도 리포트 구조, 필드명, 갱신 기준일, 검토 상태를 보여줘야 한다.

5. 공개자료 린트

사업계획서, IR, 멘토링 자료는 기술 세부를 과공개하면 안 된다. 금지 표현은 `세부 산식`, `임계값`, `자동 계약조건 확정`, `신용평가`, `법률 보장`, `전세사기 방지 보장`, `원본 서류 공개`, `무단 스크래핑`이다.

## 5. 2026-07-26 1차 제품 반영 결과

오늘 제품 코드에 반영된 범위는 아래와 같다.

| 구분 | 반영 내용 | 근거 |
| --- | --- | --- |
| 검증값 표준화 | `validation_values`에 출처, 기준일, confidence, 검수상태, 사유코드, 동의 id, 유효기간, 보관만료, 모델버전, 검수자 metadata 필드를 추가 | `db/migration-023-report-bundles-disclosure.sql`, `types/database.ts` |
| OCR 후보값화 | 문서 OCR 결과를 자동 확정값이 아니라 `needs_review` 후보값으로 저장하고, 원본 공개 대신 사람이 검수할 파생값으로 분리 | `app/api/verifications/documents/route.ts` |
| 운영 검수 API | 관리자 권한으로 검증값 후보를 조회하고 승인, 반려, 정정, 만료, 분쟁 상태로 전환 | `app/api/admin/validation-values/route.ts`, `app/api/admin/validation-values/[id]/route.ts` |
| 운영 검수 화면 | 관리자가 후보값 큐를 검색·필터링하고 확인, 정정, 반려, 분쟁, 만료 처리를 수행 | `app/admin/validation-values/page.tsx`, `app/admin/layout.tsx` |
| 공개결정 스냅샷 | 리포트 요청마다 허용/거절 판단, 요청자, 목적, 거래단계, 허용 필드, 정책버전을 `disclosure_decisions`로 기록 | `lib/report-aggregate.ts`, aggregate API routes |
| 리포트 번들 스냅샷 | 허용된 리포트는 공개 당시 JSON과 만료일을 `report_bundles`로 보존 | `lib/report-aggregate.ts`, aggregate API routes |
| 동의 철회 후 회수 | 동의 철회 또는 삭제 시 연결된 리포트 번들을 `revoked`로 바꾸고 공개결정도 회수 상태로 갱신 | `app/api/consents/[id]/route.ts` |
| 만료 자동 회수 | 유효기간이 지난 검증값, 동의, 리포트 번들을 cron에서 만료 처리하고 공개결정을 `expired`로 전환 | `app/api/cron/trust-disclosures/route.ts` |
| 이의제기 공개 회수 | 레퍼런스 이의제기 접수 시 해당 사용자 활성 리포트 번들을 회수하고 공개결정을 갱신 | `app/api/references/[id]/disputes/route.ts` |
| 공개자료 점검 | 외부 제출용 문서의 위험 표현을 CI성 명령으로 점검 | `scripts/check-public-disclosure-terms.mjs`, `npm run docs:public-check` |

검증 결과는 다음과 같다.

- `npm run typecheck`: 통과
- `npm run test:run`: 통과, Vitest `37`개 test file / `340`개 test
- `npm run docs:public-check`: 통과, 공개자료 점검 대상 `2`개 파일
- `npm run build`: 통과, Next.js `15.5.14`, static page `111/111`
- `npm run db:migrate`: 로컬 DB role `ipjuhae` 부재로 미적용. migration 023은 코드에 추가됐지만 운영/로컬 DB 적용 증거는 별도 확보 필요

남은 P0는 운영 DB migration 적용 증거와 실제 샘플 데이터 demo다. 투자자료에는 오늘 반영분을 `구현된 MVP 기능`으로 말할 수 있지만, 운영 DB 적용 전에는 `운영 적용 완료`라고 표현하지 않는다.

## 6. 모두의창업 AI 솔루션과의 연결

AI 솔루션은 출원기술의 주체가 아니라 보조 도구로만 둔다.

| AI 활용 | 기술축 연결 | 안전한 표현 |
| --- | --- | --- |
| Image-to-Text/OCR | 원본자료 -> 검증값 변환 | 사람이 검수할 후보값 추출 |
| 법률 문구 보조 | 공개통제, 동의/고지 문구 | 약관·고지 초안과 위험 표현 대체 |
| 시각자료 생성 | 리포트/동의/기술흐름 설명 | 투자자료와 사업계획서 이해도 개선 |
| 공공데이터 설명 AI | 지역·거래 맥락 설명 | 개인 평가가 아닌 공개 데이터 설명 |

## 7. 외부 제출용 요약 문안

```text
입주해의 기술 고도화는 단순 AI 점수 산정이 아니라, 임대차 거래에서 제출되는 원본 자료를 출처와 검수상태가 있는 확인 항목으로 변환하고, 임차인·임대인·주택을 분리해 리포트화한 뒤, 사용자의 동의 범위와 거래 단계에 따라 최소 항목만 공유하는 구조입니다.

모두의창업 기간에는 현재 구현된 문서 업로드, OCR, 레퍼런스, 동의, 접근로그, 리포트 API를 기반으로 검증값 표준화, 제한 열람 리포트, 이의제기/정정 후 공개 회수, 임대인·주택 리포트 샘플을 고도화합니다. AI는 사람의 계약 판단을 대체하지 않고, 문서 후보값 추출, 정책 문구 초안, 공공데이터 설명, 투자자료 시각화에 한정해 사용합니다.
```

## 8. 참조 기준

- `docs/modoo-startup-feature-improvement-plan-20260723.md`
- `docs/patent-technical-diagrams-202607.md`
- `docs/patent-public-private-matrix-202607.md`
- `docs/01.기율법무법인/분석/기율법무법인_기능반영_전체매트릭스_260723.md`
- `docs/01.기율법무법인/기율법무법인_문서분석_및_추가작성로드맵_260712.md`

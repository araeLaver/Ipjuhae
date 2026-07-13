# 입주해 외부 문서 통합 분석 및 플랫폼 반영표

- 분석일: 2026-07-13
- 기준 출원번호: 10-2026-0126389
- 목적: 기술설명서, 추가발명 보완자료, 도면집, 사업계획서와 활동보고서의 제품 요구를 하나의 구현 기준으로 통합

## 1. 분석한 원문

### 기술·출원 문서군

1. 00_자료_송부서_260712.hwp
2. 01_입주해 플랫폼_기술구성 및 처리절차 설명서_260712.hwp
3. 02_입주해_추가발명사항_및_명세서_보완의견서_260712.hwp
4. 03_입주해_플랫폼_도면집_260712.hwp
5. 도면 01~17 PNG

### 사업계획·활동 문서군

1. 김다운_1R 사업계획서_260712.hwp
2. 김다운_1R 활동보고서_260712.hwp
3. 입주해_사업계획서_v1.2_260713.hwp
4. 입주해_사업계획서_v1.2_260714.hwp
5. 심사도판 D01~D02, F01~F04

260713본과 260714본은 HWP 바이너리 해시는 다르지만 추출 본문상 기준일 표기 한 줄만 다르고 기능 요구는 동일하다. 260714본을 최신 기준으로 사용했다.

## 2. 통합 제품 원칙

| ID | 원칙 | 플랫폼 반영 |
|---|---|---|
| P-01 | 계약 안전이나 사람의 신용을 단정하지 않는다 | 리포트·Trust Card 책임제한 문구와 상태형 표현 |
| P-02 | 임차인, 임대인, 주택을 분리해 확인한다 | 계약 리포트 3축 체크리스트 |
| P-03 | 원문, 추출값, 검수값, 공개값을 분리한다 | trust evidence/fact 계층과 document_intakes, contract_check_items |
| P-04 | 출처, 기준일, 유효기간과 미확인 사유를 표시한다 | 리포트 항목 필드 및 사용자·인쇄 화면 |
| P-05 | 확인되지 않은 값은 추정하지 않는다 | MISSING, REVIEW_REQUIRED, EXPIRED 상태 |
| P-06 | 목적과 수신자에 필요한 최소정보만 공개한다 | Trust Card field_keys, audience_role, purpose, expires_at |
| P-07 | 사용자와 운영자 열람·변경을 감사 가능하게 한다 | access audit, trust_card_access_logs |
| P-08 | 자동화 결과를 사람이 검토하고 수정내역을 남긴다 | ai_processing_runs와 human_review_status |
| P-09 | 계획과 실제 성과를 분리한다 | validation_experiments target_count/actual_count |
| P-10 | 법률·보안 근거가 없으면 자동화와 유료화를 확대하지 않는다 | trust_compliance_gates |

## 3. 기술설명서·추가발명 대응

| 요구 ID | 문서 요구 | 상태 | 구현 근거 |
|---|---|---|---|
| T-01 | 사용자 채널, 접근제어, 서비스, 비동기 처리, 저장부, 외부원천 분리 | 반영 | Next.js Route Handler, 인증/권한, trust extraction/outbox |
| T-02 | 원문 암호화·분리 저장과 사실 객체 분리 | 반영 기반 | trust_evidence_items, trust_source_records, trust_facts |
| T-03 | 출처·관측시점·요청식별자·응답버전 | 반영 | trust evidence/source metadata와 request context |
| T-04 | 임차인 온보딩, 목적별 동의, 문서검증, 수동검수 | 반영 | consent API, extraction jobs, 관리자 검수 |
| T-05 | 임대인·매물 권리 검증과 잠정/검수대기 | 반영 | property verification 및 contract report property axis |
| T-06 | 문서 격리·악성검사 후 OCR | 신규 반영 | document_intakes, scan_status, OCR clean gate |
| T-07 | 중복처리 방지와 재시도·실패보관 | 반영 | idempotency, outbox, extraction attempt/error |
| T-08 | 매칭·협상·계약·거래증명 | 반영 | transaction, recommendation, reference trust graph API |
| T-09 | 허용 상태전이와 사유 기록 | 반영 | trust 상태 제약, 리포트 상태전이 |
| T-10 | 거래단계·역할·동의·근거 유효성 기반 최소공개 | 반영 | disclosure policy와 Trust Card |
| T-11 | 동의철회 시 신규 열람 중지와 공개 회수 | 반영 | consent revocation, disclosure/Trust Card revoke |
| T-12 | 외부기관 장애의 제한 재시도·잠정값·복구 재검증 | 반영 기반 | outbox/maintenance와 external_data_access gate |
| T-13 | 정책·모델 후보 등록, 검증, 승인, 적용, 중지, 복귀 | 반영 | trust policy/model lifecycle |
| T-14 | 근거 의존관계 역방향 탐색과 선택 재계산 | 반영 | trust dependency/cascade engine |
| T-15 | 거래증명 기반 양방향 평가와 이상관계 격리 | 반영 | transaction proof, trust graph, anomaly/quarantine |
| T-16 | 이의제기 중 원결정 동결과 정정 연쇄 전파 | 반영 | dispute/review, freeze, cascade, republish |
| T-17 | 개인정보 삭제와 법정 보존 예외 | 반영 기반 | retention job, consent lifecycle, compliance gate |
| T-18 | 백업·시점복구·복구훈련 | 운영 반영 필요 | 운영문서에 절차가 있으며 실제 인프라 훈련 증빙은 별도 필요 |

## 4. 사업계획서 제품 요구 대응

| 요구 ID | 제품 요구 | 상태 | 구현 근거 |
|---|---|---|---|
| B-01 | 계약 전 확인 리포트 | 신규 반영 | contract_check_reports API와 /trust/reports |
| B-02 | 임차인·임대인·주택 3축 확인상태 | 신규 반영 | contract_check_items 기본 체크리스트 |
| B-03 | 확인됨·확인 필요·미제출·기간경과 구분 | 신규 반영 | verification_status와 상태 UI |
| B-04 | 근거자료·출처·기준일·미확인 사유 | 신규 반영 | report item 필드와 상세화면 |
| B-05 | 추가 제출·확인 행동 안내 | 신규 반영 | next_action |
| B-06 | 운영자 원문 대조와 공개 승인 | 신규 반영 | review_state/reviewer/reviewed_at |
| B-07 | 리포트 인쇄·PDF 저장 | 신규 반영 | printable HTML과 브라우저 PDF 인쇄 |
| B-08 | 선택 공개형 Trust Card | 신규 반영 | trust_cards API와 사용자 화면 |
| B-09 | 수신자·목적·기간에 결합된 공유 | 신규 반영 | audience_role/purpose/expires_at |
| B-10 | 공개주소 회수와 열람 감사 | 신규 반영 | token hash/revoke/access log |
| B-11 | 중개사용 제출현황·상담 기록 | 신규 반영 | broker report axis와 realtor participant |
| B-12 | 중개사·임대관리·기관 조직계정 기반 | 신규 반영 | trust_organizations/memberships/API clients |
| B-13 | OCR 결과와 운영자 수정 기록 | 반영 | extraction fields와 AI processing corrections |
| B-14 | AI 서비스·모델·비용·개인정보·사람검토 기록 | 신규 반영 | ai_processing_runs |
| B-15 | 원문 다운로드와 재공유 기본 제한 | 반영 | Trust Card에는 공개값만 제공하며 원문 참조는 반환하지 않음 |
| B-16 | 최소수집·민감정보 원칙적 미수집 | 반영 기반 | prohibited sensitivity와 공개값 분리, 실제 수집정책은 법률검토 필요 |
| B-17 | 리포트 단위원가 측정 | 신규 반영 | OCR/API/검수시간/결제/저장지원 비용 필드 |
| B-18 | 고객 인터뷰·샘플·파일럿·가격 검증 | 신규 반영 | validation_experiments |
| B-19 | 목표와 실적의 분리 기록 | 신규 반영 | target_count/actual_count, evidence_refs |
| B-20 | 중개사 반복사용·B2B 확장 기반 | 신규 반영 | 조직계정, broker role, v1 API |
| B-21 | 책임제한과 법률검토 전 자동판정 금지 | 신규 반영 | 화면 고지와 automated_scoring blocked gate |
| B-22 | 결제·구독 가설 | 기반 존재 | Stripe/임대인 구독 기능은 존재하나 리포트 유료화는 paid_pilot 승인 전 비활성 |

## 5. 공식 확인자료 체크리스트

| 축 | 기본 항목 |
|---|---|
| 임차인 | 본인확인, 재직, 소득 범위, 이전 임대인 레퍼런스 |
| 임대인 | 본인확인, 소유자 일치, 권리확인 협조, 이전 임차인 레퍼런스 |
| 주택 | 등기부, 건축물대장, 실거래가, 공시가격, 보증보험 확인 항목 |
| 중개 | 제출자료 현황, 추가 질문, 상담·설명 기록 |

보증 가능 여부, 계약 안전, 법률 결론은 확정값으로 표시하지 않는다.

## 6. 운영 KPI와 문서 목표

관리자 제품검증 화면에서 다음 목표를 계획값으로 등록하고 실제값과 분리한다.

| 기간 | 목표 |
|---|---|
| 2026-08 | 비식별 샘플 30쪽, 업로드/OCR/검수/리포트 알파 |
| 2026-09 | 테스트 리포트 10건, 출처·기준일 표시율 100%, 중대 권한오류 0건 |
| 2026-09 | 임차인 10명, 임대인 5명, 중개사 5명 인터뷰 목표 |
| 2026-10 | 리포트 10건, 이해도 80점 이상, 중앙 처리시간 24시간 이내 |
| 2026-10 | 중개사 2~3곳 파일럿 목표 |
| 2026-11 | 응답 20건, 결제의향 5건, 반복사용 의향 중개사 2곳 목표 |
| 2026-12 | 정정 요청 2영업일 내 처리 100% 목표 |

목표 수치는 성과가 아니다. 실제 인터뷰 기록, 테스트 로그, 화면 캡처와 결제 증빙이 연결된 경우에만 actual_count와 evidence_refs에 기록한다.

## 7. 코드만으로 완료할 수 없는 항목

다음 항목은 요구사항이 플랫폼 게이트와 운영상태로 반영됐지만 외부 계약·법률의견·실사용 증빙 없이는 완료로 표시할 수 없다.

1. 인터넷등기소, 정부24/세움터, 국토교통부, 공시가격, HUG 실제 자동연동
2. 운영 OCR·악성코드 검사 공급자 연결과 정확도 측정
3. 전자서명 공급자 계약과 서명 검증
4. 개인정보·신용정보·중개업·레퍼런스·차별 이슈 법률 검토
5. 유료 리포트의 환불·삭제·책임 기준 승인
6. 실제 고객 인터뷰, 중개사 파일럿, 지불의향과 반복사용 실적
7. 운영환경 백업·시점복구·재해복구 훈련 증빙
8. 상표와 기술임치의 실제 신청·계약

이 항목은 trust_compliance_gates가 approved가 되기 전 운영 활성화 대상으로 간주하지 않는다.

## 8. 주요 신규 경로

- DB: db/migration-028-contract-report-productization.sql
- 서비스: lib/contract-trust.ts
- 사용자 API: /api/v1/contract-reports, /api/v1/trust-cards
- 문서 안전 API: /api/v1/document-intakes
- AI 기록 API: /api/v1/ai-processing-runs
- 조직 API: /api/v1/organizations
- 관리자 API: /api/v1/admin/trust-product
- 사용자 화면: /trust/reports, /trust/cards
- 관리자 화면: /admin/trust/product

## 9. 현재 판정

문서에 기재된 플랫폼 내부 기능 요구는 구현 구조와 사용자·관리자 흐름에 반영했다. 외부기관 연동, 법률 승인, 파일럿 실적과 운영 인프라 훈련은 코드로 사실을 만들 수 없는 항목이므로 게이트와 증빙 기록 구조로 반영했으며, 실제 근거가 확보될 때만 승인 상태로 전환한다.

# 입주해 특허·법무 제출용 공개/비공개 정보 매트릭스

작성일: 2026-07-10  
용도: 법무/IP 검토 제출본과 내부 운영본 분리 기준  
관련 티켓: [DOW-305](/DOW/issues/DOW-305), [DOW-303](/DOW/issues/DOW-303), [DOW-304](/DOW/issues/DOW-304)

## 제출 원칙

법무/IP 제출본은 기능 수준의 구조, 공개 필드 범위, 동의 기반 열람 흐름, redacted 샘플 리포트만 포함한다. 내부 운영본은 특허성·영업비밀·개인정보보호 검토를 위해 구현 근거를 보관하되, 외부 제출물에는 실제 사용자 데이터, 원본 서류, 세부 산식, DB schema, SQL query, OCR prompt, storage URL, access log 원문 값을 넣지 않는다.

표기 기준:

- 공개 가능: 법무/IP 자문과 특허 명세서 보강에 사용할 수 있는 기능 수준 설명
- 제한 공개: 법무대리인에게 구두 또는 별도 비밀자료로만 설명하고 제출본에는 요약하는 항목
- 비공개 유지: 영업비밀, 개인정보, 보안 리스크가 있어 외부 제출본에서 제외할 항목

## 공개/비공개 매트릭스

| 영역 | 공개 가능 | 제한 공개 | 비공개 유지 | 제출본 문구 |
| --- | --- | --- | --- | --- |
| 서비스 목적 | 임대차 거래 전 확인 항목을 역할별 리포트로 제공 | 특정 사용자군별 운영 정책 | 실제 사용자 데이터, 영업 지표 원장 | “임차인, 임대인, 주택을 분리해 계약 판단에 필요한 확인 항목 리포트를 제공한다.” |
| 원본 서류 처리 | 원본을 직접 공개하지 않고 파생 검증값으로 변환 | 서류 유형별 검토 상태 분류 | 원본 파일, storage URL, OCR 원문, 추출 payload | “원본 서류는 최소 검증값과 상태값으로 축약된다.” |
| Trust Score/신뢰 참고값 | overall signal, level, 확인 항목 충분/보통/추가 확인 필요 | 점수 구간의 존재 여부와 UX 표현 방향 | 세부 배점, threshold, penalty, `trust.score_breakdown`, 0~100/최대점 전제 | “복수 확인 항목을 종합해 신뢰 참고 신호를 산출한다.” |
| 검증 배지 | 재직, 소득, 신용 관련 확인 여부와 추가 확인 필요 상태 | 검증 provider 범주 | provider 계약 조건, 원문 응답, 개인신용정보 상세값 | “확인된 항목과 추가 확인이 필요한 항목을 분리 표시한다.” |
| 레퍼런스 | 항목형 응답 수, 추천 여부 요약, 분쟁/정정 상태 | 항목 카테고리 예시 | 작성자 식별정보, 자유서술 원문, 원문 점수 세부 | “레퍼런스 응답은 항목별 확인값과 정정 요청 상태로 구조화된다.” |
| 동의 기반 공개 | 목적, 역할, 허용 필드에 따라 공개 범위 제한 | 동의 만료/철회 조건의 큰 흐름 | consent table schema, SQL, 내부 우선순위 로직 | “동의 범위에 포함된 필드만 리포트에 포함한다.” |
| 열람로그 | 허용/거절 여부와 공개 필드를 기록한다는 사실 | 감사 목적, 분쟁 대응 목적 | IP, user-agent, request metadata, 내부 access log 상세 정책 | “열람 요청 결과와 공개 범위는 사후 감사 목적으로 기록된다.” |
| 임차인 리포트 | `tenant_trust` redacted 샘플, 공개 필드명 | 내부 status flag 매핑 | 실제 tenant profile, 연락처, score breakdown | “임차인 신뢰 리포트는 요약 신호와 확인 항목 중심으로 제공된다.” |
| 임대인 리포트 | `landlord_trust` redacted 샘플, 공개 필드명 | 임대인 검증 항목 후보 | 권리관계 자동조회 구현 세부, 실제 소유자 정보 | “임대인 신뢰 리포트는 역할별 확인 항목을 별도로 제공한다.” |
| 주택 안전 리포트 | `property_safety` redacted 샘플, 위험 flag 예시 | 등기부/건축물대장/시세 연계 가능성 | 자동 판정 산식, 외부 API 계약, 실제 주소/등기 정보 | “주택 안전 확인 항목은 별도 리포트로 제공될 수 있다.” |
| 거래조건 힌트 | 추가서류, 안전조치, 조정 옵션을 참고값으로 제시 | 산정 근거의 큰 범주 | 보증금/월세 자동 조정 규칙, match score 가중치 | “거래조건 힌트는 계약 결정을 강제하지 않는 참고 정보다.” |
| 구현 근거 | 파일 경로 수준의 코드 근거 | 필요한 경우 화면/흐름도 | DB dump, full source excerpt, secret, API key | “구현 근거는 내부 운영본에 별도 보관한다.” |

## 법무/IP 전달본 문구

아래 문구는 외부 법무/IP 자문 자료와 특허 명세서 보강 설명에 사용할 수 있다.

```md
입주해는 임대차 거래 전 정보 주체의 동의 범위에 따라 임차인, 임대인, 주택 안전 항목을 분리해 확인 항목 기반 리포트를 제공한다. 원본 서류나 자유서술 원문을 상대방에게 그대로 공개하지 않고, 계약 판단에 필요한 최소 검증값, 상태값, 요약 신호, 추가 확인 필요 항목으로 축약한다.

리포트는 목적, 열람자 역할, 허용 필드 범위에 따라 공개 항목을 제한하며, 허용 또는 거절된 열람 요청과 공개 필드 범위를 감사 목적으로 기록한다. 신뢰 참고값은 세부 배점이나 산식 대신 “확인 항목 충분”, “보통”, “추가 확인 필요”와 같은 요약 신호로 표현할 수 있다.

제출 샘플은 모두 가상 데이터이며 실제 사용자 정보, 원본 서류, OCR 원문, storage URL, access log 원문, DB schema, SQL query, score breakdown, threshold, penalty를 포함하지 않는다.
```

## 내부 운영본 보관 문구

아래 항목은 내부 운영본에만 보관하고, 법무/IP 제출본에는 요약 또는 제외한다.

- `lib/trust-score.ts`, `lib/trust-score-recalculator.ts`의 세부 산식, 배점, penalty, threshold
- `db/migration-022-patent-trust-engine.sql`의 table/column/index 상세
- `app/api/verifications/documents/route.ts`, `lib/ocr-pipeline.ts`의 OCR prompt, extraction payload, 원문 추출값
- `lib/consent-access.ts`의 consent 우선순위, SQL query, access log 상세 필드
- 실제 사용자 profile, verification, reference, property, storage object, access log 값
- 외부 provider 계약, API key, secret, 인증 provider 응답 원문

## Redacted JSON 공통 규칙

- 모든 ID는 형식 확인용 가상 ID다.
- `generatedAt`, `accessLogId`, `consentId`는 실제 운영값이 아니다.
- 연락처, 실명, 생년월일, 주소, 회사명, 소득금액, 신용등급 원문, 자유서술 원문은 제외한다.
- `trust.score_breakdown`, 세부 산식, OCR 추출 원문, SQL 결과 원문은 포함하지 않는다.
- 공개 필드는 실제 API의 `allowedFields` 체계를 따르되 제출본에서는 최소 필드만 사용한다.

## 샘플 1: tenant_trust 공개본

```json
{
  "sampleType": "tenant_trust",
  "audience": "legal_ip_submission",
  "redaction": {
    "containsRealUserData": false,
    "excluded": [
      "profile.contact",
      "trust.score_breakdown",
      "verification.detail",
      "reference.detail",
      "ocr.raw_text",
      "storage.url",
      "sql.query"
    ]
  },
  "allowedFields": [
    "report.summary",
    "report.status_flags",
    "profile.basic",
    "trust.overall_signal",
    "verification.summary",
    "validation.values",
    "reference.summary",
    "reference.disputes"
  ],
  "access": {
    "purpose": "tenant_trust_review",
    "viewerRole": "landlord",
    "result": "granted",
    "accessLogId": "redacted-access-log-tenant-001"
  },
  "report": {
    "report": {
      "type": "tenant_trust",
      "generatedAt": "2026-07-10T00:00:00.000Z",
      "summary": "확인 항목 기반 신뢰 리포트"
    },
    "statusFlags": [
      "추가 확인 필요"
    ],
    "profile": {
      "basic": {
        "userType": "tenant",
        "ageRange": "비식별 연령대",
        "familyType": "비식별 가구유형",
        "isComplete": true
      }
    },
    "trust": {
      "overallSignal": "보통",
      "level": "fair"
    },
    "verification": {
      "summary": {
        "employment": "확인 항목",
        "income": "추가 확인 필요",
        "credit": "확인 항목"
      }
    },
    "validation": {
      "values": [
        {
          "key": "income_document_status",
          "status": "추가 확인 필요",
          "flag": "document"
        },
        {
          "key": "identity_document_status",
          "status": "확인 항목",
          "flag": "identity"
        }
      ]
    },
    "reference": {
      "summary": {
        "completedCount": 2,
        "recommendCount": 1
      },
      "disputes": [
        {
          "id": "redacted-reference-dispute-001",
          "status": "검토 중"
        }
      ]
    }
  }
}
```

## 샘플 2: landlord_trust 공개본

```json
{
  "sampleType": "landlord_trust",
  "audience": "legal_ip_submission",
  "redaction": {
    "containsRealUserData": false,
    "excluded": [
      "profile.contact",
      "trust.score_breakdown",
      "verification.detail",
      "reference.detail",
      "property.ownership_raw_record",
      "registry.api_response",
      "sql.query"
    ]
  },
  "allowedFields": [
    "report.summary",
    "report.status_flags",
    "profile.basic",
    "trust.overall_signal",
    "verification.summary",
    "validation.values",
    "reference.summary"
  ],
  "access": {
    "purpose": "landlord_trust_review",
    "viewerRole": "tenant",
    "result": "granted",
    "accessLogId": "redacted-access-log-landlord-001"
  },
  "report": {
    "report": {
      "type": "landlord_trust",
      "generatedAt": "2026-07-10T00:00:00.000Z",
      "summary": "확인 항목 기반 신뢰 리포트"
    },
    "statusFlags": [],
    "profile": {
      "basic": {
        "userType": "landlord",
        "ageRange": "비식별 연령대",
        "familyType": null,
        "isComplete": true
      }
    },
    "trust": {
      "overallSignal": "확인 항목 충분",
      "level": "good"
    },
    "verification": {
      "summary": {
        "employment": "확인 항목",
        "income": "확인 항목",
        "credit": "추가 확인 필요"
      }
    },
    "validation": {
      "values": [
        {
          "key": "landlord_identity_status",
          "status": "확인 항목",
          "flag": "identity"
        },
        {
          "key": "property_relationship_status",
          "status": "확인 항목",
          "flag": "ownership"
        }
      ]
    },
    "reference": {
      "summary": {
        "completedCount": 1,
        "recommendCount": 1
      }
    }
  }
}
```

## 샘플 3: property_safety 공개본

```json
{
  "sampleType": "property_safety",
  "audience": "legal_ip_submission",
  "redaction": {
    "containsRealUserData": false,
    "excluded": [
      "profile.contact",
      "property.full_address",
      "registry.raw_record",
      "building_ledger.raw_record",
      "market_price.raw_response",
      "storage.url",
      "sql.query"
    ]
  },
  "allowedFields": [
    "report.summary",
    "report.status_flags",
    "property.safety_summary",
    "property.risk_flags",
    "property.safety_snapshot",
    "evidence.metadata"
  ],
  "access": {
    "purpose": "property_safety_review",
    "viewerRole": "tenant",
    "result": "granted",
    "accessLogId": "redacted-access-log-property-001"
  },
  "report": {
    "report": {
      "type": "property_safety",
      "generatedAt": "2026-07-10T00:00:00.000Z",
      "summary": "주택 안전 확인 항목 리포트"
    },
    "statusFlags": [
      "최신 확인 필요"
    ],
    "property": {
      "safetySummary": {
        "propertyId": "redacted-property-001",
        "title": "비식별 매물명",
        "region": "시/구 단위 비식별 지역",
        "propertyType": "apartment",
        "status": "최신 확인 필요"
      },
      "riskFlags": [
        "등기/권리관계 추가 확인 필요",
        "건축물 정보 최신성 확인 필요"
      ],
      "safetySnapshot": {
        "registry": "요약 상태만 표시",
        "buildingLedger": "요약 상태만 표시",
        "marketPrice": "요약 상태만 표시",
        "overall": "추가 확인 필요"
      }
    },
    "evidence": {
      "metadata": {
        "latestSafetyCheckAt": "2026-07-01T00:00:00.000Z",
        "expiresAt": "2026-08-01T00:00:00.000Z"
      }
    }
  }
}
```

## 내부 운영 체크리스트

- 법무/IP 제출 전 `trust.score_breakdown`, `verification.detail`, `reference.detail`, `profile.contact`가 포함되지 않았는지 확인한다.
- OCR 원문 또는 원본 서류를 재구성할 수 있는 `validation_text`, `extraction_payload`, file path, storage URL을 제거한다.
- access log는 존재와 목적만 설명하고 IP, user-agent, request metadata 원문은 제출하지 않는다.
- 주택 안전 자동 산정, 임대인 권리관계 자동조회, feedback learning은 구현 완료가 아니라 확장 실시예 또는 부분 구현으로 표시한다.
- 법무대리인이 세부 산식 확인을 요청하면 별도 NDA/비밀자료 조건에서 화면 공유로 설명하고 제출 파일에는 넣지 않는다.

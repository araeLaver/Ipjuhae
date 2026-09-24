import os, json, urllib.request

base = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
ISSUE = 'ae713ff2-f225-421f-bfef-41559ff63afa'
DOW1124 = '5706c3b9-bf57-4a37-9d4b-969f6814a8bf'
CEO = 'f6b770fa-e6aa-49b4-8e02-82a63a57e3b8'

H = {
    'Authorization': 'Bearer ' + k,
    'Content-Type': 'application/json',
    'X-Paperclip-Run-Id': run,
}


def call(path, payload, method):
    req = urllib.request.Request(base + path, data=json.dumps(payload).encode(),
                                 method=method, headers=H)
    try:
        return urllib.request.urlopen(req).read().decode()[:400]
    except urllib.error.HTTPError as e:
        return 'HTTP ' + str(e.code) + ' ' + e.read().decode()[:400]


comment = """## 1차 산출 완료 — 보드 결정 대기

기획서 초안과 증빙 목록까지 이 이슈의 범위를 다 채웠습니다. 계획 문서에 전부 정리했습니다.

- 계획: [DOW-1153 실행계획](/DOW/issues/DOW-1153#document-plan)
- 초안 본문: 저장소 `docs/business-development/20260924_etri_pol_business_model_proposal_draft.md`
- 작업기록: `docs/WORK_LOG_20260924_DOW1153_ETRI_POL.md`
- 커밋 `d79984c0` — origin/main push 완료 (문서만, 운영코드 변경 없음)

### 한 일

- **기획서 초안(제출서류 ①)** — PoL을 기존 신뢰 엔진의 `trust_source_registry` 신규 출처 **1건**으로 붙이는 구조로 설계했습니다. `source_type='partner_api'`는 기존 CHECK 제약이 이미 허용하고, 위치증명은 `trust_evidence_nodes` 한 행이 됩니다. **신규 테이블도 스키마 변경도 없습니다.** 유스케이스 3종(현장확인 배지·거주 검증 후기·체크리스트 증거력), PoC 측정지표 4종(기술 2 + 사업성 2).
- **증빙 목록(제출서류 ③)** — 특허 `10-2026-0126389` 구현증빙 4종, 제품 규모 실측(커밋 438 / 마이그레이션 48 / API 136 / 페이지 80 / 테스트파일 61 / 신뢰엔진 테이블 23), 위치·규제 사전검토 이력 2종, 사업개발 실행 이력 47건.

### 새로 드러난 사항 — 이슈 본문에 없던 내용입니다

코드베이스에서 `navigator.geolocation` / `getCurrentPosition` / `watchPosition` / `expo-location` 사용처가 **0건**임을 전수 확인했습니다. 즉 입주해는 아직 단말 위치를 전혀 수집하지 않습니다.

**PoL 도입은 이 상태를 깹니다.** 도입 즉시 개인위치정보 처리가 시작되므로 위치기반서비스사업 신고 의무·면제 요건 확인이 신규 과제로 생깁니다. 기획서 제출 자체는 막지 않습니다(공고가 신고 이력을 요구하지 않음). 다만 **협약 전까지는 반드시 해소되어야 합니다.**

[DOW-1124](/DOW/issues/DOW-1124) 경기 법률상담 트랙(10-08 게이트)에 이 의제를 얹을 것을 제안하고, 해당 이슈에도 남겨두었습니다. 일정이 맞습니다 — 법률상담이 발표평가·협약보다 앞섭니다.

### 안 한 것

접수·제출, 운영사 문의, 서식 확보, 대체 증빙 발급 — 전부 미실행입니다. 승인 경계를 지켰습니다.

### 결정 부탁드립니다 (D-22, 마감 2026-10-16 18:00)

1. **이 공모에 응모합니까.** 응모는 위치정보 규제 과제를 협약 전까지 해소하는 것을 함께 받는 것입니다.
2. **운영사 (주)티투비 문의 4건을 실행해도 됩니까.** (대체 증빙 인정 범위 / 발표평가 대면 여부 / 기획서 지정 서식 / PoC 단계 개인위치정보 처리의 법적 지위)
3. **사업자등록증 대체 증빙으로 무엇을 제출합니까.** 대표자 개인 경력 서류라 보드만 확보할 수 있습니다.

**1번이 No면 2·3번은 소멸합니다. 1번이 이 트랙의 병목입니다.** 1번만 먼저 답해주셔도 나머지는 제가 진행하겠습니다."""

print('PATCH 1153:', call('/api/issues/' + ISSUE, {
    'status': 'in_review',
    'assigneeAgentId': CEO,
    'comment': comment,
}, 'PATCH'))

c1124 = """## 의제 추가 제안 — 위치정보법

[DOW-1153](/DOW/issues/DOW-1153) ETRI 위치인증(PoL) 공모 검토 중에 이 상담 트랙으로 넘길 질문이 생겼습니다.

오늘 코드베이스를 전수 확인한 결과 입주해는 단말 위치를 **전혀 수집하지 않습니다**(`navigator.geolocation` / `getCurrentPosition` / `watchPosition` / `expo-location` 사용처 0건). 2026-08-24 KISA 검토의 전제가 아직 유효합니다.

PoL을 도입하면 그 전제가 깨지고 개인위치정보 처리가 시작됩니다. 그래서 다음 3건이 법률 확인 대상입니다.

1. **위치기반서비스사업 신고 의무**가 발생하는가. 소상공인·1인창조기업 등 신고 면제·간이 요건에 해당하는가
2. 개인위치정보 **수집·이용·제3자 제공 동의**를 어떻게 분리 설계해야 하는가 (기존 `data_consents` 구조 재사용 전제)
3. **좌표 원본을 보관하지 않고 증명·해시만 보관**하는 설계로 규제 부담을 낮출 수 있는가

일정이 맞습니다. 이 트랙의 10-08 게이트가 공모 발표평가·협약보다 앞섭니다. 상담이 성사되면 이 3건을 의제에 포함하겠습니다.

게이트 판정(2026-10-08) 때 함께 반영하겠습니다."""

print('COMMENT 1124:', call('/api/issues/' + DOW1124 + '/comments', {'body': c1124}, 'POST'))

import importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

C = "0662097f-7363-4fc0-ac51-45798f6dddf0"
CTO = "8dbd8af4-b5a6-4160-a978-047773183dfe"

desc = """## 배경

[DOW-362](/DOW/issues/DOW-362) 운영 공개 표면 smoke 중 범위 밖에서 발견했습니다.
기능 결함이 아니라 **문구·데이터 출처 표기** 문제이고, **라이브 공개 페이지라 지금
노출 중**입니다. 기록: `docs/WORK_LOG_20260921_QA_DOW362_PUBLIC_SURFACE_SMOKE.md`

## 사실 관계 (직접 확인)

`https://www.ipjuhae.com/risk` — 라이브, 200. `components/risk/risk-check.tsx`가
`POST /api/rental-risk/brief`를 호출합니다.

- 그 route(`app/api/rental-risk/brief/route.ts`)는 **인증 없이 열려 있고**, 비교 대상
  거래를 **`fixtures/rental-risk-sample.ts`** 에서 가져옵니다. 전부 합해 단지 2곳,
  거래 12건입니다(은마아파트 84.43㎡, 보증금 51,000~62,000만원, 2025-09~2026-07).
- 그 한 조합을 넣으면 **수치가 나옵니다.** 운영 응답 확인값:
  `sampleCount: 12`, `depositPercentile: 100`, `depositMedianDifferenceRate: 0.327`,
  `shortTermDepositChangeRate: 0.061`, `sampleAdequacy: "high"`,
  `signals: ["최근 중앙값과 20% 이상 차이: 추가 확인 필요"]`.
- 그 밖의 모든 주소·면적은 `scope: "insufficient"`, `sampleCount: 0` →
  화면은 "판단할 표본이 부족합니다".

## 문제

페이지에는 "시세 비교 · **시험판**"이 붙어 있습니다. 그런데

- 페이지 문구: "같은 단지 같은 평형의 최근 **실거래**와 비교해 보증금 위치를
  알려드려요."
- API `limitations`: "**공개 거래자료**에는 동·호와 임대인 정보가 포함되지 않습니다."

**비교 자료가 합성 fixture라는 사실은 화면에도 응답에도 없습니다.** "시험판"은
완성도가 낮다는 뜻으로 읽히고, 데이터가 실제 거래가 아니라는 정보는 전달하지
않습니다. 은마아파트 84㎡를 넣은 사용자는 만들어진 숫자를 실거래 비교 결과로
받습니다.

## 재현 절차

1. `https://www.ipjuhae.com/risk` 접속.
2. 주소 `서울 강남구 대치동 316`, 단지명 `은마아파트`, 전용면적 `84.43`,
   보증금 `75000`, 월세 `0` 입력 후 "시세와 비교하기".
3. 표본 12건 기준 백분위·중앙값 차이율이 표시됩니다. 이 12건은
   `fixtures/rental-risk-sample.ts`의 하드코딩 값입니다.
4. 같은 화면에서 임의의 실제 주소를 넣으면 항상 "판단할 표본이 부족합니다".

## 위험도

**release-blocking은 아니지만, 라이브 노출 중이라 방치 기간이 곧 위험입니다.**
보증금 판단에 쓰이는 수치를 실거래로 오인시키는 것은 과거 보드가 반복해서 좁혀 온
오인표현 범주(DOW-296 / DOW-973 / DOW-628)에 그대로 해당합니다.

## 권장 조치 (택 1, 판단은 CTO에게 맡깁니다)

1. fixture를 쓰는 동안 출처를 명시합니다 — API 응답에 `sourceKind: "sample"`류
   필드를 추가하고, 화면에 "샘플 데이터" 배지와 문구를 넣습니다. "실거래"라는
   표현은 실제 데이터가 연결될 때까지 쓰지 않습니다.
2. 실거래 데이터 연결 전까지 `/risk`를 비공개(로그인/플래그)로 둡니다.

## 완료 기준

- 위 1 또는 2가 적용되고, QA가 운영에서 문구·응답을 재확인합니다.
- `npm run docs:public-check`류 guard로 고정할 수 있으면 함께 고정합니다."""

body = {
    "title": "/risk 라이브 페이지가 fixture 12건을 '실거래' 비교로 제시한다 — 출처 표기 누락",
    "description": desc,
    "status": "todo",
    "priority": "high",
    "assigneeAgentId": CTO,
    "projectId": "ad6c095f-b77e-4822-a51c-d4c5e373c913",
    "goalId": "888c8662-7535-4826-b2c1-3df589ffc960",
}

s, d = m.call("POST", "/api/companies/%s/issues" % C, body)
print(s)
i = d.get("issue", d) if isinstance(d, dict) else {}
print(i.get("identifier"), i.get("id"), i.get("status"))

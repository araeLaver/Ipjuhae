# 임대차 리스크 브리프 PoC

공개 CSV를 본뜬 비식별 fixture만 사용해 주소·단지 매칭과 가격 이상도 브리프를 검증한다. 운영 DB, 외부 API, 개인정보는 사용하지 않는다.

## 실행

개발 서버에서 다음 요청으로 재현할 수 있다.

```bash
curl -sS -X POST http://localhost:3000/api/rental-risk/brief \
  -H 'content-type: application/json' \
  --data '{"address":"서울 강남구 대치동 316","complexName":"은마아파트","areaM2":84.43,"depositManwon":56500,"monthlyRentManwon":0}'
```

응답은 `match`, `comparison`, 5개 `metrics`, `signals`, `limitations`, `sourceAsOf`를 포함한다. 결과는 사기나 권리관계 판정이 아니며, 표본 부족·모호한 매칭에서는 `추가 확인 필요`로 안전하게 종료한다.

## 검증 기준

`evaluateMatchingQuality`는 수동 정답셋에 대해 다음 값을 계산한다.

- `precision = 올바른 자동 매칭 / 전체 자동 매칭`
- `coverage = 올바른 자동 매칭 / 정답 단지가 있는 전체 입력`
- Go 기준: precision 95% 이상이며 coverage 80% 이상

현재 fixture는 파이프라인 재현성 확인용이며 실제 시장 coverage를 대표하지 않는다. 실제 공개 CSV를 확보한 다음 100건 수동 정답셋으로 같은 함수를 실행해야 Go/No-Go를 결정할 수 있다.

## 공개 CSV 100건 검증

`fixtures/rental-risk-public-validation.csv`는 서울시 공개 부동산 스키마를 사용한 공개 저장소 CSV를 commit SHA로 고정하고, 그중 고유 아파트 100건을 추출한 정답셋이다. 개인정보 컬럼은 없으며 원천 행 식별자, 정답 주소·단지명, 변형 입력, 예상·실제 매칭 결과를 함께 저장한다.

```bash
npm run rental-risk:validate
```

네트워크 없이 같은 원천 파일을 지정할 수도 있다.

```bash
npx tsx scripts/build-rental-risk-validation.ts /path/to/df_서울.csv
```

측정 결과는 `docs/rental-risk-validation-results.json`에 생성된다.

- precision: `80 / 80 = 100%` (자동 매칭된 80건 기준, 기준 95% 충족)
- coverage: `80 / 100 = 80%` (기준 80% 충족)
- insufficient: `20 / 100 = 20%`
- exact 외 normalization·alias 변형 성공률: `55 / 55 = 100%`
- 결론: 정해진 Go 기준은 경계값으로 충족하지만, 표본이 의도적으로 구성된 정답셋이므로 제한적 Go이다.

실패 20건은 시·도 생략 10건(`addressNormalization`)과 법정동 생략 10건(`legalDongExpansion`)이다. alias 실패와 원천 결측은 없었다.

다음 구현 개선 후보는 세 가지다.

1. 시·도 생략 입력을 서비스 기본 지역(서울)과 결합한 뒤 재매칭한다.
2. 자치구+지번 입력은 법정동 후보를 확장하되 단일 후보일 때만 자동 확정한다.
3. alias는 운영 코드에 하드코딩하지 않고 출처·갱신일이 있는 별도 테이블로 관리한다.

### 해석 경계

이 검증은 주소·단지명 매칭 품질만 측정한다. 원천은 매매 공개 CSV이므로 전월세 보증금·월세의 가격 이상도 정확성을 증명하지 않는다. 서울시 전월세 전체 CSV가 다시 제공되면 동일 스크립트 입력 스키마를 전월세 원천으로 교체하고 `sampleCount`, 기간 확장, 가격 percentile을 별도 검증해야 한다. 따라서 현재 결과는 production 가격 안내에 대한 최종 Go가 아니다.

```bash
npm test -- --run __tests__/lib/rental-risk.test.ts __tests__/api/rental-risk-brief.test.ts
npm run typecheck
```

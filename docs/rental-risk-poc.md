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

```bash
npm test -- --run __tests__/lib/rental-risk.test.ts __tests__/api/rental-risk-brief.test.ts
npm run typecheck
```

# 2026-09-26 — DOW-1150 demo 캡처에서 Next.js dev indicator 배지 제거

담당: 입주해
관련: DOW-1150, DOW-730, DOW-1186

## 문제

`/demo/public-mock/listings` 캡처 좌하단에 Next.js dev indicator 배지가 같이 찍혔다.
이 route는 production에서 404라 **dev에서만 존재**하고, 따라서 캡처에는 항상 배지가
따라붙는다. 그런데 이 캡처의 용도가 외부 제출물이라 제출 이미지에 개발 도구 UI가 박힌다.

기능 결함은 아니고 제출물 위생 문제다.

## 수정

`next.config.js`에서 **캡처용 flag가 켜졌을 때만** 끈다.

```js
...(process.env.PUBLIC_MOCK_DEMO_ENABLED === '1' ? { devIndicators: false } : {}),
```

전역으로 끄지 않은 이유: 평소 개발에서 이 배지는 빌드 상태를 알려주는 쓸모가 있다.
`PUBLIC_MOCK_DEMO_ENABLED`는 캡처를 뜰 때만 세우는 값이고 production에서는 애초에
세워지지 않으므로 일반 개발과 운영에 영향이 없다.

## 검증에서 한 번 틀렸다 — 존재 여부로 판정하면 안 된다

처음 검증기는 `nextjs-portal` / `#devtools-indicator` **요소의 존재**를 봤고,
수정 후에도 `present=True`가 나와 **"안 고쳐졌다"고 판정했다.**

실제로는 고쳐져 있었다. `devIndicators: false`여도 Next는 요소를 DOM에 남겨 두고
크기만 0으로 만든다. 스크린샷을 직접 열어 보고서야 배지가 사라진 것을 확인했다.

캡처에 찍히느냐가 기준이므로 **보이는 크기**로 판정하도록 고쳤다.

```
flag OFF (대조군): #devtools-indicator 36x36 display=block → 보임   PASS
flag ON  (캡처용): #devtools-indicator  0x0               → 안 보임 PASS
```

**대조군을 같이 둔 이유**: flag OFF에서도 배지가 사라졌다면 그건 "전역으로 꺼서 개발
편의를 없앤 것"이다. 두 판정이 갈려야 수정이 의도한 범위에 머물렀다는 뜻이다.

## 게이트

```
npx tsc --noEmit                         클린
npx eslint next.config.js                 클린
npm run build (flag 없이 = 운영 경로)      성공
node scripts/check-test-suite-health.mjs   860개 / 83파일 / 죽은 스위트 0개
```

## 남은 것

이 수정은 배지만 없앤다. **외부 공개 자체는 여전히 보드 승인 대상**이다
([DOW-730](/DOW/issues/DOW-730) 결론 유지). QA가 캡처를 다시 뜰 때
`PUBLIC_MOCK_DEMO_ENABLED=1`로 띄우면 배지 없는 이미지를 얻는다.

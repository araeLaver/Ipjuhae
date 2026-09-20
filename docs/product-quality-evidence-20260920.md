# 제품/품질 증거 일일 기록 - 2026-09-20

## 요약

- 기준 경로: `/Volumes/WorkDrive/Develop/02_Ipjuhae`
- 기준 커밋: `7a697a71 feat: /check 결과 화면에 테스터 모집, 모집 문안 정리`
- 워크트리: 깨끗함(미커밋 변경 없음), 로컬 `main` = `origin/main`
- 오늘 검증 결과: `typecheck` 통과, 테스트 전체 통과(162 스위트 / 449 테스트), production `build` 통과
- **중대 발견**: 보안·컴플라이언스 테스트 11개 스위트가 "실행조차 되지 않은 채" 실패로 굳어 있었다. 오늘 원인을 찾아 고쳤고, 되살아난 119개 테스트는 전부 통과한다.

## 오늘 찾은 문제: 테스트 스위트 11개가 죽어 있었음

### 증상

`vitest run` 결과가 `330 passed / 21 failed`였고, 실패 21건 중 11건은 개별 테스트 실패가 아니라
**스위트 자체가 로드에 실패**한 것이었다. 에러 메시지는 한 줄뿐이었다.

```
Error: No such built-in module: node:
```

죽어 있던 스위트(= 한 번도 검증되지 않던 영역):

- `__tests__/api/compliance-gates.test.ts`
- `__tests__/api/external-requests-authorization.test.ts`
- `__tests__/api/references.test.ts`
- `__tests__/lib/auth.test.ts`
- `__tests__/lib/contract-trust-compliance.test.ts`
- `__tests__/lib/contract-trust-mutation-authorization.test.ts`
- `__tests__/lib/idempotency.test.ts`
- `__tests__/lib/public-mock-demo-boundary.test.ts`
- `__tests__/lib/trust-engine-compliance.test.ts`
- `__tests__/lib/trust-engine-security.test.ts`
- `__tests__/lib/verification.test.ts`

이름에서 보이듯 **인증, 권한, 신뢰 엔진 보안, 컴플라이언스 게이트, 멱등성** —
가장 깨지면 안 되는 영역이 통째로 무검증 상태였다.

### 원인 1 — 서버 코드를 브라우저(jsdom) 환경에서 돌리고 있었다

`vitest.config.ts`의 `environment`가 `'jsdom'`이었다. 그런데 `__tests__` 아래에는
컴포넌트 테스트가 한 건도 없고 전부 `app/api`·`lib`의 서버 사이드 코드다.

jsdom 환경에서는 Vite가 Node 내장 모듈을 "브라우저 호환용"으로 externalize 한다.

```
[vite] (client) warning: Module "crypto" has been externalized for browser compatibility,
imported by ".../lib/otp.ts"
```

`lib/otp.ts`, `lib/idempotency.ts`, `lib/trust-engine.ts`, `lib/verification.ts`,
`lib/storage.ts`, `lib/upload.ts` 등이 `import crypto from 'crypto'`를 쓰고 있어서,
이 모듈을 직·간접으로 import 하는 스위트가 전부 여기에 걸렸다.
현재 로컬 런타임인 Node v26.8.2에서 이 externalize 경로가
`No such built-in module: node:`로 터지면서 스위트가 로드 단계에서 죽었다.

### 원인 2 — 셸의 `NODE_ENV=production`이 테스트로 새어 들어왔다

환경을 `node`로 바꾸자 스위트는 로드되기 시작했지만, 이번엔 39개 테스트가 실패했다.
에러가 전부 운영 가드였다.

- `Error: JWT_SECRET is required in production` (`lib/jwt.ts:20`)
- `Error: VERIFICATION_PROVIDER가 mock로 설정되어 있습니다. 운영에서는 codef 또는 nice를 사용해야 합니다.` (`lib/verification.ts:76`)
- `POST /api/auth/signup`이 200 대신 500

원인은 제품 코드가 아니라 **에이전트 실행 셸에 `NODE_ENV=production`이 export 되어 있다는 것**이다.
`lib/jwt.ts`와 `lib/verification.ts`의 가드는 `process.env.NODE_ENV === 'production'`을 보는데,
테스트가 그 값을 그대로 상속받아 "운영에서 mock을 쓰고 있다"고 판단해 정상적으로 거부했다.
즉 가드 자체는 의도대로 동작했고, 테스트 환경이 오염돼 있었던 것이다.

### 조치

`vitest.config.ts` 두 곳을 고쳤다.

- `environment: 'jsdom'` → `'node'`
  (컴포넌트 테스트를 추가할 때는 파일 상단에 `// @vitest-environment jsdom`을 붙이면 된다)
- `env: { NODE_ENV: 'test' }` 추가
  (셸에 무엇이 떠 있든 테스트는 항상 `test`로 고정 — CI에서도 같은 오염이 재발할 수 있다)

## 검증 결과

| 검증 | 명령 | 수정 전 | 수정 후 |
| --- | --- | --- | --- |
| 타입 | `tsc --noEmit` | 통과 | 통과 |
| 단위/통합 테스트 | `vitest run` | 스위트 143/162, 테스트 330 통과 / 21 실패 | **스위트 162/162, 테스트 449 통과 / 0 실패** |
| 프로덕션 빌드 | `next build` | 통과 | 통과 (exit 0) |

되살아난 테스트: **119개** (330 → 449). 되살아난 테스트는 제품 코드를 한 줄도 손대지 않고 전부 통과했다.
즉 제품에는 문제가 없었고, **테스트 하네스가 조용히 거짓 안전 신호를 주고 있었다.**

## 남은 리스크와 후속

1. **CI가 이 침묵을 왜 못 잡았는지 확인 필요.** 스위트 로드 실패도 종료 코드로는 잡히지만,
   실패 21건이 "원래 그런 것"으로 굳어 있었을 가능성이 크다.
   → 후속: CI에 "기대 테스트 수 하한" 또는 스위트 로드 실패 전용 알림을 건다.
2. **`import crypto from 'crypto'`를 `node:crypto`로 정규화**하는 정리 작업.
   지금 설정으로 증상은 사라졌지만, 표기를 통일해 두면 번들러/런타임이 바뀔 때 재발을 막는다.
   (대상: `lib/otp.ts`, `lib/idempotency.ts`, `lib/storage.ts`, `lib/trust-engine.ts`,
   `lib/upload.ts`, `lib/verification.ts`, `app/api/**` 8곳, `db/migrate.ts`)
3. **에이전트 실행 셸의 `NODE_ENV=production`**은 테스트 말고 다른 로컬 스크립트에도 같은
   방식으로 샐 수 있다. 어댑터 환경 설정에서 걷어내는 편이 안전하다.

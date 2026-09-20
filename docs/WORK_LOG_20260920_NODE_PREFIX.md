# 워크로그 2026-09-20 (3) — `crypto`를 `node:crypto`로

어제 테스트 스위트 11개가 통째로 죽었던 건(DOW-1040)은
vitest 환경을 `node`로 고정해서 증상이 사라졌다. 오늘은 그 증상을 만든 쪽을 고쳤다.

## 왜 죽었나

`import crypto from 'crypto'`처럼 **프리픽스 없이** Node 내장 모듈을 부르면,
번들러가 이걸 "브라우저에서 쓰려는 패키지"로 오해할 여지가 생긴다.
브라우저용으로 externalize 되는 순간 `crypto.randomBytes`가 없는 빈 껍데기가 오고,
그 파일을 import 하는 테스트는 전부 같이 죽는다.

`import crypto from 'node:crypto'`는 오해할 구석이 없다. Node 내장 모듈이라고
경로에 써 있다.

## 고친 것

한 줄짜리 수정 19군데.

| 어디 | 무엇 |
| --- | --- |
| `lib/` | otp, idempotency, storage, trust-engine, upload, verification |
| `app/api/` | waitlist invite, community posts·comments·reports, landlord property images, references(+resend) |
| 기타 | `db/migrate.ts`, `vitest.config.ts`, `__tests__/lib/idempotency.test.ts` |

티켓에 적힌 목록 외에 `vitest.config.ts`와 `__tests__/lib/idempotency.test.ts`도
같이 넣었다. 남겨두면 다음 사람이 "여긴 왜 다르지" 하고 멈춘다.

## 손대지 않은 것

`server.js`와 `socket-auth.js`는 `require('path')`, `require('crypto')`를 쓴다.
CommonJS `require`는 번들러를 거치지 않고 Node가 직접 푼다. 이번 사고 경로가 아니라
그대로 뒀다.

## 검증

| | |
| --- | --- |
| `tsc --noEmit` | 통과 |
| `vitest run` | 449/449 통과 |
| `next build` | 통과, 라우트 125개(static 69 / dynamic 56) |

커밋 `37f7a82`, `origin/main`에 push 완료.

## 남는 것

앞으로 새로 쓰는 코드가 다시 프리픽스 없이 들어오면 똑같은 일이 반복된다.
lint 규칙(`unicorn/prefer-node-protocol` 또는 `no-restricted-imports`)으로 막는 게
다음 수순인데, 이번 티켓 범위 밖이라 여기 적어만 둔다.

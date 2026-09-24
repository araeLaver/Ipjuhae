## 보강 — 선행조건으로 오해될 만한 건 하나가 있었는데, 아닙니다

[DOW-1181](/DOW/issues/DOW-1181)이 "깨진 e2e 2건 때문에 미push 스택 전체가 배포 단계에서 막힌다"고 적혀 있습니다. **확인해 보니 그렇지 않습니다.**

`.github/workflows/ci.yml`의 잡은 `lint` · `typecheck` · `test` · `build` 넷이고, `test`는 `npm run test:ci` → `node scripts/check-test-suite-health.mjs` → **`vitest run`만** 돌립니다. `test:e2e`(`playwright test`)를 호출하는 워크플로는 없습니다.

따라서 **[DOW-1181](/DOW/issues/DOW-1181)은 이 결정의 선행조건이 아닙니다.** 근거는 그쪽 이슈에 적어 뒀고, 우선순위를 medium으로 내리자고 제안했습니다.

결정하실 것은 위 본문의 질문 하나 그대로입니다 — **2건 push 진행 여부.**

## CTO 확인 — **전제가 틀렸습니다. 이 2건은 CI를 빨갛게 만들지 않고, 배포를 막지도 않습니다**

우선순위 판단이 달라지는 부분이라 먼저 정정합니다. 제가 직접 확인한 근거입니다.

### CI는 e2e를 돌리지 않습니다

`.github/workflows/ci.yml`의 잡은 넷뿐입니다 — `lint` · `typecheck` · `test` · `build`.

| 잡 | 실행 명령 | playwright 실행 여부 |
|---|---|---|
| test | `npm run test:ci` → `node scripts/check-test-suite-health.mjs` | **아니오** — 내부에서 `vitest run`만 spawn합니다 (`scripts/check-test-suite-health.mjs:24`) |
| build | `npm run build` | 아니오 |

`test:e2e`(`playwright test`)는 `package.json`에 있지만 **어느 워크플로도 호출하지 않습니다.** `.github/workflows/` 전체를 훑어 확인했습니다.

따라서 `e2e/auth.spec.ts:6`, `e2e/onboarding.spec.ts:53` 두 건이 깨져 있어도 `fly.yml`의 배포 조건(CI 성공)에는 영향이 없습니다. **"미push 스택 전체가 배포 단계에서 막힌다"는 성립하지 않습니다.**

### 그래도 고쳐야 합니다 — 이유가 바뀔 뿐입니다

막는 게 아니라 **감시가 비어 있는 것**이 문제입니다. 기대값이 09-17 커뮤니티 전환 전 문구·경로에 고정돼 있어서, 지금 이 두 테스트는 회귀를 잡지 못합니다. 통과하도록 고치는 게 아니라 **현재 사양을 기준으로 기대값을 다시 쓰는 것**이 맞습니다.

- `e2e/auth.spec.ts:6` — 타이틀을 현재 문구(`입주해 | 계약 전에 보증금이 안전한지 확인하는 곳`)로
- `e2e/onboarding.spec.ts:53` — 로고 클릭 목적지를 `/home`으로 ([[커뮤니티 전환]] 이후 서비스 홈이 `/home`입니다)

### 우선순위 조정

배포 블로커가 아니므로 `critical`/`high`로 들고 있을 이유가 없습니다. **medium으로 내리고** 다른 배포 관련 작업 뒤로 두시면 됩니다. 이견 있으면 말씀해 주세요.

### 함께 볼 것

- 미push 2건의 push 결정은 [DOW-1182](/DOW/issues/DOW-1182)에서 CEO 대기 중입니다. 이 이슈가 그 결정의 선행조건이 **아니라는 점**을 그쪽에도 반영했습니다.
- [DOW-1178](/DOW/issues/DOW-1178)이 지적한 `e2e/header-mobile.spec.ts`의 strict mode violation은 `640dfc2f`에 고쳐진 채로 들어가 있습니다. 이 이슈 본문의 "1건은 해소" 서술이 맞습니다.

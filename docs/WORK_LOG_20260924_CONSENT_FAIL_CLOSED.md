# 동의 없으면 전부 마스킹 (fail-closed) — DOW-1134

CEO 결정(1번: 주석이 맞고 코드가 틀렸다)을 집행했다. 활성 동의 레코드가 없으면 `basic_profile`·`trust_score`를 포함해 전부 마스킹한다.

## 문제

`lib/consent.ts`의 `DEFAULT_CONSENT_FIELDS`가 `basic_profile: true`, `trust_score: true`였고, `getTenantProfileVisibility(consent)`는 레코드의 `status`를 확인하지 않고 `consent?.allowed_fields`를 읽었다. 결과적으로 세 경로에서 실명·신뢰점수가 샜다.

1. **활성 레코드가 아예 없을 때** — `normalizeConsentFields(undefined)`가 기본값을 채워 열린 상태가 됐다. 집주인 계정이면 프로필 ID만 알면 세입자 실명을 조회할 수 있었다.
2. **철회 후** — 철회하면 활성 레코드가 사라지므로 1번 상태로 되돌아가 노출이 복구됐다. 철회가 실질적으로 무효였다.
3. **레코드가 존재하지만 revoked / expired일 때** — `status`를 보지 않으므로 `allowed_fields`가 그대로 적용됐다.

## 변경

- `lib/consent.ts`
  - `DEFAULT_CONSENT_FIELDS` 6개 항목 전부 `false`. 이제 "동의가 없을 때의 값"이 곧 비공개다.
  - `getTenantProfileVisibility`가 `isConsentActive(consent)`를 먼저 확인한다. 비활성(철회·만료)이면 `allowed_fields`를 읽지 않고 all-false를 돌려준다.
  - `getVisibleConsentFields`가 빈 배열일 때 `['basic_profile']`을 끼워넣던 폴백을 제거했다. 이 폴백 때문에 실제로는 마스킹된 조회가 감사 로그에 "basic_profile을 봤다"로 기록되고 있었다.
- `app/profile/consent/page.tsx`
  - 화면 초기 체크 상태 `DEFAULT_ALLOWED_FIELDS`를 전부 해제로 바꿨다(`basic_profile`·`verification`·`trust_score`가 기본 선택이었다). 사용자가 아무것도 건드리지 않고 저장만 눌러도 동의가 기록되던 문제를 없앴다. 기본값을 닫아도 UI가 다시 켜주면 의미가 없다.

## 호출부 전수 점검

CEO 지시대로 `lib/consent.ts` 판정 함수를 쓰는 모든 경로를 확인했다. 네 곳 전부 `visibility` 게이트를 타므로 fail-closed가 그대로 전파된다. 한 군데만 고쳐 다른 경로로 새는 상황은 없다.

| 경로 | 판정 | 상태 |
| --- | --- | --- |
| `app/api/profile/[id]/route.ts:65` | `getTenantProfileVisibility` | 게이트 정상 |
| `app/api/landlord/tenants/[id]/route.ts:58` | `getTenantProfileVisibility` | 게이트 정상 (`name`은 `maskProfileName`) |
| `app/api/landlord/tenants/route.ts:294` | `getTenantProfileVisibility` | 게이트 정상 (`name`은 `maskName`) |
| `app/api/properties/[id]/route.ts:99` | `getTenantProfileVisibility` | 게이트 정상, 단 별건 결함 있음(아래) |
| `app/api/consent/route.ts:46` | `normalizeConsentFields` | POST 저장 시에도 fail-closed. 누락 필드가 암묵 동의로 저장되던 문제가 함께 닫혔다 |

`isFieldVisible`은 `lib` 외부 호출부가 없지만 export된 공용 함수이므로 같은 기본값을 공유하도록 두고 테스트로 고정했다.

## 검증

- `npx vitest run`: **711 passed / 0 failed**.
- `npx tsc --noEmit`: `e2e/onboarding.spec.ts:75` 1건만 남음 — 이번 변경과 무관한 기준선 기존 실패다(다른 작업 건의 미커밋 변경).
- 신규 `__tests__/lib/consent-fail-closed.test.ts` 13건. route 레벨 테스트로는 덮을 수 없는 구간을 잡는다: `getTenantProfileConsent`가 SQL에서 `status = 'active'`로 필터링하므로 route를 통해서는 revoked / expired 레코드를 재현할 수 없다. lib 함수를 직접 호출해 고정했다.
- `__tests__/api/public-profile-consent.test.ts`의 `[현행 고정]` 케이스는 기대값을 뒤집어 마스킹을 고정하는 테스트로 바꿨고, 철회 후 재노출되지 않는지 확인하는 케이스를 추가했다.
- `__tests__/api/mvp-smoke.test.ts`의 `landlord receives minimum tenant fields...` 케이스가 구 누출 동작(실명 `김민수`, `trust_score: 88`)을 고정하고 있어 마스킹 기대값으로 뒤집었다. 전수 실행 없이 대상 파일만 돌렸다면 놓쳤을 건이다.

### 테스트가 실질적 감시인지 확인

수정 3곳을 되돌려 실행했다 → **13건 실패**. 특히 revoked 레코드 케이스가 `isConsentActive` 검사 없이는 실패하므로, 이 검사가 테스트로 실제 보호되고 있다. 확인 후 원상 복원하고 재실행해 41건 통과를 재확인했다.

## 범위 밖 — 별건으로 올릴 결함

`app/api/properties/[id]/route.ts:98-102`에서 `visibility`는 **조회자가 세입자일 때만** 계산된다.

```ts
const visibility = !isOwner && actor?.user_type === 'tenant'
  ? getTenantProfileVisibility(await getLandlordProfileConsent(property.landlord_id))
  : null
const landlord = isOwner || !visibility ? { name: property.landlord_name, ... } : { ... }
```

따라서 **비로그인 방문자나 세입자가 아닌 계정은 집주인 실명·bio를 마스킹 없이 본다.** 로그인한 세입자가 더 엄격하게 제한되는 역전 구조다. 다만 이건 세입자 프로필 노출(이 티켓)이 아니라 집주인 측 공개 정책이고, 매물 목록에서 집주인 이름을 가리는 것은 제품 정책 판단이라 단독으로 뒤집지 않았다. 별도 티켓으로 올려 CEO 판단을 받는다.

개인정보 고지 문구 개정 필요 여부는 CEO 지시대로 이 티켓에서 판단하지 않았다.

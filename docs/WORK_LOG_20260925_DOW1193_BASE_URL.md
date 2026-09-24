# 2026-09-25 — DOW-1193 base URL 접합 지점 단일화

담당: 입주해
관련: DOW-1168(발견 경위), DOW-1193

## 한 줄

`NEXT_PUBLIC_BASE_URL`을 문자열로 이어 붙이던 12곳을 `lib/base-url.ts` 한 곳으로 모았다.
환경변수에 끝 슬래시가 붙어도 `//`가 생기지 않는다.

## 왜 (결함이 아니라 잠복 위험이었다)

`fly.toml`의 값이 `https://www.ipjuhae.com`이라 끝 슬래시가 없어서 지금은 잘 돈다.
**우연히 안전한 것이지 구조가 아니다.** 누군가 값에 슬래시를 하나 붙이면 12곳이 한꺼번에
`//`가 되고, 그중 둘은 조용히 넘어가지 않는다.

- `lib/oauth.ts` — OAuth `redirect_uri`. 콘솔 등록값과 불일치하면 **소셜 로그인 전체 실패**
- `lib/email.ts` — 메일 본문 링크. 이미 발송된 메일은 되돌릴 수 없다

환경변수 한 글자가 코드 리뷰도 배포 게이트도 거치지 않고 그 결과를 만든다.

## 만든 것 — `lib/base-url.ts`

- `normalizeBaseUrl(value, fallback)` — 끝 슬래시 제거, 빈 값이면 폴백(폴백도 정규화)
- `getBaseUrl(fallback)` — 정규화된 env 값. **호출 시점에 읽는다** (모듈 로드 시 굳히지 않음)
- `buildUrl(path, fallback)` — 경로 앞 슬래시 유무와 무관하게 단일 슬래시로 접합

판정을 한 곳에 모으는 방식은 DOW-1168의 `lib/safe-redirect.ts`와 같다.

## 바꾼 곳 — 전수 grep으로 다시 세었다

티켓 목록(13곳)을 그대로 믿지 않고 `NEXT_PUBLIC_BASE_URL`을 다시 grep했다.

| 파일 | 처리 |
| --- | --- |
| `lib/oauth.ts` | `buildUrl` |
| `lib/email.ts` (3곳) | `buildUrl` |
| `lib/notifications.ts` | `getBaseUrl` + `buildUrl` |
| `lib/storage.ts` | `buildUrl` |
| `app/api/auth/social/[provider]/callback/route.ts` | `getBaseUrl` |
| `app/api/auth/magic-link/route.ts` | `normalizeBaseUrl` (폴백 체인 보존) |
| `app/api/references/route.ts` | `buildUrl` |
| `app/api/references/[id]/resend/route.ts` | `buildUrl` |
| `app/api/admin/waitlist/invite/route.ts` | `buildUrl` + 폴백 `https://www.ipjuhae.com` 유지 |
| `app/admin/users/[id]/page.tsx` | `buildUrl` |
| `app/api/launch/smoke/route.ts` | **바꾸지 않음** — 접합이 아니라 존재 여부 검사 |
| `scripts/prelaunch-check.mjs` | **바꾸지 않음** — 필수 env 목록일 뿐 |

### 폴백이 서로 달랐다 — 값을 바꾸지 않도록 개별 보존

- 대부분 `http://localhost:3000`
- `app/api/admin/waitlist/invite/route.ts`만 `https://www.ipjuhae.com` → 인자로 명시해 유지
- `lib/email.ts`·`lib/storage.ts`는 **폴백이 아예 없었다.** env 미설정 시 문자열
  `"undefined/profile"`이 메일에 실려 나갈 수 있었다. 이제 기본 폴백을 탄다 —
  잠복 결함 하나가 부수적으로 닫혔다.

### `magic-link`는 체인이라 따로 다뤘다

`NEXT_PUBLIC_BASE_URL || NEXT_PUBLIC_APP_URL || https://${host}` 3단 폴백이다.
**순서를 건드리지 않고** 결과값만 `normalizeBaseUrl`로 감쌌다.

## 회귀 테스트 — `__tests__/lib/base-url.test.ts` 15건

티켓이 특히 못박은 두 가지를 그대로 넣었다.

1. **`redirect_uri` 바이트 동일성** — 끝 슬래시가 없을 때 수정 전 표현식
   `` `${base}/api/auth/social/${provider}/callback` `` 과 **같은 문자열**인지.
   내부 함수를 부르지 않고 `getAuthorizeUrl()`이 만든 URL의 `redirect_uri` 쿼리를
   되읽어 확인한다 — 실제로 provider에 전송되는 값이 기준이어야 한다.
2. **끝 슬래시가 붙은 값에서 `//`가 안 생기는지** — base 3종(`슬래시 없음`/`하나`/`둘`) ×
   경로 9종 조합 전수.

### 되돌려 실패 확인

`lib/oauth.ts`를 수정 전으로 되돌리고 돌렸다.

```
1 failed | 14 passed
Expected: "https://www.ipjuhae.com/api/auth/social/kakao/callback"
Received: "https://www.ipjuhae.com//api/auth/social/kakao/callback"
```

정확히 티켓이 경고한 `//api` 형태로 깨진다. 바이트 동일성 테스트는 되돌려도 통과하는데,
그건 끝 슬래시가 없는 경우라 수정과 무관하게 참이어야 하는 항목이다 — 맞는 동작이다.

복원 후 `git diff`로 원본 상태를 확인했다.

## 게이트

```
npx tsc --noEmit                        클린
npx eslint <변경 9파일>                   클린
node scripts/check-test-suite-health.mjs  776개 / 78파일 / 죽은 스위트 0개 (직전 761)
```

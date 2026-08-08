# 제품/품질 증거 일일 기록 - 2026-08-04

## 요약

- 기준 경로: `/Volumes/WorkDrive/Develop/02_Ipjuhae`
- 기준 브랜치: `fix/cron-secret-environment-scope`
- 기준 커밋: `383d667ed9e33537ae9c86a7762e20d90de2852f`
- 최근 제품 커밋: `4618be3 feat: harden auth and subscription flow`
- 오늘 검증 결과: `typecheck`, `test:run`, `build` 모두 실패

## 워크트리 상태

`git status --short` 기준으로 기존 미커밋/미추적 항목이 남아 있다.

- 수정됨: `.claude/settings.local.json`
- 미추적 문서:
  - `docs/gyeonggi-levelup-internal-evidence-audit-20260804.md`
  - `docs/product-quality-evidence-20260803-blockers.md`
  - `docs/synthetic-mock-publication-qa-checklist-20260803.md`
- 미추적 디렉터리:
  - `mobile/node_modules/`
  - `temp/`

## 실행한 검증

### `npm run typecheck`

결과: 실패

핵심 증거:

- `app/api/landlord/properties/route.ts`: `TS1002 Unterminated string literal`
- `app/api/landlord/properties/[id]/route.ts`: `TS1002 Unterminated string literal`
- `app/api/landlord/properties/[id]/images/route.ts`: `TS1002 Unterminated string literal`
- `app/api/landlord/stats/route.ts`: `TS1002 Unterminated string literal`
- `app/api/messages/conversations/route.ts`: `TS1002 Unterminated string literal`
- `app/api/messages/conversations/[id]/route.ts`: `TS1490 File appears to be binary` 및 문자열 parse error
- `app/api/messages/unread/route.ts`: `TS1002 Unterminated string literal`
- `app/api/notifications/**/route.ts`: 다수의 문자열 parse error

### `npm run test:run`

결과: 실패

핵심 증거:

- 전체 집계: 54 test files 중 8 failed, 46 passed / 627 tests 중 23 failed, 604 passed
- API smoke/properties suite는 route parse error로 로드 실패
- `__tests__/api/auth.test.ts`, `__tests__/lib/auth.test.ts`는 `jsonwebtoken`에서 `Bad "options.audience" option. The payload already has an "aud" property.`로 실패
- `__tests__/lib/trust-score.test.ts`는 현재 구현이 레퍼런스 점수를 평균/클램프 처리하고 라벨을 `최고/좋음/낮음`으로 반환하지만, 테스트는 합산 점수와 `우수/양호/시작` 라벨을 기대해 실패
- `vitest.config.ts`의 include가 `**/__tests__/**/*.test.{ts,tsx}`라 `.claude/worktrees/nostalgic-shockley/__tests__`까지 수집되어 실패가 중복된다

### `npm run build`

결과: 실패

핵심 증거:

- Next.js production build가 `stream did not contain valid UTF-8`로 중단
- 실패 파일:
  - `app/api/landlord/properties/[id]/images/route.ts`
  - `app/api/landlord/properties/[id]/route.ts`
  - `app/api/landlord/properties/route.ts`
  - `app/api/landlord/stats/route.ts`
  - `app/api/messages/conversations/[id]/route.ts`

## 원인 분류

현재 `HEAD`의 `4618be3 feat: harden auth and subscription flow`에서 아래 12개 파일이 직전 기준 `73b76b2` 대비 변경되었고, 여러 파일에 깨진 한글 문자열과 유효하지 않은 UTF-8 바이트가 포함되어 있다.

- `app/api/landlord/properties/[id]/images/route.ts`
- `app/api/landlord/properties/[id]/route.ts`
- `app/api/landlord/properties/route.ts`
- `app/api/landlord/stats/route.ts`
- `app/api/messages/conversations/[id]/route.ts`
- `app/api/messages/conversations/route.ts`
- `app/api/messages/unread/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/notifications/preferences/route.ts`
- `app/api/notifications/read-all/route.ts`
- `app/api/notifications/route.ts`
- `lib/auth.ts`

예: `73b76b2`의 `app/api/landlord/properties/route.ts`는 `보증금은 0 이상이어야 합니다`로 정상 문자열을 포함하지만, 현재 `HEAD`는 `보증금�? 0 ?�상?�어???�니??` 형태로 깨져 있고 닫는 따옴표도 손상되어 parse가 실패한다.

## 제품 진행 증거

- 인증/구독 하드닝 커밋(`4618be3`)과 cron secret scope 수정 커밋(`383d667`)이 존재해 보안/운영 품질 작업은 진행 중이다.
- 다만 현재 제품 빌드 산출물은 생성되지 않는다. mentoring, 투자, 지원사업 증빙에는 "보안 하드닝 작업 진행"과 함께 "UTF-8 손상 및 JWT 계약 회귀 복구 필요"를 명시해야 한다.

## 후속 조치

- `4618be3`에서 손상된 API route 파일을 `73b76b2`의 정상 UTF-8 문자열과 비교해 복구한다.
- `lib/auth.ts`의 JWT payload/options 중복 `iss`/`aud` 계약을 정리한다.
- `vitest.config.ts`에서 `.claude/worktrees/**`, `node_modules/**`, `.next/**`를 명시적으로 제외해 agent worktree의 오래된 테스트가 루트 검증에 섞이지 않도록 한다.
- 복구 후 `npm run typecheck`, `npm run test:run`, `npm run build`를 재실행한다.

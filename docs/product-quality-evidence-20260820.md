# 제품/품질 증거 일일 기록 - 2026-08-20

## 요약

- 기준 경로: `/Volumes/WorkDrive/Develop/02_Ipjuhae`
- 기준 커밋: `7a4b5cd1 Merge pull request #174 from araeLaver/fix/favicon-remove-old-generators`
- 최근 제품 커밋:
  - `e5abaed6 fix(brand): remove old dynamic icon generators so the new favicon shows`
  - `89629cd8 feat(auth): show only configured social login providers`
  - `25ff2f02 feat(trust): approve admin + automated_scoring gate (account now exists)`
  - `907630c6 fix(security): CSRF check must allow same-origin (www/non-www)`
- 오늘 검증 결과: `typecheck`, `test:run`, production build 조건의 `build` 통과

## 워크트리 상태

`git status --short` 기준 미커밋 변경이 남아 있다.

- 수정됨: `.claude/settings.local.json`
- 수정됨: `app/admin/disputes/page.tsx`
- 수정됨: `app/admin/layout.tsx`
- 수정됨: `app/profile/consent/events/page.tsx`
- 수정됨: `app/profile/page.tsx`
- 수정됨: `app/profile/reference/[id]/page.tsx`
- 수정됨: `components/landing/footer.tsx`
- 수정됨: `components/layout/header.tsx`
- 수정됨: `components/layout/mobile-nav.tsx`
- 수정됨: `components/listings/ListingCard.tsx`
- 수정됨: `components/listings/ListingSearch.tsx`
- 수정됨: `components/trust/data-score-card.tsx`
- 미추적: `docs/business-development/20260817_gsp_two_opportunities_final_decision_sheet.md`

변경 성격은 UI 문구 한글화와 admin/profile/listing 화면 표시 개선으로 보인다. 본 실행에서는 기존 변경을 되돌리거나 커밋하지 않았다.

## 실행한 검증

### `npm run typecheck`

결과: 통과

- `tsc --noEmit` 완료
- npm 경고: `auto-install-peers`, `recursive`는 향후 npm major에서 지원 중단 예정

### `npm run test:run`

결과: 통과

- 40개 test files 통과
- 413개 tests 통과
- 실패 없음

### `npm run build`

1차 결과: 실패

- 명령: `npm run build`
- 원인: 로컬 `.env.local`에 `NODE_ENV=development`가 들어 있어 `next build`가 비표준 환경으로 실행됨
- 증상:
  - Next.js 경고: non-standard `NODE_ENV`
  - prerender 단계에서 `/500`, `/privacy`, `/_not-found` 등이 실패
  - 대표 에러: `<Html> should not be imported outside of pages/_document`, `Cannot read properties of null (reading 'useContext')`

2차 결과: 통과

- 명령: `rm -rf .next && NODE_ENV=production npm run build`
- 결과:
  - 149개 static pages 생성 완료
  - route manifest 생성 완료
  - build worker 정상 종료

남은 build 경고:

- `lib/request-context.ts`가 Edge Runtime 경로에서 Node.js `crypto`를 import한다는 경고
- 다수 페이지의 React Hook dependency 경고
- 일부 `<img>` 사용 경고
- `STRIPE_SECRET_KEY` 미설정으로 Stripe 기능이 503을 반환한다는 로컬 빌드 로그

## 제품 진행 증거

- favicon 정리 PR이 병합되어 brand asset 노출 경로가 정리됐다.
- social login provider 노출 로직이 configured provider만 보여주도록 개선됐다.
- admin trust gate와 automated scoring gate 관련 변경이 병합됐다.
- CSRF same-origin 허용 수정이 반영되어 `www`/non-`www` origin 차이로 인한 보안 미들웨어 회귀가 완화됐다.
- 현재 워크트리에는 사용자-facing UI 문구를 한국어로 맞추는 변경이 추가 진행 중이다.

## 리스크와 후속 조치

- 로컬 `.env.local`의 `NODE_ENV=development`가 기본 `npm run build`를 깨뜨린다. production build 검증 명령은 `NODE_ENV=production npm run build`처럼 명시해야 하며, env hygiene 후속 정리가 필요하다.
- 미커밋 UI 한글화 변경은 type/test/build 기준으로는 통과했지만, 화면 QA와 문구 자연스러움 검토가 필요하다.
- Edge Runtime의 `crypto` import 경고는 runtime 배포 전 별도 추적이 필요하다.

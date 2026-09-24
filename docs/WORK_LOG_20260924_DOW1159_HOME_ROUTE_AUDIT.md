# 2026-09-24 — `/home` 유입 경로 조사 (DOW-1159)

조사·보고만. **코드 변경 0건.** 결론은 CEO 승인 대기(이슈 DOW-1159, `in_review`).

## 결론

**(A) 박힌 유입 경로 없음.** `/home`으로 들어오는 길은 헤더 로고(`components/layout/header.tsx:64`) 1곳뿐이고, 그 1곳은 형제 이슈(U3, 로고 목적지 `/`)에서 사라진다. 다만 **삭제가 아니라 `/home → /` 308 영구 리다이렉트**를 권고했다 — 저장소 밖으로 나간 링크와 구형 PWA 아이콘은 확인할 방법이 없고, 리다이렉트 유지 비용이 되돌리기 비용보다 싸다.

## 확인한 것 (전부 `/home` 참조 0건, 헤더 로고만 예외)

- PWA manifest `start_url` = `/check` — `app/manifest.ts:19`, 라이브 `/manifest.webmanifest`에서도 확인
- manifest `shortcuts` = `/check`, `/` / 서비스워커 precache(`public/sw.js:6`)에 `/home` 없음
- 모바일 앱: React Navigation 네이티브 화면(`mobile/src/navigation/AppNavigator.tsx:107`), `scheme: ipjuhae`, `associatedDomains`·`intentFilters` 없음 → 웹 `/home` 딥링크 없음. 앱이 웹으로 여는 링크는 `/terms`·`/privacy`·`mailto:` 3개(`mobile/src/screens/SettingsScreen.tsx:95-97`)
- 미들웨어(`middleware.ts:315`는 `/`로), `next.config.js` redirects/rewrites 정의 없음
- 로그인 후 이동 `/landlord`·`/admin`·`/profile`(`app/login/page.tsx:134-138`), 온보딩도 `/home` 없음
- `app/sitemap.ts`에 `/home` 없음, `/home`은 `noindex`(`app/home/page.tsx:18`)
- `marketing/` 전체·`mobile/store-listing.md` 스캔 → `/home` 0건
- 라이브 HTTP: `/` 200 · `/home` 200(noindex) · `/check` 200 · `/community` 200. `href="/home"`은 `/`와 `/community`에 각 1건(헤더 로고), `/check`·`/install`·`/about`은 0건

## 집행 시 함께 고칠 잔존 참조 (유입 경로 아님)

- `scripts/verify-demo-network-isolation.mjs:21` — `CONTROL_PATH = '/home'` (demo 격리 검증 **대조군**. 죽으면 거짓 통과)
- `__tests__/components/demo-network-isolation.test.tsx:19,55,88` — `usePathname` 목값 `'/home'`

## `NEXT_PUBLIC_APP_URL`

운영에 설정돼 있다(값은 기록하지 않음). 빌드 타임 `Dockerfile:34` ARG 기본값 + 런타임 `fly.toml:34` `[env]` 두 층. 따라서 `app/home/page.tsx:23`의 `localhost:3000` 폴백은 운영에서 발동하지 않는다. 단 `:29,33`의 **조용한 `[]` 반환**은 남아 있어 `/api/listings` 장애 시 매물 0건이 정상 화면처럼 보인다.

## 확인 못 한 것

1. `/home` 실제 트래픽 — 셸에 Fly 토큰이 없다(`flyctl auth whoami` → `no access token available`). DevOps/보드가 아래 한 줄을 실행해야 한다.
   ```sql
   SELECT count(*), max(created_at) FROM analytics_events
   WHERE event_name = 'page_view' AND properties->>'path' = '/home';
   ```
   (`components/analytics/PageViewTracker.tsx:14`가 모든 경로의 `page_view`에 `path`를 남긴다)
2. 저장소 밖으로 나간 링크(카톡·카페·오픈채팅·DM) — 원고에 0건이지만 "보낸 적 없다"는 증명이 아니다.
3. 09-22(`48128ede`) manifest 변경 전에 설치된 PWA 홈 화면 아이콘 — 옛 `start_url`(`/home`)로 실행될 수 있다.

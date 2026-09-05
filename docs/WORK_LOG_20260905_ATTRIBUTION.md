# 워크로그 2026-09-05 — 사전신청 유입 계측(0주차)

## 배경

사전 신청자가 프로덕션 기준 1명. 인스타·스레드 게시물을 올려도 반응이 없는데,
**어디서 막히는지 구분할 수단이 없는 상태**였다.

- 게시물이 애초에 안 보이는 것인지
- 보고도 링크를 안 누르는 것인지
- 랜딩까지 와서 신청을 안 하는 것인지

셋은 처방이 완전히 다르다. 콘텐츠를 더 만들기 전에 계측을 먼저 깔았다.

## 한 일

### 1. OG 이미지 교체 — `app/opengraph-image.tsx`

기존 이미지는 보라색 그라데이션 + 집 이모지에 문구가 "세입자 프로필 기반 부동산 매칭 플랫폼"으로,
랜딩을 사전모집으로 바꾸기 전의 옛 포지셔닝이었다. 브랜드 색도 아니었다.

랜딩 히어로와 같은 메시지·팔레트(네이비 #0C2247 + 앰버 #E9A23B)로 다시 만들었다.
링크 미리보기와 랜딩이 다른 말을 하면 클릭한 사람이 한 번 더 이탈한다.

### 2. 랜딩 twitter 메타 추가 — `app/page.tsx`

랜딩이 `openGraph`만 지정하고 `twitter`를 안 줘서, 루트 레이아웃의 옛 문구가 그대로 나가고 있었다.
Next의 메타데이터는 최상위 키 단위로 교체되므로 페이지에서 따로 지정해야 한다.

### 3. 유입 경로 수집 — `lib/attribution.ts`, `db/migration-041-waitlist-attribution.sql`

- `waitlist`에 `utm_source / utm_medium / utm_campaign / referrer_host` 컬럼 추가
- 첫 진입(first-touch) 기준으로 탭 세션 동안 유지. 새로고침해도 최초 출처를 잃지 않는다
- 신청 POST에 동봉해 저장

**저장하지 않는 것:** IP, User-Agent 원문, referrer 전체 URL.
referrer는 호스트만 남긴다 — 쿼리스트링에 개인정보가 실려 올 수 있기 때문.
신뢰를 파는 서비스가 계측을 이유로 개인정보 수집을 늘리면 안 된다고 판단.

### 4. `page_view` 기록 버그 수정 — `components/analytics/PageViewTracker.tsx`

**기존 코드가 경로를 기록하지 못하고 있었다.**

```
PageViewTracker  →  trackEvent('page_view', { path: pathname })
analytics-client →  const { sessionId, properties = {} } = options   ← path를 안 읽음
DB               →  properties = {}
```

지금까지 쌓인 `analytics_events`의 `page_view`는 전부 빈 객체였다. 어느 페이지가
방문됐는지 알 수 없는 상태. `properties` 안으로 옮기고 유입 정보도 함께 싣도록 고쳤다.

기존 애널리틱스 파이프라인(`analytics_events` 테이블, `/api/analytics/event`, `track()`)이
이미 갖춰져 있어서 새로 만들지 않고 연결만 했다.

### 5. 채널별 집계 — `app/api/admin/waitlist/route.ts`

관리자 조회 응답에 `sources` 추가. 채널별 랜딩 방문 → 신청 → 전환율을 한 번에 본다.
목록 행에도 `utm_source`, `referrer_host` 노출.

### 6. 동의 문구 갱신

신청자 기록에 유입 경로가 함께 저장되므로 수집 항목에 명시했다.
`WAITLIST_CONSENT_VERSION`을 `waitlist-v3-20260905`로 올렸다.

## 검증

로컬에서 스레드 유입을 재현해 신청까지 완주시켰다.

```
진입: /?utm_source=threads&utm_medium=social&utm_campaign=week1  (referrer: threads.net)

analytics_events → page_view {"path":"/", "utm_source":"threads", "utm_medium":"social",
                              "utm_campaign":"week1", "referrer_host":"www.threads.net"}
waitlist         → 01098765432 | tenant | threads | www.threads.net
집계             → source=threads  visits=1  signups=1
```

- `npx tsc --noEmit` 통과
- `npx vitest run` 449개 전부 통과
- ESLint 클린
- 검증용 로컬 데이터는 삭제함

## 배포 시 필요한 것

`migration-041-waitlist-attribution.sql`이 프로덕션에 적용돼야 신청 API가 동작한다.
**마이그레이션 없이 배포하면 신청 INSERT가 실패한다.**

## 채널별 UTM

| 위치 | 주소 |
| --- | --- |
| 스레드 본문 링크 | `ipjuhae.com/?utm_source=threads` |
| 인스타 프로필 링크 | `ipjuhae.com/?utm_source=ig_bio` |
| 릴스 설명·댓글 | `ipjuhae.com/?utm_source=ig_reel` |
| 유튜브 쇼츠 설명 | `ipjuhae.com/?utm_source=shorts` |
| 중개사 명함·문자 | `ipjuhae.com/?utm_source=offline` |

## 남은 것 (이번에 안 건드림)

- `/api/analytics/event`에 rate limit이 없다. 랜딩 주소를 본격적으로 뿌리기 시작하면
  스팸으로 집계가 오염될 수 있다. `lib/rate-limit.ts`가 이미 있으니 붙이면 된다.
- `components/PageViewTracker.tsx`가 죽은 코드로 남아 있다. 실제로 마운트되는 건
  `components/analytics/PageViewTracker.tsx` 쪽이다.
- `lib/db.ts:8`의 SSL 판별이 `DATABASE_URL.includes('localhost')`라
  `127.0.0.1`로 접속하면 로컬인데도 SSL을 켜서 연결이 깨진다.
- 방문 계측은 페이지뷰 기준이라 순방문자는 구분하지 않는다. 채널 간 비교에는 충분하다고 보고
  방문자 식별자는 두지 않았다.

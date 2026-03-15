# Rentme (임주해) — Product Hunt Launch Kit

## Basic Info
- **Product Name**: Rentme
- **URL**: https://www.ipjuhae.com
- **Category**: SaaS, Real Estate, PropTech
- **Topics**: real-estate, matching, trust, rental, tenant-verification

---

## Tagline (60자 이내)
Verified tenant profiles that match you with the right landlord

## Description (260자 이내)
Rentme flips the rental market. Instead of tenants hunting for listings, they create verified profiles — employment, income, credit — and landlords discover them. Our trust score algorithm matches tenants with compatible landlords, reducing fraud and information asymmetry in the Korean rental market.

## Short Description (Korean, 앱스토어/홍보용)
세입자가 프로필을 만들고, 집주인이 찾아오는 역발상 부동산 매칭 플랫폼.
신원인증과 신뢰 점수로 안전하고 투명한 임대차 거래를 만듭니다.

---

## Key Features (Gallery Slide Text)

### Slide 1: Hero
"Stop hunting for apartments. Let landlords find you."
세입자 프로필 기반 역방향 매칭 — 집주인이 검증된 세입자를 발견합니다.

### Slide 2: Trust Score
"Trust Score: Your rental credential"
재직, 소득, 신용 3단계 인증 → 0~100점 신뢰 점수.
높은 신뢰 점수 = 더 좋은 조건의 매물 매칭.

### Slide 3: Matching
"AI-powered matching, not random listings"
라이프스타일, 예산, 선호 지역을 분석하여
세입자-집주인 양방향 호환성 점수 제공.

### Slide 4: Verification
"Verified badges that landlords trust"
재직증명, 소득증명, 신용조회 — 배지 하나가
10번의 집 보러가기보다 강력합니다.

### Slide 5: Dashboard
"Landlord dashboard: Filter, discover, decide"
집주인 전용 대시보드에서 인증된 세입자 풀을
신뢰점수, 예산, 입주 희망일 기준으로 필터링.

---

## Maker Comment (첫 번째 코멘트)

안녕하세요, Rentme 개발자입니다.

한국에서 집을 구할 때 가장 큰 문제는 정보 비대칭입니다.
세입자는 매물 정보를 믿을 수 없고, 집주인은 세입자를 검증할 방법이 없습니다.

Rentme는 이 문제를 뒤집었습니다:
- 세입자가 먼저 프로필을 만들고 인증합니다
- 집주인이 검증된 세입자 풀에서 직접 선택합니다
- 양쪽 모두 신뢰 점수로 상대방을 평가할 수 있습니다

현재 베타 운영 중이며, 초대 코드로 가입할 수 있습니다.
피드백과 질문 환영합니다!

Hi, I'm the maker of Rentme.

The biggest problem in Korean rental markets is information asymmetry.
Tenants can't trust listings, and landlords can't verify tenants.

Rentme reverses this: tenants create verified profiles first,
and landlords discover them from a trusted pool.

Currently in beta — feedback and questions welcome!

---

## Pricing
- Free: 기본 프로필 생성, 매물 검색, 메시지 3건/일
- Premium (₩9,900/월): 무제한 메시지, 우선 매칭, 프리미엄 배지, 상세 분석

---

## Competitors / Alternatives
- 직방 (Zigbang) — 매물 중심 검색 플랫폼
- 다방 (Dabang) — 중개사 연결 플랫폼
- 피터팬 — 직거래 커뮤니티

## Differentiation
"매물 검색"이 아닌 "세입자 프로필 매칭" — 시장에서 유일한 tenant-forward 모델

---

## Technical Highlights (for Hacker News cross-post)
- Next.js 15 + React 18 + TypeScript
- PostgreSQL + JWT authentication
- Trust score algorithm (employment × 30 + income × 30 + credit × 40)
- Verification badge system with document upload
- Real-time messaging
- Deployed on Koyeb with CI/CD (GitHub Actions)

---

## Launch Checklist

### Before Launch
- [ ] 스크린샷 5장 준비 (1270×760px, 각 슬라이드별)
- [ ] 60초 데모 영상 (Loom or screen recording)
- [ ] Thumbnail 이미지 (240×240px)
- [ ] Gallery GIF (hero animation)
- [ ] Maker avatar + bio 설정

### Launch Day
- [ ] 00:01 PST (한국 17:01) 런칭 게시
- [ ] Maker 첫 코멘트 즉시 작성
- [ ] Twitter/X 런칭 트윗
- [ ] Reddit r/SideProject, r/startups, r/webdev 포스트
- [ ] Hacker News "Show HN" 포스트
- [ ] 한국 커뮤니티: 디스쿼드, 긱뉴스, 요즘IT
- [ ] Slack #prod-rentme 런칭 알림

### After Launch
- [ ] 모든 PH 코멘트 30분 이내 답변
- [ ] Upvote 요청 DM (지인/개발자 커뮤니티)
- [ ] 결과 스크린샷 SNS 공유
- [ ] 피드백 기반 개선사항 정리

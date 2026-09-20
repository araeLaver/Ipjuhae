# 2026-09-21 문서 복원 워크로그

작업: [DOW-1111](/DOW/issues/DOW-1111), 근거: [DOW-1110](/DOW/issues/DOW-1110).

## 결과 및 구조 판단

- `main`에 없던 문서 76개(`docs/` 75개, `marketing/` 1개)를 원래 경로에 복원했다.
- 원본 브랜치: `feature/community-trust-docs-kakao`
- 원본 스냅샷: `f0ff1b9fa4eb1eaa16731ce4cf5af7ec3619e471` (보존 태그: `archive/community-trust-docs-kakao`)
- 기존 상대 링크와 과거 참조 경로를 보존하기 위해 top-level 경로를 유지했다. `docs/business-development/`의 이후 문서와 경로 중복은 없다.
- 이 문서들은 당시 판단의 역사적 기록이며 현재 공고 유효성 또는 최신 제품 상태의 재검증 결과가 아니다.
- 이슈의 날짜 범위 설명과 달리 실제 누락 목록에는 `proptech-outreach-runbook-20260808.md`, `proptech-pitching-day-20260808.md`도 포함되어 있으며 함께 복원했다.

## 검증

- 원본과 main의 `docs/`, `marketing/` 경로 집합 차이: 복원 전 76개.
- 복원 파일 76개 전부 원본 스냅샷과 바이트 단위 일치 확인.
- 기존 파일 수정 없이 신규 문서만 추가했다. 실행 코드 변경이 없어 제품 테스트는 실행하지 않았다.

## 파일별 원본 마지막 변경 커밋

`git log <원본 스냅샷> -- <경로>`로 원래 변경 이력을 조회할 수 있다.

| 복원 경로 | 원본 마지막 변경 커밋 |
| --- | --- |
| `docs/ai-training-center-eligibility-20260715.md` | `096b7de3971530d8e09286b59f3a7b6061c41d49` |
| `docs/bottom-up-open-innovation-fit-20260721.md` | `6618b44893ba9774c74b2dab6b5ab281e5e4adba` |
| `docs/brand-color-theme-20260726.md` | `73a88b346c8813a82c26c873bd76e9af08ec3138` |
| `docs/business-opportunities-20260725.md` | `bbb7c1837aa359ade6f0f4425345ec5f55ca0b5e` |
| `docs/business-opportunities-20260727.md` | `9cb90b86e82959841ca6ea1ac99e71147e9b8e14` |
| `docs/business-opportunities-20260728.md` | `0d826c5389687febc30ba2187efd93c367e0ea7e` |
| `docs/daegu-smart-city-investment-fit-20260726.md` | `7df30fffa74b090637bf38264f0fd7b290396375` |
| `docs/gangnam-jobnstartup-hub-fit-20260721.md` | `6618b44893ba9774c74b2dab6b5ab281e5e4adba` |
| `docs/gov-first-smartcity-fit-202607.md` | `096b7de3971530d8e09286b59f3a7b6061c41d49` |
| `docs/gyeonggi-ai-cluster-openinnovation-fit-20260720.md` | `b99d181b8b9087708dd3b330aa1e2444a9bc23a6` |
| `docs/gyeonggi-levelup-rentme-fit-20260802.md` | `54d50c8eb90d9e037b54374db7b053a549f002ea` |
| `docs/hug-up-rentme-social-service-fit-20260712.md` | `b73c878aad15d34d2b6acc7227a97b0a9d5d7d06` |
| `docs/hug-up-rentme-social-service-fit-20260720.md` | `b99d181b8b9087708dd3b330aa1e2444a9bc23a6` |
| `docs/immediate-launch-readiness-20260726.md` | `73a88b346c8813a82c26c873bd76e9af08ec3138` |
| `docs/invest-connect-2-fit-20260727.md` | `65524536f22c2239c0298e56c6a7cbd4e87a532e` |
| `docs/k-startup-onestop-legal-ip-consultation-202607.md` | `4f16efb89e2c13d6ba89e7ca58c58ba5deda7c97` |
| `docs/kdata-ai-data-problem-bank-application-draft-20260715.md` | `096b7de3971530d8e09286b59f3a7b6061c41d49` |
| `docs/kibo-venture-camp-19-go-no-go-20260712.md` | `b73c878aad15d34d2b6acc7227a97b0a9d5d7d06` |
| `docs/kisa-ict-security-support-fit-20260715.md` | `096b7de3971530d8e09286b59f3a7b6061c41d49` |
| `docs/kisa-ict-security-support-fit-20260726.md` | `7df30fffa74b090637bf38264f0fd7b290396375` |
| `docs/modoo-startup-feature-improvement-plan-20260723.md` | `9cb90b86e82959841ca6ea1ac99e71147e9b8e14` |
| `docs/modoo-startup-patent-technical-implementation-plan-20260726.md` | `65524536f22c2239c0298e56c6a7cbd4e87a532e` |
| `docs/mydata-expert-consultation-draft-20260723.md` | `81b033d0017130f9672195dcf3bdc211bac4812a` |
| `docs/next-challenge-application-202607.md` | `2de95a7ed00edc1f019a87c9fd7def3180095b3f` |
| `docs/outreach-drafts-20260713.md` | `23ae8a80074821f0874d7f9ba6fba253410a85c4` |
| `docs/outreach-drafts-20260720.md` | `d4f15a0aad49229bf1f18db09f17825746f8df4d` |
| `docs/outreach-drafts-20260722.md` | `81b033d0017130f9672195dcf3bdc211bac4812a` |
| `docs/outreach-drafts-20260724.md` | `81b033d0017130f9672195dcf3bdc211bac4812a` |
| `docs/outreach-drafts-20260727.md` | `0d826c5389687febc30ba2187efd93c367e0ea7e` |
| `docs/outreach-drafts-20260729.md` | `104ef10b904b99ab09797ba2d5224b4f1681c04d` |
| `docs/outreach-drafts-20260731.md` | `5a93a6549ab13914fbaf8b816c35c50efe1cf779` |
| `docs/outreach-drafts-20260803.md` | `0fcd970fae402594359b2dd3941e9f7d252d2ec9` |
| `docs/patent-public-private-matrix-202607.md` | `44c3e47a5aa7a330c87a6aae25c21ea2188b416d` |
| `docs/patent-technical-diagrams-202607.md` | `44c3e47a5aa7a330c87a6aae25c21ea2188b416d` |
| `docs/posco-imp-ir-teaser-202607.md` | `dc9db1de02cd8ca9b8ef0768ba7741e83a8c0a04` |
| `docs/pre-tips-fit-20260802.md` | `54d50c8eb90d9e037b54374db7b053a549f002ea` |
| `docs/product-quality-evidence-20260719.md` | `b99d181b8b9087708dd3b330aa1e2444a9bc23a6` |
| `docs/product-quality-evidence-20260720.md` | `b99d181b8b9087708dd3b330aa1e2444a9bc23a6` |
| `docs/product-quality-evidence-20260722.md` | `81b033d0017130f9672195dcf3bdc211bac4812a` |
| `docs/product-quality-evidence-20260723.md` | `81b033d0017130f9672195dcf3bdc211bac4812a` |
| `docs/product-quality-evidence-20260724.md` | `81b033d0017130f9672195dcf3bdc211bac4812a` |
| `docs/product-quality-evidence-20260725.md` | `1e092f3e8e5917bea79734d730a20810f04d6fba` |
| `docs/product-quality-evidence-20260726.md` | `9cb90b86e82959841ca6ea1ac99e71147e9b8e14` |
| `docs/product-quality-evidence-20260727.md` | `9cb90b86e82959841ca6ea1ac99e71147e9b8e14` |
| `docs/product-quality-evidence-20260729.md` | `05a12c69b0f3d8f801b94d09aab6a7cc7bfcda0b` |
| `docs/product-quality-evidence-20260731.md` | `5a93a6549ab13914fbaf8b816c35c50efe1cf779` |
| `docs/product-quality-evidence-20260801.md` | `5a93a6549ab13914fbaf8b816c35c50efe1cf779` |
| `docs/proptech-outreach-runbook-20260808.md` | `0b331fc56e36613db4951cd56b8a1a1d6b66dba4` |
| `docs/proptech-pitching-day-20260808.md` | `0e32543f6d17d01e86ed0afd3b5d54ea685ccde8` |
| `docs/public-data-ai-growth-application-draft-20260801.md` | `8deb9529df4501b6bd9a1d2feb0ca1008c4cf0bd` |
| `docs/public-data-ai-growth-fit-20260717.md` | `096b7de3971530d8e09286b59f3a7b6061c41d49` |
| `docs/public-data-ai-growth-fit-20260726.md` | `7df30fffa74b090637bf38264f0fd7b290396375` |
| `docs/seoul-aihub-daoudata-fit-20260714.md` | `4f16efb89e2c13d6ba89e7ca58c58ba5deda7c97` |
| `docs/sktch-with-ai-fit-20260725.md` | `1e092f3e8e5917bea79734d730a20810f04d6fba` |
| `docs/slush-2026-fit-20260730.md` | `779a2fd3fdb171e734329dd3c419098d81cd5127` |
| `docs/support-opportunities-20260711.md` | `b73c878aad15d34d2b6acc7227a97b0a9d5d7d06` |
| `docs/support-opportunities-20260712.md` | `b73c878aad15d34d2b6acc7227a97b0a9d5d7d06` |
| `docs/support-opportunities-20260713.md` | `23ae8a80074821f0874d7f9ba6fba253410a85c4` |
| `docs/support-opportunities-20260714.md` | `4f16efb89e2c13d6ba89e7ca58c58ba5deda7c97` |
| `docs/support-opportunities-20260715.md` | `60230a01b791b96d2926300ef7ac054e9fbfca47` |
| `docs/support-opportunities-20260717.md` | `096b7de3971530d8e09286b59f3a7b6061c41d49` |
| `docs/support-opportunities-20260718.md` | `096b7de3971530d8e09286b59f3a7b6061c41d49` |
| `docs/support-opportunities-20260719.md` | `b99d181b8b9087708dd3b330aa1e2444a9bc23a6` |
| `docs/support-opportunities-20260720.md` | `b99d181b8b9087708dd3b330aa1e2444a9bc23a6` |
| `docs/support-opportunities-20260721.md` | `6618b44893ba9774c74b2dab6b5ab281e5e4adba` |
| `docs/support-opportunities-20260722.md` | `81b033d0017130f9672195dcf3bdc211bac4812a` |
| `docs/support-opportunities-20260723.md` | `81b033d0017130f9672195dcf3bdc211bac4812a` |
| `docs/support-opportunities-20260724.md` | `e9935250498c902d592ca14939b7cbd6b1f46eb8` |
| `docs/support-opportunities-20260731.md` | `aede8f5ae7bfe748030d63a1bd119fe7a64afbb8` |
| `docs/support-opportunities-20260801.md` | `5a93a6549ab13914fbaf8b816c35c50efe1cf779` |
| `docs/support-opportunities-20260803.md` | `3faaa1f07636f70a5067b8b7abd4251be0f6bf8f` |
| `docs/support-priority-decision-20260716.md` | `096b7de3971530d8e09286b59f3a7b6061c41d49` |
| `docs/topdown-openinnovation-fit-20260713.md` | `23ae8a80074821f0874d7f9ba6fba253410a85c4` |
| `docs/tri-nexus-ai-deeptech-fit-20260730.md` | `779a2fd3fdb171e734329dd3c419098d81cd5127` |
| `docs/yongin-ai-data-startup-fit-20260720.md` | `b99d181b8b9087708dd3b330aa1e2444a9bc23a6` |
| `marketing/press-release-202607.md` | `44c3e47a5aa7a330c87a6aae25c21ea2188b416d` |

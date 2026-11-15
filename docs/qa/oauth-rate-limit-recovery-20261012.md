# OAuth rate limit 브라우저 복구 검증

- 작업: [DOW-1511](/DOW/issues/DOW-1511), 상위: [DOW-1495](/DOW/issues/DOW-1495)
- 기준 revision: `bd9bc5091000d39038b942acbf3b3e2b47623b38`
- 변경: middleware 인증 한도 소진 시 GET `/api/auth/social/{kakao,naver,google}`의 HTML 요청만 303으로 `/login?error=oauth_unavailable`에 복귀한다. 안전한 redirect만 보존하며 Retry-After, no-store, Vary: Accept, 추적 헤더를 포함한다. OAuth state 쿠키를 만들지 않는다.
- API 및 POST, callback 요청은 기존 JSON 429를 유지한다. 한도 검사와 IP 판정은 그대로 사용한다.

## 검증 결과

- `npx vitest run __tests__/middleware.test.ts __tests__/components/social-login-recovery.test.tsx __tests__/api/oauth-configuration.test.ts __tests__/api/login-redirect-return.test.ts`: 4 파일, 56 테스트 PASS.
- `npm run typecheck`: PASS.
- `git diff --check`: PASS.
- `node scripts/qa/check-social-login-recovery-independent.cjs`: 4 브라우저 시나리오 PASS. providers 10회 호출 후 API 429/Retry-After 및 브라우저 로그인 안내·이메일 포커스·복귀 목적지 보존 확인.
- 로컬 fixture: localhost:3197, OAuth 및 Redis 설정을 실행 프로세스에서만 비활성화. secret 파일 변경 없음.
- 증거: `docs/qa/social-login-recovery-independent-20261012/browser-result.json`, `rate-limit-recovery.png`.
- 검증 한계: Redis 실서버 및 실제 스크린리더 음성 출력은 이번 로컬 검증 범위에 포함하지 않았다.

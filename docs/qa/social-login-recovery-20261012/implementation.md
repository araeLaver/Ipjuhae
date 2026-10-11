# 소셜 로그인 차단 복구 구현 검증

- 작업: [DOW-1507](/DOW/issues/DOW-1507), 상위 [DOW-1495](/DOW/issues/DOW-1495), 독립 검수 [DOW-1508](/DOW/issues/DOW-1508)
- 입력: `docs/ux/20261012_social_login_unavailable_recovery_spec.md`
- 로컬 구현 및 가짜 OAuth 설정 검증. 외부 push·배포·secret 변경 없음.

## 변경

- `app/api/auth/social/[provider]/route.ts`: 기존 설정 판정을 재사용한다. 비활성 provider의 일반 API 요청은 503 JSON과 쿠키 미생성 계약을 유지한다. `Accept`에 `text/html`을 명시한 브라우저 진입만 공개 base URL의 `/login?error=oauth_unavailable`로 307 복귀한다. `Vary: Accept`, `Cache-Control: no-store`를 설정한다. 검증한 시작 요청의 목적지만 전달한다. 정상 provider authorize와 state 생성은 유지한다.
- `app/api/auth/social/[provider]/callback/route.ts`: 오류 복귀 URL에 `safeRedirectPath`가 통과시킨 목적지를 전달한다. 취소·state 불일치·기존 이메일·인증 실패 및 잘못된 provider 오류에서 state와 redirect 쿠키를 정리한다. state 검증 실패 시 token 교환 없음.
- `app/login/page.tsx`: 제목 아래 폼 위에 `role=status` 지속 안내를 표시한다. 이메일 대체 버튼은 비밀번호 모드로 전환하고 이메일 필드에 포커스를 이동한다. 소셜 전용 계정의 대체 로그인 가능성을 보장하지 않는 명세 문구를 포함한다. 기존 공용 버튼·목록 가드는 변경하지 않았다.

## 검증 결과

- `npx vitest run __tests__/components/social-login-recovery.test.tsx __tests__/api/oauth-configuration.test.ts __tests__/api/login-redirect-return.test.ts`: 3개 파일, 49개 통과.
- `npm run typecheck`: 통과.
- `git diff --check`: 통과.
- `node scripts/qa/check-social-login-recovery.cjs`: Chromium에서 API 503/쿠키 미생성, 직접 HTML 진입 후 복구 안내, Enter 키로 이메일 포커스, 비활성 버튼 숨김, 360px 가로 넘침 없음, mock 비밀번호 로그인 후 `/community/abc?tab=latest` 복귀 확인.
- 산출물: `browser-result.json`, `mobile.png`. 실제 로그인 API·운영 공급자 인증·실제 음성 출력 성공 증거는 아니다.

## 로컬 브라우저 재현

```sh
KAKAO_CLIENT_ID='' KAKAO_CLIENT_SECRET='' NAVER_CLIENT_ID='' NAVER_CLIENT_SECRET='' GOOGLE_CLIENT_ID='' GOOGLE_CLIENT_SECRET='' NEXT_PUBLIC_BASE_URL=http://localhost:3197 npx next dev --hostname 127.0.0.1 --port 3197
node scripts/qa/check-social-login-recovery.cjs
```

브라우저 스크립트는 localhost만 허용하고 로그인 응답·provider 목록을 mock한다. 테스트 이메일은 fixture이며 계정 생성이나 이메일 발송을 하지 않는다.

## QA·CTO 후속 검수

- CTO: 명시적 `Accept: text/html` 분기 구현 및 API 503/정상 307 계약 유지 검토.
- QA: 목록 성공 후 설정 차단과 회원가입 버튼에서 차단된 경우의 복구. 실제 스크린리더의 안내 인지, 200% 확대, 모바일·키보드 판정.
- QA: 네 가지 콜백 오류 및 위험한 목적지 배제 독립 확인. 가짜 설정 fixture와 mock만 사용.
- 운영 인증 성공·이메일 전달·신규 소셜 가입 이후 복귀는 이번 판정에 포함하지 않는다.

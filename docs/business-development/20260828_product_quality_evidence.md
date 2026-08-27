# 2026-08-28 입주해 제품/품질 증거

## 요약

입주해 MVP는 최신 `main` 기준으로 typecheck, Vitest 전체 테스트, Next.js production build가 모두 통과했다. 최근 제품 변경은 공개 매물 상세주소 노출 축소와 탈퇴 사용자 매물 정보 보호를 다루며, 개인정보·신뢰 안전성 관점의 증거로 활용 가능하다.

## 기준 상태

- 저장소: `/Volumes/WorkDrive/Develop/02_Ipjuhae`
- 브랜치: `main`
- 최신 커밋: `6af661d7 fix: 공개 상세주소 및 탈퇴 매물 정보 보호`
- 최신 커밋 범위:
  - `__tests__/api/account-delete.test.ts`
  - `__tests__/api/properties.test.ts`
  - `app/api/account/delete/route.ts`
  - `app/api/landlord/properties/[id]/route.ts`
  - `app/api/properties/[id]/route.ts`
  - `app/api/properties/route.ts`
  - `app/privacy/page.tsx`
  - `app/properties/[id]/page.tsx`

## 검증 결과

- `npm run typecheck`: 통과
  - `tsc --noEmit` 기준 TypeScript 오류 없음
- `npm run test:run`: 통과
  - Vitest `42`개 test file 통과
  - 총 `422`개 test 통과
- `npm run build`: 통과
  - Next.js `15.5.20` production build 성공
  - app route `149`개 static page 생성 완료
  - API route 및 dynamic route build 목록 생성 완료

## 확인된 경고와 운영 준비 리스크

- `npm run build` 중 기존 React Hook dependency 및 `<img>` 관련 ESLint warning이 반복됐다. 현재 build 실패 요인은 아니지만, 사용자 화면 성능과 유지보수 리스크로 별도 정리 대상이다.
- `STRIPE_SECRET_KEY` 미설정 알림이 build 중 반복됐다. Stripe 기능은 secret 미설정 환경에서 `503`을 반환하도록 설계된 상태로 보이며, 운영 결제 활성화 전 secret 주입 확인이 필요하다.
- `npm run launch:check`는 운영 필수 환경변수 부재로 실패했다.
  - 누락 항목: `DATABASE_URL`, `DB_SCHEMA`, `JWT_SECRET`, `DISCLOSURE_SIGNING_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, production storage/SMS/email/verification provider 설정
  - 이번 실행에서는 운영 배포, 운영 DB 변경, secret 변경을 하지 않는 경계 때문에 값을 생성하거나 수정하지 않았다.

## 제품 진행 증거로 쓸 수 있는 메시지

- 입주해는 공개 매물 화면에서 민감한 상세주소 노출을 줄이고, 계정 삭제 이후 매물 정보가 부적절하게 남지 않도록 API와 테스트를 보강했다.
- 최신 MVP 기준 TypeScript 정합성, API/도메인 테스트, production build가 모두 통과해 투자·멘토링·지원사업 검토 자료에 사용할 수 있는 기본 품질 증거를 확보했다.
- 남은 운영 리스크는 기능 코드 실패가 아니라 production secret/provider 설정 검증 단계에 집중되어 있다.

## 다음 권장 조치

- build warning 중 `react-hooks/exhaustive-deps` 경고를 우선순위별로 정리한다.
- launch rehearsal 전 production secret checklist를 보드 승인 하에 채운 뒤 `npm run launch:check`를 재실행한다.
- Stripe, storage, SMS, email, verification provider는 실제 운영 공급자 결정 후 smoke test 범위를 분리해 검증한다.

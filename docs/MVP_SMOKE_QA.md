# MVP smoke QA

Automated smoke coverage lives in `__tests__/api/mvp-smoke.test.ts` and covers:

- Tenant profile creation through `PUT /api/tenant/profile`.
- Landlord tenant search and screening through `GET /api/landlord/tenants`.
- Listing creation, tenant match generation, and conversation start across `POST /api/listings`, `GET /api/matches`, and `POST /api/messages/conversations`.

Manual provider-key checks for staging:

- Auth providers: verify Kakao/Naver login callbacks with real redirect URLs and provider keys.
- SMS/email: send one phone verification and one landlord reference request with live provider credentials.
- Payments: create one landlord subscription checkout in Stripe test mode and confirm webhook delivery.
- File storage: upload listing/profile images with the configured storage bucket and confirm public URLs render.

## 모바일 권한·알림·계정 회귀 체크리스트

아래 항목은 iOS/Android staging build에서 세입자와 집주인 계정으로 각각 확인합니다.

### 알림 설정

- [ ] 최초 실행에서 알림 권한을 허용·거부한 경우 앱의 toggle 상태가 OS 권한 상태와 일치한다.
- [ ] `설정 > 푸시 알림`을 끄면 `새 메시지 알림`과 `매칭 알림`의 활성 상태 및 설명이 모순되지 않는다.
- [ ] 알림 toggle을 변경하고 앱을 종료·재실행하거나 다시 로그인해도 선택값이 유지된다.
- [ ] `프로필 > 알림 설정`과 `설정 > 알림 설정`이 동일한 실제 설정 화면으로 이동하며 placeholder가 노출되지 않는다.
- [ ] OS 설정에서 알림 권한을 변경한 뒤 앱으로 복귀하면 화면 상태가 즉시 갱신된다.

### 사진 권한·인증 서류 제출

- [ ] 사진 접근 권한을 처음 거부하면 권한 필요 안내가 표시되고 앱이 중단되지 않는다.
- [ ] 영구 거부 상태에서는 OS 설정으로 이동할 수 있는 복구 안내를 제공한다.
- [ ] picker 취소 시 upload API가 호출되지 않고 `제출 중...` 상태가 남지 않는다.
- [ ] 사진을 선택하면 해당 인증 종류와 파일 MIME type이 정확히 전달되며 성공 후 최신 인증 상태를 다시 조회한다.
- [ ] upload 실패·네트워크 단절 후 오류 안내가 표시되고 버튼이 다시 활성화되어 재시도할 수 있다.
- [ ] 이미 완료된 인증에는 제출 버튼이 노출되지 않으며 pull-to-refresh 후에도 완료 상태가 유지된다.

### 프로필·로그아웃·계정 삭제

- [ ] 세입자 프로필 조회 실패 시 빈 화면 대신 재시도 가능한 오류 상태가 표시된다.
- [ ] 집주인 계정에는 세입자 전용 인증 현황과 레퍼런스 메뉴가 노출되지 않는다.
- [ ] 로그아웃 확인 창에서 취소하면 session이 유지되고, 확인하면 token 제거 후 인증 화면으로 이동한다.
- [ ] 계정 삭제에서 취소하면 변경이 없고, 확인하면 지원 문의 안내가 아닌 실제 삭제 또는 명확한 후속 절차로 연결된다.
- [ ] 계정 삭제 완료 후 기존 token으로 보호 API를 호출할 수 없고 재로그인도 차단된다.

### 현재 release gate

- 알림 권한 및 preference가 실제로 연동되지 않거나 알림 설정 화면이 placeholder이면 배포를 차단합니다.
- 사진 권한 거부 후 복구 경로가 없으면 high risk로 기록하고 store 제출 전에 수정합니다.
- 계정 삭제가 앱 내부 또는 명확한 지원 절차로 완료되지 않으면 개인정보·store 심사 위험으로 기록합니다.

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

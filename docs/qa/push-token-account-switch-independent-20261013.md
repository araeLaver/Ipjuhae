# Push token account-switch independent review — 2026-10-13

## Scope

- Source issue: DOW-1691 / original backlog item DOW-1125.
- Workspace: `/Volumes/WorkDrive/Develop/02_Ipjuhae`.
- No production data, secrets, external push sends, PR merge, or deployment were used.

## Existing behavior verified

- `app/api/notifications/push-token/route.ts`
  - `PUT /api/notifications/push-token` validates Expo token shape and platform.
  - `PUT` uses `ON CONFLICT (token) DO UPDATE SET user_id = $1`, so when the current user registers the same device token, ownership moves to the current account.
  - `DELETE` is still scoped to `WHERE user_id = $1 AND token = $2`, so a user cannot delete another user's row by only knowing the token.
- `mobile/src/services/apiClient.ts`
  - `clearTokens()` removes `expo_push_token` with auth tokens. This prevents the next account on the same device from skipping registration because of a stale local token.
- `mobile/src/services/notificationService.ts`
  - Disabled notifications revoke the stored token when the user is authenticated.
  - Failed revokes are retried through `expo_push_token_pending_revoke`.
  - A 401 during revoke stores the pending token outside `expo_push_token`, preserving retry without blocking later owner transfer.

## Commands run

```bash
npm run test:run -- __tests__/api/push-token.test.ts
npm run test:run -- __tests__/mobile/notification-permission-sync.test.ts
npm run test:run -- __tests__/mobile/notification-foreground-resync.test.ts
```

## Results

- `__tests__/api/push-token.test.ts`: 4 passed.
- `__tests__/mobile/notification-permission-sync.test.ts`: 26 passed.
- `__tests__/mobile/notification-foreground-resync.test.ts`: 5 passed.

## Ownership boundary

Safe cases already covered:

- Same device, new account enables notifications: client sends `PUT`, and the server moves token ownership atomically.
- Session expiry or logout-like cleanup before a different account signs in: local `expo_push_token` is removed so the next registration is not skipped.
- Notification disable or OS permission removal while authenticated: client sends user-scoped `DELETE`; failures keep a retry token.

Unsafe case that remains:

- Same device, previous account's server row remains, a different account signs in, and that different account does not enable/register notifications.
- In that path the client sends no push-token request. The server does not receive a device token, stable installation id, Expo receipt, or authenticated signal that can prove which previous row belongs to this device.
- Deleting by token without the owning `user_id`, deleting by guessed last-seen age, or deleting all previous-user rows would risk removing a valid token for another account/device.

## Decision

No independent code change was made for DOW-1691. The remaining DOW-1125 case still requires a future push-send implementation to process Expo delivery receipts such as `DeviceNotRegistered`, or an explicit device identity design with a migration and privacy review. Adding either is outside the delegated scope because this task forbids external sends and new schema expansion for work-padding.

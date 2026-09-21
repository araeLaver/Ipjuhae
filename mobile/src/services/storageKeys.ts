/**
 * 기기에 영속되는 AsyncStorage 키.
 *
 * 세션 정리(`apiClient.clearTokens`)와 알림 등록(`notificationService`)이 같은 키를
 * 다뤄야 하는데, `notificationService`가 `apiClient`를 import하므로 상수를 한쪽에
 * 두면 순환 import가 된다. 양쪽이 여기서만 가져온다.
 */

export const AUTH_TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Expo push token. 세션이 아니라 기기에 묶인 값이지만 세션과 함께 비워야 한다 —
 * `push_tokens.token`이 UNIQUE라 기기 토큰의 소유자를 옮기는 유일한 수단이
 * `PUT /notifications/push-token`의 `ON CONFLICT DO UPDATE SET user_id`이고,
 * 저장값이 남아 있으면 재등록을 건너뛰어 이전 계정이 이 기기를 계속 가리킨다.
 */
export const PUSH_TOKEN_KEY = 'expo_push_token';

export const PUSH_PREFERENCE_KEY = 'push_notifications_enabled';

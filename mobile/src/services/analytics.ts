/**
 * 앱 익명 계측.
 *
 * `apiClient`를 쓰지 않는다. 그쪽은 저장된 토큰을 Authorization 헤더와 쿠키에
 * 자동으로 붙이는데, 그러면 로그인한 사람의 `/check` 이용이 계정과 묶인다.
 * 여기서는 같은 base URL에 인증 헤더 없이 맨 fetch로 보낸다.
 * 다만 `x-mobile-client` 헤더는 반드시 붙인다 — 인증과 무관하게 미들웨어 CSRF를
 * 통과하기 위한 헤더이고, 이게 없으면 모든 요청이 403으로 조용히 버려진다.
 *
 * 기기 ID는 만들지도 보내지도 않는다. 실패는 삼킨다 —
 * 계측 때문에 화면이 멈추면 안 된다.
 *
 * 허용되는 이벤트 이름과 속성 키는 서버(`lib/analytics-events.ts`)가 최종 판정한다.
 * 서버는 허용 목록 밖의 키를 버리므로, 여기서 실수로 금액을 넣어도 저장되지 않는다.
 */

import Constants from 'expo-constants';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'https://www.ipjuhae.com/api';

export type AnonymousEventName =
  | 'check_result_viewed'
  | 'tester_invite_shown'
  | 'tester_invite_clicked';

/** 서버가 받아주는 익명 속성 키만 나열한다. */
export interface AnonymousEventProperties {
  surface?: 'app';
  level?: string;
  from?: string;
}

/** fire-and-forget. await 하지 않아도 되고, 실패해도 아무 일도 일어나지 않는다. */
export function trackAnonymous(
  event: AnonymousEventName,
  properties: AnonymousEventProperties = {}
): void {
  try {
    void fetch(`${API_BASE_URL}/analytics/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 이게 빠지면 미들웨어 CSRF 검사에서 403으로 전량 버려진다.
        // React Native의 fetch는 Origin도 Referer도 붙이지 않으므로, 앱 요청임을
        // 알리는 이 헤더가 유일한 통과 경로다. 토큰을 떼려고 apiClient를 우회할 때
        // 이 헤더까지 같이 잃어버리기 쉽다 — apiClient.ts:50과 같은 값이다.
        'x-mobile-client': 'true',
      },
      body: JSON.stringify({
        event_name: event,
        properties: { surface: 'app', ...properties },
      }),
    }).catch(() => {
      // 통신 실패는 무시한다.
    });
  } catch {
    // 여기서 던지면 안 된다.
  }
}

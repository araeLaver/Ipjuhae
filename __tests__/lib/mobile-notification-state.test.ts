import { describe, expect, it } from 'vitest';
import { getEffectiveNotificationState } from '../../mobile/src/utils/notificationState';

const enabledPreferences = {
  pushEnabled: true,
  messageEnabled: true,
  matchEnabled: true,
};

describe('getEffectiveNotificationState', () => {
  it('OS 권한이 허용되고 서버 설정이 켜져 있으면 모든 알림을 활성화한다', () => {
    expect(getEffectiveNotificationState(enabledPreferences, true)).toEqual(enabledPreferences);
  });

  it('OS 권한이 거부되면 서버 설정과 관계없이 푸시와 하위 알림을 비활성화한다', () => {
    expect(getEffectiveNotificationState(enabledPreferences, false)).toEqual({
      pushEnabled: false,
      messageEnabled: false,
      matchEnabled: false,
    });
  });

  it('서버에서 푸시를 끈 경우 OS 권한이 있어도 하위 알림을 비활성화한다', () => {
    expect(
      getEffectiveNotificationState(
        { pushEnabled: false, messageEnabled: true, matchEnabled: true },
        true
      )
    ).toEqual({
      pushEnabled: false,
      messageEnabled: false,
      matchEnabled: false,
    });
  });

  it('허용 상태에서는 개별 서버 설정을 그대로 반영한다', () => {
    expect(
      getEffectiveNotificationState(
        { pushEnabled: true, messageEnabled: false, matchEnabled: true },
        true
      )
    ).toEqual({
      pushEnabled: true,
      messageEnabled: false,
      matchEnabled: true,
    });
  });
});

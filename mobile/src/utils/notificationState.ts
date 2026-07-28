export interface MobileNotificationPreferences {
  pushEnabled: boolean;
  messageEnabled: boolean;
  matchEnabled: boolean;
}

export interface EffectiveNotificationState {
  pushEnabled: boolean;
  messageEnabled: boolean;
  matchEnabled: boolean;
}

export function getEffectiveNotificationState(
  preferences: MobileNotificationPreferences,
  permissionGranted: boolean
): EffectiveNotificationState {
  const pushEnabled = permissionGranted && preferences.pushEnabled;

  return {
    pushEnabled,
    messageEnabled: pushEnabled && preferences.messageEnabled,
    matchEnabled: pushEnabled && preferences.matchEnabled,
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { apiClient } from './apiClient';
import { PUSH_PENDING_REVOKE_KEY, PUSH_PREFERENCE_KEY, PUSH_TOKEN_KEY } from './storageKeys';

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PushState {
  enabled: boolean;
  permission: PushPermissionStatus;
  tokenRegistered: boolean;
  error: string | null;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function normalizePermission(status: Notifications.PermissionStatus): PushPermissionStatus {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: '입주해 알림',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F0663F',
  });
}

/**
 * 알림이 꺼진 상태인데 남아 있는 토큰을 정리한다.
 *
 * 앱 안에서 끄는 경로(`disableNotifications`)는 서버 토큰 삭제와 기기 토큰 폐기까지
 * 하는데, 기기 설정에서 꺼진 경로에는 그 정리가 없어 서버가 보는 동의 상태와 기기의
 * 실제 상태가 갈라졌다.
 *
 * 선호값이 꺼지는 "순간"이 아니라 꺼져 있는 "동안" 매번 확인한다. 전자로 두면 서버
 * 삭제가 한 번 실패했을 때 선호값은 이미 false라 다시는 정리가 돌지 않는다. 저장된
 * 토큰이 없으면 바로 빠지므로, 복귀마다 불려도 실제 요청은 정리가 끝날 때까지만 나간다.
 *
 * 서버 삭제가 실패하면 지울 토큰을 들고 있다가 다음 복귀에서 다시 시도한다 —
 * 여기에는 실패를 알려 줄 사용자가 없기 때문이다. 실패가 **401**인 경우에는
 * 그 401이 세션 정리를 태워 `PUSH_TOKEN_KEY`를 이미 비운 뒤이므로, 토큰을
 * `PUSH_PENDING_REVOKE_KEY`로 옮겨 둔다. 원래 자리에 되돌리면 다음 계정의
 * 재등록 `PUT`이 생략되어 소유자 이전이 막힌다.
 */
async function revokeStoredToken(canCallServer: boolean): Promise<void> {
  // 비로그인 상태에서는 서버 토큰이 사용자에 묶여 있어 지울 수 없다. 저장된 토큰을
  // 남겨 두고, 다시 로그인해 초기화가 돌 때 정리한다.
  if (!canCallServer) return;
  const token =
    (await AsyncStorage.getItem(PUSH_TOKEN_KEY)) ??
    (await AsyncStorage.getItem(PUSH_PENDING_REVOKE_KEY));
  if (!token) return;

  try {
    await apiClient.delete(`/notifications/push-token?token=${encodeURIComponent(token)}`);
  } catch {
    // 서버 행이 그대로다. 지울 토큰을 들고 다음 복귀에서 다시 건다.
    await AsyncStorage.setItem(PUSH_PENDING_REVOKE_KEY, token);
    return;
  }

  // 여기서부터 서버 행은 없다. 기기 토큰 폐기가 실패하더라도 저장값을 비워야
  // 이미 지워진 행에 대고 복귀마다 DELETE를 되풀이하지 않는다. 폐기 실패는 다음
  // 활성화 때 새 토큰을 받으면서 해소된다.
  try {
    await Notifications.unregisterForNotificationsAsync();
  } catch {
    // 사용자에게 알릴 것이 없다 — 앱이 방금 앞으로 나온 순간이다.
  }
  await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_PENDING_REVOKE_KEY]);
}

/**
 * 저장된 선호값을 OS 권한에 맞춘다.
 *
 * 권한은 기기 설정에서 앱 밖으로 바뀔 수 있으므로, 켜 두었더라도 권한이 없으면
 * 꺼진 것으로 본다. 선호값도 함께 되돌려 다음 실행에서 같은 모순이 반복되지 않게 한다.
 */
async function reconcilePreference(
  preferred: boolean,
  permission: PushPermissionStatus
): Promise<boolean> {
  const enabled = preferred && permission === 'granted';
  if (preferred && !enabled) {
    await AsyncStorage.setItem(PUSH_PREFERENCE_KEY, 'false');
  }
  return enabled;
}

/**
 * 기기 토큰을 서버에 맞춘다.
 *
 * 포그라운드 복귀마다 불리므로 저장된 토큰과 같으면 요청을 만들지 않는다. 토큰이
 * 바뀐 경우(앱 재설치, Expo 토큰 회전)에만 서버에 다시 올린다.
 */
async function registerToken(): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Expo projectId가 설정되지 않았습니다.');

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if ((await AsyncStorage.getItem(PUSH_TOKEN_KEY)) === token) return;

  await apiClient.put('/notifications/push-token', {
    token,
    platform: Platform.OS,
  });
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function initializeNotifications(canRegisterToken = true): Promise<PushState> {
  try {
    await configureAndroidChannel();
    const preferred = (await AsyncStorage.getItem(PUSH_PREFERENCE_KEY)) === 'true';
    const permissions = await Notifications.getPermissionsAsync();
    const permission = normalizePermission(permissions.status);
    const enabled = await reconcilePreference(preferred, permission);

    // 꺼져 있는데 토큰이 남아 있으면 서버는 이 기기를 계속 발송 대상으로 본다.
    if (!enabled) await revokeStoredToken(canRegisterToken);

    // 앱 시작 시에는 권한 팝업을 띄우지 않는다. 사용자가 이전에 활성화했고
    // OS 권한도 유지된 경우에만 token을 갱신한다.
    if (enabled && permission === 'granted' && canRegisterToken) {
      try {
        await registerToken();
        return { enabled, permission, tokenRegistered: true, error: null };
      } catch {
        // 이 경로는 포그라운드 복귀마다 지나간다. 이미 등록해 둔 토큰이 있으면
        // 일시적인 실패(오프라인 복귀 등)이므로 복귀할 때마다 오류를 띄우지 않는다.
        if (await AsyncStorage.getItem(PUSH_TOKEN_KEY)) {
          return { enabled, permission, tokenRegistered: true, error: null };
        }
        return {
          enabled,
          permission,
          tokenRegistered: false,
          error: '푸시 토큰을 등록하지 못했습니다. 네트워크 연결 후 다시 시도해 주세요.',
        };
      }
    }

    return { enabled, permission, tokenRegistered: false, error: null };
  } catch {
    return {
      enabled: false,
      permission: 'undetermined',
      tokenRegistered: false,
      error: '알림 상태를 확인하지 못했습니다. 앱은 계속 사용할 수 있습니다.',
    };
  }
}

export async function enableNotifications(): Promise<PushState> {
  await configureAndroidChannel();
  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== Notifications.PermissionStatus.GRANTED) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  const permission = normalizePermission(permissions.status);
  if (permission !== 'granted') {
    await reconcilePreference(true, permission);
    await revokeStoredToken(true);
    return {
      enabled: false,
      permission,
      tokenRegistered: false,
      error: '알림 권한이 꺼져 있습니다. 기기 설정에서 권한을 허용해 주세요.',
    };
  }

  await AsyncStorage.setItem(PUSH_PREFERENCE_KEY, 'true');
  try {
    await registerToken();
    return { enabled: true, permission, tokenRegistered: true, error: null };
  } catch {
    return {
      enabled: true,
      permission,
      tokenRegistered: false,
      error: '권한은 허용됐지만 토큰 등록에 실패했습니다. 다시 시도해 주세요.',
    };
  }
}

export async function disableNotifications(): Promise<PushState> {
  await AsyncStorage.setItem(PUSH_PREFERENCE_KEY, 'false');
  let error: string | null = null;
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  try {
    if (token) {
      await apiClient.delete(`/notifications/push-token?token=${encodeURIComponent(token)}`);
    }
  } catch {
    // 지울 토큰을 여기서 옮겨 두지 않으면 바로 아래에서 PUSH_TOKEN_KEY가 비워지며 사라진다.
    // 그러면 아래 문구가 약속한 "다음 연결 때"의 재시도 — revokeStoredToken()이
    // PUSH_PENDING_REVOKE_KEY를 읽어 거는 DELETE — 가 지울 토큰을 찾지 못한다.
    // PUSH_TOKEN_KEY로 되돌리지 않는 이유는 revokeStoredToken() 주석을 참고한다.
    if (token) await AsyncStorage.setItem(PUSH_PENDING_REVOKE_KEY, token);
    error = '이 기기의 서버 토큰 정리를 완료하지 못했습니다. 다음 연결 때 다시 처리해 주세요.';
  }
  try {
    // 서버 요청이 실패해도 기기 자체의 push token을 폐기해
    // 로그아웃 후 이전 계정 알림이 수신되는 것을 막는다.
    await Notifications.unregisterForNotificationsAsync();
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    error ??= '기기의 푸시 토큰을 폐기하지 못했습니다. 다시 시도해 주세요.';
  }
  const permissions = await Notifications.getPermissionsAsync();
  return {
    enabled: false,
    permission: normalizePermission(permissions.status),
    tokenRegistered: false,
    error,
  };
}

export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}

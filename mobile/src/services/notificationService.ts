import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { apiClient } from './apiClient';

const PUSH_PREFERENCE_KEY = 'push_notifications_enabled';
const PUSH_TOKEN_KEY = 'expo_push_token';

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

async function registerToken(): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Expo projectId가 설정되지 않았습니다.');

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await apiClient.put('/notifications/push-token', {
    token,
    platform: Platform.OS,
  });
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function initializeNotifications(canRegisterToken = true): Promise<PushState> {
  try {
    await configureAndroidChannel();
    const enabled = (await AsyncStorage.getItem(PUSH_PREFERENCE_KEY)) === 'true';
    const permissions = await Notifications.getPermissionsAsync();
    const permission = normalizePermission(permissions.status);

    // 앱 시작 시에는 권한 팝업을 띄우지 않는다. 사용자가 이전에 활성화했고
    // OS 권한도 유지된 경우에만 token을 갱신한다.
    if (enabled && permission === 'granted' && canRegisterToken) {
      try {
        await registerToken();
        return { enabled, permission, tokenRegistered: true, error: null };
      } catch {
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
    await AsyncStorage.setItem(PUSH_PREFERENCE_KEY, 'false');
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
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) {
      await apiClient.delete(`/notifications/push-token?token=${encodeURIComponent(token)}`);
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    }
  } catch {
    error = '이 기기의 서버 토큰 정리를 완료하지 못했습니다. 다음 연결 때 다시 처리해 주세요.';
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

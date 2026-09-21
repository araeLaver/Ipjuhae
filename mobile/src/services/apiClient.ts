/**
 * API Client for Rentme Mobile
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AUTH_TOKEN_KEY, PUSH_TOKEN_KEY, REFRESH_TOKEN_KEY } from './storageKeys';

/**
 * 기본은 프로덕션이다. 로컬 서버로 붙여 확인할 때만
 * EXPO_PUBLIC_API_BASE_URL 이나 app.json의 expo.extra.apiBaseUrl 로 덮는다.
 * (안드로이드 에뮬레이터에서 호스트 주소는 10.0.2.2다.)
 */
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'https://www.ipjuhae.com/api';

const TOKEN_KEY = AUTH_TOKEN_KEY;

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  }

  async setTokens(token: string, refreshToken?: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  /**
   * 세션을 비운다. 로그아웃과 401(세션 만료)이 공통으로 지나는 한 곳이다.
   *
   * `expo_push_token`도 함께 지운다. 이 값이 남으면 `notificationService`의
   * 재등록 생략이 걸려, 같은 기기에서 다음 계정이 로그인해도 `PUT`이 나가지 않는다.
   * `push_tokens.token`은 UNIQUE라 그 `PUT`이 소유자를 옮기는 유일한 수단이고,
   * `DELETE`는 `user_id`로도 좁히므로 새 사용자가 이전 행을 지울 수도 없다.
   * 결과적으로 이 기기가 이전 계정의 발송 대상으로 남는다.
   */
  async clearTokens(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, PUSH_TOKEN_KEY]);
  }

  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-mobile-client': 'true',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      // Several deployed routes (messages, landlord/properties, listings POST)
      // read the `auth_token` cookie directly instead of the Authorization
      // header, so send the token both ways.
      headers['Cookie'] = `auth_token=${token}`;
    }

    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      await this.clearTokens();
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  async get<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' });
  }

  async uploadFile<T>(url: string, file: { uri: string; name: string; type: string }): Promise<T> {
    const token = await this.getToken();
    const formData = new FormData();
    formData.append('file', file as any);

    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}`, Cookie: `auth_token=${token}` } : {}),
        'x-mobile-client': 'true',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    return response.json();
  }
}

export const apiClient = new ApiClient();

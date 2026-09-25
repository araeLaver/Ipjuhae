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

export const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해 주세요.';

/**
 * 토큰을 들고 보낸 요청이 401로 돌아왔을 때 던진다.
 *
 * 토큰 없이 보낸 요청(로그인·회원가입)의 401은 "세션 만료"가 아니라 그냥
 * 인증 실패이므로 이 오류를 쓰지 않는다. 그래야 비밀번호를 틀렸을 뿐인
 * 사용자를 만료 안내로 내보내지 않는다.
 */
export class SessionExpiredError extends Error {
  readonly code = 'UNAUTHORIZED';

  constructor(message: string = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * 상태코드별 한국어 폴백. 서버가 문구를 주지 않을 때만 쓴다.
 * `HTTP 403` 같은 개발자 문자열이 사용자에게 보이지 않게 하는 마지막 방어선이다.
 */
const STATUS_FALLBACKS: Record<number, string> = {
  400: '요청 내용을 다시 확인해 주세요.',
  401: '로그인이 필요합니다.',
  403: '권한이 없습니다.',
  404: '요청하신 정보를 찾을 수 없습니다.',
  408: '요청 시간이 초과되었습니다. 다시 시도해 주세요.',
  409: '이미 처리된 요청이에요.',
  413: '파일 용량이 너무 큽니다.',
  422: '입력값을 다시 확인해 주세요.',
  429: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
};

export function fallbackMessage(status: number): string {
  if (STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status];
  if (status >= 500) return '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/**
 * 서버 오류 문구를 꺼낸다.
 *
 * 이 저장소의 API 라우트는 압도적으로 `json({ error })` 형태다(`{ message }`는
 * 소수). 예전에는 `error.message`만 읽어서 거의 모든 한국어 문구가 버려지고
 * `HTTP 403` 같은 문자열이 사용자에게 그대로 보였다.
 */
export function pickServerMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const candidate = body as { error?: unknown; message?: unknown };
  for (const value of [candidate.error, candidate.message]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      const nested = (value as { message?: unknown }).message;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }
  return null;
}

type UnauthorizedListener = () => void;

class ApiClient {
  private baseUrl: string;
  private unauthorizedListeners = new Set<UnauthorizedListener>();

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * 세션 만료(토큰을 들고 보낸 요청의 401)를 구독한다. 구독 해제 함수를 돌려준다.
   *
   * `AuthContext`가 이걸 구독해 `user`를 비우고 비인증 스택으로 돌려보낸다.
   * 이 연결이 없으면 토큰이 지워져도 화면은 인증 스택에 남아, 모든 요청이
   * 실패하는데 로그인 화면으로 갈 길이 없는 상태가 된다.
   */
  onUnauthorized(listener: UnauthorizedListener): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  /**
   * 만료된 세션을 비우고 구독자에게 알린다.
   *
   * 사용자에게 보이는 문구는 서버 문구(`유효하지 않은 토큰입니다` 등)가 아니라
   * 항상 같은 안내로 고정한다. 화면마다 다른 말이 나오면 무엇을 해야 하는지가
   * 흐려진다.
   */
  private async handleSessionExpired(): Promise<never> {
    await this.clearTokens();
    for (const listener of [...this.unauthorizedListeners]) {
      try {
        listener();
      } catch {
        // 구독자 하나가 터져도 나머지 구독자와 오류 전달을 막지 않는다.
      }
    }
    throw new SessionExpiredError();
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

    // 토큰을 들고 보낸 401만 "세션 만료"다. 로그인·회원가입처럼 토큰 없이
    // 보낸 요청의 401은 서버 문구(`이메일 또는 비밀번호가 올바르지 않습니다`)를
    // 그대로 보여줘야 한다.
    if (response.status === 401 && token) {
      return this.handleSessionExpired();
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(pickServerMessage(body) ?? fallbackMessage(response.status));
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

    // 업로드도 `request()`와 같은 401 처리를 탄다. 예전에는 이 경로만 빠져 있어
    // 서류 제출(VerificationScreen)에서 만료 토큰이 기기에 그대로 남았다.
    if (response.status === 401 && token) {
      return this.handleSessionExpired();
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(pickServerMessage(body) ?? fallbackMessage(response.status));
    }
    return response.json();
  }
}

export const apiClient = new ApiClient();

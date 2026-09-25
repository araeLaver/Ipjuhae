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
 * 서버가 내려준 실패. `message`는 이미 사용자에게 보여도 되는 한국어다.
 *
 * `status`를 들고 다니는 이유: 화면이 "권한이 없어 못 본다"(403)와 "지금 못
 * 불러왔다"(네트워크·500)를 갈라 말해야 하는데, 문구만으로는 구분할 수 없다.
 * 예전에는 커뮤니티 화면이 모든 실패를 `이 게시판은 볼 수 없어요`로 덮어,
 * 비행기 모드도 "볼 수 없는 게시판"으로 읽혔다.
 *
 * 네트워크 자체가 끊긴 경우는 `fetch`가 던지므로 이 오류가 아니다 — 호출부는
 * `instanceof ApiError`로 "서버가 답은 했다"를 구분할 수 있다.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
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

/**
 * 401이 "세션 만료"가 아니라 "자격 증명 실패"인 요청들.
 *
 * 처음에는 "토큰을 들고 보낸 401만 만료"로 갈랐는데, 그러면 토큰이 이미
 * 비워진 뒤에 날아간 요청(복귀 시 재조회, 알림 토큰 정리)의 401이 복구
 * 경로를 타지 못했다. 실제로 `notificationService`의 정리 `DELETE`가
 * 그 구멍에 빠져 DOW-1117 회귀 테스트 3건이 깨졌다.
 *
 * 가르는 기준은 토큰 유무가 아니라 **요청의 성격**이다. 로그인·가입은
 * 401이 정상 응답이고, 그 문구(`이메일 또는 비밀번호가 올바르지 않습니다`)를
 * 그대로 보여줘야 한다. 로그아웃의 401은 이미 끝난 세션이라 알릴 것이 없다.
 */
const AUTH_ENTRY_POINTS = ['/auth/login', '/auth/signup', '/auth/register', '/auth/logout'];

function isAuthEntryPoint(url: string): boolean {
  const path = url.split('?')[0];
  return AUTH_ENTRY_POINTS.some((entry) => path === entry || path.startsWith(`${entry}/`));
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

    // 로그인·가입·로그아웃을 뺀 모든 401은 "세션 만료"다. 토큰 유무로 가르지
    // 않는 이유는 `AUTH_ENTRY_POINTS` 주석 참고.
    if (response.status === 401 && !isAuthEntryPoint(url)) {
      return this.handleSessionExpired();
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(
        pickServerMessage(body) ?? fallbackMessage(response.status),
        response.status
      );
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
    // 업로드 경로에 로그인·가입은 없으므로 401은 전부 세션 만료다.
    if (response.status === 401) {
      return this.handleSessionExpired();
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(
        pickServerMessage(body) ?? fallbackMessage(response.status),
        response.status
      );
    }
    return response.json();
  }
}

export const apiClient = new ApiClient();

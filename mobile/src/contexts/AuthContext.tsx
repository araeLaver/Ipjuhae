/**
 * Auth Context for Rentme Mobile
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, SESSION_EXPIRED_MESSAGE } from '../services/apiClient';
import * as api from '../services/api';
import { disableNotifications } from '../services/notificationService';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, userType: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** 세션이 끊겨 비인증 상태로 돌아왔을 때 보여줄 안내. 평소에는 null이다. */
  sessionExpiredMessage: string | null;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const dismissSessionExpired = useCallback(() => setSessionExpiredMessage(null), []);

  /**
   * 세션 만료(401)를 받으면 `user`를 비운다.
   *
   * `AppNavigator`가 `isAuthenticated`로 스택을 가르므로, 이 연결이 없으면
   * 토큰이 지워진 뒤에도 인증 스택에 남아 모든 화면이 실패만 하고 로그인으로
   * 갈 길이 없다(앱 강제 종료가 유일한 탈출구였다).
   */
  useEffect(
    () =>
      apiClient.onUnauthorized(() => {
        setUser(null);
        setSessionExpiredMessage(SESSION_EXPIRED_MESSAGE);
      }),
    []
  );

  const refreshUser = useCallback(async () => {
    try {
      const token = await apiClient.getToken();
      if (!token) {
        setUser(null);
        return;
      }
      // /api/auth/me wraps the user: { user: { id, email, name, userType } }
      const userData = await api.fetchMe();
      setUser(userData);
    } catch {
      setUser(null);
      await apiClient.clearTokens();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshUser();
      setIsLoading(false);
    })();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    // /api/auth/login returns { success, userId, token, user: { user_type } } —
    // the embedded user is partial, so fetch the full user from /auth/me.
    const token = await api.login(email, password);
    await apiClient.setTokens(token);
    setUser(await api.fetchMe());
    setSessionExpiredMessage(null);
  };

  const register = async (email: string, password: string, _name: string, userType: string) => {
    // /api/auth/signup only accepts email/password/userType (name is set later
    // via the profile flow) and returns { success, userId, token, userType }.
    const token = await api.signup(email, password, userType);
    await apiClient.setTokens(token);
    setUser(await api.fetchMe());
    setSessionExpiredMessage(null);
  };

  const logout = async () => {
    try {
      // 인증 token을 지우기 전에 현재 계정의 push token을 해제한다.
      await disableNotifications().catch(() => undefined);
      // 서버 로그아웃이 실패해도(세션이 이미 죽었거나 오프라인) 로그아웃은
      // 진행한다. 여기서 던지면 호출부에 catch가 없어 그대로 미처리 거부가
      // 되는데, 정작 아래 `finally`에서 기기 쪽 로그아웃은 이미 끝난 뒤다.
      await api.logout().catch(() => undefined);
    } finally {
      await apiClient.clearTokens();
      setUser(null);
      // 스스로 로그아웃한 사람에게 "세션이 만료되었습니다"를 띄우지 않는다.
      // `/auth/logout`은 `AUTH_ENTRY_POINTS`라 401이어도 만료 구독자를 켜지
      // 않지만, 로그아웃 직전에 날아간 다른 요청이 켜 놓았을 수 있다.
      setSessionExpiredMessage(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        sessionExpiredMessage,
        dismissSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

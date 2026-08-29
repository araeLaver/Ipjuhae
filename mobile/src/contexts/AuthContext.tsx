/**
 * Auth Context for Rentme Mobile
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import * as api from '../services/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, userType: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  };

  const register = async (email: string, password: string, _name: string, userType: string) => {
    // /api/auth/signup only accepts email/password/userType (name is set later
    // via the profile flow) and returns { success, userId, token, userType }.
    const token = await api.signup(email, password, userType);
    await apiClient.setTokens(token);
    setUser(await api.fetchMe());
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      await apiClient.clearTokens();
      setUser(null);
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

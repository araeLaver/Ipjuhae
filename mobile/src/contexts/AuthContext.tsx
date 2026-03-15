/**
 * Auth Context for Rentme Mobile
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
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
      const userData = await apiClient.get<User>('/auth/me');
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
    const response = await apiClient.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    await apiClient.setTokens(response.token);
    setUser(response.user);
  };

  const register = async (email: string, password: string, name: string, userType: string) => {
    const response = await apiClient.post<{ token: string; user: User }>('/auth/signup', {
      email,
      password,
      name,
      userType,
    });
    await apiClient.setTokens(response.token);
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
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

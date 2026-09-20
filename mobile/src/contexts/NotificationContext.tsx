import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import {
  disableNotifications,
  enableNotifications,
  initializeNotifications,
  PushState,
} from '../services/notificationService';

interface NotificationContextType extends PushState {
  isLoading: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const initialState: PushState = {
  enabled: false,
  permission: 'undetermined',
  tokenRegistered: false,
  error: null,
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<PushState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setState(await initializeNotifications(isAuthenticated));
    setIsLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthLoading) return;
    void refresh();
  }, [isAuthLoading, isAuthenticated, refresh]);

  // 알림 권한은 기기 설정에서 앱 밖으로 바뀐다. 앱이 다시 앞으로 나올 때 상태를
  // 다시 맞추지 않으면, 사용자가 권한을 끄고 돌아와도 화면은 켜진 것으로 남는다.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const previous = appStateRef.current;
      appStateRef.current = next;
      if (previous !== 'active' && next === 'active' && !isAuthLoading) {
        void refresh();
      }
    });
    return () => subscription.remove();
  }, [isAuthLoading, refresh]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    setIsLoading(true);
    setState(enabled ? await enableNotifications() : await disableNotifications());
    setIsLoading(false);
  }, []);

  return (
    <NotificationContext.Provider value={{ ...state, isLoading, setEnabled, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}

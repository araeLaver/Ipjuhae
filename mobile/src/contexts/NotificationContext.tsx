import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

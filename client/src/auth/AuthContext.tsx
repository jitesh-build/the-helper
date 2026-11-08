import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from '../api';
import type { AuthResponse, Profile } from '../types';
import { useToast } from '../toast/ToastContext';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    api.onUnauthorized(() => {
      logout();
      toast.info('Your session expired. Please log in again.');
    });
    return () => api.onUnauthorized(null);
  }, [logout, toast]);

  useEffect(() => {
    if (!api.getToken()) {
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then(setUser)
      .catch((e: unknown) => {
        // a 401 is already handled (token cleared) by onUnauthorized; anything else keeps the token
        if (!(e instanceof api.ApiError && e.status === 401)) {
          toast.error(`Couldn't reach the server: ${api.errorMessage(e)} Reload the page to try again.`);
        }
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const finish = useCallback((r: AuthResponse) => {
    api.setToken(r.token);
    setUser(r.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      finish(await api.login(email, password));
    },
    [finish],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      finish(await api.register(name, email, password));
    },
    [finish],
  );

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
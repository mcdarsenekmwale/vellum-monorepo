import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from '../lib/api';
import type { User } from '@vellbase/api-client/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, name: string, handle: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      // Prefer cached user in SecureStore (fast-path) then refresh with /me.
      const cachedUser = await apiClient.getCurrentUser();
      if (cachedUser) {
        setUser(cachedUser);
        setIsAuthenticated(true);
      }
      // Always try a network refresh to catch revoked tokens / updated profiles.
      const freshUser = await apiClient.getMe();
      setUser(freshUser);
      setIsAuthenticated(true);
      await apiClient.setCurrentUser(freshUser);
    } catch {
      // Token expired, missing, or server unreachable. Treat as signed-out.
      // onAuthError callback in lib/api already initiates the login redirect.
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.login({ email, password });
    setUser(response.user);
    setIsAuthenticated(true);
    return response;
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, handle: string) => {
    // apiClient.register already writes tokens + cached user to storage.
    // We MUST also set React state here so the UI transitions to authenticated
    // without requiring a second roundtrip login() call.
    const response = await apiClient.register({ email, password, name, handle });
    setUser(response.user);
    setIsAuthenticated(true);
    return response;
  }, []);

  const logout = useCallback(async () => {
    let firstError: unknown;
    try {
      await apiClient.logout();
    } catch (err) {
      firstError = err;
    }
    // Always wipe client state — even if server logout fails (e.g. token
    // already invalid or network down), the user chose to sign out.
    setUser(null);
    setIsAuthenticated(false);
    if (firstError) throw firstError;
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await apiClient.getMe();
    setUser(me);
    await apiClient.setCurrentUser(me);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

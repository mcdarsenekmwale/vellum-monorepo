import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from '../lib/api';
import type { User } from '../packages/api-client/src/types/index';

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
      const currentUser = await apiClient.getCurrentUser();
      if (currentUser) {
        const me = await apiClient.getMe();
        setUser(me);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
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
    const response = await apiClient.register({ email, password, name, handle });
    return response;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiClient.getMe();
      setUser(me);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
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

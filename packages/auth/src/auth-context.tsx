import React, { createContext, useContext, useState, useEffect, useCallback, type JSX } from 'react';
import { ApiClient } from '@vellum/api-client';
import type { User, AuthResponse } from '@vellum/api-client';

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, handle: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export interface AuthProviderProps {
  apiClient: ApiClient;
  children: React.ReactNode;
}

export function AuthProvider({ apiClient, children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUser = await apiClient.getCurrentUser();
        if (storedUser) {
          const currentUser = await apiClient.getMe();
          setUser(currentUser);
        }
      } catch {
        await apiClient.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [apiClient]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.login({ email, password });
    setUser(response.user);
  }, [apiClient]);

  const register = useCallback(async (email: string, password: string, handle: string, name: string) => {
    const response = await apiClient.register({ email, password, handle, name });
    setUser(response.user);
  }, [apiClient]);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
  }, [apiClient]);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await apiClient.getMe();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }, [apiClient]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function hasRole(user: User | null, role: User['role']): boolean {
  if (!user) return false;
  const roleHierarchy: Record<User['role'], User['role'][]> = {
    ADMIN: ['ADMIN', 'MODERATOR', 'CREATOR', 'USER', 'GUEST'],
    MODERATOR: ['MODERATOR', 'CREATOR', 'USER', 'GUEST'],
    CREATOR: ['CREATOR', 'USER', 'GUEST'],
    USER: ['USER', 'GUEST'],
    GUEST: ['GUEST'],
  };
  return roleHierarchy[user.role]?.includes(role) ?? false;
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, 'ADMIN');
}

export function isModerator(user: User | null): boolean {
  return hasRole(user, 'MODERATOR');
}

export function isCreator(user: User | null): boolean {
  return hasRole(user, 'CREATOR');
}

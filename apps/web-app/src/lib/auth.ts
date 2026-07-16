import { redirect } from '@tanstack/react-router';
import { apiClient } from './api';

export async function requireAuth(locationPath?: string) {
  try {
    const user = await apiClient.getCurrentUser();
    if (!user) {
      const redirectPath = locationPath || '/';
      throw redirect({ 
        to: '/login', 
        search: { redirect: redirectPath } 
      });
    }
    return user;
  } catch (err) {
    const redirectPath = locationPath || '/';
    throw redirect({ 
      to: '/login', 
      search: { redirect: redirectPath } 
    });
  }
}

export async function optionalAuth() {
  try {
    return await apiClient.getCurrentUser();
  } catch {
    return null;
  }
}

export function getRedirectUrl(search: Record<string, string>): string {
  const redirectUrl = search?.redirect || '/';
  if (!redirectUrl.startsWith('/')) {
    return '/';
  }
  const allowedPaths = [
    '/', '/profile', '/profile/edit', '/settings', '/settings/about', 
    '/settings/privacy', '/settings/language', '/settings/help',
    '/compose', '/saved', '/notifications', '/highlights',
  ];
  if (allowedPaths.includes(redirectUrl) || redirectUrl.startsWith('/article/')) {
    return redirectUrl;
  }
  return '/';
}
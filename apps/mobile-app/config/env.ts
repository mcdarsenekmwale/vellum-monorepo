/**
 * Environment configuration for the mobile app.
 *
 * Expo automatically loads .env in dev mode and .env.production in builds.
 * Variables must be prefixed with EXPO_PUBLIC_ to be available in client code.
 * The __DEV__ global is true during development and false in production builds.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_BASE_URL from environment file (highest)
 * 2. Auto-detect based on __DEV__ flag
 */

declare const __DEV__: boolean;

const PROD_API_URL = 'https://cmrfcrfjq1g65wfdvx0g77d3v.ewr.prisma.build';
const DEV_API_URL = 'http://localhost:3001';

export const apiBaseUrl: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (__DEV__ ? DEV_API_URL : PROD_API_URL);

export const isDevelopment: boolean = __DEV__;
export const isProduction: boolean = !__DEV__;

export const environment = {
  apiBaseUrl,
  isDevelopment,
  isProduction,
} as const;

/**
 * Environment configuration for the web app.
 *
 * Vite automatically loads .env in dev mode and .env.production in builds.
 * The import.meta.env.DEV flag is true during development and false in production.
 *
 * Priority:
 * 1. VITE_API_BASE_URL from environment file (highest)
 * 2. Auto-detect based on Vite's DEV flag
 */

const PROD_API_URL = 'https://x6f90klu3dvfsyiudrvzkh6i.ewr.prisma.build';
const DEV_API_URL = 'http://localhost:3001';

export const apiBaseUrl: string =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? DEV_API_URL : PROD_API_URL);

export const isDevelopment: boolean = import.meta.env.DEV;
export const isProduction: boolean = import.meta.env.PROD;

export const environment = {
  apiBaseUrl,
  isDevelopment,
  isProduction,
} as const;

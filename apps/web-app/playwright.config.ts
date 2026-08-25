import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the @vellbase/web-app i18n smoke tests.
 *
 * The Vite dev server (see vite.config.ts) runs on port 3000.
 * Set WEB_APP_URL to point at a different environment (e.g. preview build).
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.WEB_APP_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

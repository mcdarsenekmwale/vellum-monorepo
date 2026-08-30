/* Playwright config dedicated to axe-core a11y scans (Sub-D Task 5) */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/axe-d",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "line",
  timeout: 600_000,
  use: {
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true,
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/ai-component-t9.spec.ts", "**/activity-t9.spec.ts", "**/expanded-d.spec.ts"],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "line",
  timeout: 240_000,
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

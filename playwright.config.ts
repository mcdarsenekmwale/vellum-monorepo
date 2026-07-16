import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: "list",

  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 60000,
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "npm run dev:api",
      url: "http://localhost:3001/api/health",
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: "npm run dev:web",
      url: "http://localhost:3000",
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: "npm run dev:admin",
      url: "http://localhost:3002",
      timeout: 120000,
      reuseExistingServer: true,
    },
  ],
});

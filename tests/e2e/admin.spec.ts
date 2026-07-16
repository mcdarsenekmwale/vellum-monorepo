import { expect } from "@playwright/test";
import { test, assertClean } from "./helpers";

const ADMIN_ORIGIN = "http://localhost:3002";

const SIDEBAR_PATHS = [
  "/users",
  "/articles",
  "/posts",
  "/videos",
  "/reports",
  "/analytics",
  "/settings",
  "/audit",
  "/help",
  "/notifications",
];

test.describe("admin-dashboard navigation", () => {
  test("login navigates to dashboard without errors", async ({ page, collector }) => {
    await page.goto(`${ADMIN_ORIGIN}/auth/login`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[id="email"]')).toBeVisible({ timeout: 10000 });

    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${ADMIN_ORIGIN}/dashboard`, { timeout: 15000, waitUntil: "domcontentloaded" });
    
    await expect(page.locator('text=/dashboard/i').first()).toBeVisible();
    assertClean(collector);
  });

  test("sidebar links navigate without console errors or failed API requests", async ({ page, collector }) => {
    await page.goto(`${ADMIN_ORIGIN}/auth/login`, { waitUntil: "domcontentloaded" });
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${ADMIN_ORIGIN}/dashboard`, { timeout: 15000, waitUntil: "domcontentloaded" });

    for (const path of SIDEBAR_PATHS) {
      await page.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      assertClean(collector);
    }
  });

  test("logout returns to login page", async ({ page, collector }) => {
    await page.goto(`${ADMIN_ORIGIN}/auth/login`, { waitUntil: "domcontentloaded" });
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${ADMIN_ORIGIN}/dashboard`, { timeout: 15000, waitUntil: "domcontentloaded" });

    const userMenu = page.locator('[data-sidebar="footer"] button, aside button').first();
    await userMenu.click();

    const signOut = page.locator('text=/sign out/i').first();
    await expect(signOut).toBeVisible();
    await signOut.click();

    await page.waitForURL(/\/auth\/login/, { timeout: 15000, waitUntil: "domcontentloaded" });
    await expect(page.locator('input[id="email"]')).toBeVisible();
    assertClean(collector);
  });
});

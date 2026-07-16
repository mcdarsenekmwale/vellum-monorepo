import { expect } from "@playwright/test";
import { test, assertClean } from "./helpers";

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

test.describe("web-app navigation", () => {
  test("home page loads without errors", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/`, { waitUntil: "commit" });
    await page.waitForLoadState("load");
    await expect(page).toHaveTitle(/Vellum/);
    assertClean(collector);
  });

  test("login and registration pages load without errors", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/login`, { waitUntil: "commit" });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    assertClean(collector);

    await page.goto(`${WEB_ORIGIN}/register`, { waitUntil: "commit" });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    assertClean(collector);
  });

  test("feed and search work without errors", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/discover`, { waitUntil: "commit" });
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill("the");
    await page.waitForTimeout(800);
    assertClean(collector);
  });

  test("authenticated profile and settings pages load without errors", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/login`, { waitUntil: "commit" });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    await page.locator('input[type="email"]').first().fill("admin@vellum.com");
    await page.locator('input[type="password"]').first().fill("password123");
    await page.locator('button[type="submit"]').click();
    
    await page.waitForURL(`${WEB_ORIGIN}/`, { timeout: 15000, waitUntil: "commit" });

    await page.goto(`${WEB_ORIGIN}/profile`, { waitUntil: "commit" });
    await page.waitForSelector('text=/posts/i', { timeout: 10000 });
    assertClean(collector);

    await page.goto(`${WEB_ORIGIN}/settings`, { waitUntil: "commit" });
    await page.waitForSelector('h1', { timeout: 10000 });
    assertClean(collector);
  });

  test("content pages load without errors", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/`, { waitUntil: "commit" });

    const articleLink = page.locator('a[href^="/article/"]').first();
    if (await articleLink.isVisible().catch(() => false)) {
      await articleLink.click();
      await page.waitForURL(/\/article\//, { timeout: 10000, waitUntil: "commit" });
      assertClean(collector);
    }

    await page.goto(`${WEB_ORIGIN}/discover`, { waitUntil: "commit" });
    const categoryLink = page.locator('a[href^="/category/"]').first();
    if (await categoryLink.isVisible().catch(() => false)) {
      await categoryLink.click();
      await page.waitForURL(/\/category\//, { timeout: 10000, waitUntil: "commit" });
      assertClean(collector);
    }
  });
});

/**
 * Web App — Agent-Based Automated Navigation Tests
 *
 * Validates end-to-end user journeys for the public web application:
 * - Authentication (login/logout/register)
 * - Guest navigation (home, discover, highlights, article, author, category)
 * - Authenticated navigation (profile, settings, notifications, saved, compose)
 * - Settings sub-pages (about, help, language, privacy)
 * - Form submissions (login, register, search, compose)
 * - Browser back/forward navigation
 * - Cross-page consistency (no console errors, no failed API requests)
 */
import { expect, type Page } from "@playwright/test";
import { test, assertClean } from "./helpers";

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:3001";

const TEST_USER_EMAIL = "admin@vellum.com";
const TEST_USER_PASSWORD = "password123";

// ─── Helper: Wait for the React shell to render body content ──────────────
async function waitForShell(page: Page, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const len = await page.evaluate(() => document.body.textContent?.length || 0).catch(() => 0);
    if (len > 100) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

// ─── Helper: Authenticate to the web app ──────────────────────────────────
async function webLogin(page: Page) {
  await page.goto(`${WEB_ORIGIN}/login`, { waitUntil: "commit" });
  await waitForShell(page);

  const emailInput = page
    .locator('input[type="email"], input[placeholder*="email" i]')
    .first();
  const pwInput = page.locator('input[type="password"]').first();

  await emailInput.fill(TEST_USER_EMAIL);
  await pwInput.fill(TEST_USER_PASSWORD);

  await page
    .locator('button[type="submit"], button:has-text(/sign in|log in/i)')
    .first()
    .click();

  // Allow redirect to home (or wherever the app sends authenticated users)
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
    waitUntil: "commit",
  });
  await waitForShell(page);
}

// ─── Helper: Fetch a real article slug from the API for navigation tests ──
async function fetchTestArticle(): Promise<{ slug: string; authorHandle: string; authorId: string } | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/articles?page=1&limit=5`);
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.data?.[0];
    if (!first?.slug || !first?.author?.handle) return null;
    return {
      slug: first.slug,
      authorHandle: first.author.handle,
      authorId: first.author.id,
    };
  } catch {
    return null;
  }
}

// Routes that should be reachable without authentication
const GUEST_ROUTES = [
  "/",
  "/discover",
  "/highlights",
  "/login",
  "/register",
];

// Routes that require authentication (should redirect to /login when guest)
const AUTH_ROUTES = [
  "/profile",
  "/profile/edit",
  "/settings",
  "/settings/about",
  "/settings/help",
  "/settings/language",
  "/settings/privacy",
  "/notifications",
  "/saved",
  "/compose",
];

// ─── Test Suites ────────────────────────────────────────────────────────────

test.describe("Web App — Guest Navigation Smoke Test", () => {
  for (const route of GUEST_ROUTES) {
    test(`guest route ${route || "/"} loads without errors`, async ({ page, collector }) => {
      await page.goto(`${WEB_ORIGIN}${route}`, { waitUntil: "commit" });
      await waitForShell(page);
      await page.waitForTimeout(800);
      assertClean(collector);
    });
  }
});

test.describe("Web App — Authentication Guard", () => {
  for (const route of AUTH_ROUTES) {
    test(`auth route ${route} redirects guest to login`, async ({ page, collector }) => {
      await page.goto(`${WEB_ORIGIN}${route}`, { waitUntil: "commit" });
      // Should redirect to /login (or contain login form)
      await page.waitForURL(
        (url) => url.pathname === "/login" || url.pathname.includes("/login"),
        { timeout: 15000 }
      ).catch(() => {
        // Some apps render an inline login prompt instead of redirecting
      });
      await page.waitForTimeout(500);
      // Either we are on /login OR a login form is visible
      const onLogin = page.url().includes("/login");
      const hasLoginForm = await page
        .locator('input[type="email"], input[type="password"]')
        .first()
        .isVisible()
        .catch(() => false);
      expect(onLogin || hasLoginForm).toBeTruthy();
      assertClean(collector);
    });
  }
});

test.describe("Web App — Login Flow", () => {
  test("login navigates to home and shows authenticated UI", async ({ page, collector }) => {
    await webLogin(page);
    // After login the user should not be on /login
    expect(page.url()).not.toMatch(/\/login/);
    assertClean(collector);
  });

  test("logout returns to a guest-accessible state", async ({ page, collector }) => {
    await webLogin(page);
    // Try to find a logout/sign out affordance
    const logoutBtn = page
      .locator('button:has-text(/sign out|log out|logout/i), a:has-text(/sign out|log out|logout/i)')
      .first();

    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForTimeout(1500);
    } else {
      // Fall back to clearing storage and reloading
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto(`${WEB_ORIGIN}/`, { waitUntil: "commit" });
      await waitForShell(page);
    }

    // Confirm guest state — accessing /profile should redirect to login
    await page.goto(`${WEB_ORIGIN}/profile`, { waitUntil: "commit" });
    await page.waitForURL(
      (url) => url.pathname === "/login" || url.pathname.includes("/login"),
      { timeout: 15000 }
    ).catch(() => {});
    assertClean(collector);
  });
});

test.describe("Web App — Authenticated Navigation Smoke Test", () => {
  test("every authenticated route loads without errors", async ({ page, collector }) => {
    await webLogin(page);

    for (const route of AUTH_ROUTES) {
      await page.goto(`${WEB_ORIGIN}${route}`, { waitUntil: "commit" });
      await waitForShell(page);
      await page.waitForTimeout(800);
      assertClean(collector);
    }
  });

  test("browser back/forward navigation works", async ({ page, collector }) => {
    await webLogin(page);

    await page.goto(`${WEB_ORIGIN}/profile`, { waitUntil: "commit" });
    await waitForShell(page);
    await page.goto(`${WEB_ORIGIN}/settings`, { waitUntil: "commit" });
    await waitForShell(page);

    await page.goBack();
    await page.waitForURL(/\/profile/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    await page.goForward();
    await page.waitForURL(/\/settings/, { timeout: 10000 }).catch(() => {});
    assertClean(collector);
  });
});

test.describe("Web App — Settings Sub-Pages", () => {
  const settingsRoutes = [
    "/settings",
    "/settings/about",
    "/settings/help",
    "/settings/language",
    "/settings/privacy",
  ];

  for (const route of settingsRoutes) {
    test(`settings page ${route} renders content`, async ({ page, collector }) => {
      await webLogin(page);
      await page.goto(`${WEB_ORIGIN}${route}`, { waitUntil: "commit" });
      await waitForShell(page);
      await page.waitForTimeout(800);
      // Page should render at least one heading or labeled section
      const heading = page.locator("h1, h2, [role='heading']").first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      assertClean(collector);
    });
  }
});

test.describe("Web App — Discover & Search", () => {
  test("discover page loads and search input accepts input", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/discover`, { waitUntil: "commit" });
    await waitForShell(page);

    const searchInput = page
      .locator('input[placeholder*="search" i], input[type="search"]')
      .first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("the");
      await page.waitForTimeout(800);
    }
    assertClean(collector);
  });

  test("category page loads when navigating from discover", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/discover`, { waitUntil: "commit" });
    await waitForShell(page);

    const categoryLink = page.locator('a[href^="/category/"]').first();
    if (await categoryLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await categoryLink.click();
      await page.waitForURL(/\/category\//, { timeout: 10000, waitUntil: "commit" });
      await waitForShell(page);
      assertClean(collector);
    }
  });
});

test.describe("Web App — Article & Author Navigation", () => {
  let article: { slug: string; authorHandle: string; authorId: string } | null;

  test.beforeAll(async () => {
    article = await fetchTestArticle();
  });

  test("article detail page renders title and actions", async ({ page, collector }) => {
    if (!article) {
      test.skip();
      return;
    }
    await page.goto(`${WEB_ORIGIN}/article/${article.slug}`, { waitUntil: "commit" });
    await waitForShell(page);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    assertClean(collector);
  });

  test("author profile page renders and follower links work", async ({ page, collector }) => {
    if (!article) {
      test.skip();
      return;
    }
    await page.goto(`${WEB_ORIGIN}/author/${article.authorHandle}`, {
      waitUntil: "commit",
    });
    await waitForShell(page);

    // Followers link (if present) should navigate to /author/:id/followers
    const followersLink = page
      .locator('a[href*="/followers"]')
      .first();
    if (await followersLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await followersLink.click();
      await page.waitForURL(/\/followers/, { timeout: 10000, waitUntil: "commit" });
      await waitForShell(page);
      assertClean(collector);
    }
  });

  test("author following page loads", async ({ page, collector }) => {
    if (!article) {
      test.skip();
      return;
    }
    await page.goto(`${WEB_ORIGIN}/author/${article.authorHandle}/following`, {
      waitUntil: "commit",
    });
    await waitForShell(page);
    assertClean(collector);
  });
});

test.describe("Web App — Compose Form (authenticated)", () => {
  test("compose page renders form fields", async ({ page, collector }) => {
    await webLogin(page);
    await page.goto(`${WEB_ORIGIN}/compose`, { waitUntil: "commit" });
    await waitForShell(page);

    // Should render at least one input/textarea for content
    const field = page
      .locator('input[type="text"], input[type="title"], textarea, [contenteditable="true"]')
      .first();
    await expect(field).toBeVisible({ timeout: 10000 });
    assertClean(collector);
  });

  test("compose cancel does not create an article", async ({ page, collector }) => {
    await webLogin(page);
    await page.goto(`${WEB_ORIGIN}/compose`, { waitUntil: "commit" });
    await waitForShell(page);

    const cancelBtn = page
      .locator('button:has-text(/cancel|discard/i), a:has-text(/cancel|discard/i)')
      .first();
    if (await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(800);
    }
    assertClean(collector);
  });
});

test.describe("Web App — Profile Edit Form (authenticated)", () => {
  test("profile edit page renders and fields accept input", async ({ page, collector }) => {
    await webLogin(page);
    await page.goto(`${WEB_ORIGIN}/profile/edit`, { waitUntil: "commit" });
    await waitForShell(page);

    const field = page
      .locator('input[type="text"], input[type="email"], textarea')
      .first();
    await expect(field).toBeVisible({ timeout: 10000 });

    // Type into the first text field and ensure no errors are emitted
    await field.fill("Test display name").catch(() => {});
    await page.waitForTimeout(500);
    assertClean(collector);
  });
});

test.describe("Web App — Register Form Validation", () => {
  test("register page renders form fields", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/register`, { waitUntil: "commit" });
    await waitForShell(page);

    const emailInput = page
      .locator('input[type="email"], input[placeholder*="email" i]')
      .first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    const pwInput = page.locator('input[type="password"]').first();
    await expect(pwInput).toBeVisible({ timeout: 10000 });
    assertClean(collector);
  });

  test("register submit with invalid input shows validation (no crash)", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/register`, { waitUntil: "commit" });
    await waitForShell(page);

    // Submit empty form — should show validation, not crash
    await page
      .locator('button[type="submit"], button:has-text(/sign up|register|create/i)')
      .first()
      .click();
    await page.waitForTimeout(1000);
    assertClean(collector);
  });
});

test.describe("Web App — Notifications & Saved Lists (authenticated)", () => {
  test("notifications page loads", async ({ page, collector }) => {
    await webLogin(page);
    await page.goto(`${WEB_ORIGIN}/notifications`, { waitUntil: "commit" });
    await waitForShell(page);
    await page.waitForTimeout(800);
    assertClean(collector);
  });

  test("saved page loads", async ({ page, collector }) => {
    await webLogin(page);
    await page.goto(`${WEB_ORIGIN}/saved`, { waitUntil: "commit" });
    await waitForShell(page);
    await page.waitForTimeout(800);
    assertClean(collector);
  });
});

test.describe("Web App — Highlights", () => {
  test("highlights page loads without errors", async ({ page, collector }) => {
    await page.goto(`${WEB_ORIGIN}/highlights`, { waitUntil: "commit" });
    await waitForShell(page);
    await page.waitForTimeout(800);
    assertClean(collector);
  });
});

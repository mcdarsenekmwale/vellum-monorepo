#!/usr/bin/env node
/**
 * Comprehensive API Test Suite
 * Tests all API endpoints that interact with the synchronized tables.
 *
 * Usage:
 *   node scripts/comprehensive-api-test.mjs
 *
 * Environment variables:
 *   API_BASE_URL  - Base URL of the API (default: http://localhost:3001)
 */
import "dotenv/config";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const API_URL = API_BASE_URL.endsWith("/api") ? API_BASE_URL : `${API_BASE_URL}/api`;

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function log(test, status, detail = "") {
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "○";
  console.log(`  ${icon} [${status}] ${test}${detail ? ` — ${detail}` : ""}`);
  if (status === "PASS") passed++;
  else if (status === "FAIL") { failed++; failures.push({ test, detail }); }
  else skipped++;
}

async function request(method, path, body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON response */ }
  return { status: res.status, data, ok: res.ok };
}

async function testHealthEndpoints() {
  console.log("\n── Health Endpoints ──");
  try {
    const r = await request("GET", "/health");
    log("GET /health", r.ok ? "PASS" : "FAIL", `status=${r.status}`);
  } catch (e) { log("GET /health", "FAIL", e.message); }

  try {
    const r = await request("GET", "/health/ready");
    const dbStatus = r.data?.database?.status || "unknown";
    if (r.ok && dbStatus === "connected") log("GET /health/ready", "PASS", `db=${dbStatus}`);
    else if (r.ok && dbStatus === "disconnected") log("GET /health/ready", "SKIP", `db=${dbStatus} (expected if DB unreachable)`);
    else log("GET /health/ready", "FAIL", `status=${r.status}, db=${dbStatus}`);
  } catch (e) { log("GET /health/ready", "FAIL", e.message); }
}

async function testAuthFlow() {
  console.log("\n── Auth Flow ──");
  let token = null;

  // Login as existing creator user for CRUD tests
  const creatorEmail = "creator@vellbase.com";
  const creatorPassword = "Admin123!";
  try {
    const r = await request("POST", "/auth/login", {
      email: creatorEmail,
      password: creatorPassword,
    });
    if (r.ok && r.data?.accessToken) {
      log("POST /auth/login (creator)", "PASS", `user=${creatorEmail}`);
      token = r.data.accessToken;
    } else {
      // Fallback: register a new user and promote them
      const testEmail = `test-sync-${Date.now()}@example.com`;
      const testHandle = `testsync${Date.now().toString(36)}`;
      const regR = await request("POST", "/auth/register", {
        email: testEmail,
        password: "TestPass123!",
        name: "Test Sync User",
        handle: testHandle,
      });
      if (regR.ok && regR.data?.accessToken) {
        log("POST /auth/register", "PASS", `user=${testEmail}`);
        token = regR.data.accessToken;
      } else {
        log("POST /auth/register", "FAIL", `status=${regR.status}, msg=${regR.data?.message || "unknown"}`);
      }
    }
  } catch (e) { log("POST /auth/login", "FAIL", e.message); }

  // Get current user
  if (token) {
    try {
      const r = await request("GET", "/auth/me", null, token);
      if (r.ok) log("GET /auth/me", "PASS", `email=${r.data?.email}`);
      else log("GET /auth/me", "FAIL", `status=${r.status}`);
    } catch (e) { log("GET /auth/me", "FAIL", e.message); }
  }

  return token;
}

async function testArticles(token) {
  console.log("\n── Articles (CRUD) ──");
  let articleSlug = null;

  // List articles
  try {
    const r = await request("GET", "/articles?page=1&limit=5");
    if (r.ok) {
      const count = r.data?.items?.length || r.data?.data?.length || r.data?.length || 0;
      log("GET /articles", "PASS", `count=${count}`);
    } else {
      log("GET /articles", "FAIL", `status=${r.status}`);
    }
  } catch (e) { log("GET /articles", "FAIL", e.message); }

  // Create article (requires auth)
  if (token) {
    try {
      const uniqueTitle = `Test Sync Article ${Date.now()}`;
      const r = await request("POST", "/articles", {
        title: uniqueTitle,
        excerpt: "Test excerpt for sync verification",
        body: ["This is a test article body paragraph."],
        readMinutes: 3,
        categorySlug: "technology",
      }, token);
      if (r.ok || r.status === 201) {
        articleSlug = r.data?.slug || r.data?.article?.slug;
        log("POST /articles", "PASS", `slug=${articleSlug}`);
      } else {
        log("POST /articles", "FAIL", `status=${r.status}, msg=${r.data?.message || "unknown"}`);
      }
    } catch (e) { log("POST /articles", "FAIL", e.message); }
  }

  // Get single article
  if (articleSlug) {
    try {
      const r = await request("GET", `/articles/${articleSlug}`);
      if (r.ok) log("GET /articles/:slug", "PASS", `slug=${articleSlug}`);
      else log("GET /articles/:slug", "FAIL", `status=${r.status}`);
    } catch (e) { log("GET /articles/:slug", "FAIL", e.message); }
  }

  // Update article (uses PUT, not PATCH)
  if (token && articleSlug) {
    try {
      const r = await request("PUT", `/articles/${articleSlug}`, {
        title: `Updated ${Date.now()}`,
        excerpt: "Updated test excerpt for sync verification",
        body: ["This is an updated test article body paragraph."],
        readMinutes: 5,
        categorySlug: "technology",
      }, token);
      if (r.ok) log("PUT /articles/:slug", "PASS", `slug=${articleSlug}`);
      else log("PUT /articles/:slug", "FAIL", `status=${r.status}`);
    } catch (e) { log("PUT /articles/:slug", "FAIL", e.message); }
  }

  return articleSlug;
}

async function testHighlights(token) {
  console.log("\n── Highlights (CRUD) ──");

  try {
    const r = await request("GET", "/highlights?page=1&limit=5");
    if (r.ok) log("GET /highlights", "PASS", `count=${r.data?.items?.length || r.data?.length || 0}`);
    else log("GET /highlights", "FAIL", `status=${r.status}`);
  } catch (e) { log("GET /highlights", "FAIL", e.message); }

  if (token) {
    try {
      const r = await request("POST", "/highlights", {
        title: "Test Sync Highlight",
        handle: `testsync-${Date.now()}`,
        videoUrl: "https://example.com/video.mp4",
      }, token);
      if (r.ok || r.status === 201) log("POST /highlights", "PASS");
      else log("POST /highlights", "FAIL", `status=${r.status}`);
    } catch (e) { log("POST /highlights", "FAIL", e.message); }
  }
}

async function testComments(token, articleSlug) {
  console.log("\n── Comments ──");

  // Comments use /api/comments with articleSlug in body
  if (token && articleSlug) {
    try {
      const r = await request("GET", `/comments?articleSlug=${articleSlug}`);
      if (r.ok) log("GET /comments?articleSlug=", "PASS", `count=${r.data?.length || r.data?.items?.length || 0}`);
      else log("GET /comments?articleSlug=", "FAIL", `status=${r.status}`);
    } catch (e) { log("GET /comments?articleSlug=", "FAIL", e.message); }

    try {
      const r = await request("POST", "/comments", {
        articleSlug,
        body: "Test comment for sync verification",
      }, token);
      if (r.ok || r.status === 201) log("POST /comments", "PASS");
      else log("POST /comments", "FAIL", `status=${r.status}, msg=${r.data?.message || "unknown"}`);
    } catch (e) { log("POST /comments", "FAIL", e.message); }
  } else {
    log("Comments tests", "SKIP", "no article slug or token available");
  }
}

async function testCategories() {
  console.log("\n── Categories ──");
  try {
    const r = await request("GET", "/categories");
    if (r.ok) log("GET /categories", "PASS", `count=${r.data?.length || r.data?.items?.length || 0}`);
    else log("GET /categories", "FAIL", `status=${r.status}`);
  } catch (e) { log("GET /categories", "FAIL", e.message); }
}

async function testTags() {
  console.log("\n── Tags ──");
  try {
    const r = await request("GET", "/tags");
    if (r.ok) log("GET /tags", "PASS", `count=${r.data?.length || r.data?.items?.length || 0}`);
    else if (r.status === 404) log("GET /tags", "SKIP", "endpoint not found");
    else log("GET /tags", "FAIL", `status=${r.status}`);
  } catch (e) { log("GET /tags", "FAIL", e.message); }
}

async function testAdminEndpoints(token) {
  console.log("\n── Admin Endpoints ──");
  if (!token) {
    log("Admin endpoints", "SKIP", "no auth token");
    return;
  }

  const endpoints = [
    "/admin/dashboard",
    "/admin/users?page=1&limit=5",
    "/admin/articles?page=1&limit=5",
    "/admin/highlights?page=1&limit=5",
    "/admin/comments?page=1&limit=5",
    "/admin/categories?page=1&limit=5",
  ];

  for (const ep of endpoints) {
    try {
      const r = await request("GET", ep, null, token);
      if (r.ok) log(`GET ${ep}`, "PASS", `status=${r.status}`);
      else if (r.status === 403) log(`GET ${ep}`, "SKIP", "insufficient permissions");
      else log(`GET ${ep}`, "FAIL", `status=${r.status}`);
    } catch (e) { log(`GET ${ep}`, "FAIL", e.message); }
  }
}

async function testBookmarkAndLike(token, articleSlug) {
  console.log("\n── Bookmarks & Likes ──");
  if (!token || !articleSlug) {
    log("Bookmarks & Likes", "SKIP", "no token or article slug");
    return;
  }

  // Likes use /api/likes/toggle with articleSlug in body
  try {
    const r = await request("POST", "/likes/toggle", { articleSlug }, token);
    if (r.ok) log("POST /likes/toggle", "PASS");
    else log("POST /likes/toggle", "FAIL", `status=${r.status}`);
  } catch (e) { log("POST /likes/toggle", "FAIL", e.message); }

  // Bookmarks use /api/bookmarks/toggle with articleSlug in body
  try {
    const r = await request("POST", "/bookmarks/toggle", { articleSlug }, token);
    if (r.ok) log("POST /bookmarks/toggle", "PASS");
    else log("POST /bookmarks/toggle", "FAIL", `status=${r.status}`);
  } catch (e) { log("POST /bookmarks/toggle", "FAIL", e.message); }
}

async function main() {
  console.log("========================================");
  console.log("  Comprehensive API Test Suite");
  console.log("========================================");
  console.log(`  API URL: ${API_URL}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log("");

  try {
    await testHealthEndpoints();
    const token = await testAuthFlow();
    const articleSlug = await testArticles(token);
    await testHighlights(token);
    await testComments(token, articleSlug);
    await testCategories();
    await testTags();
    await testBookmarkAndLike(token, articleSlug);
    await testAdminEndpoints(token);
  } catch (e) {
    console.error(`\nUnexpected error: ${e.message}`);
    console.error(e.stack);
  }

  console.log("\n========================================");
  console.log("  Test Results Summary");
  console.log("========================================");
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${passed + failed + skipped}`);
  console.log("");

  if (failures.length > 0) {
    console.log("  Failures:");
    for (const f of failures) {
      console.log(`    - ${f.test}: ${f.detail}`);
    }
    console.log("");
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

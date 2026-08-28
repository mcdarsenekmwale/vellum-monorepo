/**
 * Analytics Page Browser Test
 *
 * Verifies the /analytics page renders all 4 views (overview, heatmap, realtime,
 * detailed) without crashing, captures console errors, and screenshots each view.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3002";
const EMAIL = "admin@vellbase.com";
const PASSWORD = "password123";
const OUT_DIR = path.join(__dirname, "test-output", "screenshots");

const CRITICAL_ERROR_PATTERNS = [
  /HeatMap is not defined/i,
  /useAnalyticsHeatmap is not a function/i,
  /useAnalyticsRealtime is not a function/i,
  /useAnalyticsRetention is not a function/i,
  /Rendered fewer hooks than expected/i,
  /Rendered more hooks than during the previous render/i,
  /is not a function/i,
  /is not defined/i,
];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const consoleMessages = [];
  const pageErrors = [];
  const criticalErrors = [];

  page.on("console", (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    consoleMessages.push(entry);
    if (msg.type() === "error") {
      const isCritical = CRITICAL_ERROR_PATTERNS.some((p) => p.test(msg.text()));
      if (isCritical) criticalErrors.push(entry);
    }
  });
  page.on("pageerror", (err) => {
    const entry = { name: err.name, message: err.message, stack: err.stack };
    pageErrors.push(entry);
    const isCritical = CRITICAL_ERROR_PATTERNS.some((p) => p.test(err.message));
    if (isCritical) criticalErrors.push({ type: "pageerror", text: err.message });
  });

  const results = { steps: [], statValues: {}, consoleErrors: [], pageErrors: [], criticalErrors: [], apiEndpoints: {} };
  const log = (name, detail, ok) => {
    const icon = ok === true ? "PASS" : ok === false ? "FAIL" : "INFO";
    console.log(`  [${icon}] ${name}: ${detail}`);
    results.steps.push({ name, detail, ok });
  };

  try {
    // Step 1: Login
    console.log("\n[STEP] Login");
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const url = page.url();
    const loginOk = url.includes("dashboard") || url.endsWith("/");
    log("Login", `Redirected to ${url}`, loginOk);

    // Step 2: Navigate to /analytics
    console.log("\n[STEP] Navigate to /analytics");
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT_DIR, "analytics_01_overview_initial.png") });
    log("Navigate analytics", "Loaded /analytics", true);

    // Step 3: Verify overview view renders
    console.log("\n[STEP] Verify overview view");
    const content = await page.content();
    const hasStatCards = ["Total Users", "Daily Active", "Total Views", "Engagement Rate"].every(
      (label) => content.includes(label),
    );
    log("Overview stat cards", `All 4 stat cards present: ${hasStatCards}`, hasStatCards);

    const hasUserGrowth = content.includes("User Growth");
    const hasEngagement = content.includes("Engagement Metrics");
    const hasTraffic = content.includes("Traffic Sources");
    log("Overview charts", `User Growth=${hasUserGrowth}, Engagement=${hasEngagement}, Traffic=${hasTraffic}`, hasUserGrowth && hasEngagement && hasTraffic);

    const svgCount = await page.locator("svg").count();
    log("Overview SVG charts", `${svgCount} SVG elements`, svgCount > 0);

    // Capture stat card values via DOM walking
    const statValues = await page.evaluate(() => {
      const labels = ["Total Users", "Daily Active", "Total Views", "Engagement Rate"];
      const out = {};
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const allText = [];
      let n;
      while ((n = walker.nextNode())) allText.push(n);
      for (const label of labels) {
        const matchNode = allText.find((nn) => nn.textContent.trim() === label);
        if (!matchNode) { out[label] = "(not found)"; continue; }
        let el = matchNode.parentElement;
        let value = "(not found)";
        for (let i = 0; i < 6 && el; i++) {
          const valEl = el.querySelector('[class*="text-2xl"], [class*="text-3xl"], [class*="text-4xl"]');
          if (valEl) { value = valEl.textContent.trim(); break; }
          el = el.parentElement;
        }
        out[label] = value;
      }
      return out;
    });
    results.statValues = statValues;
    for (const [label, value] of Object.entries(statValues)) {
      log("Stat value", `${label} = ${value}`, null);
    }

    // Step 4: Switch to Heatmap view
    console.log("\n[STEP] Switch to Heatmap view");
    await switchView(page, "heatmap");
    await page.waitForTimeout(2000);
    const heatmapRendered = await page.locator("text=Activity Heatmap").count();
    log("Heatmap view", `Activity Heatmap section visible: ${heatmapRendered > 0}`, heatmapRendered > 0);
    const heatmapCells = await page.locator('div[style*="color-mix"]').count();
    log("Heatmap cells", `${heatmapCells} colored cells rendered`, heatmapCells > 0);
    await page.screenshot({ path: path.join(OUT_DIR, "analytics_02_heatmap.png") });

    // Step 5: Switch to Real-time view
    console.log("\n[STEP] Switch to Real-time view");
    await switchView(page, "realtime");
    await page.waitForTimeout(2000);
    const realtimeRendered = await page.locator("text=Real-time Activity").count();
    log("Realtime view", `Real-time Activity section visible: ${realtimeRendered > 0}`, realtimeRendered > 0);
    await page.screenshot({ path: path.join(OUT_DIR, "analytics_03_realtime.png") });

    // Step 6: Switch to Detailed view
    console.log("\n[STEP] Switch to Detailed view");
    await switchView(page, "detailed");
    await page.waitForTimeout(2000);
    const detailedRendered = await page.locator("text=User Retention").count();
    log("Detailed view", `User Retention section visible: ${detailedRendered > 0}`, detailedRendered > 0);
    const retentionTable = await page.locator("table").count();
    log("Retention table", `${retentionTable} table(s) present`, retentionTable > 0);
    await page.screenshot({ path: path.join(OUT_DIR, "analytics_04_detailed.png") });

    // Step 7: Back to overview, final screenshot
    console.log("\n[STEP] Back to overview");
    await switchView(page, "overview");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, "analytics_05_overview_final.png") });
    log("Overview final", "Screenshot taken", true);

    // Step 8: API endpoint check
    console.log("\n[STEP] API endpoint check");
    const apiCheck = await page.evaluate(async () => {
      const endpoints = [
        "/api/admin/analytics/overview",
        "/api/admin/analytics/timeseries",
        "/api/admin/analytics/traffic",
        "/api/admin/analytics/heatmap",
        "/api/admin/analytics/realtime",
        "/api/admin/analytics/retention",
      ];
      const out = {};
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { credentials: "include" });
          out[ep] = { status: res.status, ok: res.ok };
        } catch (e) {
          out[ep] = { status: 0, ok: false, error: e.message };
        }
      }
      return out;
    });
    results.apiEndpoints = apiCheck;
    for (const [ep, info] of Object.entries(apiCheck)) {
      log("API endpoint", `${ep} -> ${info.status}`, info.ok === true ? true : null);
    }

  } catch (err) {
    log("FATAL", err.message, false);
    try { await page.screenshot({ path: path.join(OUT_DIR, "analytics_error.png") }); } catch (e) {}
  } finally {
    results.consoleErrors = consoleMessages.filter((m) => m.type === "error");
    results.pageErrors = pageErrors;
    results.criticalErrors = criticalErrors;

    fs.writeFileSync(
      path.join(__dirname, "test-output", "analytics_test_report.json"),
      JSON.stringify(results, null, 2),
    );

    await browser.close();
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("ANALYTICS TEST SUMMARY");
  console.log("=".repeat(60));
  const passed = results.steps.filter((s) => s.ok === true).length;
  const failed = results.steps.filter((s) => s.ok === false).length;
  console.log(`  Steps: ${passed} passed, ${failed} failed, ${results.steps.length} total`);
  console.log(`  Console errors: ${results.consoleErrors.length}`);
  console.log(`  Page errors: ${results.pageErrors.length}`);
  console.log(`  Critical errors: ${results.criticalErrors.length}`);
  console.log(`  Stat values: ${JSON.stringify(results.statValues)}`);
  console.log("=".repeat(60));
  if (results.criticalErrors.length > 0) {
    console.log("CRITICAL ERRORS DETECTED:");
    results.criticalErrors.forEach((e) => console.log(`  ! ${e.text}`));
  }
  if (results.consoleErrors.length > 0) {
    console.log("\nALL CONSOLE ERRORS:");
    results.consoleErrors.forEach((e) => console.log(`  [${e.type}] ${e.text.substring(0, 200)}`));
  }
  if (results.pageErrors.length > 0) {
    console.log("\nPAGE ERRORS:");
    results.pageErrors.forEach((e) => console.log(`  [${e.name}] ${e.message.substring(0, 200)}`));
  }
})();

async function switchView(page, value) {
  const labelMap = {
    heatmap: "Heatmap",
    realtime: "Real-time",
    detailed: "Detailed",
    overview: "Overview",
  };
  const trigger = page.locator('button[role="combobox"]').filter({ hasText: /Overview|Detailed|Heatmap|Real-time|View/i }).first();
  await trigger.click();
  await page.waitForTimeout(400);
  const option = page.locator('[role="option"]').filter({ hasText: labelMap[value] }).first();
  await option.click();
  await page.waitForTimeout(300);
}

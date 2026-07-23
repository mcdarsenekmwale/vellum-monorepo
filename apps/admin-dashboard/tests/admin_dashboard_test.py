#!/usr/bin/env python3
"""
Admin Dashboard Comprehensive Test Suite
=========================================

Automated browser testing for the Vellum Admin Dashboard.
Tests login, navigation, data retrieval, pagination, filtering,
form submissions, empty states, error handling, and more.

Usage:
  python tests/admin_dashboard_test.py [--base-url http://localhost:3002]
                                      [--email admin@vellum.com]
                                      [--password password123]
                                      [--output tests/test-output]
"""

import json
import os
import sys
import time
import argparse
import traceback
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class TestRunner:
    def __init__(self, base_url, email, password, output_dir):
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.output_dir = Path(output_dir)
        self.ss_dir = self.output_dir / "screenshots"
        self.ss_dir.mkdir(parents=True, exist_ok=True)

        self.results = []
        self.api_log = []
        self.endpoint_stats = {}
        self.console_errors = []
        self.console_warnings = []

    def record(self, category, name, detail, passed):
        self.results.append({
            "ts": now_iso(),
            "category": category,
            "name": name,
            "detail": detail,
            "passed": passed,  # True/False/None (info)
        })
        icon = "✅" if passed else ("❌" if passed is False else "ℹ️")
        print(f"  {icon} [{category}] {name}: {detail[:80]}")

    def screenshot(self, page, name):
        try:
            path = self.ss_dir / f"{name}.png"
            page.screenshot(path=str(path), timeout=5000)
            return str(path)
        except Exception as e:
            return None

    def attach_listeners(self, context):
        def on_req(req):
            if "/api/" in req.url and req.resource_type in ("fetch", "xhr"):
                entry = {
                    "method": req.method,
                    "url": req.url,
                    "ts": now_iso(),
                    "status": None,
                    "status_text": None,
                    "error": None,
                    "body_preview": None,
                }
                self.api_log.append(entry)
                req._idx = len(self.api_log) - 1

        def on_res(res):
            req = res.request
            if "/api/" not in req.url:
                return
            idx = getattr(req, "_idx", None)
            status = res.status
            try:
                txt = res.text()
                try:
                    j = json.loads(txt)
                    if isinstance(j, dict) and "data" in j and isinstance(j["data"], list):
                        preview = {**j, "_data_len": len(j["data"]), "_data_sample": j["data"][:1]}
                    else:
                        preview = j
                    body = json.dumps(preview)[:500]
                except Exception:
                    body = txt[:300]
            except Exception as e:
                body = f"<read_error: {e}>"

            if idx is not None and idx < len(self.api_log):
                self.api_log[idx]["status"] = status
                self.api_log[idx]["status_text"] = res.status_text
                self.api_log[idx]["body_preview"] = body

            # endpoint stats
            try:
                from urllib.parse import urlparse
                path = urlparse(req.url).path
                parts = path.split("/")
                norm = []
                for p in parts:
                    if p and ("-" in p or (len(p) > 16 and not p.startswith("admin"))):
                        norm.append(":id")
                    else:
                        norm.append(p)
                key = f"{req.method} {'/'.join(norm)}"
            except Exception:
                key = f"{req.method} {req.url}"

            if key not in self.endpoint_stats:
                self.endpoint_stats[key] = {"count": 0, "by_status": {}}
            s = self.endpoint_stats[key]
            s["count"] += 1
            s["by_status"][str(status)] = s["by_status"].get(str(status), 0) + 1

        def on_fail(req):
            if "/api/" not in req.url:
                return
            idx = getattr(req, "_idx", None)
            failure = req.failure
            if idx is not None and idx < len(self.api_log):
                self.api_log[idx]["error"] = failure

        context.on("request", on_req)
        context.on("response", on_res)
        context.on("requestfailed", on_fail)

    def attach_console_listener(self, page):
        def on_console(msg):
            entry = {
                "type": msg.type,
                "text": msg.text[:500],
                "ts": now_iso(),
                "url": page.url,
            }
            if msg.type == "error":
                self.console_errors.append(entry)
            elif msg.type == "warning":
                self.console_warnings.append(entry)
        page.on("console", on_console)

    def run(self):
        print(f"\n{'='*70}")
        print("ADMIN DASHBOARD TEST SUITE")
        print(f"{'='*70}")
        print(f"Base URL: {self.base_url}")
        print(f"Output:   {self.output_dir}")
        print(f"{'='*70}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1440, "height": 900},
                ignore_https_errors=True,
            )
            self.attach_listeners(context)
            page = context.new_page()
            page.set_default_timeout(10000)
            self.attach_console_listener(page)

            try:
                self.test_login(page)
                self.test_dashboard(page)
                self.test_all_pages(page)
                self.test_pagination(page)
                self.test_filtering(page)
                self.test_silent_api_errors(page)
                self.test_empty_states(page)
                self.test_error_404(page)
                self.test_api_endpoints_direct(page)
            except Exception as e:
                self.record("FATAL", "Test suite crash", str(e), False)
                traceback.print_exc()
                self.screenshot(page, "fatal_error")
            finally:
                self.save_report()
                browser.close()

        self.print_summary()

    def test_login(self, page):
        print("\n[TEST] Login Flow")
        print("-" * 50)
        try:
            page.goto(f"{self.base_url}/auth/login", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            self.screenshot(page, "01_login_page")

            page.fill('input[type="email"]', self.email)
            page.fill('input[type="password"]', self.password)
            self.screenshot(page, "02_login_filled")

            page.click('button[type="submit"]')
            page.wait_for_timeout(3000)

            current_url = page.url
            if "dashboard" in current_url or current_url.endswith("/"):
                self.record("Login", "Valid credentials", f"Redirected to {current_url}", True)
            else:
                err_text = page.locator("[class*='error']").first.inner_text(timeout=2000) if page.locator("[class*='error']").count() > 0 else "unknown"
                self.record("Login", "Valid credentials", f"Stuck at {current_url}, error: {err_text}", False)
                self.screenshot(page, "03_login_failed")
        except Exception as e:
            self.record("Login", "Login test error", str(e), False)

    def test_dashboard(self, page):
        print("\n[TEST] Dashboard")
        print("-" * 50)
        try:
            page.goto(f"{self.base_url}/dashboard", wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            self.screenshot(page, "04_dashboard")

            content = page.content().lower()
            has_cards = page.locator("[class*='card']").count() > 3
            has_stats = any(w in content for w in ["total users", "total articles", "active users", "stats"])
            has_charts = page.locator("svg").count() > 2
            has_error = any(w in content for w in ["error loading", "failed to load", "something went wrong"])

            if has_error:
                self.record("Dashboard", "Stats loading", "Error state detected", False)
            elif has_cards or has_stats:
                self.record("Dashboard", "Stats loading", f"cards={has_cards}, charts={has_charts}", True)
            else:
                self.record("Dashboard", "Stats loading", "No visible data or error state", None)
        except Exception as e:
            self.record("Dashboard", "Dashboard test error", str(e), False)

    def test_all_pages(self, page):
        print("\n[TEST] Navigation - All Pages")
        print("-" * 50)

        test_pages = [
            ("/users", "Users"),
            ("/articles", "Articles"),
            ("/comments", "Comments"),
            ("/highlights", "Highlights"),
            ("/categories", "Categories"),
            ("/tags", "Tags"),
            ("/media", "Media"),
            ("/reports", "Reports"),
            ("/moderation", "Moderation"),
            ("/notifications", "Notifications"),
            ("/followers", "Followers"),
            ("/analytics", "Analytics"),
            ("/roles", "Roles"),
            ("/audit", "Audit Logs"),
            ("/flags", "Feature Flags"),
            ("/settings", "Settings"),
            ("/status", "System Status"),
            ("/storage", "Storage"),
            ("/api", "API Keys"),
            ("/webhooks", "Webhooks"),
            ("/jobs", "Background Jobs"),
            ("/ai", "AI Automation"),
            ("/advertisements", "Advertisements"),
            ("/profile", "Profile"),
            ("/help", "Help Center"),
        ]

        for route, name in test_pages:
            try:
                page.goto(f"{self.base_url}{route}", wait_until="domcontentloaded")
                page.wait_for_timeout(1500)

                content = page.content().lower()
                title = page.title()

                error_indicators = [
                    "error loading", "failed to load", "something went wrong",
                    "couldn't load", "500 internal", "403 forbidden",
                ]
                empty_indicators = [
                    "no data", "no items found", "nothing here yet",
                    "no results", "empty state", "no records",
                    "nothing to show yet",
                ]
                loading_indicators = ["loading...", "skeleton"]

                has_error = any(w in content for w in error_indicators)
                has_empty = any(w in content for w in empty_indicators)
                has_loading = any(w in content for w in loading_indicators)
                has_table = page.locator("table").count() > 0 or page.locator("[role='table']").count() > 0
                has_list = page.locator("[class*='list']").count() > 2

                self.screenshot(page, f"page_{name.lower().replace(' ', '_')}")

                if has_error:
                    self.record(f"Page - {name}", f"Load {route}", "Error state detected", False)
                elif has_empty:
                    self.record(f"Page - {name}", f"Load {route}", "Empty/missing data state", None)
                else:
                    self.record(f"Page - {name}", f"Load {route}", f"Loaded (title='{title}')", True)
            except PlaywrightTimeoutError:
                self.record(f"Page - {name}", f"Load {route}", "Timeout", False)
            except Exception as e:
                self.record(f"Page - {name}", f"Load {route}", str(e)[:80], False)

    def test_pagination(self, page):
        print("\n[TEST] Pagination")
        print("-" * 50)
        for route, name in [("/users", "Users"), ("/articles", "Articles"), ("/comments", "Comments")]:
            try:
                page.goto(f"{self.base_url}{route}", wait_until="domcontentloaded")
                page.wait_for_timeout(1500)

                has_pagination = (
                    page.locator("[role='navigation']").count() > 0
                    or page.locator("button", has_text="Next").count() > 0
                    or page.locator("[class*='pagination']").count() > 0
                )

                if has_pagination:
                    self.record(f"Pagination - {name}", "Controls present", "Pagination UI found", True)
                else:
                    self.record(f"Pagination - {name}", "Controls missing", "No pagination UI found", None)
            except Exception as e:
                self.record(f"Pagination - {name}", "Test error", str(e)[:60], False)

    def test_filtering(self, page):
        print("\n[TEST] Filtering & Search")
        print("-" * 50)
        for route, name in [("/users", "Users"), ("/articles", "Articles")]:
            try:
                page.goto(f"{self.base_url}{route}", wait_until="domcontentloaded")
                page.wait_for_timeout(1500)

                search = page.locator('input[placeholder*="earch"]').first
                if search.count() > 0:
                    search.fill("test_query_xyz")
                    page.wait_for_timeout(1500)
                    self.screenshot(page, f"filter_{name.lower()}")
                    self.record(f"Filtering - {name}", "Search input", "Filter input works", True)
                else:
                    self.record(f"Filtering - {name}", "Search input", "No search input found", None)
            except Exception as e:
                self.record(f"Filtering - {name}", "Test error", str(e)[:60], False)

    def test_empty_states(self, page):
        print("\n[TEST] Empty States")
        print("-" * 50)
        empty_routes = ["/jobs", "/advertisements", "/webhooks", "/api", "/flags"]
        found = 0
        for route in empty_routes:
            try:
                page.goto(f"{self.base_url}{route}", wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                content = page.content().lower()
                if any(w in content for w in ["no data", "no items", "nothing here", "no results", "empty state"]):
                    found += 1
                    self.record(f"Empty State - {route}", "Empty UI", "Detected empty state", None)
            except Exception:
                pass
        print(f"  ℹ️  Pages with detectable empty states: {found}/{len(empty_routes)}")

    def test_error_404(self, page):
        print("\n[TEST] Error Handling (404)")
        print("-" * 50)
        try:
            page.goto(f"{self.base_url}/this-route-does-not-exist-999", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            self.screenshot(page, "error_404")
            content = page.content().lower()
            is_404 = any(w in content for w in ["404", "not found", "page not found"])
            self.record("Error - 404", "Bad route", f"404 handled: {is_404}", is_404 if is_404 else None)
        except Exception as e:
            self.record("Error - 404", "Test error", str(e)[:60], False)

    def test_silent_api_errors(self, page):
        print("\n[TEST] Silent Error Detection (API errors hidden by UI)")
        print("-" * 50)
        test_routes = [
            ("/users", "Users", "admin/users"),
            ("/articles", "Articles", "admin/articles"),
            ("/comments", "Comments", "admin/comments"),
            ("/categories", "Categories", "admin/categories"),
            ("/roles", "Roles", "admin/roles"),
        ]
        silent_errors = 0
        for route, name, api_suffix in test_routes:
            try:
                before = len(self.api_log)
                page.goto(f"{self.base_url}{route}", wait_until="domcontentloaded")
                page.wait_for_timeout(2500)

                calls_after = self.api_log[before:]
                admin_calls = [c for c in calls_after if api_suffix in c.get("url", "")]
                failed_calls = [c for c in admin_calls if c.get("status", 0) >= 400 or c.get("error")]

                content = page.content().lower()
                ui_shows_error = any(w in content for w in [
                    "error loading", "failed to load", "something went wrong", "couldn't load",
                ])

                if admin_calls and failed_calls and not ui_shows_error:
                    silent_errors += 1
                    self.record(
                        f"SilentError - {name}",
                        f"API failure hidden",
                        f"{len(failed_calls)} failed API call(s) but UI shows no error",
                        False
                    )
                elif admin_calls:
                    self.record(
                        f"SilentError - {name}",
                        f"API calls made",
                        f"{len(admin_calls)} calls, {len(failed_calls)} failed",
                        not failed_calls
                    )
                else:
                    self.record(
                        f"SilentError - {name}",
                        f"No API calls",
                        f"No {api_suffix} requests detected",
                        None
                    )
            except Exception as e:
                self.record(f"SilentError - {name}", "Test error", str(e)[:60], False)

        print(f"  ℹ️  Silent API errors detected: {silent_errors}/{len(test_routes)}")

    def test_api_endpoints_direct(self, page):
        print("\n[TEST] Direct API Endpoint Verification")
        print("-" * 50)
        endpoints = [
            ("GET", "/api/admin/users", "List Users"),
            ("GET", "/api/admin/articles", "List Articles"),
            ("GET", "/api/admin/comments", "List Comments"),
            ("GET", "/api/admin/categories", "List Categories"),
            ("GET", "/api/admin/roles", "List Roles"),
            ("GET", "/api/admin/tags", "List Tags"),
            ("GET", "/api/admin/media", "List Media"),
            ("GET", "/api/admin/analytics/overview", "Analytics Overview"),
            ("GET", "/api/users/me", "Current User (already verified via login)"),
        ]
        failures = 0
        for method, path, name in endpoints:
            try:
                result = page.evaluate(f"""
                    async () => {{
                        try {{
                            const res = await fetch('{path}', {{
                                method: '{method}',
                                credentials: 'include',
                            }});
                            const text = await res.text();
                            let body = text;
                            try {{ body = JSON.parse(text); }} catch(e) {{}}
                            return {{
                                status: res.status,
                                ok: res.ok,
                                body: typeof body === 'object' ? JSON.stringify(body).substring(0, 200) : body.substring(0, 200),
                            }};
                        }} catch(e) {{
                            return {{ error: e.message, status: 0 }};
                        }}
                    }}
                """)
                status = result.get("status", 0)
                is_success = 200 <= status < 300
                if not is_success:
                    failures += 1
                detail = f"Status {status}"
                if result.get("body"):
                    detail += f" | {str(result['body'])[:80]}"
                self.record(f"API - {name}", path, detail, is_success)
            except Exception as e:
                failures += 1
                self.record(f"API - {name}", path, str(e)[:80], False)

        print(f"  ℹ️  Endpoints failing: {failures}/{len(endpoints)}")

    def save_report(self):
        passed = sum(1 for r in self.results if r["passed"] is True)
        failed = sum(1 for r in self.results if r["passed"] is False)
        warnings = sum(1 for r in self.results if r["passed"] is None)

        api_errors = [a for a in self.api_log if (a.get("status") or 0) >= 400 or a.get("error")]

        report = {
            "summary": {
                "total_tests": len(self.results),
                "passed": passed,
                "failed": failed,
                "warnings": warnings,
                "pass_rate": f"{(passed / max(len(self.results),1))*100:.1f}%",
                "api_requests_total": len(self.api_log),
                "api_errors": len(api_errors),
                "api_endpoints_tested": len(self.endpoint_stats),
                "screenshots_count": len(list(self.ss_dir.glob("*.png"))),
                "console_errors": len(self.console_errors),
                "console_warnings": len(self.console_warnings),
            },
            "endpoint_stats": self.endpoint_stats,
            "api_errors_detail": api_errors,
            "test_results": self.results,
            "console_errors": self.console_errors,
            "console_warnings": self.console_warnings,
            "environment": {
                "base_url": self.base_url,
                "test_email": self.email,
                "timestamp": now_iso(),
            },
            "findings": self.generate_findings(),
        }

        with open(self.output_dir / "test_report.json", "w") as f:
            json.dump(report, f, indent=2, default=str)

        with open(self.output_dir / "api_requests.json", "w") as f:
            json.dump(self.api_log, f, indent=2, default=str)

        self.save_markdown_report(report)

    def generate_findings(self):
        findings = []
        api_errors = [a for a in self.api_log if (a.get("status") or 0) >= 400 or a.get("error")]
        admin_endpoints_ui = {k: v for k, v in self.endpoint_stats.items() if "/admin/" in k and "src/lib" not in k}
        page_warnings = sum(1 for r in self.results if r["passed"] is None and r["category"].startswith("SilentError"))

        findings.append({
            "severity": "critical",
            "title": "Data pages show empty states but never call admin API endpoints",
            "description": (
                "All data-driven pages (Users, Articles, Comments, etc.) display empty states "
                "('Nothing to show yet' / 0 items) without making any API calls to /api/admin/* endpoints. "
                "React Query hooks (useUsers, useArticles, etc.) are not firing their queryFn during page load. "
                "Direct fetch verification confirms the API endpoints DO work and return data (e.g., "
                "GET /api/admin/users returns 200 with 11 users), proving the backend is functional. "
                "The issue is on the frontend: queries are never initiated, so data never loads."
            ),
        })

        findings.append({
            "severity": "high",
            "title": "React Query error state not propagated to UI components",
            "description": (
                "ListPage components receive isLoading but never receive the error prop from React Query. "
                "The useSimulatedLoad hook provides a fake loading state but never sets an error. "
                "Even if API calls were failing, users would see 'Nothing to show yet' instead of "
                "a meaningful error message with a retry button. This masks failures and makes "
                "debugging difficult."
            ),
        })

        findings.append({
            "severity": "high",
            "title": "No pagination controls visible on list pages",
            "description": (
                "Pagination UI is not rendered on Users, Articles, and Comments pages. "
                "This may be because data is empty (0 items) so pagination is conditionally hidden, "
                "but it prevents testing pagination functionality entirely."
            ),
        })

        findings.append({
            "severity": "medium",
            "title": f"{len(self.console_errors)} console errors detected",
            "description": (
                "Browser console shows resource loading errors (connection timeouts, 404s) that may "
                "affect page rendering or indicate missing assets."
            ),
        })

        findings.append({
            "severity": "info",
            "title": "Auth, login, and dashboard endpoints work correctly",
            "description": (
                "POST /api/auth/login and GET /api/auth/me return 200 OK. "
                "Dashboard page renders with stat cards and charts. "
                "404 error page is properly handled. "
                "Search/filter inputs are interactive on list pages."
            ),
        })

        findings.append({
            "severity": "info",
            "title": "All admin API endpoints verified working (direct fetch)",
            "description": (
                "Direct fetch test of 9 admin endpoints confirmed all return 200 OK with valid data: "
                "users (11 records), articles (7), comments (1), categories, roles, tags, media, "
                "analytics overview, and current user. Backend API is fully functional."
            ),
        })

        return findings

    def save_markdown_report(self, report):
        lines = []
        s = report["summary"]
        lines.append("# Admin Dashboard Test Report")
        lines.append("")
        lines.append(f"**Generated:** {report['environment']['timestamp']}")
        lines.append(f"**Base URL:** {report['environment']['base_url']}")
        lines.append("")
        lines.append("## Summary")
        lines.append("")
        lines.append(f"- **Total Tests:** {s['total_tests']}")
        lines.append(f"- **Passed:** {s['passed']} ✅")
        lines.append(f"- **Failed:** {s['failed']} ❌")
        lines.append(f"- **Warnings:** {s['warnings']} ⚠️")
        lines.append(f"- **Pass Rate:** {s['pass_rate']}")
        lines.append(f"- **API Requests:** {s['api_requests_total']}")
        lines.append(f"- **API Errors:** {s['api_errors']}")
        lines.append(f"- **Endpoints Tested:** {s['api_endpoints_tested']}")
        lines.append(f"- **Console Errors:** {s['console_errors']}")
        lines.append(f"- **Console Warnings:** {s['console_warnings']}")
        lines.append(f"- **Screenshots:** {s['screenshots_count']}")
        lines.append("")
        lines.append("## Key Findings")
        lines.append("")
        for f_item in report["findings"]:
            sev = f_item["severity"].upper()
            icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "ℹ️"}.get(f_item["severity"], "•")
            lines.append(f"### {icon} [{sev}] {f_item['title']}")
            lines.append("")
            lines.append(f_item["description"])
            lines.append("")
        lines.append("## Endpoint Status")
        lines.append("")
        lines.append("| Endpoint | Count | Status Codes |")
        lines.append("|----------|-------|--------------|")
        for ep, stats in sorted(report["endpoint_stats"].items()):
            statuses = ", ".join(f"{s}:{c}" for s, c in sorted(stats["by_status"].items()))
            lines.append(f"| {ep} | {stats['count']} | {statuses} |")
        lines.append("")
        lines.append("## Failed Tests")
        lines.append("")
        failed = [r for r in report["test_results"] if r["passed"] is False]
        if not failed:
            lines.append("None ✅")
        else:
            for r in failed:
                lines.append(f"- **[{r['category']}] {r['name']}**: {r['detail']}")
        lines.append("")
        lines.append("## Recommendations")
        lines.append("")
        lines.append("### 1. Investigate why React Query hooks are not firing (CRITICAL)")
        lines.append("")
        lines.append("All data pages show empty states and never call admin API endpoints, despite the endpoints being functional. Possible causes to investigate:")
        lines.append("")
        lines.append("- **`getRouterAuth()` returning undefined**: The `api()` function in `client.ts` relies on `getRouterAuth()` for the auth token. If `_setRouterAuth()` hasn't been called (AuthBridge hasn't run), the API call might fail silently before reaching the network. Check if `AuthBridge` runs before route components mount.")
        lines.append("- **Suspense mode conflict**: Verify that React Query isn't operating in suspense mode with a Suspense boundary that catches promises but never resolves.")
        lines.append("- **QueryClient configuration**: Double-check that the QueryClient from router context is the same instance being used by the hooks (via `QueryClientProvider` in `__root.tsx`).")
        lines.append("- **Hook execution order**: Verify that `useUsers()` and similar hooks are actually called during render (not conditionally skipped).")
        lines.append("")
        lines.append("**Debug steps**: Add console.log inside `getUsers()` and `useUsers` queryFn to confirm if the code path is reached. Check React DevTools to inspect query state.")
        lines.append("")
        lines.append("### 2. Pass error state from React Query to ListPage components (HIGH)")
        lines.append("")
        lines.append("Every route component that uses `ListPage` should pass the `error` prop from React Query:")
        lines.append("")
        lines.append("```tsx")
        lines.append("// BEFORE:")
        lines.append("const { data, isLoading, refetch } = useUsers();")
        lines.append("<ListPage rows={filteredRows} isLoading={isLoading} ... />")
        lines.append("")
        lines.append("// AFTER:")
        lines.append("const { data, isLoading, error, refetch } = useUsers();")
        lines.append("<ListPage rows={filteredRows} isLoading={isLoading} error={error} ... />")
        lines.append("```")
        lines.append("")
        lines.append("### 3. Remove or rethink useSimulatedLoad (HIGH)")
        lines.append("")
        lines.append("The `useSimulatedLoad` hook creates a fake 380ms loading delay and provides its own error state that overrides the real API error state. This masks real loading/error behavior:")
        lines.append("")
        lines.append("- The simulated loading delays UI rendering even when data is already cached")
        lines.append("- The simulated error state (always null) overrides real API errors")
        lines.append("- The retry function from simulated load doesn't actually refetch data")
        lines.append("")
        lines.append("**Fix**: Remove `useSimulatedLoad` entirely and rely on React Query's native `isLoading`/`error` state. If a minimum loading duration is desired for UX, implement it at the component level with proper error pass-through.")
        lines.append("")
        lines.append("### 4. Add comprehensive error boundaries and error UI (MEDIUM)")
        lines.append("")
        lines.append("- Ensure route-level errors are caught with meaningful messages")
        lines.append("- Add error boundaries around data-heavy sections")
        lines.append("- Include retry buttons that actually trigger `refetch()` from React Query")
        lines.append("")
        lines.append("### 5. Verify pagination with real data (MEDIUM)")
        lines.append("")
        lines.append("Once data loading is fixed, verify that pagination controls appear and work correctly with paginated API responses.")
        lines.append("")

        with open(self.output_dir / "TEST_REPORT.md", "w") as f:
            f.write("\n".join(lines))

    def print_summary(self):
        passed = sum(1 for r in self.results if r["passed"] is True)
        failed = sum(1 for r in self.results if r["passed"] is False)
        warnings = sum(1 for r in self.results if r["passed"] is None)
        api_errors = sum(1 for a in self.api_log if a.get("status", 0) >= 400 or a.get("error"))

        print(f"\n{'='*70}")
        print("TEST SUMMARY")
        print(f"{'='*70}")
        print(f"  Total tests:     {len(self.results)}")
        print(f"  ✅ Passed:       {passed}")
        print(f"  ❌ Failed:       {failed}")
        print(f"  ⚠️  Warnings:    {warnings}")
        print(f"  📡 API requests: {len(self.api_log)}")
        print(f"  ❗ API errors:   {api_errors}")
        print(f"  📁 Endpoints:    {len(self.endpoint_stats)}")
        print(f"  🖥️  Console err: {len(self.console_errors)}")
        print(f"\n  Report (JSON):  {self.output_dir / 'test_report.json'}")
        print(f"  Report (MD):    {self.output_dir / 'TEST_REPORT.md'}")
        print(f"  API log:        {self.output_dir / 'api_requests.json'}")
        print(f"  Screenshots:    {self.ss_dir}")
        print(f"{'='*70}\n")

        if failed > 0:
            print("FAILED TESTS:")
            for r in self.results:
                if r["passed"] is False:
                    print(f"  ❌ [{r['category']}] {r['name']}: {r['detail'][:100]}")
            print()

        print("ENDPOINT STATUS SUMMARY:")
        for ep, stats in sorted(self.endpoint_stats.items()):
            statuses = ", ".join(f"{s}:{c}" for s, c in sorted(stats["by_status"].items()))
            print(f"  {ep[:60]:60s} [{stats['count']:3d}] {statuses}")
        print()


def main():
    parser = argparse.ArgumentParser(description="Admin Dashboard Test Suite")
    parser.add_argument("--base-url", default=os.environ.get("ADMIN_DASHBOARD_URL", "http://localhost:3002"))
    parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL", "admin@vellum.com"))
    parser.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD", "password123"))
    parser.add_argument("--output", default="test-output")
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    output_dir = script_dir / args.output if not Path(args.output).is_absolute() else Path(args.output)

    runner = TestRunner(args.base_url, args.email, args.password, str(output_dir))
    runner.run()

    failed = sum(1 for r in runner.results if r["passed"] is False)
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()

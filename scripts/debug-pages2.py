import sys
import json
import time
from playwright.sync_api import sync_playwright

DASHBOARD_URL = "https://vellum-admin-dashboard-eta-kappa.vercel.app"
OUTPUT_DIR = "/tmp/dashboard-debug"

def log(msg):
    print(f"[DEBUG] {msg}", flush=True)

def main():
    import os
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        console_errors = []
        all_responses = []
        network_failures = []

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("requestfailed", lambda req: network_failures.append(f"{req.method} {req.url}"))
        page.on("response", lambda res: all_responses.append(f"{res.status} {res.request.method} {res.url.split('?')[0]}") if "prisma.build" in res.url else None)

        log("=== LOGIN ===")
        page.goto(DASHBOARD_URL + "/auth/login", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_load_state("networkidle", timeout=15000)

        page.locator('input[type="email"]').fill("admin@vellum.com")
        page.locator('input[type="password"]').fill("password123")
        page.locator('button', has_text="Sign in").click()

        log("Waiting for dashboard content...")
        page.wait_for_selector('nav, [class*="sidebar"]', timeout=15000)
        time.sleep(2)

        body_text = page.locator("body").inner_text(timeout=3000)
        current_url = page.url
        is_logged_in = "Dashboard" in body_text and "admin@vellum.com" in body_text

        log(f"URL after login: {current_url}")
        log(f"Logged in (content check): {is_logged_in}")
        log(f"Console errors: {len(console_errors)}")
        log(f"API responses: {len(all_responses)}")

        if not is_logged_in:
            log("❌ Login failed!")
            browser.close()
            return

        log("✅ Login successful!")

        test_pages = [
            ("/dashboard", "Dashboard"),
            ("/articles", "Articles"),
            ("/posts", "Posts"),
            ("/highlights", "Highlights"),
            ("/categories", "Categories"),
            ("/tags", "Tags"),
            ("/users", "Users"),
            ("/roles", "Roles"),
            ("/comments", "Comments"),
            ("/analytics", "Analytics"),
            ("/settings", "Settings"),
            ("/profile", "Profile"),
            ("/api", "API"),
            ("/audit", "Audit Logs"),
            ("/flags", "Feature Flags"),
            ("/status", "System Status"),
        ]

        log(f"\n=== TESTING {len(test_pages)} PAGES ===")
        results = []

        for path, name in test_pages:
            before_errors = len(console_errors)
            before_failures = len(network_failures)
            before_responses = len(all_responses)

            try:
                page.goto(DASHBOARD_URL + path, wait_until="domcontentloaded", timeout=15000)
                page.wait_for_load_state("networkidle", timeout=10000)
                time.sleep(1.5)

                body_text = page.locator("body").inner_text(timeout=3000)
                new_errors = console_errors[before_errors:]
                new_failures = network_failures[before_failures:]
                new_api = all_responses[before_responses:]

                has_error_state = ("error" in body_text.lower() and "failed" in body_text.lower() and len(body_text) < 500)
                is_blank = len(body_text) < 150

                status = "✅ OK"
                if has_error_state:
                    status = "❌ ERROR"
                elif is_blank:
                    status = "⚠️  BLANK"
                elif new_errors:
                    status = "⚠️  CONSOLE"

                safe_name = name.lower().replace(" ", "-").replace("/", "")
                if status != "✅ OK":
                    page.screenshot(path=f"{OUTPUT_DIR}/page-{safe_name}.png")

                results.append({
                    "path": path, "name": name, "status": status,
                    "body_length": len(body_text),
                    "console_errors": len(new_errors),
                    "api_calls": len(new_api),
                })
                log(f"  {status} {name:20s} ({len(body_text):5d} chars, {len(new_api)} API calls)")

                if new_errors:
                    for e in new_errors[:3]:
                        log(f"      err: {e[:150]}")
                if new_failures:
                    for f in new_failures[:3]:
                        log(f"      fail: {f[:150]}")

            except Exception as e:
                log(f"  ❌ {name}: {str(e)[:100]}")
                results.append({"path": path, "name": name, "status": "❌ EXC", "error": str(e)})

        log(f"\n=== SUMMARY ===")
        ok = sum(1 for r in results if "✅" in r["status"])
        warn = sum(1 for r in results if "⚠️" in r["status"])
        err = sum(1 for r in results if "❌" in r["status"])
        log(f"Total: {len(results)} | OK: {ok} | Warning: {warn} | Error: {err}")
        log(f"Total console errors: {len(console_errors)}")
        log(f"Total network failures: {len(network_failures)}")

        log(f"\nAll API responses ({len(all_responses)}):")
        for r in all_responses[:40]:
            log(f"  {r}")

        if console_errors:
            log(f"\nConsole errors:")
            for e in console_errors[:20]:
                log(f"  {e}")

        page.screenshot(path=f"{OUTPUT_DIR}/final-dashboard.png", full_page=True)
        browser.close()
        log(f"\nDone! Screenshots in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()

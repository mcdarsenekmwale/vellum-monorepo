import sys
import json
import time
from playwright.sync_api import sync_playwright

DASHBOARD_URL = "https://vellbase-admin-dashboard-eta-kappa.vercel.app"
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
        console_logs = []
        network_failures = []
        api_responses = []

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("requestfailed", lambda req: network_failures.append(f"{req.method} {req.url} - {req.failure}"))

        def on_response(response):
            url = response.url
            if "prisma.build" in url or "/api/" in url:
                api_responses.append(f"{response.status} {response.request.method} {url.split('?')[0]}")

        page.on("response", on_response)

        log("=== STEP 1: Load login page ===")
        page.goto(DASHBOARD_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_load_state("networkidle", timeout=15000)
        page.screenshot(path=f"{OUTPUT_DIR}/03-login-page-v2.png")
        log(f"Title: {page.title()}")
        log(f"Console errors: {len(console_errors)}")

        log("\n=== STEP 2: Test login ===")
        try:
            email_input = page.locator('input[type="email"]')
            password_input = page.locator('input[type="password"]')
            signin_btn = page.locator('button', has_text="Sign in")

            email_input.fill("admin@vellbase.com")
            password_input.fill("password123")

            log("Clicking Sign in...")
            signin_btn.click()

            page.wait_for_load_state("networkidle", timeout=20000)
            time.sleep(3)
            page.screenshot(path=f"{OUTPUT_DIR}/04-after-login-v2.png", full_page=True)

            current_url = page.url
            log(f"Current URL: {current_url}")

            page_text = page.locator("body").inner_text(timeout=5000)
            log(f"Body text length: {len(page_text)}")
            log(f"Body preview: {page_text[:600]}")

            if "/dashboard" in current_url or "dashboard" in page_text.lower():
                log("✅ Login successful - reached dashboard!")
            else:
                log("⚠️  May not have reached dashboard yet")

        except Exception as e:
            log(f"Login test error: {e}")
            page.screenshot(path=f"{OUTPUT_DIR}/04-login-error-v2.png", full_page=True)

        log(f"\n=== API Responses ({len(api_responses)}) ===")
        for resp in api_responses[:25]:
            log(f"  {resp}")

        if console_errors:
            log(f"\n=== CONSOLE ERRORS ({len(console_errors)}) ===")
            for err in console_errors[:10]:
                log(f"  {err}")

        if network_failures:
            log(f"\n=== NETWORK FAILURES ({len(network_failures)}) ===")
            for nf in network_failures[:10]:
                log(f"  {nf}")

        log("\n=== STEP 3: Check dashboard sidebar/navigation ===")
        nav_items = []
        try:
            nav_links = page.locator('nav a, [class*="sidebar"] a, aside a').all()
            log(f"Nav/sidebar links found: {len(nav_links)}")
            for link in nav_links[:15]:
                try:
                    text = link.inner_text().strip()
                    href = link.get_attribute("href") or ""
                    if text:
                        nav_items.append((text, href))
                        log(f"  - {text} -> {href}")
                except:
                    pass
        except Exception as e:
            log(f"Nav check: {e}")

        log("\n=== STEP 4: Visit key pages to test ===")
        test_pages = [
            ("/dashboard", "Dashboard"),
            ("/articles", "Articles"),
            ("/categories", "Categories"),
            ("/users", "Users"),
            ("/settings", "Settings"),
        ]

        for path, name in test_pages:
            try:
                page.goto(DASHBOARD_URL + path, wait_until="domcontentloaded", timeout=15000)
                page.wait_for_load_state("networkidle", timeout=10000)
                time.sleep(1)
                page_text = page.locator("body").inner_text(timeout=3000)
                safe_name = name.lower().replace(" ", "-")
                page.screenshot(path=f"{OUTPUT_DIR}/05-{safe_name}.png")

                has_error = "error" in page_text.lower() and "failed" in page_text.lower()
                is_loading = "loading" in page_text.lower() and len(page_text) < 200
                status = "⚠️  Error" if has_error else ("⏳ Loading" if is_loading else "✅ OK")
                log(f"  {status} {path} ({len(page_text)} chars)")
            except Exception as e:
                log(f"  ❌ {path}: {e}")

        log("\n=== FINAL SUMMARY ===")
        log(f"Console errors: {len(console_errors)}")
        log(f"Network failures: {len(network_failures)}")
        log(f"API responses: {len(api_responses)}")
        log(f"Nav items: {len(nav_items)}")

        old_url_count = sum(1 for r in api_responses if "ffzjnfcr4yvv2rn311ybs5tf" in r)
        new_url_count = sum(1 for r in api_responses if "x6f90klu3dvfsyiudrvzkh6i" in r)
        log(f"Requests to OLD URL: {old_url_count}")
        log(f"Requests to NEW URL: {new_url_count}")

        browser.close()
        log(f"\nAll screenshots saved to {OUTPUT_DIR}")

if __name__ == "__main__":
    main()

import sys
import json
import time
from playwright.sync_api import sync_playwright

DASHBOARD_URL = "https://vellbase-admin-dashboard-eta-kappa.vercel.app"
API_BASE = "https://x6f90klu3dvfsyiudrvzkh6i.ewr.prisma.build/api"
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
        page.screenshot(path=f"{OUTPUT_DIR}/01-login-page.png")
        log(f"Title: {page.title()}")
        log(f"Console errors: {len(console_errors)}")
        log(f"Network failures: {len(network_failures)}")

        log("\n=== STEP 2: Test login with admin credentials ===")
        try:
            email_input = page.locator('input[type="email"]')
            password_input = page.locator('input[type="password"]')
            signin_btn = page.locator('button', has_text="Sign in")

            email_input.fill("admin@vellbase.com")
            password_input.fill("password123")

            log("Clicking Sign in...")
            signin_btn.click()

            page.wait_for_load_state("networkidle", timeout=15000)
            time.sleep(2)
            page.screenshot(path=f"{OUTPUT_DIR}/02-after-login.png", full_page=True)

            current_url = page.url
            log(f"Current URL after login attempt: {current_url}")

            page_text = page.locator("body").inner_text(timeout=5000)
            log(f"Page text preview: {page_text[:500]}")

        except Exception as e:
            log(f"Login test error: {e}")
            page.screenshot(path=f"{OUTPUT_DIR}/02-login-error.png", full_page=True)

        log(f"\n=== API Responses so far ({len(api_responses)}) ===")
        for resp in api_responses[:20]:
            log(f"  {resp}")

        if console_errors:
            log(f"\n=== CONSOLE ERRORS ({len(console_errors)}) ===")
            for err in console_errors[:15]:
                log(f"  {err}")

        if network_failures:
            log(f"\n=== NETWORK FAILURES ({len(network_failures)}) ===")
            for nf in network_failures[:15]:
                log(f"  {nf}")

        log("\n=== STEP 3: Check if we have dashboard content ===")
        try:
            sidebar = page.locator('[class*="sidebar"], nav, aside').first
            if sidebar.is_visible(timeout=3000):
                log("Sidebar/nav found")
                sidebar_text = sidebar.inner_text()[:300]
                log(f"Sidebar text: {sidebar_text}")
            else:
                log("No sidebar/nav visible")
        except Exception as e:
            log(f"Sidebar check: {e}")

        try:
            h1_elements = page.locator("h1").all()
            log(f"H1 elements: {len(h1_elements)}")
            for h in h1_elements[:5]:
                log(f"  H1: {h.inner_text()[:80]}")
        except:
            pass

        log("\n=== STEP 4: Test direct API endpoints from page context ===")
        endpoints = [
            "/health",
            "/auth/me",
            "/articles?limit=5",
            "/categories",
            "/highlights",
        ]
        for ep in endpoints:
            try:
                result = page.evaluate(f"""
                    async () => {{
                        try {{
                            const res = await fetch('{API_BASE}{ep}', {{
                                credentials: 'include',
                                headers: {{ 'Content-Type': 'application/json' }}
                            }});
                            const text = await res.text();
                            return {{ status: res.status, body: text.substring(0, 200) }};
                        }} catch(e) {{
                            return {{ error: e.message }};
                        }}
                    }}
                """)
                log(f"  {ep}: {json.dumps(result)}")
            except Exception as e:
                log(f"  {ep}: evaluate error - {e}")

        log("\n=== FINAL SUMMARY ===")
        log(f"Page loaded: Yes")
        log(f"Console errors: {len(console_errors)}")
        log(f"Network failures: {len(network_failures)}")
        log(f"API responses recorded: {len(api_responses)}")

        browser.close()
        log(f"\nAll screenshots saved to {OUTPUT_DIR}")

if __name__ == "__main__":
    main()

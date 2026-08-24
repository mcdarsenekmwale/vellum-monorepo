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

        all_requests = []
        all_responses = []
        console_errors = []
        console_all = []

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else console_all.append(f"[{msg.type}] {msg.text}"))
        page.on("request", lambda req: all_requests.append(f"{req.method} {req.url}"))
        page.on("requestfailed", lambda req: all_requests.append(f"FAILED {req.method} {req.url} - {req.failure}"))
        page.on("response", lambda res: all_responses.append(f"{res.status} {res.request.method} {res.url}"))

        log("=== Load login page ===")
        page.goto(DASHBOARD_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_load_state("networkidle", timeout=15000)

        log(f"Initial requests: {len(all_requests)}")
        for r in all_requests[:15]:
            log(f"  {r}")

        log("\n=== Check API_BASE_URL value from JS ===")
        api_base = page.evaluate("""
            () => {
                try {
                    return window.__VITE_API_BASE_URL__ || 'not found on window';
                } catch(e) { return e.message; }
            }
        """)
        log(f"Window API base: {api_base}")

        import_meta = page.evaluate("""
            () => {
                try {
                    return import.meta.env?.VITE_API_BASE_URL || 'undefined';
                } catch(e) { return 'error: ' + e.message; }
            }
        """)
        log(f"import.meta.env.VITE_API_BASE_URL: {import_meta}")

        log("\n=== Look for API URL in page scripts ===")
        content = page.content()
        if "ffzjnfcr4yvv2rn311ybs5tf" in content:
            log("❌ OLD URL found in page content!")
        else:
            log("✅ Old URL not in page HTML")

        if "x6f90klu3dvfsyiudrvzkh6i" in content:
            log("✅ NEW URL found in page content!")
        else:
            log("⚠️  New URL not found in page HTML")

        log("\n=== Fill and submit login form ===")
        email_input = page.locator('input[type="email"]')
        password_input = page.locator('input[type="password"]')
        signin_btn = page.locator('button', has_text="Sign in")

        email_input.fill("admin@vellum.com")
        password_input.fill("password123")

        before_req_count = len(all_requests)
        before_resp_count = len(all_responses)

        log("Clicking Sign in button...")
        signin_btn.click()

        log("Waiting 5 seconds for login request...")
        time.sleep(5)

        new_requests = all_requests[before_req_count:]
        new_responses = all_responses[before_resp_count:]

        log(f"\nNew requests after login click: {len(new_requests)}")
        for r in new_requests[:20]:
            log(f"  {r}")

        log(f"\nNew responses after login click: {len(new_responses)}")
        for r in new_responses[:20]:
            log(f"  {r}")

        log(f"\nConsole errors: {len(console_errors)}")
        for e in console_errors[:10]:
            log(f"  {e}")

        log(f"\nAll console logs: {len(console_all)}")
        for l in console_all[:15]:
            log(f"  {l}")

        page.screenshot(path=f"{OUTPUT_DIR}/06-after-login-debug.png", full_page=True)

        current_url = page.url
        log(f"\nCurrent URL: {current_url}")

        body_text = page.locator("body").inner_text(timeout=3000)
        log(f"Body text ({len(body_text)} chars):")
        log(body_text[:800])

        log("\n=== Check for error messages ===")
        error_el = page.locator('[class*="error"], [class*="destructive"], [role="alert"]').first
        if error_el.count() > 0 and error_el.is_visible(timeout=1000):
            log(f"Error element found: {error_el.inner_text()}")
        else:
            log("No obvious error elements found")

        log("\n=== Test direct fetch from page context ===")
        login_test = page.evaluate("""
            async () => {
                try {
                    const base = (import.meta?.env?.VITE_API_BASE_URL || 'MISSING').replace(/\\/+$/, '');
                    const url = base + '/auth/login';
                    console.log('Fetching:', url);
                    const res = await fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'admin@vellum.com', password: 'password123' })
                    });
                    const text = await res.text();
                    return { status: res.status, url: url, body: text.substring(0, 300) };
                } catch(e) {
                    return { error: e.message };
                }
            }
        """)
        log(f"Login test result: {json.dumps(login_test, indent=2)}")

        browser.close()

if __name__ == "__main__":
    main()

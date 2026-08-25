import sys
import json
import time
import re
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
        for r in all_requests[:20]:
            log(f"  {r}")

        log("\n=== Download and check main JS bundle for API URL ===")
        js_bundle_url = None
        for r in all_requests:
            if "index-" in r and r.endswith(".js"):
                js_bundle_url = r.split(" ")[-1]
                break

        if js_bundle_url:
            log(f"JS bundle: {js_bundle_url}")
            import urllib.request
            try:
                resp = urllib.request.urlopen(js_bundle_url)
                js_content = resp.read().decode('utf-8', errors='replace')
                log(f"JS bundle size: {len(js_content)} chars")

                old_match = "ffzjnfcr4yvv2rn311ybs5tf" in js_content
                new_match = "x6f90klu3dvfsyiudrvzkh6i" in js_content
                log(f"Old URL in bundle: {old_match}")
                log(f"New URL in bundle: {new_match}")

                prisma_urls = re.findall(r'https?://[a-z0-9]+\.ewr\.prisma\.build[^"\'`\s]*', js_content)
                log(f"Prisma URLs found: {len(prisma_urls)}")
                for u in set(prisma_urls):
                    log(f"  {u[:100]}")
            except Exception as e:
                log(f"Error fetching JS: {e}")
        else:
            log("No JS bundle found in requests")

        log("\n=== Fill and submit login form ===")
        email_input = page.locator('input[type="email"]')
        password_input = page.locator('input[type="password"]')
        signin_btn = page.locator('button', has_text="Sign in")

        email_input.fill("admin@vellbase.com")
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
        for l in console_all[:20]:
            log(f"  {l}")

        page.screenshot(path=f"{OUTPUT_DIR}/07-after-login-v3.png", full_page=True)

        current_url = page.url
        log(f"\nCurrent URL: {current_url}")

        body_text = page.locator("body").inner_text(timeout=3000)
        log(f"Body text ({len(body_text)} chars):")
        log(body_text[:1000])

        log("\n=== Test direct fetch from page context ===")
        login_test = page.evaluate("""
            async () => {
                try {
                    const scripts = document.querySelectorAll('script');
                    let found = 'no scripts';
                    for (const s of scripts) {
                        if (s.textContent && s.textContent.includes('prisma.build')) {
                            const match = s.textContent.match(/https?:\\/\\/[a-z0-9]+\\.ewr\\.prisma\\.build[^\"'`\\s]*/);
                            if (match) { found = match[0]; break; }
                        }
                    }
                    return { foundApiBase: found };
                } catch(e) {
                    return { error: e.message };
                }
            }
        """)
        log(f"API base found in page: {json.dumps(login_test)}")

        log("\n=== Direct curl test of login API ===")
        import urllib.request
        try:
            req = urllib.request.Request(
                "https://x6f90klu3dvfsyiudrvzkh6i.ewr.prisma.build/api/auth/login",
                data=json.dumps({"email": "admin@vellbase.com", "password": "password123"}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            resp = urllib.request.urlopen(req, timeout=10)
            body = resp.read().decode()
            log(f"Status: {resp.status}")
            log(f"Response: {body[:300]}")
        except urllib.error.HTTPError as e:
            log(f"HTTP Error: {e.code} - {e.read().decode()[:300]}")
        except Exception as e:
            log(f"Error: {e}")

        browser.close()

if __name__ == "__main__":
    main()

import json
import time
from playwright.sync_api import sync_playwright

DASHBOARD_URL = "https://vellum-admin-dashboard-eta-kappa.vercel.app"

def log(msg):
    print(f"[VERIFY] {msg}", flush=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        api_requests = []
        page.on("request", lambda req: api_requests.append(f"{req.method} {req.url}") if "prisma.build" in req.url else None)

        log("Loading admin dashboard...")
        page.goto(DASHBOARD_URL + "/auth/login", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_load_state("networkidle", timeout=15000)

        log("Testing login...")
        page.locator('input[type="email"]').fill("admin@vellum.com")
        page.locator('input[type="password"]').fill("password123")
        page.locator('button', has_text="Sign in").click()
        page.wait_for_selector('nav, [class*="sidebar"]', timeout=15000)
        time.sleep(2)

        log(f"\nAPI requests made ({len(api_requests)}):")
        old_url_count = 0
        new_url_count = 0
        for r in api_requests:
            if "ffzjnfcr4yvv2rn311ybs5tf" in r:
                old_url_count += 1
                log(f"  OLD: {r}")
            elif "x6f90klu3dvfsyiudrvzkh6i" in r:
                new_url_count += 1
                log(f"  NEW: {r.split('?')[0]}")

        log(f"\n=== SUMMARY ===")
        log(f"Requests to OLD URL: {old_url_count}")
        log(f"Requests to NEW URL: {new_url_count}")
        if old_url_count == 0 and new_url_count > 0:
            log("SUCCESS: All API requests use the new URL!")
        else:
            log("FAIL: Old URL is still being used!")

        browser.close()

if __name__ == "__main__":
    main()

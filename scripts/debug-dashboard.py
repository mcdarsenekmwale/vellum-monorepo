import sys
import json
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
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}") if msg.type != "error" else console_errors.append(msg.text))

        network_errors = []
        page.on("requestfailed", lambda req: network_errors.append(f"{req.method} {req.url} - {req.failure}"))

        log(f"Navigating to {DASHBOARD_URL}...")
        try:
            page.goto(DASHBOARD_URL, wait_until="domcontentloaded", timeout=30000)
            log("Page loaded (domcontentloaded)")
        except Exception as e:
            log(f"Navigation error: {e}")

        log("Waiting for networkidle...")
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
            log("Network idle")
        except Exception as e:
            log(f"Network idle timeout: {e}")

        log("Taking initial screenshot...")
        page.screenshot(path=f"{OUTPUT_DIR}/01-initial.png", full_page=True)

        title = page.title()
        log(f"Page title: {title}")

        content = page.content()
        with open(f"{OUTPUT_DIR}/01-content.html", "w") as f:
            f.write(content)

        log(f"Content length: {len(content)} chars")

        body_text = page.locator("body").inner_text(timeout=5000)
        log(f"Body text length: {len(body_text)} chars")
        log(f"Body preview: {body_text[:500]}")

        if console_errors:
            log(f"\n=== CONSOLE ERRORS ({len(console_errors)}) ===")
            for err in console_errors[:20]:
                log(f"  {err}")

        if console_logs:
            log(f"\n=== CONSOLE LOGS ({len(console_logs)}) ===")
            for l in console_logs[:20]:
                log(f"  {l}")

        if network_errors:
            log(f"\n=== NETWORK ERRORS ({len(network_errors)}) ===")
            for err in network_errors[:20]:
                log(f"  {err}")

        buttons = page.locator("button").all()
        log(f"\n=== BUTTONS FOUND: {len(buttons)} ===")
        for i, btn in enumerate(buttons[:20]):
            try:
                text = btn.inner_text()
                log(f"  [{i}] text='{text[:60]}' visible={btn.is_visible()}")
            except:
                pass

        inputs = page.locator("input").all()
        log(f"\n=== INPUTS FOUND: {len(inputs)} ===")
        for i, inp in enumerate(inputs[:20]):
            try:
                t = inp.get_attribute("type") or "text"
                ph = inp.get_attribute("placeholder") or ""
                log(f"  [{i}] type={t} placeholder='{ph[:60]}'")
            except:
                pass

        links = page.locator("a").all()
        log(f"\n=== LINKS FOUND: {len(links)} ===")
        for i, link in enumerate(links[:20]):
            try:
                text = link.inner_text()
                href = link.get_attribute("href") or ""
                log(f"  [{i}] text='{text[:60]}' href='{href[:80]}'")
            except:
                pass

        api_calls = []
        for l in console_logs:
            if "api" in l.lower() or "fetch" in l.lower() or "xhr" in l.lower():
                api_calls.append(l)
        if api_calls:
            log(f"\n=== API-RELATED LOGS ===")
            for a in api_calls[:10]:
                log(f"  {a}")

        log("\n=== DIAGNOSTIC SUMMARY ===")
        log(f"Page loaded: {'Yes' if title else 'No (blank?)'}")
        log(f"Console errors: {len(console_errors)}")
        log(f"Network errors: {len(network_errors)}")
        log(f"Buttons: {len(buttons)}")
        log(f"Inputs: {len(inputs)}")

        browser.close()
        log("\nDone. Screenshots saved to " + OUTPUT_DIR)

if __name__ == "__main__":
    main()

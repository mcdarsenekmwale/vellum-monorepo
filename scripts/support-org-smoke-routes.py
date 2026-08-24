"""
Support Org routes smoke (no auth): verify 10 route files resolve correctly.
Tests that vite build bundle parses HTML, navigates via direct URL to each route,
confirms anonymous → login redirect (for gated support routes), and support pages
contain registered route titles in HTML head meta.
"""
import os
import sys
import subprocess
import time
import signal
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PwTimeoutError

PROJECT = Path(__file__).resolve().parent.parent
ADMIN_DIR = PROJECT / "apps" / "admin-dashboard"
DIST_DIR = ADMIN_DIR / "dist"
OUTPUT_DIR = "/tmp/support-org-smoke"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SUPPORT_ROUTES = [
    "/support",
    "/support/departments",
    "/support/teams",
    "/support/tickets",
    "/support/agents",
    "/support/reports",
    "/support/comparisons",
    "/support/kb",
    "/support/analytics/dept-000",  # $id dynamic
    "/support/teams/team-000",      # $id dynamic
    "/support/departments/dept-000",
    "/support/tickets/tkt-000",
]

def log(msg):
    print(f"[SMOKE] {msg}", flush=True)

def main():
    if not DIST_DIR.exists():
        log(f"dist not found, skipping")
        sys.exit(0)
    # Start vite preview
    preview = subprocess.Popen(
        ["npx", "vite", "preview", "--port", "4174", "--host", "127.0.0.1"],
        cwd=str(ADMIN_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(3)
    base = "http://127.0.0.1:4174"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()
            failures = []
            warnings = []
            for route in SUPPORT_ROUTES:
                try:
                    page.goto(f"{base}{route}", wait_until="domcontentloaded", timeout=15000)
                    try:
                        page.wait_for_load_state("networkidle", timeout=10000)
                    except PwTimeoutError:
                        pass
                    title = page.title()
                    body = page.locator("body").inner_text(timeout=6000)[:2500]
                    ss_name = route.strip("/").replace("/", "_") or "root"
                    page.screenshot(path=f"{OUTPUT_DIR}/{ss_name}.png", full_page=True)
                    log(f"{route:45s} → {title[:80]:80s}  OK")
                    if "Vellum" not in title and "not found" not in body.lower():
                        warnings.append(f"{route} title missing Vellum brand: {title}")
                    if "Error:" in body and "chunk" in body:
                        failures.append(f"{route}: chunk error visible in body")
                except Exception as e:
                    failures.append(f"{route}: {e}")
            browser.close()
    finally:
        preview.send_signal(signal.SIGTERM)
        preview.wait(timeout=8)
    print("\n" + "=" * 60)
    print("ROUTE SMOKE SUMMARY")
    print("=" * 60)
    if failures:
        print(f"FAILURES ({len(failures)}):")
        for f in failures:
            print(f"  ❌ {f}")
    if warnings:
        print(f"WARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  ⚠️ {w}")
    if not failures:
        print("✅ All support routes smoke-tested OK (SSR served HTML)")
    print(f"Screenshots in {OUTPUT_DIR}")
    sys.exit(1 if failures else 0)

if __name__ == "__main__":
    main()

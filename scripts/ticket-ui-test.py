#!/usr/bin/env python3
"""
Ticket UI Comparison Test v4 — proper login via API for both apps,
sets cookies + localStorage, then checks ticket display.
"""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright

API_BASE = "http://localhost:3001"
WEB_URL = "http://localhost:3003"
MOBILE_URL = "http://localhost:8082"
EMAIL = "ticket-test@vellum.dev"
PASSWORD = "Test12345!"

def api_login():
    data = json.dumps({"email": EMAIL, "password": PASSWORD}).encode()
    req = urllib.request.Request(f"{API_BASE}/api/auth/login", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def fetch_tickets(token):
    req = urllib.request.Request(f"{API_BASE}/api/help/tickets?page=1&limit=20", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

async def main():
    print("=" * 70)
    print("  TICKET UI COMPARISON TEST (v4)")
    print("=" * 70)

    auth = api_login()
    token = auth["accessToken"]
    user = auth.get("user", {})

    api_tickets = fetch_tickets(token)
    api_subjects = sorted([t["subject"] for t in api_tickets.get("data", [])])
    api_statuses = {t["subject"]: t["status"] for t in api_tickets.get("data", [])}
    print(f"\n  API returns {len(api_subjects)} ticket(s):")
    for s in api_subjects:
        print(f"    - [{api_statuses[s]}] {s}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # ── Mobile App ──
        print("\n>>> Mobile App UI Test")
        mobile_ctx = await browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/537.36"
        )
        mobile_page = await mobile_ctx.new_page()

        mobile_logs = []
        mobile_page.on("console", lambda msg: mobile_logs.append(f"[{msg.type}] {msg.text}"))
        mobile_page.on("pageerror", lambda err: mobile_logs.append(f"[ERROR] {err}"))
        mobile_reqs = []
        mobile_page.on("request", lambda req: mobile_reqs.append(f"REQ {req.method} {req.url}") if "help/tickets" in req.url else None)
        mobile_page.on("response", lambda resp: mobile_reqs.append(f"RESP {resp.status} {resp.url}") if "help/tickets" in resp.url else None)

        mobile_subjects = []
        try:
            # First load to set localStorage
            await mobile_page.goto(MOBILE_URL, wait_until="commit", timeout=30000)
            await mobile_page.wait_for_timeout(2000)

            # Inject tokens
            await mobile_page.evaluate(f"""() => {{
                localStorage.setItem('vellum_access_token', '{token}');
                localStorage.setItem('vellum_refresh_token', '{auth.get("refreshToken", "")}');
                localStorage.setItem('vellum_user', '{json.dumps(user)}');
            }}""")

            # Navigate to help-tickets
            await mobile_page.goto(f"{MOBILE_URL}/help-tickets", wait_until="commit", timeout=30000)
            await mobile_page.wait_for_timeout(8000)

            print("  [MOBILE] Network requests:")
            for r in mobile_reqs:
                print(f"    {r}")

            print("\n  [MOBILE] Console errors:")
            for l in mobile_logs:
                if "error" in l.lower():
                    print(f"    {l}")

            body = await mobile_page.evaluate("() => document.body.innerText")
            print(f"\n  [MOBILE] Page text:\n  {body[:2000]}")

            for s in api_subjects:
                if s in body:
                    mobile_subjects.append(s)
                    print(f"  [MOBILE] ✅ Found: '{s}'")
                else:
                    print(f"  [MOBILE] ❌ NOT found: '{s}'")

            try:
                await mobile_page.screenshot(path="/tmp/mobile-tickets.png")
            except: pass

        except Exception as e:
            print(f"  [MOBILE] ERROR: {e}")
        await mobile_ctx.close()

        # ── Web App ──
        print("\n>>> Web App UI Test")
        web_ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        web_page = await web_ctx.new_page()

        web_logs = []
        web_page.on("console", lambda msg: web_logs.append(f"[{msg.type}] {msg.text}"))
        web_page.on("pageerror", lambda err: web_logs.append(f"[ERROR] {err}"))
        web_reqs = []
        web_page.on("request", lambda req: web_reqs.append(f"REQ {req.method} {req.url}") if "help/tickets" in req.url else None)
        web_page.on("response", lambda resp: web_reqs.append(f"RESP {resp.status} {resp.url}") if "help/tickets" in resp.url else None)

        web_subjects = []
        try:
            # Use Playwright's API request to login via the web app's API (sets cookies)
            # First navigate to the web app origin
            await web_page.goto(WEB_URL, wait_until="commit", timeout=30000)
            await web_page.wait_for_timeout(2000)

            # Do a fetch-based login from the page context (this sets cookies + we store token)
            login_result = await web_page.evaluate(f"""async () => {{
                const resp = await fetch('{API_BASE}/api/auth/login', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    credentials: 'include',
                    body: JSON.stringify({{email: '{EMAIL}', password: '{PASSWORD}'}})
                }});
                const data = await resp.json();
                localStorage.setItem('vellum_access_token', data.accessToken);
                localStorage.setItem('vellum_refresh_token', data.refreshToken);
                localStorage.setItem('vellum_user', JSON.stringify(data.user));
                return {{ok: resp.ok, token: data.accessToken?.substring(0, 20)}};
            }}""")
            print(f"  [WEB] Login via fetch: {login_result}")

            # Navigate to settings/help
            await web_page.goto(f"{WEB_URL}/settings/help", wait_until="commit", timeout=30000)
            await web_page.wait_for_timeout(5000)

            # Click "My Tickets" tab
            try:
                tab = web_page.locator('button:has-text("My Tickets")').first
                if await tab.is_visible():
                    await tab.click()
                    print("  [WEB] Clicked 'My Tickets' tab")
                    await web_page.wait_for_timeout(3000)
            except:
                pass

            print("  [WEB] Network requests:")
            for r in web_reqs:
                print(f"    {r}")

            print("\n  [WEB] Console errors:")
            for l in web_logs:
                if "error" in l.lower():
                    print(f"    {l}")

            body = await web_page.evaluate("() => document.body.innerText")
            print(f"\n  [WEB] Page text (first 2000):\n  {body[:2000]}")

            for s in api_subjects:
                if s in body:
                    web_subjects.append(s)
                    print(f"  [WEB] ✅ Found: '{s}'")
                else:
                    print(f"  [WEB] ❌ NOT found: '{s}'")

        except Exception as e:
            print(f"  [WEB] ERROR: {e}")
        await web_ctx.close()
        await browser.close()

    # ── Final Comparison ──
    print("\n" + "=" * 70)
    print("  FINAL COMPARISON")
    print("=" * 70)
    print(f"  API tickets:          {api_subjects}")
    print(f"  Web UI found:         {sorted(web_subjects)}")
    print(f"  Mobile UI found:      {sorted(mobile_subjects)}")
    print()
    w_ok = sorted(web_subjects) == api_subjects
    m_ok = sorted(mobile_subjects) == api_subjects
    print(f"  Web == API:           {'✅ YES' if w_ok else '❌ NO'}")
    print(f"  Mobile == API:        {'✅ YES' if m_ok else '❌ NO'}")
    print(f"  Web == Mobile:        {'✅ YES' if sorted(web_subjects) == sorted(mobile_subjects) else '❌ NO'}")

    if w_ok and m_ok:
        print("\n  🎉 SUCCESS: Both apps display the same tickets!")
    else:
        print("\n  ⚠️  See diagnostics above for issues.")

asyncio.run(main())

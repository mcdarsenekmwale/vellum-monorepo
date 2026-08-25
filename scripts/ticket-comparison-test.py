#!/usr/bin/env python3
"""
Ticket Comparison Test
======================
Logs into both the web app and mobile app (web build), navigates to the
tickets/help-center section, and compares the tickets displayed.

Reports discrepancies in:
  - Ticket count
  - Ticket subjects
  - Ticket IDs / numbers
  - Ticket statuses
"""

import asyncio
import json
import re
import sys
from playwright.async_api import async_playwright

# ── Configuration ──────────────────────────────────────────────────────────
WEB_APP_URL = "http://localhost:3003"
MOBILE_APP_URL = "http://localhost:8082"
API_BASE = "http://localhost:3001"
TEST_EMAIL = "ticket-test@vellbase.dev"
TEST_PASSWORD = "Test12345!"
TIMEOUT = 15000

# ── Helpers ────────────────────────────────────────────────────────────────
async def wait_for_visible(page, selector, timeout=TIMEOUT):
    """Wait for an element to be visible."""
    el = page.locator(selector).first
    await el.wait_for(state="visible", timeout=timeout)
    return el

async def login_web_app(page):
    """Login on the web app."""
    print("[WEB] Navigating to login page...")
    await page.goto(f"{WEB_APP_URL}/login", wait_until="networkidle")
    await page.wait_for_timeout(2000)

    # Fill email
    email_input = page.locator('input[type="email"], input[name="email"]').first
    await email_input.wait_for(state="visible", timeout=TIMEOUT)
    await email_input.fill(TEST_EMAIL)

    # Fill password
    pwd_input = page.locator('input[type="password"], input[name="password"]').first
    await pwd_input.wait_for(state="visible", timeout=TIMEOUT)
    await pwd_input.fill(TEST_PASSWORD)

    # Click sign in button
    sign_in = page.locator('button:has-text("Sign In"), button:has-text("Sign in"), button[type="submit"]').first
    await sign_in.click()
    await page.wait_for_timeout(3000)
    print(f"[WEB] Logged in. Current URL: {page.url}")

async def login_mobile_app(page):
    """Login on the mobile app (web build)."""
    print("[MOBILE] Navigating to login page...")
    await page.goto(f"{MOBILE_APP_URL}/login", wait_until="networkidle")
    await page.wait_for_timeout(3000)

    # Fill email
    email_input = page.locator('input[type="email"], input[name="email"]').first
    await email_input.wait_for(state="visible", timeout=TIMEOUT)
    await email_input.fill(TEST_EMAIL)

    # Fill password
    pwd_input = page.locator('input[type="password"], input[name="password"]').first
    await pwd_input.wait_for(state="visible", timeout=TIMEOUT)
    await pwd_input.fill(TEST_PASSWORD)

    # Click sign in button
    sign_in = page.locator('text=/^Sign In$/i, button:has-text("Sign In"), button:has-text("Sign in")').first
    await sign_in.click()
    await page.wait_for_timeout(3000)
    print(f"[MOBILE] Logged in. Current URL: {page.url}")

async def capture_web_tickets(page):
    """Navigate to web app help center tickets tab and capture displayed tickets."""
    print("[WEB] Navigating to Settings > Help...")
    await page.goto(f"{WEB_APP_URL}/settings/help", wait_until="networkidle")
    await page.wait_for_timeout(3000)

    # Click the "My Tickets" tab
    try:
        tickets_tab = page.locator('button:has-text("My Tickets"), [role="tab"]:has-text("My Tickets"), button:has-text("Tickets")').first
        await tickets_tab.wait_for(state="visible", timeout=TIMEOUT)
        await tickets_tab.click()
        await page.wait_for_timeout(2000)
    except Exception as e:
        print(f"[WEB] Warning: Could not click Tickets tab: {e}")

    # Capture all ticket subjects and IDs from the page
    tickets_data = await page.evaluate("""
        () => {
            const tickets = [];
            // Look for ticket subject text elements
            const subjectEls = document.querySelectorAll('p.truncate, .text-sm.font-medium.truncate');
            const statusEls = document.querySelectorAll('.text-\\\\[10px\\\\].px-2, span[class*="rounded-full"].font-medium');
            const numberEls = document.querySelectorAll('.font-mono');

            for (let i = 0; i < subjectEls.length; i++) {
                tickets.push({
                    subject: subjectEls[i]?.textContent?.trim() || '',
                    status: statusEls[i]?.textContent?.trim() || '',
                    number: numberEls[i]?.textContent?.trim() || '',
                });
            }

            // Also grab any text that looks like ticket content
            const bodyText = document.body.innerText;

            return { tickets, bodyText: bodyText.substring(0, 5000) };
        }
    """)

    return tickets_data

async def capture_mobile_tickets(page):
    """Navigate to mobile app help-tickets screen and capture displayed tickets."""
    print("[MOBILE] Navigating to Help Tickets...")
    await page.goto(f"{MOBILE_APP_URL}/help-tickets", wait_until="networkidle")
    await page.wait_for_timeout(4000)

    # Capture ticket data from the mobile app
    tickets_data = await page.evaluate("""
        () => {
            const tickets = [];
            const bodyText = document.body.innerText;

            // React Native Web renders text in <div> or <span>
            // Look for ticket subjects - typically in Text components
            const allText = document.querySelectorAll('div, span, p');
            const ticketPattern = /TKT-|ticket-|Test Ticket/i;

            for (const el of allText) {
                const text = el.textContent?.trim();
                if (text && ticketPattern.test(text) && text.length < 200) {
                    tickets.push({ text });
                }
            }

            return { tickets, bodyText: bodyText.substring(0, 5000) };
        }
    """)

    return tickets_data

async def fetch_api_tickets_web(token):
    """Fetch tickets via the web app API endpoint."""
    import urllib.request
    req = urllib.request.Request(
        f"{API_BASE}/api/help/tickets?page=1&limit=20",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

async def fetch_api_tickets_mobile(token):
    """Fetch tickets via the mobile app API endpoint."""
    import urllib.request
    req = urllib.request.Request(
        f"{API_BASE}/api/v1/help/tickets?page=1&perPage=20&status=all",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

async def get_token():
    """Login via API to get a JWT token."""
    import urllib.request
    data = json.dumps({"email": TEST_EMAIL, "password": TEST_PASSWORD}).encode()
    req = urllib.request.Request(
        f"{API_BASE}/api/auth/login",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        return result["accessToken"]

# ── Main Test ──────────────────────────────────────────────────────────────
async def main():
    print("=" * 70)
    print("  TICKET COMPARISON TEST: Web App vs Mobile App")
    print("=" * 70)

    # First, fetch tickets via both API endpoints to compare data sources
    print("\n>>> Step 1: Fetch tickets via both API endpoints")
    token = await get_token()
    print(f"  Token acquired: {token[:30]}...")

    api_web = await fetch_api_tickets_web(token)
    api_mobile = await fetch_api_tickets_mobile(token)

    web_ticket_count = len(api_web.get("data", []))
    mobile_ticket_count = len(api_mobile.get("items", []))

    print(f"\n  Web API (/api/help/tickets):     {web_ticket_count} ticket(s)")
    for t in api_web.get("data", []):
        print(f"    - [{t.get('status', '?')}] {t.get('subject', '?')} (id={t.get('id', '?')[:20]})")

    print(f"\n  Mobile API (/api/v1/help/tickets): {mobile_ticket_count} ticket(s)")
    for t in api_mobile.get("items", []):
        print(f"    - [{t.get('status', '?')}] {t.get('subject', '?')} (id={t.get('id', '?')})")

    if web_ticket_count != mobile_ticket_count:
        print("\n  ⚠️  DISCREPANCY: Different ticket counts from the two API endpoints!")
    else:
        web_subjects = {t.get("subject") for t in api_web.get("data", [])}
        mobile_subjects = {t.get("subject") for t in api_mobile.get("items", [])}
        if web_subjects != mobile_subjects:
            print("\n  ⚠️  DISCREPANCY: Same count but different ticket subjects!")
        else:
            print("\n  ✅ Same tickets from both API endpoints")

    # Now test the UI of both apps
    print("\n>>> Step 2: Launch browser and test web app UI")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # ── Web App ──
        web_context = await browser.new_context(viewport={"width": 1280, "height": 900})
        web_page = await web_context.new_page()

        try:
            await login_web_app(web_page)
            web_data = await capture_web_tickets(web_page)
            print(f"\n  [WEB UI] Tickets found on page: {len(web_data.get('tickets', []))}")
            for t in web_data.get("tickets", []):
                print(f"    - Subject: {t.get('subject', '?')}")
                print(f"      Status:  {t.get('status', '?')}")
                print(f"      Number:  {t.get('number', '?')}")

            # Check for error states
            web_body = web_data.get("bodyText", "")
            if "No tickets" in web_body or "no tickets" in web_body.lower():
                print("  [WEB UI] ⚠️ 'No tickets' message displayed")
            if "error" in web_body.lower() or "Error" in web_body:
                print("  [WEB UI] ⚠️ Error message detected on page")
        except Exception as e:
            print(f"  [WEB UI] ERROR: {e}")
            web_data = {"tickets": [], "bodyText": str(e)}

        await web_context.close()

        # ── Mobile App ──
        print("\n>>> Step 3: Launch browser and test mobile app UI")
        mobile_context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/537.36"
        )
        mobile_page = await mobile_context.new_page()

        try:
            await login_mobile_app(mobile_page)
            mobile_data = await capture_mobile_tickets(mobile_data)
            print(f"\n  [MOBILE UI] Ticket-related text elements found: {len(mobile_data.get('tickets', []))}")
            for t in mobile_data.get("tickets", []):
                print(f"    - {t.get('text', '?')}")

            mobile_body = mobile_data.get("bodyText", "")
            print(f"\n  [MOBILE UI] Page text (first 2000 chars):\n{mobile_body[:2000]}")

            if "No tickets" in mobile_body or "no tickets" in mobile_body.lower():
                print("  [MOBILE UI] ⚠️ 'No tickets' message displayed")
            if "error" in mobile_body.lower():
                print("  [MOBILE UI] ⚠️ Error message detected on page")
        except Exception as e:
            print(f"  [MOBILE UI] ERROR: {e}")
            mobile_data = {"tickets": [], "bodyText": str(e)}

        await mobile_context.close()
        await browser.close()

    # ── Comparison Summary ──
    print("\n" + "=" * 70)
    print("  COMPARISON SUMMARY")
    print("=" * 70)
    print(f"\n  Web API tickets:     {web_ticket_count}")
    print(f"  Mobile API tickets:  {mobile_ticket_count}")
    print(f"  Same data source:    {'YES' if web_ticket_count == mobile_ticket_count else 'NO ❌'}")

    web_subjects_api = {t.get("subject") for t in api_web.get("data", [])}
    mobile_subjects_api = {t.get("subject") for t in api_mobile.get("items", [])}
    print(f"  Same ticket subjects: {'YES' if web_subjects_api == mobile_subjects_api else 'NO ❌'}")

    print(f"\n  Web API response shape:     {list(api_web.keys())}")
    print(f"  Mobile API response shape:  {list(api_mobile.keys())}")
    print(f"  Same response shape:        {'YES' if set(api_web.keys()) == set(api_mobile.keys()) else 'NO ❌'}")

    # ── Discrepancy Details ──
    print("\n>>> DISCREPANCY ANALYSIS:")
    print("""
  1. ENDPOINT MISMATCH:
     - Web app calls:     GET /api/help/tickets     (HelpController → SupportService → PostgreSQL)
     - Mobile app calls:  GET /api/v1/help/tickets  (HelpCenterController → HelpCenterService → In-memory store)

  2. DATA STORE MISMATCH:
     - Web app tickets are persisted in PostgreSQL (survive server restart)
     - Mobile app tickets are in an in-memory store (lost on server restart)
     - Tickets created in one app are NOT visible in the other

  3. RESPONSE SHAPE MISMATCH:
     - Web API returns:    { data: [...], total, page, pageSize }
     - Mobile API returns: { items: [...], total, page, perPage }
     - Mobile app code expects: SupportTicketListItem[] (bare array)

  4. TICKET SHAPE MISMATCH:
     - Web ticket:     { id (UUID), ticketNumber, subject, message, status: "NEW", priority, ... }
     - Mobile ticket:  { id ("ticket-N"), ownerId, subject, status: "open", messages: [] }

  FIX REQUIRED:
     Mobile app's BackendApi.ts should call /api/help/tickets (same as web app)
     and parse the { data: [...] } response shape.
""")

asyncio.run(main())

"""Quick login-page recon: find actual email/password/submit selectors on the running page."""
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 414, "height": 896})
    page = ctx.new_page()
    page.goto("http://localhost:19006/login", wait_until="domcontentloaded", timeout=45000)
    # Wait for network idle per webapp-testing skill
    try: page.wait_for_load_state("networkidle", timeout=15000)
    except Exception: pass
    page.wait_for_timeout(5000)
    page.screenshot(path="/tmp/recon_login.png", full_page=True)
    out = page.evaluate(
        """() => {
            function info(el) {
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return {
                    tag: el.tagName?.toLowerCase(),
                    cls: (el.className || '').toString().slice(0, 120),
                    id: el.id || null,
                    tid: el.getAttribute?.('data-testid') || el.getAttribute?.('testID') || el.getAttribute?.('accessibilityLabel') || null,
                    role: el.getAttribute?.('role') || null,
                    type: el.getAttribute?.('type') || null,
                    placeholder: el.getAttribute?.('placeholder') || null,
                    innerText: (el.innerText || el.textContent || '').slice(0, 160),
                    w: Math.round(r.width), h: Math.round(r.height),
                    x: Math.round(r.x), y: Math.round(r.y),
                    hasOnClick: !!(el.onclick || el.getAttribute?.('onclick')),
                    handlers: null,
                };
            }
            const inputs = Array.from(document.querySelectorAll('input'))
                .concat(Array.from(document.querySelectorAll('textarea')))
                .map(info);
            const buttons = Array.from(document.querySelectorAll('button'))
                .concat(Array.from(document.querySelectorAll('[role="button"]')))
                .concat(Array.from(document.querySelectorAll('Pressable, [class*="Pressable"], [class*="pressable"]')))
                .map(info);
            // Sort by area
            buttons.sort((a,b) => Math.max(0,b.w*b.h) - Math.max(0,a.w*a.h));
            return {
                path: location.pathname,
                bodyText: (document.body?.innerText || '').slice(0, 2000),
                inputs, buttons: buttons.slice(0, 40),
            };
        }"""
    )
    print(json.dumps(out, indent=2, ensure_ascii=False))
    ctx.close()
    browser.close()

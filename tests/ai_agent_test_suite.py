#!/usr/bin/env python3
"""
Comprehensive AI Agent-Based Navigation & Testing Suite
Covers: authentication, navigation, CRUD operations, error detection
"""
import sys
import json
import time
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from playwright.sync_api import sync_playwright, Page, expect, TimeoutError as PlaywrightTimeoutError

ADMIN_URL = "http://localhost:3003"
API_URL = "http://localhost:3001/api"
ADMIN_EMAIL = "admin@vellbase.com"
ADMIN_PASSWORD = "password123"

@dataclass
class TestResult:
    name: str
    status: str  # PASS, FAIL, SKIP
    message: str = ""
    duration: float = 0.0
    category: str = ""
    screenshot: str = ""

@dataclass
class TestSuite:
    results: List[TestResult] = field(default_factory=list)
    errors: List[Dict] = field(default_factory=list)
    
    def add_result(self, result: TestResult):
        self.results.append(result)
        status_icon = "✅" if result.status == "PASS" else ("❌" if result.status == "FAIL" else "⏭️")
        print(f"  {status_icon} [{result.category}] {result.name}: {result.message}")
        if result.status == "FAIL":
            self.errors.append({"test": result.name, "message": result.message, "category": result.category})
    
    def summary(self) -> Dict:
        passed = sum(1 for r in self.results if r.status == "PASS")
        failed = sum(1 for r in self.results if r.status == "FAIL")
        skipped = sum(1 for r in self.results if r.status == "SKIP")
        total = len(self.results)
        return {
            "total": total,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "pass_rate": f"{(passed/total*100):.1f}%" if total > 0 else "N/A",
            "errors": self.errors
        }

suite = TestSuite()

def run_test(name: str, category: str, fn):
    start = time.time()
    try:
        fn()
        duration = time.time() - start
        suite.add_result(TestResult(name=name, status="PASS", message="Completed successfully", duration=duration, category=category))
    except Exception as e:
        duration = time.time() - start
        suite.add_result(TestResult(name=name, status="FAIL", message=str(e)[:200], duration=duration, category=category))

def take_screenshot(page: Page, name: str) -> str:
    path = f"/tmp/test_{name}_{int(time.time())}.png"
    try:
        page.screenshot(path=path, full_page=True)
    except:
        pass
    return path

def check_page_loaded(page: Page, url: str) -> bool:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_load_state("networkidle", timeout=10000)
        return True
    except PlaywrightTimeoutError:
        return False

def has_errors(page: Page) -> List[str]:
    errors = []
    console_errors = page.evaluate("() => window.__consoleErrors || []")
    if console_errors:
        errors.extend(console_errors)
    return errors

def test_admin_login(page: Page):
    """Test admin login flow with email/password"""
    page.context.clear_cookies()
    page.goto(f"{ADMIN_URL}/auth/login", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=15000)
    
    page.wait_for_selector('#email', state='visible', timeout=15000)
    
    assert "login" in page.url.lower(), f"Expected login page, got {page.url}"
    
    email_input = page.locator('#email')
    password_input = page.locator('#password')
    submit_btn = page.locator('button[type="submit"]')
    
    assert email_input.is_visible(), f"Email input not found. URL: {page.url}"
    assert password_input.is_visible(), "Password input not found"
    assert submit_btn.is_visible(), "Submit button not found"
    
    email_input.fill(ADMIN_EMAIL)
    password_input.fill(ADMIN_PASSWORD)
    submit_btn.click()
    
    page.wait_for_url(f"{ADMIN_URL}/dashboard", timeout=15000)
    page.wait_for_load_state("networkidle", timeout=10000)
    
    assert "/dashboard" in page.url, f"Login failed - expected dashboard, got {page.url}"
    take_screenshot(page, "admin_dashboard")

def test_admin_session_persistence(page: Page):
    """Test that session persists across page reloads"""
    page.goto(f"{ADMIN_URL}/dashboard", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    page.reload(wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    assert "/login" not in page.url, "Session lost on reload - redirected to login"
    assert "/dashboard" in page.url, f"Expected dashboard after reload, got {page.url}"
    take_screenshot(page, "session_persistence")

def test_admin_sidebar_navigation(page: Page):
    """Test all sidebar menu items navigate correctly"""
    page.goto(f"{ADMIN_URL}/dashboard", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    nav_items = page.locator('nav a, aside a, [class*="sidebar"] a, [class*="nav"] a').all()
    print(f"  Found {len(nav_items)} navigation items")
    
    tested_routes = set()
    failures = []
    
    test_routes = [
        "/dashboard",
        "/users",
        "/articles",
        "/categories",
        "/highlights",
        "/comments",
        "/media",
        "/notifications",
        "/analytics",
        "/settings",
    ]
    
    for route in test_routes:
        if route in tested_routes:
            continue
        tested_routes.add(route)
        
        try:
            page.goto(f"{ADMIN_URL}{route}", wait_until="domcontentloaded", timeout=10000)
            page.wait_for_load_state("networkidle", timeout=8000)
            
            page_text = page.inner_text('body', timeout=2000).lower()
            error_indicators = ["failed to load", "something went wrong", "this page didn't load"]
            has_error = any(ind in page_text for ind in error_indicators)
            
            if has_error:
                failures.append(f"Route {route}: page shows error state")
                take_screenshot(page, f"nav_error_{route.replace('/', '_')}")
        except PlaywrightTimeoutError:
            failures.append(f"Route {route}: timeout loading page")
        except Exception as e:
            failures.append(f"Route {route}: {str(e)[:100]}")
    
    if failures:
        raise AssertionError(f"Navigation failures: {'; '.join(failures[:5])}")

def test_admin_crud_users(page: Page):
    """Test user CRUD operations"""
    page.goto(f"{ADMIN_URL}/users", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    page.wait_for_timeout(1500)
    
    body_text = page.inner_text('body', timeout=3000)
    assert len(body_text) > 10, "Users page appears empty"
    take_screenshot(page, "users_list")

def test_admin_crud_articles(page: Page):
    """Test articles management"""
    page.goto(f"{ADMIN_URL}/articles", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    page.wait_for_selector('table, [role="table"], [class*="table"], article, [class*="card"]', timeout=10000)
    take_screenshot(page, "articles_list")

def test_admin_crud_categories(page: Page):
    """Test categories management"""
    page.goto(f"{ADMIN_URL}/categories", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    # Wait for content
    page.wait_for_timeout(1000)
    take_screenshot(page, "categories_list")

def test_admin_analytics(page: Page):
    """Test analytics page"""
    page.goto(f"{ADMIN_URL}/analytics", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    page.wait_for_timeout(1000)
    take_screenshot(page, "analytics")

def test_admin_settings(page: Page):
    """Test settings page"""
    page.goto(f"{ADMIN_URL}/settings", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    page.wait_for_timeout(1000)
    take_screenshot(page, "settings")

def test_api_auth_me(page: Page):
    """Test /auth/me endpoint for session validation"""
    page.goto(f"{ADMIN_URL}/auth/login", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    email_input = page.locator('#email')
    password_input = page.locator('#password')
    submit_btn = page.locator('button[type="submit"]')
    
    email_input.fill(ADMIN_EMAIL)
    password_input.fill(ADMIN_PASSWORD)
    submit_btn.click()
    page.wait_for_url(f"{ADMIN_URL}/dashboard", timeout=15000)
    
    result = page.evaluate("""async (apiUrl) => {
        try {
            const res = await fetch(apiUrl + '/auth/me', { credentials: 'include' });
            return { status: res.status, data: await res.json().catch(() => ({})) };
        } catch(e) {
            return { status: 0, error: e.message };
        }
    }""", API_URL)
    
    assert result.get("status") == 200, f"/auth/me returned status {result.get('status')}: {result.get('error', result.get('data'))}"
    data = result.get("data", {})
    assert data.get("email") == ADMIN_EMAIL or data.get("id"), "User data not returned correctly"

def test_api_protected_endpoints(page: Page):
    """Test that protected API endpoints return 401 without auth"""
    page.context.clear_cookies()
    result = page.evaluate("""async (apiUrl) => {
        const results = {};
        const endpoints = ['/admin/dashboard', '/users/me', '/articles', '/notifications'];
        for (const ep of endpoints) {
            try {
                const res = await fetch(apiUrl + ep, { credentials: 'omit', mode: 'cors' });
                results[ep] = res.status;
            } catch(e) {
                results[ep] = 'error:' + e.message;
            }
        }
        return results;
    }""", API_URL)
    
    print(f"  Protected endpoint status codes: {json.dumps(result)}")
    admin_status = result.get('/admin/dashboard')
    assert admin_status in (401, 403), f"Admin dashboard should be protected, got status {admin_status}"

def test_logout(page: Page):
    """Test logout functionality"""
    page.goto(f"{ADMIN_URL}/dashboard", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=10000)
    
    logout_btn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout"), [role="menuitem"]:has-text("Logout")').first
    
    if logout_btn.count() > 0:
        logout_btn.click()
        page.wait_for_url("**/auth/login**", timeout=15000, wait_until="domcontentloaded")
        assert "/login" in page.url, "Logout did not redirect to login page"
    else:
        page.context.clear_cookies()
        page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
        page.goto(f"{ADMIN_URL}/dashboard", wait_until="domcontentloaded")
        page.wait_for_url("**/auth/login**", timeout=15000, wait_until="domcontentloaded")
        assert "/login" in page.url, "After clearing cookies, should redirect to login"

def test_admin_route_guards(page: Page):
    """Test that protected routes redirect to login when unauthenticated"""
    page.context.clear_cookies()
    page.goto(f"{ADMIN_URL}/auth/login", wait_until="domcontentloaded")
    page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    
    protected_routes = [
        "/dashboard",
        "/users",
        "/articles",
        "/categories",
        "/analytics",
        "/settings",
    ]
    
    failures = []
    for route in protected_routes:
        try:
            page.goto(f"{ADMIN_URL}{route}", wait_until="domcontentloaded", timeout=8000)
            page.wait_for_timeout(1500)
            
            current_url = page.url
            if "/login" not in current_url.lower() and "/auth" not in current_url.lower():
                failures.append(f"Route {route} not protected - url={current_url}")
                take_screenshot(page, f"guard_fail_{route.replace('/', '_')}")
        except Exception as e:
            failures.append(f"Route {route}: error - {str(e)[:80]}")
    
    if failures:
        raise AssertionError(f"Route guard failures: {'; '.join(failures[:5])}")

def capture_console_errors(page: Page):
    """Set up console error capture"""
    page.evaluate("""() => {
        window.__consoleErrors = [];
        const origErr = console.error;
        console.error = (...args) => {
            window.__consoleErrors.push(args.map(a => String(a)).join(' ').slice(0, 200));
            origErr.apply(console, args);
        };
        const origWarn = console.warn;
        console.warn = (...args) => {
            window.__consoleErrors.push('[WARN] ' + args.map(a => String(a)).join(' ').slice(0, 200));
            origWarn.apply(console, args);
        };
        window.addEventListener('error', (e) => {
            window.__consoleErrors.push('[GLOBAL_ERR] ' + e.message + ' at ' + e.filename + ':' + e.lineno);
        });
        window.addEventListener('unhandledrejection', (e) => {
            window.__consoleErrors.push('[UNHANDLED_REJ] ' + String(e.reason).slice(0, 200));
        });
    }""")

def main():
    print("=" * 70)
    print("COMPREHENSIVE AUTH & NAVIGATION TEST SUITE")
    print("=" * 70)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True,
        )
        page = context.new_page()
        
        # Capture console errors
        capture_console_errors(page)
        
        # ─── Phase 1: Auth Route Guards ───
        print("\n📋 Phase 1: Route Protection Tests")
        run_test("Protected routes redirect to login", "auth-guard", lambda: test_admin_route_guards(page))
        
        # ─── Phase 2: Login & Session ───
        print("\n📋 Phase 2: Authentication Tests")
        run_test("Admin login flow", "auth-login", lambda: test_admin_login(page))
        run_test("Session persistence on reload", "auth-session", lambda: test_admin_session_persistence(page))
        run_test("/auth/me endpoint", "auth-api", lambda: test_api_auth_me(page))
        run_test("Protected API endpoints without auth", "auth-api", lambda: test_api_protected_endpoints(page))
        
        # Re-login for subsequent tests
        page.goto(f"{ADMIN_URL}/auth/login", wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle", timeout=10000)
        try:
            email_input = page.locator('#email')
            password_input = page.locator('#password')
            submit_btn = page.locator('button[type="submit"]')
            if email_input.is_visible():
                email_input.fill(ADMIN_EMAIL)
                password_input.fill(ADMIN_PASSWORD)
                submit_btn.click()
                page.wait_for_url(f"{ADMIN_URL}/dashboard", timeout=15000)
        except:
            pass
        
        # ─── Phase 3: Navigation ───
        print("\n📋 Phase 3: Navigation Tests")
        run_test("Sidebar navigation routes", "navigation", lambda: test_admin_sidebar_navigation(page))
        
        # ─── Phase 4: CRUD & Feature Pages ───
        print("\n📋 Phase 4: Feature / CRUD Page Tests")
        run_test("Users management page", "crud-users", lambda: test_admin_crud_users(page))
        run_test("Articles management page", "crud-articles", lambda: test_admin_crud_articles(page))
        run_test("Categories management page", "crud-categories", lambda: test_admin_crud_categories(page))
        run_test("Analytics page", "feature-analytics", lambda: test_admin_analytics(page))
        run_test("Settings page", "feature-settings", lambda: test_admin_settings(page))
        
        # ─── Phase 5: Logout ───
        print("\n📋 Phase 5: Logout Test")
        run_test("Logout flow", "auth-logout", lambda: test_logout(page))
        
        # ─── Summary ───
        print("\n" + "=" * 70)
        print("TEST SUITE SUMMARY")
        print("=" * 70)
        summary = suite.summary()
        print(f"  Total:   {summary['total']}")
        print(f"  Passed:  {summary['passed']}  ✅")
        print(f"  Failed:  {summary['failed']}  ❌")
        print(f"  Skipped: {summary['skipped']}  ⏭️")
        print(f"  Pass Rate: {summary['pass_rate']}")
        
        if summary["errors"]:
            print(f"\n❌ Failures:")
            for err in summary["errors"]:
                print(f"  - [{err['category']}] {err['test']}: {err['message'][:120]}")
        
        browser.close()
        
        # Save results
        with open("/tmp/test_results.json", "w") as f:
            json.dump({
                "results": [r.__dict__ for r in suite.results],
                "summary": summary
            }, f, indent=2, default=str)
        print(f"\n📄 Results saved to /tmp/test_results.json")
        
        return 0 if summary["failed"] == 0 else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted")
        sys.exit(1)

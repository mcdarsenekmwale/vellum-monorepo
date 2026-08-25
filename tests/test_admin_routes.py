import json
import os
from playwright.sync_api import sync_playwright

ROUTES = [
    "/dashboard", "/analytics", "/tags", "/categories", "/users", "/articles",
    "/highlights", "/comments", "/webhooks", "/api", "/advertisements",
    "/ai", "/flags", "/settings", "/moderation", "/reports", "/jobs",
    "/audit", "/media", "/storage", "/status", "/notifications", "/profile",
    "/roles", "/permissions", "/posts", "/videos", "/playlists", "/music",
    "/followers", "/help"
]

BASE_URL = "http://localhost:3003"
SCREENSHOTS_DIR = "tests/admin_screenshots"
RESULTS_FILE = "tests/admin_test_results.json"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def safe_screenshot(page, path):
    try:
        page.screenshot(path=path, full_page=False, timeout=10000)
        return True
    except Exception as e:
        print(f"    Screenshot warning: {str(e)[:80]}")
        return False

def main():
    results = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
        )
        page = context.new_page()
        page.set_default_timeout(15000)
        page.set_default_navigation_timeout(20000)
        
        console_errors = []
        
        def handle_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)
        
        page.on("console", handle_console)
        page.on("pageerror", lambda exc: console_errors.append(f"PAGE_ERROR: {exc}"))
        
        print("Step 1: Navigating to login page...")
        try:
            page.goto(f"{BASE_URL}/auth/login", wait_until="domcontentloaded")
        except Exception as e:
            print(f"Navigation warning: {str(e)[:100]}")
        
        page.wait_for_timeout(3000)
        
        login_title = page.title()
        print(f"Login page title: {login_title}")
        
        login_screenshot = os.path.join(SCREENSHOTS_DIR, "00_login_page.png")
        safe_screenshot(page, login_screenshot)
        
        print("Step 2: Filling in login credentials...")
        login_success = False
        try:
            page.fill('input[type="email"]', "admin@vellbase.app")
            page.fill('input[type="password"]', "password123")
            
            print("Step 3: Submitting login form...")
            page.click('button[type="submit"]')
            page.wait_for_timeout(5000)
            
            after_login_title = page.title()
            after_login_url = page.url
            print(f"After login - Title: {after_login_title}")
            print(f"After login - URL: {after_login_url}")
            
            after_login_screenshot = os.path.join(SCREENSHOTS_DIR, "01_after_login.png")
            safe_screenshot(page, after_login_screenshot)
            login_success = True
        except Exception as e:
            print(f"Login error: {e}")
            print("Continuing with current page state...")
        
        for i, route in enumerate(ROUTES):
            print(f"\n{'='*60}")
            print(f"Testing route: {route} ({i+1}/{len(ROUTES)})")
            print(f"{'='*60}")
            
            console_errors.clear()
            
            result = {
                "route": route,
                "status": "WORKING",
                "title": "",
                "url": "",
                "content_elements": [],
                "console_errors": [],
                "screenshot": ""
            }
            
            try:
                full_url = f"{BASE_URL}{route}"
                try:
                    page.goto(full_url, wait_until="domcontentloaded")
                except Exception as e:
                    print(f"  Navigation warning: {str(e)[:100]}")
                
                page.wait_for_timeout(3000)
                
                result["title"] = page.title()
                result["url"] = page.url
                
                body_text = ""
                try:
                    body_text = page.inner_text("body", timeout=5000)
                except:
                    pass
                has_content = len(body_text.strip()) > 50
                
                content_elements = []
                
                try:
                    h1_count = page.locator("h1").count()
                    if h1_count > 0:
                        h1_text = page.locator("h1").first.inner_text(timeout=3000).strip()
                        content_elements.append(f"H1: {h1_text[:60]}")
                except:
                    pass
                
                try:
                    h2_count = page.locator("h2").count()
                    if h2_count > 0:
                        content_elements.append(f"{h2_count} H2 headings")
                except:
                    pass
                
                try:
                    buttons = page.locator("button").count()
                    if buttons > 0:
                        content_elements.append(f"{buttons} buttons")
                except:
                    pass
                
                try:
                    links = page.locator("a").count()
                    if links > 0:
                        content_elements.append(f"{links} links")
                except:
                    pass
                
                try:
                    tables = page.locator("table").count()
                    if tables > 0:
                        content_elements.append(f"{tables} tables")
                except:
                    pass
                
                try:
                    inputs = page.locator("input").count()
                    if inputs > 0:
                        content_elements.append(f"{inputs} inputs")
                except:
                    pass
                
                try:
                    cards = page.locator("[class*='card'], [class*='Card']").count()
                    if cards > 0:
                        content_elements.append(f"{cards} cards")
                except:
                    pass
                
                result["content_elements"] = content_elements
                
                if not has_content and not content_elements:
                    result["status"] = "EMPTY"
                
                result["console_errors"] = list(console_errors)
                
                if console_errors:
                    result["status"] = "ERROR"
                
                safe_route = route.replace("/", "_").strip("_") or "dashboard"
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"{i+2:02d}_{safe_route}.png")
                if safe_screenshot(page, screenshot_path):
                    result["screenshot"] = screenshot_path
                
                print(f"  Title: {result['title']}")
                print(f"  URL: {result['url']}")
                print(f"  Status: {result['status']}")
                print(f"  Content: {', '.join(content_elements) if content_elements else 'None/minimal'}")
                if console_errors:
                    print(f"  Console errors: {len(console_errors)}")
                    for err in console_errors[:3]:
                        print(f"    - {err[:120]}")
                
            except Exception as e:
                result["status"] = "ERROR"
                result["console_errors"] = [str(e)]
                print(f"  Exception: {e}")
            
            results.append(result)
        
        browser.close()
    
    with open(RESULTS_FILE, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Total routes tested: {len(results)}")
    working = sum(1 for r in results if r["status"] == "WORKING")
    errors = sum(1 for r in results if r["status"] == "ERROR")
    empty = sum(1 for r in results if r["status"] == "EMPTY")
    print(f"WORKING: {working}")
    print(f"ERROR: {errors}")
    print(f"EMPTY: {empty}")
    print(f"\nResults saved to: {RESULTS_FILE}")
    print(f"Screenshots saved to: {SCREENSHOTS_DIR}")

if __name__ == "__main__":
    main()

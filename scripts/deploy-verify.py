#!/usr/bin/env python3
import requests
import os
import sys
import time

API_BASE = os.environ.get("API_ORIGIN", "http://localhost:3001")
WEB_ORIGIN = os.environ.get("WEB_ORIGIN", "http://localhost:3000")
ADMIN_ORIGIN = os.environ.get("ADMIN_ORIGIN", "http://localhost:3002")

DEMO_USER = {
    "email": "admin@vellum.com",
    "password": "password123",
}

def print_status(step, status, detail=""):
    marker = "[OK]" if status else "[FAIL]"
    color = "\033[92m" if status else "\033[91m"
    reset = "\033[0m"
    print(f"{color}{marker}{reset} {step}")
    if detail:
        print(f"    {detail}")

def test_api_health():
    try:
        resp = requests.get(f"{API_BASE}/api/health", timeout=10)
        if resp.status_code == 200:
            print_status("API Health Check", True, f"Status: {resp.status_code}")
            return True
        else:
            print_status("API Health Check", False, f"Status: {resp.status_code}")
            return False
    except Exception as e:
        print_status("API Health Check", False, str(e))
        return False

def test_web_app_login():
    try:
        resp = requests.post(
            f"{API_BASE}/api/auth/login",
            json=DEMO_USER,
            timeout=10,
            headers={"Content-Type": "application/json"}
        )
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("accessToken")
            user = data.get("user")
            if token and user:
                print_status("Web App API Login", True, f"User: {user.get('email')}")
                
                resp_me = requests.get(
                    f"{API_BASE}/api/auth/me",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                if resp_me.status_code == 200:
                    print_status("Web App Token Validation", True)
                    return True
                else:
                    print_status("Web App Token Validation", False, f"Status: {resp_me.status_code}")
                    return False
            else:
                print_status("Web App API Login", False, "Missing token or user")
                return False
        else:
            print_status("Web App API Login", False, f"Status: {resp.status_code}")
            return False
    except Exception as e:
        print_status("Web App API Login", False, str(e))
        return False

def test_admin_login():
    try:
        resp = requests.post(
            f"{API_BASE}/api/auth/login",
            json=DEMO_USER,
            timeout=10,
            headers={"Content-Type": "application/json"}
        )
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("accessToken")
            user = data.get("user")
            if token and user:
                role = user.get("role", "").upper()
                if role == "ADMIN":
                    print_status("Admin API Login", True, f"Admin: {user.get('email')}, Role: {role}")
                    
                    resp_me = requests.get(
                        f"{API_BASE}/api/auth/me",
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=10
                    )
                    if resp_me.status_code == 200:
                        print_status("Admin Token Validation", True)
                        return True
                    else:
                        print_status("Admin Token Validation", False, f"Status: {resp_me.status_code}")
                        return False
                else:
                    print_status("Admin API Login", False, f"User is not ADMIN, role: {role}")
                    return False
            else:
                print_status("Admin API Login", False, "Missing token or user")
                return False
        else:
            print_status("Admin API Login", False, f"Status: {resp.status_code}")
            return False
    except Exception as e:
        print_status("Admin API Login", False, str(e))
        return False

def test_web_app_pages():
    pages = ["/", "/login", "/register", "/discover"]
    all_ok = True
    for page in pages:
        try:
            resp = requests.get(f"{WEB_ORIGIN}{page}", timeout=10, allow_redirects=True)
            if resp.status_code == 200:
                print_status(f"Web App Page {page}", True)
            else:
                print_status(f"Web App Page {page}", False, f"Status: {resp.status_code}")
                all_ok = False
        except Exception as e:
            print_status(f"Web App Page {page}", False, str(e))
            all_ok = False
    return all_ok

def test_admin_pages():
    pages = ["/auth/login", "/dashboard"]
    all_ok = True
    for page in pages:
        try:
            resp = requests.get(f"{ADMIN_ORIGIN}{page}", timeout=10, allow_redirects=True)
            if resp.status_code == 200:
                print_status(f"Admin Page {page}", True)
            else:
                print_status(f"Admin Page {page}", False, f"Status: {resp.status_code}")
                all_ok = False
        except Exception as e:
            print_status(f"Admin Page {page}", False, str(e))
            all_ok = False
    return all_ok

def test_admin_api_endpoints():
    try:
        resp = requests.post(
            f"{API_BASE}/api/auth/login",
            json=DEMO_USER,
            timeout=10,
            headers={"Content-Type": "application/json"}
        )
        if resp.status_code != 200:
            print_status("Admin API Endpoints", False, "Login failed")
            return False
        
        token = resp.json().get("accessToken")
        endpoints = [
            "/api/admin/dashboard",
            "/api/admin/users",
            "/api/admin/notifications",
            "/api/admin/audit-logs",
            "/api/admin/settings",
        ]
        
        all_ok = True
        for endpoint in endpoints:
            resp_ep = requests.get(
                f"{API_BASE}{endpoint}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if resp_ep.status_code == 200:
                print_status(f"Admin API {endpoint}", True)
            else:
                print_status(f"Admin API {endpoint}", False, f"Status: {resp_ep.status_code}")
                all_ok = False
        
        return all_ok
    except Exception as e:
        print_status("Admin API Endpoints", False, str(e))
        return False

def run_all_tests():
    print("\n=== Deployment Verification ===")
    print(f"API Base: {API_BASE}")
    print(f"Web Origin: {WEB_ORIGIN}")
    print(f"Admin Origin: {ADMIN_ORIGIN}")
    print("=" * 50)

    results = []
    
    results.append(test_api_health())
    results.append(test_web_app_login())
    results.append(test_admin_login())
    results.append(test_web_app_pages())
    results.append(test_admin_pages())
    results.append(test_admin_api_endpoints())

    print("=" * 50)
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"\033[92mAll {passed}/{total} tests passed!\033[0m")
        return 0
    else:
        print(f"\033[91m{passed}/{total} tests passed. {total - passed} failed.\033[0m")
        return 1

if __name__ == "__main__":
    sys.exit(run_all_tests())

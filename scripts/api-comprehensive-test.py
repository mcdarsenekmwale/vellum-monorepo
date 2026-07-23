#!/usr/bin/env python3
import requests
import time
import sys
import os
from datetime import datetime

API_BASE = os.environ.get("API_BASE", "https://ef9y4l5cks304qewa8wv4kyo.sin.prisma.build/api")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@vellum.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "password123")

results = []
timings = {}

def record(test_name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    color = "\033[92m" if passed else "\033[91m"
    reset = "\033[0m"
    print(f"{color}[{status}]{reset} {test_name}")
    if detail:
        print(f"       {detail}")
    results.append((test_name, passed, detail))

def timed_request(method, url, **kwargs):
    start = time.time()
    resp = requests.request(method, url, timeout=30, **kwargs)
    elapsed = (time.time() - start) * 1000
    return resp, elapsed

print("=" * 60)
print("  API Comprehensive Test Suite")
print(f"  Target: {API_BASE}")
print(f"  Time: {datetime.now().isoformat()}")
print("=" * 60)
print()

# ============================================================
# SECTION 1: Health & Basic Endpoints
# ============================================================
print("--- Section 1: Health & Basic Endpoints ---")

resp, t = timed_request("GET", f"{API_BASE}/health")
record("Health endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
timings["health"] = t

resp, t = timed_request("GET", f"{API_BASE}/articles?limit=5")
record("Articles endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
timings["articles_list"] = t
if resp.status_code == 200:
    try:
        data = resp.json()
        record("Articles response has data array", isinstance(data.get("data"), list), f"Count: {len(data.get('data', []))}")
    except:
        record("Articles response valid JSON", False)

resp, t = timed_request("GET", f"{API_BASE}/categories")
record("Categories endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
timings["categories"] = t

resp, t = timed_request("GET", f"{API_BASE}/highlights?limit=5")
record("Highlights endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
timings["highlights_list"] = t

# ============================================================
# SECTION 2: Authentication
# ============================================================
print()
print("--- Section 2: Authentication ---")

resp, t = timed_request("POST", f"{API_BASE}/auth/login", 
    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    headers={"Content-Type": "application/json"})
record("Login with valid credentials returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
timings["login"] = t

access_token = None
user = None
if resp.status_code == 200:
    try:
        data = resp.json()
        access_token = data.get("accessToken")
        user = data.get("user")
        record("Login response has accessToken", bool(access_token))
        record("Login response has user object", bool(user))
        if user:
            record("User has email field", bool(user.get("email")))
            record("User has role field", bool(user.get("role")))
            record("User role is ADMIN", user.get("role") == "ADMIN", f"Role: {user.get('role')}")
    except Exception as e:
        record("Login response valid JSON", False, str(e))

resp, t = timed_request("POST", f"{API_BASE}/auth/login",
    json={"email": "invalid@test.com", "password": "wrongpassword"},
    headers={"Content-Type": "application/json"})
record("Login with invalid credentials returns 401", resp.status_code in [401, 400, 403], f"Status: {resp.status_code}, Time: {t:.0f}ms")

if access_token:
    resp, t = timed_request("GET", f"{API_BASE}/auth/me",
        headers={"Authorization": f"Bearer {access_token}"})
    record("Auth/me endpoint with valid token returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
    timings["auth_me"] = t

resp, t = timed_request("GET", f"{API_BASE}/auth/me",
    headers={"Authorization": "Bearer invalidtoken123"})
record("Auth/me endpoint with invalid token returns 401", resp.status_code in [401, 403], f"Status: {resp.status_code}, Time: {t:.0f}ms")

# ============================================================
# SECTION 3: Admin Endpoints
# ============================================================
print()
print("--- Section 3: Admin Endpoints ---")

admin_auth_headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}

if access_token:
    resp, t = timed_request("GET", f"{API_BASE}/admin/dashboard", headers=admin_auth_headers)
    record("Admin dashboard endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
    timings["admin_dashboard"] = t

    resp, t = timed_request("GET", f"{API_BASE}/admin/users?limit=10", headers=admin_auth_headers)
    record("Admin users endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
    timings["admin_users"] = t

    resp, t = timed_request("GET", f"{API_BASE}/admin/notifications?limit=10", headers=admin_auth_headers)
    record("Admin notifications endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
    timings["admin_notifications"] = t

    resp, t = timed_request("GET", f"{API_BASE}/admin/audit-logs?limit=10", headers=admin_auth_headers)
    record("Admin audit logs endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
    timings["admin_audit_logs"] = t

    resp, t = timed_request("GET", f"{API_BASE}/admin/settings", headers=admin_auth_headers)
    record("Admin settings endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
    timings["admin_settings"] = t

    resp, t = timed_request("GET", f"{API_BASE}/admin/help/articles?limit=10", headers=admin_auth_headers)
    record("Admin help articles endpoint returns 200", resp.status_code == 200, f"Status: {resp.status_code}, Time: {t:.0f}ms")
    timings["admin_help_articles"] = t

# ============================================================
# SECTION 4: CRUD Operations
# ============================================================
print()
print("--- Section 4: CRUD Operations ---")

if access_token:
    resp, t = timed_request("POST", f"{API_BASE}/admin/notifications",
        json={
            "userId": user.get("id") if user else "",
            "kind": "SYSTEM",
            "body": f"Test notification {int(time.time())}",
        },
        headers={**admin_auth_headers, "Content-Type": "application/json"})
    created_id = None
    if resp.status_code in [200, 201]:
        try:
            data = resp.json()
            if isinstance(data, dict):
                created_id = data.get("id")
        except:
            pass
    record("Create notification returns 200/201", resp.status_code in [200, 201], f"Status: {resp.status_code}, Time: {t:.0f}ms")

    if created_id:
        resp, t = timed_request("PUT", f"{API_BASE}/admin/notifications/{created_id}/read",
            headers=admin_auth_headers)
        record("Mark notification as read returns 200", resp.status_code in [200, 204], f"Status: {resp.status_code}, Time: {t:.0f}ms")

        resp, t = timed_request("DELETE", f"{API_BASE}/admin/notifications/{created_id}", headers=admin_auth_headers)
        record("Delete notification returns 200", resp.status_code in [200, 204], f"Status: {resp.status_code}, Time: {t:.0f}ms")

# ============================================================
# SECTION 5: Error Handling
# ============================================================
print()
print("--- Section 5: Error Handling ---")

resp, t = timed_request("GET", f"{API_BASE}/nonexistent-endpoint")
record("Non-existent endpoint returns 404", resp.status_code == 404, f"Status: {resp.status_code}, Time: {t:.0f}ms")

resp, t = timed_request("POST", f"{API_BASE}/auth/login",
    json={"email": "not-an-email", "password": "short"},
    headers={"Content-Type": "application/json"})
record("Validation error returns 400/422", resp.status_code in [400, 422, 401], f"Status: {resp.status_code}, Time: {t:.0f}ms")

# ============================================================
# SECTION 6: Performance
# ============================================================
print()
print("--- Section 6: Performance Summary ---")

avg_time = sum(timings.values()) / len(timings) if timings else 0
print(f"  Average response time: {avg_time:.0f}ms")
print(f"  Total endpoints tested: {len(timings)}")
print()

slow_endpoints = [(k, v) for k, v in timings.items() if v > 2000]
if slow_endpoints:
    print("  Slow endpoints (>2s):")
    for name, t in slow_endpoints:
        print(f"    - {name}: {t:.0f}ms")
else:
    print("  All endpoints respond within 2 seconds")

# ============================================================
# SUMMARY
# ============================================================
print()
print("=" * 60)
passed = sum(1 for _, p, _ in results if p)
total = len(results)
print(f"  Results: {passed}/{total} tests passed")
print("=" * 60)

if passed < total:
    print()
    print("Failed tests:")
    for name, p, detail in results:
        if not p:
            print(f"  - {name}: {detail}")
    sys.exit(1)
else:
    print()
    print("All tests passed successfully!")
    sys.exit(0)

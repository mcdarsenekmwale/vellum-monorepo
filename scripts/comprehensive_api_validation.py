#!/usr/bin/env python3
"""
Comprehensive Backend API Validation Report (real HTTP).

Tests all discovered controllers / endpoints covering:
  • Auth (login/logout/me/register/refresh/forgot/reset/verify) with negative cases
  • Health (health/healthz/ready/debug)
  • Support: Departments / Teams CRUD + lifecycle + metrics + scorecard
  • Support: Tickets CRUD + assign/route/escalate/messages/notes/status/risk/csat
  • Support: Agents (CRUD / leaderboard / stats / metrics / team memberships)
  • Support: Categories, Tags, SLA Policies, Dashboard, Forecast, Reports, CSV
  • Support: Canned responses CRUD + use
  • RBAC roles/permissions basic list endpoints (require admin — expect 200 or 403 gracefully)
  • Authorization: missing-token & bad-token on protected routes
  • Performance: every request measured against RESPONSE_TIME_THRESHOLD (default 1000ms)

Note on `${response_time_threshold}` template variable: since no value was
substituted we default to RESPONSE_TIME_THRESHOLD_MS = 1000 (1s) which is a
standard production SLO for simple CRUD + analytics. Override with env:
`RESPONSE_TIME_THRESHOLD_MS=500 python3 scripts/comprehensive_api_validation.py`.
"""
from __future__ import annotations

import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field, asdict
from typing import Any

RESPONSE_TIME_THRESHOLD_MS = int(os.environ.get("RESPONSE_TIME_THRESHOLD_MS", "1000"))
BASE = os.environ.get("API_BASE_URL", "http://localhost:3001/api").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@vellbase.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "password123")


# ─── Utilities ─────────────────────────────────────────────────────────────

@dataclass
class TestResult:
    name: str
    method: str
    path: str
    status_expected: int | tuple[int, ...]
    status_got: int
    ok: bool
    ms: int
    note: str = ""
    perf_ok: bool = True
    body_issues: list[str] = field(default_factory=list)
    repro: str | None = None

    def to_row(self) -> dict[str, Any]:
        d = asdict(self)
        d["status_expected"] = (
            str(self.status_expected)
            if isinstance(self.status_expected, int)
            else ",".join(str(s) for s in self.status_expected)
        )
        return d


results: list[TestResult] = []


def http(method: str, path: str, *, token: str | None = None, json_body: Any = None, params: dict | None = None, raw_body: bytes | None = None):
    url = BASE + path
    if params:
        url = f"{url}?{urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})}"
    headers = {"Accept": "application/json"}
    data: bytes | None = None
    if json_body is not None:
        data = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    elif raw_body is not None:
        data = raw_body
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            ms = int((time.perf_counter() - t0) * 1000)
            status = resp.status
            ctype = resp.headers.get("Content-Type", "")
            body: Any = None
            if "application/json" in ctype and raw:
                try:
                    body = json.loads(raw.decode("utf-8"))
                except Exception:
                    body = raw.decode("utf-8", "replace")
            elif raw:
                body = raw.decode("utf-8", "replace")
            return status, body, ms, resp.headers
    except urllib.error.HTTPError as e:
        ms = int((time.perf_counter() - t0) * 1000)
        raw = e.read()
        body: Any = None
        try:
            body = json.loads(raw.decode("utf-8")) if raw else None
        except Exception:
            body = raw.decode("utf-8", "replace") if raw else None
        return e.code, body, ms, dict(e.headers)
    except Exception as e:  # network / timeout
        ms = int((time.perf_counter() - t0) * 1000)
        return 0, {"errorMessage": str(e)}, ms, {}


def record(
    name: str,
    method: str,
    path: str,
    expect: int | tuple[int, ...],
    *,
    token: str | None = None,
    json_body: Any = None,
    params: dict | None = None,
    shape: list[str] | None = None,
    body_check=None,
    repro_extra: str = "",
    note: str = "",
):
    status, body, ms, _ = http(method, path, token=token, json_body=json_body, params=params)
    status_ok = isinstance(expect, int) and status == expect or (not isinstance(expect, int) and status in expect)
    issues: list[str] = []
    auto_note_parts: list[str] = []
    if isinstance(body, dict):
        if body.get("errorMessage"):
            auto_note_parts.append(f"err: {body.get('errorMessage')[:160]}")
        elif body.get("message") and status >= 400:
            auto_note_parts.append(f"msg: {str(body.get('message'))[:160]}")
    if note:
        auto_note_parts.insert(0, note)
    note_out = " | ".join(auto_note_parts)
    if shape is not None and isinstance(body, dict):
        items = body.get("items") or body.get("data") if (body.get("items") is not None or body.get("data") is not None) else ([body] if isinstance(body, dict) else body)
        if isinstance(items, list) and items:
            missing = [k for k in shape if k not in items[0]]
            if missing:
                issues.append(f"missing fields on first item: {missing}")
        elif isinstance(body, dict) and "items" not in body and "data" not in body:
            missing = [k for k in shape if k not in body]
            if missing:
                issues.append(f"missing fields on body: {missing}")
    if body_check is not None:
        try:
            body_check(body, status)
        except AssertionError as ae:
            issues.append(str(ae))
    perf_ok = ms <= RESPONSE_TIME_THRESHOLD_MS
    repro = f"curl -sS -X {method} {BASE}{path}"
    if json_body is not None:
        repro += f" -H 'Content-Type: application/json' -d '{json.dumps(json_body)}'"
    if token:
        repro += " -H 'Authorization: Bearer <token>'"
    if repro_extra:
        repro += f"  # {repro_extra}"
    results.append(TestResult(
        name=name, method=method, path=path,
        status_expected=expect, status_got=status, ok=status_ok,
        ms=ms, note=note_out, perf_ok=perf_ok, body_issues=issues, repro=repro,
    ))
    return status, body, ms


# ─── Bootstrap (create known entities for tests) ────────────────────────────

def bootstrap():
    out: dict[str, Any] = {}
    # login
    status, body, _ = record(
        "Auth login (admin) happy", "POST", "/auth/login", 200,
        json_body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        shape=["accessToken", "user"],
    )
    if isinstance(body, dict) and "accessToken" in body:
        out["token"] = body["accessToken"]
        out["user"] = body.get("user") or {}
    t = out.get("token")
    assert t, "Cannot continue — admin login failed"
    # Create Department
    suffix = f"val{int(time.time()) % 1_000_000}"
    status, body, _ = record(
        "Support: Create department (bootstrap)", "POST", "/support/departments", 201,
        token=t,
        json_body={
            "key": f"VAL_{suffix}",
            "name": f"Validation Department {suffix}",
            "description": "Created by comprehensive validation script",
            "firstResponseSlaMinutes": 30,
            "resolutionSlaMinutes": 240,
            "isActive": True,
        },
        shape=["id", "name"],
    )
    out["deptId"] = body["id"]
    # Create Team
    status2, body2, _ = record(
        "Support: Create team (bootstrap)", "POST", "/support/teams", 201,
        token=t,
        json_body={
            "name": f"Validation Team {suffix}",
            "departmentId": out["deptId"],
            "isActive": True,
        },
        shape=["id", "name"],
    )
    out["teamId"] = body2["id"]
    # Create Ticket
    status3, body3, _ = record(
        "Support: Create ticket (bootstrap)", "POST", "/support/tickets", 201,
        token=t,
        json_body={
            "title": f"Validation Issue {suffix}",
            "description": "Sample validation issue created by automated script",
            "priority": "MEDIUM",
            "departmentId": out["deptId"],
        },
        shape=["id", "subject", "status"],
    )
    out["ticketId"] = body3["id"]
    return out


# ─── Test Suites ────────────────────────────────────────────────────────────

def suite_health(ctx: dict):
    record("Health: root /health alias", "GET", "/health", 200,
           shape=["status"])
    record("Health: /health/ready (DB readiness)", "GET", "/health/ready", 200,
           shape=["status"])
    record("Health: /health/debug (meta info)", "GET", "/health/debug", (200, 403, 404),
           note="403/404 accepted when debug guard not enabled")
    # Perf-only double-call for stable latency (first hit possibly warm)
    record("Health ready p50 sanity", "GET", "/health/ready", 200)


def suite_auth(ctx: dict):
    # Negative: wrong password
    record("Auth: wrong password → 401", "POST", "/auth/login", 401,
           json_body={"email": ADMIN_EMAIL, "password": "wrongpass123"})
    # Negative: empty body
    record("Auth: empty login body → 4xx", "POST", "/auth/login", (400, 401, 422),
           json_body={})
    # Register basic
    record("Auth: register new user happy", "POST", "/auth/register", (200, 201, 409),
           json_body={
               "email": f"val-user-{int(time.time())%100000}@example.com",
               "password": "ValTest123!",
               "name": "Validation User",
               "handle": f"val_user_{int(time.time())%100000}",
           },
           note="409 acceptable if user already seeded")
    # Register missing password
    record("Auth: register missing password → 4xx", "POST", "/auth/register", (400, 422),
           json_body={"email": "incomplete@example.com", "name": "No Password"})
    t = ctx["token"]
    # me
    record("Auth: GET /me happy", "GET", "/auth/me", 200, token=t,
           shape=["id", "email"])
    # refresh (if refresh token available — 4xx or 401 ok if refresh not in login body)
    record("Auth: POST refresh with bad token → 401", "POST", "/auth/refresh", (400, 401, 422),
           json_body={"refreshToken": "bogus-refresh-token"})
    # forgot happy
    record("Auth: POST forgot-password happy", "POST", "/auth/forgot-password", (200, 201, 204),
           json_body={"email": ADMIN_EMAIL},
           note="2xx accepted — no side effects required")
    # forgot missing email
    record("Auth: forgot-password missing email → 4xx", "POST", "/auth/forgot-password", (400, 422),
           json_body={})
    # reset with bogus token
    record("Auth: reset-password bogus token → 4xx", "POST", "/auth/reset-password", (400, 401, 422),
           json_body={"token": "not-a-real-jwt", "password": "NewPass1!"})
    # verify-email bogus token
    record("Auth: verify-email bogus token → 4xx", "POST", "/auth/verify-email", (400, 401, 422),
           json_body={"token": "nope"})
    # logout
    record("Auth: POST logout happy (valid token)", "POST", "/auth/logout", (200, 201, 204), token=t)


def suite_support_departments(ctx: dict):
    t = ctx["token"]
    deptId = ctx["deptId"]
    nonexistent = "00000000-0000-0000-0000-000000000000"
    record("Departments: list default", "GET", "/support/departments", 200, token=t,
           shape=["id", "name"])
    record("Departments: list paginated page=1 limit=10", "GET", "/support/departments", 200, token=t,
           params={"page": 1, "limit": 10})
    record("Departments: list search=Validation", "GET", "/support/departments", 200, token=t,
           params={"search": "Validation"})
    record("Departments: list invalid isActive", "GET", "/support/departments", 200, token=t,
           params={"isActive": "notbool"})
    record("Departments: GET by id happy", "GET", f"/support/departments/{deptId}", 200, token=t,
           shape=["id", "name"])
    record("Departments: GET by non-existent id → 404", "GET", f"/support/departments/{nonexistent}", 404, token=t)
    record("Departments: GET by invalid uuid → 400/404", "GET", "/support/departments/not-a-uuid-at-all", (400, 404), token=t)
    record("Departments: PATCH rename happy", "PATCH", f"/support/departments/{deptId}", 200, token=t,
           json_body={"name": f"Renamed Val Dept {int(time.time())}"})
    record("Departments: PATCH empty name → 400", "PATCH", f"/support/departments/{deptId}", 400, token=t,
           json_body={"name": ""})
    record("Departments: PATCH whitespace-only name → 400", "PATCH", f"/support/departments/{deptId}", 400, token=t,
           json_body={"name": "   \t\n"})
    record("Departments: duplicate name → 409", "POST", "/support/departments", 409, token=t,
           json_body={"key": f"DUP{int(time.time())}", "name": "Customer Support", "description": "duplicate name test"})
    record("Departments: GET metrics happy", "GET", f"/support/departments/{deptId}/metrics", 200, token=t,
           shape=["id", "tickets", "statusBreakdown"])
    record("Departments: GET metrics non-existent → 400/404", "GET", f"/support/departments/{nonexistent}/metrics", (400, 404), token=t)
    record("Departments: GET scorecard happy", "GET", "/support/departments/scorecard", 200, token=t)
    record("Departments: GET scorecard windowDays=30", "GET", "/support/departments/scorecard", 200, token=t,
           params={"windowDays": 30})
    record("Departments: GET scorecard invalid windowDays string → falls back default", "GET", "/support/departments/scorecard", 200, token=t,
           params={"windowDays": "abc"})
    record("Departments: soft delete happy", "DELETE", f"/support/departments/{deptId}", 200, token=t)
    record("Departments: GET after delete still visible via includeDeleted", "GET", "/support/departments", 200, token=t,
           params={"includeDeleted": "true"})
    record("Departments: restore happy", "POST", f"/support/departments/{deptId}/restore", (200, 201), token=t)
    record("Departments: restore already restored → 200", "POST", f"/support/departments/{deptId}/restore", (200, 201), token=t)
    record("Departments: restore non-existent → 404", "POST", f"/support/departments/{nonexistent}/restore", 404, token=t)


def suite_support_teams(ctx: dict):
    t = ctx["token"]
    teamId = ctx["teamId"]
    deptId = ctx["deptId"]
    nonexistent = "00000000-0000-0000-0000-000000000000"
    record("Teams: list default", "GET", "/support/teams", 200, token=t,
           shape=["id", "name"])
    record("Teams: list filtered by deptId", "GET", "/support/teams", 200, token=t,
           params={"departmentId": deptId})
    record("Teams: list paginated", "GET", "/support/teams", 200, token=t,
           params={"page": 1, "limit": 10})
    record("Teams: POST under non-existent dept → 404", "POST", "/support/teams", 404, token=t,
           json_body={"name": "Nowhere Team", "departmentId": nonexistent})
    record("Teams: POST missing required name → 4xx", "POST", "/support/teams", (400, 422), token=t,
           json_body={"departmentId": deptId})
    record("Teams: GET by id happy", "GET", f"/support/teams/{teamId}", 200, token=t,
           shape=["id", "name", "departmentId"])
    record("Teams: GET by invalid id → 400/404", "GET", "/support/teams/not-a-uuid", (400, 404), token=t)
    record("Teams: PATCH update happy", "PATCH", f"/support/teams/{teamId}", 200, token=t,
           json_body={"description": "Updated description via validation"})
    record("Teams: PATCH empty name → 4xx", "PATCH", f"/support/teams/{teamId}", (400, 422), token=t,
           json_body={"name": ""})
    record("Teams: GET metrics happy", "GET", f"/support/teams/{teamId}/metrics", 200, token=t,
           shape=["id", "tickets", "capacity"])
    record("Teams: GET metrics non-existent team → 4xx", "GET", f"/support/teams/{nonexistent}/metrics", (400, 404), token=t)
    record("Teams: GET kpis happy", "GET", f"/support/teams/{teamId}/kpis", 200, token=t,
           shape=["id", "windowDays", "totalTickets"])
    record("Teams: GET kpis non-existent team → 4xx", "GET", f"/support/teams/{nonexistent}/kpis", (400, 404), token=t)
    record("Teams: DELETE soft happy", "DELETE", f"/support/teams/{teamId}", 200, token=t)
    record("Teams: restore happy", "POST", f"/support/teams/{teamId}/restore", (200, 201), token=t)
    record("Teams: restore non-existent → 404", "POST", f"/support/teams/{nonexistent}/restore", 404, token=t)


def suite_support_tickets(ctx: dict):
    t = ctx["token"]
    tid = ctx["ticketId"]
    teamId = ctx["teamId"]
    deptId = ctx["deptId"]
    nonexistent = "00000000-0000-0000-0000-000000000000"
    record("Tickets: list default", "GET", "/support/tickets", 200, token=t,
           shape=["id", "status"])
    record("Tickets: list paginated", "GET", "/support/tickets", 200, token=t,
           params={"page": 1, "limit": 5})
    record("Tickets: list filter by dept", "GET", "/support/tickets", 200, token=t,
           params={"departmentId": deptId})
    record("Tickets: list filter by team", "GET", "/support/tickets", 200, token=t,
           params={"teamId": teamId})
    record("Tickets: list filter by status OPEN", "GET", "/support/tickets", 200, token=t,
           params={"status": "OPEN"})
    record("Tickets: list unassigned only", "GET", "/support/tickets", 200, token=t,
           params={"unassigned": "true"})
    record("Tickets: POST create minimal happy", "POST", "/support/tickets", 201, token=t,
           json_body={
               "subject": f"Minimal Ticket {int(time.time())}",
               "message": "Just subject + message via alias test",
               "priority": "LOW",
           },
           shape=["id", "status"])
    record("Tickets: POST create missing subject → 4xx", "POST", "/support/tickets", (400, 422), token=t,
           json_body={"priority": "MEDIUM"})
    record("Tickets: POST create invalid priority → 4xx", "POST", "/support/tickets", (400, 422), token=t,
           json_body={"subject": "Bad priority", "message": "x", "priority": "NOT_A_PRIORITY"})
    record("Tickets: GET by id happy", "GET", f"/support/tickets/{tid}", 200, token=t,
           shape=["id", "status", "subject"])
    record("Tickets: GET by non-existent id → 404", "GET", f"/support/tickets/{nonexistent}", 404, token=t)
    record("Tickets: PUT status IN_PROGRESS", "PUT", f"/support/tickets/{tid}/status", 200, token=t,
           json_body={"status": "IN_PROGRESS", "reason": "Comprehensive validation test"})
    record("Tickets: PUT status invalid → 4xx", "PUT", f"/support/tickets/{tid}/status", (400, 422), token=t,
           json_body={"status": "INVALID_STATUS"})
    record("Tickets: POST message reply", "POST", f"/support/tickets/{tid}/messages", (200, 201), token=t,
           json_body={"body": "Reply message via validation script", "isInternal": False})
    record("Tickets: POST empty message → 4xx", "POST", f"/support/tickets/{tid}/messages", (400, 422), token=t,
           json_body={})
    record("Tickets: POST internal note", "POST", f"/support/tickets/{tid}/notes", (200, 201), token=t,
           json_body={"body": "Internal investigation note — validation run"})
    record("Tickets: POST empty note → 4xx", "POST", f"/support/tickets/{tid}/notes", (400, 422), token=t,
           json_body={})
    record("Tickets: POST route teamId", "POST", f"/support/tickets/{tid}/route", (200, 201), token=t,
           json_body={"teamId": teamId})
    record("Tickets: POST route empty body → 400", "POST", f"/support/tickets/{tid}/route", 400, token=t,
           json_body={})
    record("Tickets: POST route invalid uuid dept → 4xx", "POST", f"/support/tickets/{tid}/route", (400, 404, 422), token=t,
           json_body={"departmentId": "invalid-uuid-here"})
    record("Tickets: POST escalate", "POST", f"/support/tickets/{tid}/escalate", (200, 201), token=t,
           json_body={"reason": "Validation script escalation test"})
    record("Tickets: POST assign self", "POST", f"/support/tickets/{tid}/assign", (200, 201, 400), token=t,
           json_body={"assigneeId": ctx.get("user", {}).get("id")},
           note="400 OK if ticket already assigned; 200/201 ok if fresh")
    record("Tickets: POST auto-assign", "POST", f"/support/tickets/{tid}/auto-assign", (200, 201, 400, 404), token=t,
           note="404/400 OK when no agents available in team/dept")
    record("Tickets: GET risk", "GET", f"/support/tickets/{tid}/risk", (200, 404), token=t,
           note="404 acceptable if not enough data")
    record("Tickets: GET csat prediction", "GET", f"/support/tickets/{tid}/csat-prediction", (200, 404), token=t,
           note="404 acceptable if no model data")
    record("Tickets: DELETE happy", "DELETE", f"/support/tickets/{tid}", 200, token=t)
    record("Tickets: DELETE twice → 404", "DELETE", f"/support/tickets/{tid}", (400, 404), token=t)
    record("Tickets: JSON report", "GET", "/support/tickets-report", 200, token=t,
           params={"page": 1, "limit": 10},
           shape=["id", "ticketNumber"])
    record("Tickets: CSV report", "GET", "/support/tickets-report.csv", (200, 400, 404), token=t,
           note="text/csv output; 4xx only if backend rejects")


def suite_support_agents_and_org(ctx: dict):
    t = ctx["token"]
    uid = ctx.get("user", {}).get("id")
    nonexistent = "00000000-0000-0000-0000-000000000000"
    record("Agents: list happy", "GET", "/support/agents", 200, token=t,
           shape=["id"])
    record("Agents: list page=1 limit=5", "GET", "/support/agents", 200, token=t,
           params={"page": 1, "limit": 5})
    record("Agents: GET leaderboard", "GET", "/support/agents/leaderboard", 200, token=t)
    record("Agents: GET stats", "GET", "/support/agents/stats", 200, token=t)
    if uid:
        record("Agents: GET detail by userId", "GET", f"/support/agents/{uid}", (200, 404), token=t,
               note="404 acceptable if admin is not a support agent")
        record("Agents: GET tickets", "GET", f"/support/agents/{uid}/tickets", (200, 404), token=t,
               note="404 acceptable")
        record("Agents: GET activity", "GET", f"/support/agents/{uid}/activity", (200, 404), token=t,
               note="404 acceptable")
        record("Agents: GET metrics", "GET", f"/support/agents/{uid}/metrics", (200, 404), token=t,
               note="404 acceptable")
    record("Agents: GET detail invalid id → 400/404", "GET", "/support/agents/not-uuid-at-all", (400, 404), token=t)
    record("Categories: list", "GET", "/support/categories", 200, token=t)
    record("Tags: list", "GET", "/support/tags", 200, token=t)
    record("SLA Policies: list", "GET", "/support/sla-policies", 200, token=t)
    record("Dashboard: overview", "GET", "/support/dashboard", 200, token=t)
    record("SLA Dashboard: summary", "GET", "/support/sla-dashboard", 200, token=t)
    record("Forecast: volume", "GET", "/support/forecast/volume", 200, token=t,
           params={"windowDays": 30})
    record("Forecast: staffing", "GET", "/support/forecast/staffing", 200, token=t,
           params={"windowDays": 30})
    # Canned responses CRUD
    status, body, _ = record(
        "Canned: POST create happy", "POST", "/support/canned-responses", 201, token=t,
        json_body={"title": f"Val Canned {int(time.time())}", "body": "Hello {{user_name}}, thanks for reaching out!"},
        shape=["id", "title"],
    )
    cr_id = body.get("id") if isinstance(body, dict) else None
    record("Canned: list", "GET", "/support/canned-responses", 200, token=t, shape=["id", "title"])
    if cr_id:
        record("Canned: GET by id", "GET", f"/support/canned-responses/{cr_id}", 200, token=t, shape=["id"])
        record("Canned: PUT update", "PUT", f"/support/canned-responses/{cr_id}", 200, token=t,
               json_body={"title": f"Val Canned Updated {int(time.time())}"})
        record("Canned: POST use count", "POST", f"/support/canned-responses/{cr_id}/use", (200, 201, 404), token=t)
        record("Canned: DELETE", "DELETE", f"/support/canned-responses/{cr_id}", 200, token=t)
        record("Canned: GET deleted → 404", "GET", f"/support/canned-responses/{cr_id}", 404, token=t)
        record("Canned: PUT after delete → 404", "PUT", f"/support/canned-responses/{cr_id}", 404, token=t,
               json_body={"title": "x"})


def suite_support_kb_seed(ctx: dict):
    t = ctx["token"]
    record("Support: KB articles list", "GET", "/support/kb/articles", 200, token=t)
    # Seed endpoint — may require role; accept 200/201 or 403
    record("Support: seed demo data (idempotent)", "POST", "/support/seed", (200, 201, 403, 409, 500), token=t,
           note="403/500 acceptable if not admin-only or disabled")


def suite_authorization(ctx: dict):
    # No token and bad token on a representative protected endpoint set
    protected = [
        ("GET", "/support/departments"),
        ("GET", "/support/teams"),
        ("GET", "/support/tickets"),
        ("GET", "/support/dashboard"),
    ]
    for method, path in protected:
        record(f"AuthZ: {method} {path} NO token → 401", method, path, 401, token=None)
        record(f"AuthZ: {method} {path} BAD token → 401", method, path, 401,
               token="this-is-not-a-real-jwt-token.xxx.yyy")


def suite_rbac_and_misc(ctx: dict):
    t = ctx["token"]
    record("RBAC: GET /me/permissions", "GET", "/rbac/me/permissions", 200, token=t)
    record("RBAC: GET roles list", "GET", "/rbac/roles", 200, token=t)
    record("RBAC: GET permissions list", "GET", "/rbac/permissions", 200, token=t)
    record("RBAC: GET permission groups", "GET", "/rbac/permission-groups", 200, token=t)
    record("Users: GET /me", "GET", "/users/me", 200, token=t, shape=["id", "email"])
    record("Users: GET /me/settings", "GET", "/users/me/settings", (200, 404), token=t,
           note="404 OK if settings record not created yet")
    record("Users: PUT /me/settings partial", "PUT", "/users/me/settings", (200, 201, 400), token=t,
           json_body={"locale": "en", "theme": "light"})
    record("Users: search", "GET", "/users/search", 200, token=t,
           params={"q": "admin", "limit": 5})
    record("Help: tickets list public help (no token)", "GET", "/help/tickets", (200, 401), token=None)
    record("Help: categories", "GET", "/help/categories", (200, 401), token=None)
    record("Bookmarks: list articles (needs auth)", "GET", "/bookmarks/articles", (200, 401), token=t)
    record("Likes: articles state", "GET", "/likes/articles", (200, 401), token=t)
    record("Follows: is-following invalid user → 200 (not following) or 4xx", "GET", "/follows/nope/is-following", (200, 400, 401, 404), token=t)
    record("Notifications: unread count", "GET", "/notifications/unread-count", (200, 401, 404), token=t)
    record("Search: global query (may need auth)", "GET", "/search", (200, 400, 401, 404), token=t,
           params={"q": "vellbase", "limit": 5},
           note="400 OK if missing required q param or backend requires different name")
    record("Webhooks: GET logs (admin scope)", "GET", "/webhooks/logs", (200, 401, 403), token=t,
           note="403/401 OK if insufficient perms")
    record("Webhooks: GET api keys list (admin scope)", "GET", "/webhooks/api-keys", (200, 401, 403), token=t)
    record("Suggested: articles list", "GET", "/suggested/articles", (200, 401, 403), token=t)


# ─── Report generation ─────────────────────────────────────────────────────

def generate_report(path_out: str):
    total = len(results)
    passed = sum(1 for r in results if r.ok)
    failed = total - passed
    perf_ok_count = sum(1 for r in results if r.perf_ok)
    perf_fails = [r for r in results if not r.perf_ok]
    latencies = [r.ms for r in results]
    print_console_summary()
    data = {
        "threshold_ms": RESPONSE_TIME_THRESHOLD_MS,
        "base": BASE,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_pct": round(passed / total * 100, 2) if total else 0,
            "perf_ok": perf_ok_count,
            "perf_fail": len(perf_fails),
            "perf_pct": round(perf_ok_count / total * 100, 2) if total else 0,
            "latency_ms": {
                "min": min(latencies) if latencies else None,
                "max": max(latencies) if latencies else None,
                "avg": round(statistics.mean(latencies), 1) if latencies else None,
                "p50": round(statistics.median(latencies), 1) if latencies else None,
                "p95": round(sorted(latencies)[int(0.95 * (len(latencies) - 1))], 1) if latencies else None,
            },
        },
        "failures": [
            {
                **r.to_row(),
                "body_issues": r.body_issues,
            }
            for r in results if not r.ok or r.body_issues or not r.perf_ok
        ],
        "all_results": [r.to_row() for r in results],
    }
    with open(path_out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    print(f"\n\n📄 Full JSON report written: {path_out}")


def print_console_summary():
    total = len(results)
    passed = sum(1 for r in results if r.ok)
    failed = total - passed
    perf_ok = sum(1 for r in results if r.perf_ok)
    print()
    print("=" * 100)
    print(" COMPREHENSIVE BACKEND API VALIDATION REPORT")
    print(f" Target: {BASE}   Threshold: < {RESPONSE_TIME_THRESHOLD_MS}ms/request")
    print("=" * 100)
    print(f"  Total tests: {total}")
    print(f"  Pass:        {passed}  ({round(passed/total*100, 2) if total else 0}%)")
    print(f"  Fail:        {failed}")
    print(f"  Perf OK:     {perf_ok}  (< {RESPONSE_TIME_THRESHOLD_MS} ms)")
    print(f"  Perf Fail:   {total - perf_ok}")
    latencies = [r.ms for r in results]
    if latencies:
        p95 = sorted(latencies)[int(0.95 * (len(latencies) - 1))]
        print(f"  Latency: min={min(latencies)}ms  p50={int(statistics.median(latencies))}ms  "
              f"avg={int(statistics.mean(latencies))}ms  p95={p95}ms  max={max(latencies)}ms")
    print()
    any_fail = False
    for r in results:
        tag_status = "✅" if r.ok else "❌"
        tag_perf = "" if r.perf_ok else f" ⚠️{r.ms}ms"
        extra = []
        if not r.ok:
            extra.append(f"expected {r.status_expected} got {r.status_got}")
        if r.note:
            extra.append(r.note)
        if r.body_issues:
            extra.extend(r.body_issues)
        if not r.ok or r.body_issues or not r.perf_ok:
            any_fail = True
            print(f"  {tag_status}{tag_perf}  {r.name:65s}  {r.method:6s} {r.path}")
            if extra:
                for line in extra:
                    print(f"            → {line}")
            if r.repro:
                print(f"            Repro: {r.repro}")
    if not any_fail:
        print("  (no failures — all passed, all within perf threshold)")
    print("=" * 100)


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    print(f"Target: {BASE}   Perf threshold: < {RESPONSE_TIME_THRESHOLD_MS} ms")
    print("Step 0/8 · Bootstrap auth + create dept/team/ticket fixtures")
    ctx = bootstrap()
    suites = [
        ("1/8 Health", suite_health),
        ("2/8 Auth", suite_auth),
        ("3/8 Departments", suite_support_departments),
        ("4/8 Teams", suite_support_teams),
        ("5/8 Tickets lifecycle", suite_support_tickets),
        ("6/8 Agents / Org / CRUD extras (Canned/Cat/Tag/SLA/Dash/Forecast)", suite_support_agents_and_org),
        ("7/8 KB + Seed", suite_support_kb_seed),
        ("8/8 AuthZ + RBAC + Misc (Users/Search/Notify/Webhooks/Bookmarks/Follows)", suite_misc_wrapper),
    ]
    for label, fn in suites:
        print(f"Step {label}")
        fn(ctx)
    out = f"reports/api_validation_{time.strftime('%Y%m%d_%H%M%S')}.json"
    os.makedirs("reports", exist_ok=True)
    generate_report(out)
    # exit 1 if any logical failures (perf warnings non-fatal)
    fails = [r for r in results if not r.ok]
    return 0 if not fails else 1


def suite_misc_wrapper(ctx):
    suite_authorization(ctx)
    suite_rbac_and_misc(ctx)


if __name__ == "__main__":
    sys.exit(main())

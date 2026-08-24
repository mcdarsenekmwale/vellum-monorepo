#!/usr/bin/env python3
"""REAL HTTP E2E PROD SMOKE · Auth, Departments CRUD, Teams CRUD, Tickets CRUD, Analytics, RBAC.

Runs against http://localhost:3001 with seeded DB admin creds.
Reports PASS/FAIL per operation with status codes + JSON shape checks.
Exits nonzero on any failure.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.error
import uuid
from dataclasses import dataclass

BASE = os.environ.get("API_BASE", "http://localhost:3001")
API = f"{BASE}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@vellum.com")
ADMIN_PW = os.environ.get("ADMIN_PW", "password123")

results: list[dict] = []


@dataclass
class Session:
    access: str
    refresh: str
    user: dict


def req(method, path, *, token=None, body=None, extra_headers=None, accept_json=True) -> tuple[int, dict | str, dict]:
    data = None
    headers = {"Accept": "application/json" if accept_json else "*/*"}
    if extra_headers:
        headers.update(extra_headers)
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(f"{API}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read()
            try:
                payload = json.loads(raw.decode()) if raw else None
            except Exception:
                payload = raw.decode(errors="replace")
            return resp.status, payload, dict(resp.headers.items())
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            payload = json.loads(raw.decode()) if raw else {"status": e.code}
        except Exception:
            payload = {"raw": raw.decode(errors="replace")}
        return e.code, payload, dict(e.headers.items())


def record(name, ok, status, note=""):
    row = {"name": name, "pass": bool(ok), "status": status, "note": note}
    results.append(row)
    tag = "✅ PASS" if ok else "❌ FAIL"
    print(f"{tag}  {name:<82s} HTTP {status:<4s} {note}")
    return ok


def login(email, password) -> Session:
    code, body, _ = req("POST", "/auth/login", body={"email": email, "password": password})
    assert code == 200, f"login {email} failed HTTP {code}: {body}"
    return Session(body["accessToken"], body.get("refreshToken", ""), body["user"])


def shape(t, required_keys: list[str]):
    if not isinstance(t, dict):
        return False
    return all(k in t for k in required_keys)


def paginated_list(p, item_keys: list[str]):
    if not isinstance(p, dict):
        return False
    items = p.get("items") or p.get("data") or []
    if not isinstance(items, list):
        return False
    if item_keys and items:
        return all(shape(it, item_keys) for it in items[:3])
    return True


def main() -> int:
    print(f"=== PROD SMOKE · {API} ===")
    # 0. Health
    st, b, _ = req("GET", "/health")
    record("GET /health", st == 200 and isinstance(b, dict) and b.get("status") == "ok", str(st))
    st, b, _ = req("GET", "/health/ready")
    record("GET /health/ready", st == 200 and b.get("database", {}).get("status") == "connected", str(st),
           note=(f"DB {b.get('database', {}).get('latencyMs')}ms" if isinstance(b, dict) else ""))

    # 1. Auth negative: wrong pass
    st, b, _ = req("POST", "/auth/login", body={"email": ADMIN_EMAIL, "password": "nope"})
    record("POST /auth/login wrong password → 401", st in (401, 403), str(st))

    # 2. Auth positive: admin
    try:
        admin = login(ADMIN_EMAIL, ADMIN_PW)
    except AssertionError as e:
        record("POST /auth/login admin@vellum.com", False, "0", str(e))
        return finalize()
    record("POST /auth/login admin@vellum.com → tokens + user", True, "200",
           note=f"roles: {admin.user.get('roles') if isinstance(admin.user, dict) else '?'}")

    # 3. Me endpoint
    st, me, _ = req("GET", "/auth/me", token=admin.access)
    record("GET /auth/me", st == 200 and shape(me, ["id", "email"]), str(st))

    # 4. departments LIST
    st, dlist, _ = req("GET", "/support/departments?page=1&limit=20", token=admin.access)
    list_ok = st == 200 and paginated_list(dlist, ["id", "name"])
    record("GET /support/departments", list_ok, str(st),
           note=(f"total={dlist.get('total') or dlist.get('count') if isinstance(dlist, dict) else '?'}"))
    depts = (dlist or {}).get("items") or (dlist or {}).get("data") or []
    existing_dept = depts[0] if depts else None

    # 5. departments CREATE
    uniq = f"qa-{uuid.uuid4().hex[:6]}"
    st, created, _ = req("POST", "/support/departments", token=admin.access, body={
        "name": f"QA Dept {uniq}",
        "key": f"qa_{uniq}",
        "email": f"qa-dept-{uniq}@vellum.test",
        "description": "Smoke test dept",
    })
    created_ok = st == 201 and isinstance(created, dict) and "id" in created
    record("POST /support/departments CREATE", created_ok, str(st))
    if not created_ok:
        print("   create payload:", created)
    dept_id = created["id"] if created_ok else None

    # 5b. create duplicate → 409
    st, dpl, _ = req("POST", "/support/departments", token=admin.access, body={
        "name": f"QA Dept {uniq}", "key": f"qa_{uniq}", "email": f"qa-dept-{uniq}@vellum.test",
    })
    record("POST /support/departments duplicate key → 409", st in (409, 400), str(st))

    # 6. departments GET by id
    if dept_id:
        st, dget, _ = req("GET", f"/support/departments/{dept_id}", token=admin.access)
        record(f"GET /support/departments/{dept_id}", st == 200 and shape(dget, ["id", "name"]), str(st))

    # 7. departments PATCH rename
    if dept_id:
        st, upd, _ = req("PATCH", f"/support/departments/{dept_id}", token=admin.access, body={
            "name": f"QA Dept {uniq} RENAMED",
            "description": "updated",
        })
        record(f"PATCH /support/departments/{dept_id} rename", st == 200 and isinstance(upd, dict) and upd.get("name") == f"QA Dept {uniq} RENAMED", str(st))

    # 8. departments invalid PATCH 400/422
    if dept_id:
        st, badi, _ = req("PATCH", f"/support/departments/{dept_id}", token=admin.access, body={"name": ""})
        record(f"PATCH /support/departments/{dept_id} empty name → 400", st in (400, 422), str(st))

    # 9. Teams LIST
    st, tlist, _ = req("GET", "/support/teams?page=1&limit=20", token=admin.access)
    teams_ok = st == 200 and paginated_list(tlist, ["id", "name"])
    record("GET /support/teams", teams_ok, str(st),
           note=(f"total={tlist.get('total') or tlist.get('count') if isinstance(tlist, dict) else '?'}"))

    # 10. Team CREATE under valid dept (the one we created)
    team_id = None
    if dept_id:
        st, tcr, _ = req("POST", "/support/teams", token=admin.access, body={
            "name": f"QA Team {uniq}",
            "departmentId": dept_id,
            "description": "smoke team",
        })
        team_ok = st == 201 and isinstance(tcr, dict) and "id" in tcr
        record("POST /support/teams CREATE under valid dept", team_ok, str(st))
        team_id = tcr.get("id") if team_ok else None
        if not team_ok:
            print("   team create payload:", tcr)

    # 10b. Team CREATE under nonexistent dept → 404/409
    st, tbad, _ = req("POST", "/support/teams", token=admin.access, body={
        "name": f"QA Bad {uniq}", "departmentId": "00000000-0000-0000-0000-000000000000",
    })
    record("POST /support/teams CREATE under nonexistent dept → 4xx", 400 <= st < 500, str(st))

    # 11. Team GET
    if team_id:
        st, tget, _ = req("GET", f"/support/teams/{team_id}", token=admin.access)
        record(f"GET /support/teams/{team_id}", st == 200 and shape(tget, ["id", "name"]), str(st))

    # 12. Team PATCH
    if team_id:
        st, tupd, _ = req("PATCH", f"/support/teams/{team_id}", token=admin.access, body={"description": "patched team"})
        record(f"PATCH /support/teams/{team_id}", st == 200, str(st))

    # 13. Tickets LIST
    st, tktlist, _ = req("GET", "/support/tickets?page=1&limit=20", token=admin.access)
    record("GET /support/tickets", st == 200 and paginated_list(tktlist, ["id"]), str(st),
           note=(f"total={tktlist.get('total') or tktlist.get('count') if isinstance(tktlist, dict) else '?'}"))

    # 14. Ticket CREATE
    st, newt, _ = req("POST", "/support/tickets", token=admin.access, body={
        "title": f"QA Smoke Ticket {uniq}",
        "description": "Created by prod smoke suite",
        "priority": "MEDIUM",
        "departmentId": dept_id,
    })
    ticket_ok = st == 201 and isinstance(newt, dict) and "id" in newt
    record("POST /support/tickets CREATE", ticket_ok, str(st))
    ticket_id = newt.get("id") if ticket_ok else None
    if not ticket_ok:
        print("   ticket create payload:", newt)

    # 15. Ticket GET
    if ticket_id:
        st, tkt, _ = req("GET", f"/support/tickets/{ticket_id}", token=admin.access)
        record(f"GET /support/tickets/{ticket_id}", st == 200 and isinstance(tkt, dict) and tkt.get("id") == ticket_id, str(st))

    # 16. Ticket status update
    if ticket_id:
        st, tstatus, _ = req("PUT", f"/support/tickets/{ticket_id}/status", token=admin.access, body={
            "status": "IN_PROGRESS",
        })
        record(f"PUT /support/tickets/{ticket_id}/status → IN_PROGRESS", 200 <= st < 300, str(st))

    # 17. Ticket route department → team
    if ticket_id and team_id:
        st, rout, _ = req("POST", f"/support/tickets/{ticket_id}/route", token=admin.access, body={
            "teamId": team_id, "reason": "prod smoke route",
        })
        route_ok = 200 <= st < 300 and isinstance(rout, dict)
        record(f"POST /support/tickets/{ticket_id}/route teamId", route_ok, str(st))
        if not route_ok:
            print("   route payload:", rout)

    # 18. Ticket route without targets → 400
    if ticket_id:
        st, rb, _ = req("POST", f"/support/tickets/{ticket_id}/route", token=admin.access, body={})
        record(f"POST /support/tickets/{ticket_id}/route empty body → 400", st == 400, str(st))

    # 19. Dept metrics
    if dept_id:
        st, dm, _ = req("GET", f"/support/departments/{dept_id}/metrics?days=30", token=admin.access)
        record(f"GET /support/departments/{dept_id}/metrics", st == 200 and isinstance(dm, dict), str(st))

    # 20. Team metrics
    if team_id:
        st, tm, _ = req("GET", f"/support/teams/{team_id}/metrics?days=30", token=admin.access)
        record(f"GET /support/teams/{team_id}/metrics", st == 200 and isinstance(tm, dict), str(st))
        st, kpi, _ = req("GET", f"/support/teams/{team_id}/kpis", token=admin.access)
        record(f"GET /support/teams/{team_id}/kpis", st == 200 and isinstance(kpi, dict), str(st))

    # 21. RBAC: missing token on departments → 401
    st, _, _ = req("GET", "/support/departments")
    record("GET /support/departments NO token → 401", st == 401, str(st))

    # 22. RBAC: bad token on departments → 401
    st, _, _ = req("GET", "/support/departments", extra_headers={"Authorization": "Bearer INVALID.TOKEN.HERE"})
    record("GET /support/departments BAD token → 401", st == 401, str(st))

    # 23. Departments DELETE (soft)
    if dept_id:
        st, ddel, _ = req("DELETE", f"/support/departments/{dept_id}", token=admin.access)
        record(f"DELETE /support/departments/{dept_id} soft-delete", 200 <= st < 300, str(st))
        # restore
        st, rest, _ = req("POST", f"/support/departments/{dept_id}/restore", token=admin.access)
        record(f"POST /support/departments/{dept_id}/restore", 200 <= st < 300, str(st))

    # 24. Team DELETE (soft) + restore
    if team_id:
        st, tdel, _ = req("DELETE", f"/support/teams/{team_id}", token=admin.access)
        record(f"DELETE /support/teams/{team_id} soft-delete", 200 <= st < 300, str(st))
        st, trest, _ = req("POST", f"/support/teams/{team_id}/restore", token=admin.access)
        record(f"POST /support/teams/{team_id}/restore", 200 <= st < 300, str(st))

    # 25. Ticket DELETE (soft) cleanup
    if ticket_id:
        st, _, _ = req("DELETE", f"/support/tickets/{ticket_id}", token=admin.access)
        record(f"DELETE /support/tickets/{ticket_id}", 200 <= st < 300, str(st))

    return finalize()


def finalize() -> int:
    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    pct = 100 * passed / total if total else 0
    print(f"\n=== SUMMARY · {passed}/{total} PASS ({pct:.0f}%) ===")
    if passed != total:
        print("FAILS:")
        for r in results:
            if not r["pass"]:
                print(f"  ❌ {r['name']}  HTTP {r['status']}  note: {r['note']}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())

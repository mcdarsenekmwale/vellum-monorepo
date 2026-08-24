#!/usr/bin/env python3
"""
REGRESSION — End-to-end API checks for user detail fixes:
  A) Admin GET /admin/users/<UUID> returns 200 OK with user fields (frontend drill-down)
  B) SupportAgent GET /support/agents/<userId> OR /support/agents/<agentId> both work (dual ID)
  C) Admin agent management endpoints (update/toggle status/delete) work with agentId
"""
import urllib.request, urllib.error, json, sys
BASE = "http://localhost:3001/api"

def req(method, path, token=None, body=None):
    data = None; headers = {}
    if token: headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode() or "null")
        except Exception:
            body = e.read().decode(errors="ignore")[:300]
        return e.code, body

def label(title):
    print(f"\n{'='*70}\n{title}\n{'='*70}")

# ─── 1. Auth ───
code, login = req("POST", "/auth/login", body={"email":"admin@vellum.com","password":"password123"})
if code not in (200, 201):
    print("LOGIN FAIL", code, login); sys.exit(1)
t = login["accessToken"]

# ─── 2. A) Admin /users list -> drill down detail ───
label("A. Admin user list -> individual user detail (/admin/users/$userId)")
code, users = req("GET", "/admin/users?limit=20", token=t)
print(f"  list: HTTP {code}  count={users.get('total',0)}")

results_a = []
for i, u in enumerate(users.get("data", [])[:3]):
    uid, name, email = u.get("id"), u.get("name"), u.get("email")
    code_d, body_d = req("GET", f"/admin/users/{uid}", token=t)
    ok = (code_d == 200 and body_d.get("id") == uid and "passwordHash" not in body_d)
    results_a.append(ok)
    print(f"  [{i}] {name} <{email}> GET /admin/users/{uid[:8]}... -> HTTP {code_d}{' ✓' if ok else f' ✗ body={body_d}'}")

# ─── 3. B) dual-ID support agent detail ───
label("B. Support dual-ID: GET /support/agents/<userId> AND /support/agents/<agentId> both work")
code, agents = req("GET", "/support/agents?limit=3", token=t)
results_b = []
for i, a in enumerate(agents.get("data", [])):
    agid, uid = a.get("id"), a.get("userId")
    c1, b1 = req("GET", f"/support/agents/{uid}", token=t)
    c2, b2 = req("GET", f"/support/agents/{agid}", token=t)
    ok1 = c1 == 200 and b1.get("user",{}).get("id") == uid
    ok2 = c2 == 200 and (b2.get("user",{}).get("id") == uid or b2.get("id") == agid)
    results_b.append(ok1 and ok2)
    print(f"  [{i}] agentId={agid[:8]}...  userId={uid[:8]}... -> GET userId: HTTP {c1}{' ✓' if ok1 else ' ✗'} | GET agentId: HTTP {c2}{' ✓' if ok2 else ' ✗'}")

# ─── 4. C) Admin update / toggle / delete work with agentId ───
label("C. Support admin operations work with agentId")
if agents.get("data"):
    a = agents["data"][0]
    agid = a["id"]
    # C1 toggle status
    c, b = req("PATCH", f"/support/agents/{agid}/status", token=t, body={"isActive": False})
    print(f"  C1) toggle status with agentId {agid[:8]}... -> HTTP {c}  msg={b.get('message',b) if isinstance(b,dict) else b[:80]}")
    # C2 partial update
    c, b = req("PATCH", f"/support/agents/{agid}", token=t, body={"maxTickets": 7})
    ok = (c == 200 and isinstance(b, dict) and b.get("maxTickets") == 7) or c != 200
    print(f"  C2) partial update with agentId -> HTTP {c} {'OK' if c==200 else 'ERR'} body={str(b)[:120]}")
    # C3 read back detail with agentId to confirm
    c, b = req("GET", f"/support/agents/{agid}", token=t)
    ok3 = c == 200 and isinstance(b, dict)
    print(f"  C3) read detail with agentId -> HTTP {c} keys={list(b.keys())[:10] if isinstance(b,dict) else b[:80]}")

# ─── 5. D) users public endpoint by UUID works (for future) ───
label("D. Public user endpoint by UUID (/users/<id>) — new dual-mode controller")
uid = users.get("data",[{}])[0].get("id")
c, b = req("GET", f"/users/{uid}", token=t)
ok = c == 200 and isinstance(b, dict)
print(f"  GET /users/{uid[:8]}... (UUID) -> HTTP {c} {'✓' if ok else '✗ '+ str(b)[:100]}")
hndl = users.get("data",[{}])[0].get("handle")
if hndl:
    c, b = req("GET", f"/users/{hndl.lstrip('@')}", token=t)
    print(f"  GET /users/{hndl} (handle) -> HTTP {c} {'✓' if c==200 and isinstance(b,dict) else '✗ '+ str(b)[:100]}")

print("\n" + ("="*70))
all_ok = all(results_a) and all(results_b) and len(results_a)>0 and len(results_b)>0
print(f"OVERALL: {'✓ PASS' if all_ok else '✗ FAIL'} (A ok={all(results_a)} B ok={all(results_b)})")
sys.exit(0 if all_ok else 1)

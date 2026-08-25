#!/usr/bin/env python3
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

_, login = req("POST", "/auth/login", body={"email":"admin@vellbase.com","password":"password123"})
t = login["accessToken"]

# Find Jane Doe user via admin list (since browser clicked on that)
code, users = req("GET", "/admin/users?limit=30", token=t)
# find user with name jane
row = None
for u in users.get("data", []):
    if u.get("name","").lower().startswith("jane") or u.get("email","").lower().startswith("user2@"):
        row = u; break
if not row:
    # fallback: first user in data
    row = (users.get("data") or [{}])[0]
uid = row.get("id")
print(f"Target user id={uid}  name={row.get('name')}  email={row.get('email')}")

# A) admin detail (this is what frontend calls for User Detail page)
print("\n--- A) GET /admin/users/<userId>  (frontend admin detail endpoint) ---")
code, body = req("GET", f"/admin/users/{uid}", token=t)
msg = body.get("message") if isinstance(body, dict) else body
keys = sorted(list(body.keys())) if isinstance(body, dict) else None
print(f"HTTP {code}")
if code == 200 and keys:
    print(f"OK keys[:15] = {keys[:15]}")
    print(f"   id = {body.get('id')}")
    print(f"   name = {body.get('name')}")
    print(f"   isActive = {body.get('isActive')}")
    print(f"   role = {body.get('role')}")
else:
    print(f"FAIL response = {msg}")

# B) get an agent (user) ID from support agent list
code, agents = req("GET", "/support/agents?limit=1", token=t)
a = (agents.get("data") or [{}])[0]
ag_user_id = a.get("userId")
ag_agent_id = a.get("id")
print(f"\nSupport agent.id={ag_agent_id}  userId={ag_user_id}")

# Test admin detail also works for support agent userId
print(f"\n--- B) GET /admin/users/<supportAgent.userId>  (user linked to agent) ---")
c, b = req("GET", f"/admin/users/{ag_user_id}", token=t)
k = sorted(list(b.keys())) if isinstance(b, dict) else None
print(f"HTTP {c}", f"keys[:15]={k[:15]}" if c==200 and k else f"message={b.get('message') if isinstance(b,dict) else b}")

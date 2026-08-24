#!/usr/bin/env python3
import urllib.request, urllib.error, json

BASE = "http://localhost:3001/api"

def req(method, path, token=None, body=None):
    data = None
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")

_, login = req("POST", "/auth/login", body={"email":"admin@vellum.com","password":"password123"})
t = login["accessToken"]

s, agents = req("GET", "/support/agents?limit=1", token=t)
print("list agents HTTP", s)
a = agents["data"][0]
ag_id = a["id"]          # SupportAgent.id
us_id = a["userId"]      # User.id
print(f"agent.id={ag_id}")
print(f"user.userId={us_id}")

print("\n--- GET /support/agents/<agent.id> (WRONG param) ---")
s1, b1 = req("GET", f"/support/agents/{ag_id}", token=t)
print("HTTP", s1, "type:", type(b1).__name__)
if isinstance(b1, dict):
    if "data" in b1 and isinstance(b1["data"], list):
        print(f"!! RETURNS PAGINATED LIST !! len(data)={len(b1['data'])} total={b1.get('total')}")
    else:
        print("keys:", sorted(list(b1.keys()))[:15])

print("\n--- GET /support/agents/<userId> (correct) ---")
s2, b2 = req("GET", f"/support/agents/{us_id}", token=t)
print("HTTP", s2, "type:", type(b2).__name__)
if isinstance(b2, dict):
    if "data" in b2 and isinstance(b2["data"], list):
        print(f"!! RETURNS PAGINATED LIST !! len(data)={len(b2['data'])} total={b2.get('total')}")
        print("first row keys:", sorted(list(b2["data"][0].keys()))[:10] if b2["data"] else "empty")
    else:
        print("keys:", sorted(list(b2.keys()))[:20])

print("\n--- GET /users/<userId> (generic) ---")
s3, b3 = req("GET", f"/users/{us_id}", token=t)
print("HTTP", s3, end=" ")
if isinstance(b3, dict):
    if "statusCode" in b3:
        print("->", b3.get("message"))
    else:
        print("keys:", sorted(list(b3.keys()))[:15])
else:
    print(b3)

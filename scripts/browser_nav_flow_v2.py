#!/usr/bin/env python3
"""Browser nav v2: click correct refs, retry login, handle slow dashboard"""
import subprocess, json, time, re, sys

def sh(cmd):
    r = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    return (r.stdout or ""), (r.stderr or "")

def elements():
    raw, _ = sh("agent-browser snapshot -i")
    out = []
    for line in raw.splitlines():
        m = re.search(r"\[ref=(e[0-9]+)\]", line)
        if m:
            out.append((m.group(1), line.strip()))
    return raw, out

def find_els(cond):
    _, els = elements()
    return [r for r, l in els if cond(l)]

def wait_until(fn, tries=10, sleep=2):
    for i in range(tries):
        if fn(): return True
        time.sleep(sleep)
    return False

# Ensure on login page
sh("agent-browser open http://localhost:3002/auth/login?redirect=%2Fsupport%2Fagents")
time.sleep(3)
raw, _ = elements()
print("Initial page:", [w for w in ["Sign in","Login","Vellum","404"] if w in raw])

# Fill email
email_refs = find_els(lambda l: 'textbox "Email"' in l)
if email_refs:
    sh(f"agent-browser click ref@{email_refs[0]}")
    sh("agent-browser type admin@vellum.com")
    time.sleep(0.5)
# Fill password
pwd_refs = find_els(lambda l: 'textbox "Password"' in l)
if pwd_refs:
    sh(f"agent-browser click ref@{pwd_refs[0]}")
    sh("agent-browser type password123")
    time.sleep(0.5)
# Click sign in
btn_refs = find_els(lambda l: '"Sign in"' in l and '[ref=' in l)
if not btn_refs:
    btn_refs = find_els(lambda l: "button" in l and ("Sign in" in l or "Login" in l or "Continue" in l))
if btn_refs:
    out, err = sh(f"agent-browser click ref@{btn_refs[0]}")
    print("login click:", out, err[:200])
else:
    sh("agent-browser press Enter")

# 2) Wait for agents list (since redirect=/support/agents)
def on_agents():
    raw, _ = elements()
    return ("Agent" in raw or "agent" in raw.lower()) and "Sign in" not in raw and "Email" not in raw

ok = wait_until(on_agents, tries=15, sleep=2)
raw, els = elements()
print("Agents list reached?", ok)
print("--- list snapshot ---")
print(raw[:2500])
print("--- end list ---")

# 3) Try to click a username link: look for a clickable link with name "Sarah Chen"/"Mike" etc or @handle
name_refs = find_els(lambda l: ("@" in l and ("link" in l.lower() or "clickable" in l.lower())) or (any(n in l for n in ["Chen", "Johnson", "Watson", "Rodriguez", "Priya"]) and ("link" in l.lower() or "clickable" in l.lower())))
# Avoid page heading "Support Agents" / "Agents"
name_refs = [r for r in name_refs if r not in find_els(lambda l: "heading" in l.lower() and ("Agent" in l or "Support" in l))]
print("Potential clickable name refs:", name_refs)

if name_refs:
    r = name_refs[0]
    label = [l for ref,l in els if ref == r][0][:200]
    print(f">> Clicking {r}: {label}")
    sh(f"agent-browser click ref@{r}")
else:
    # Direct URL with real UUID
    print(">> Using direct URL with known real User UUID")
    sh("agent-browser open http://localhost:3002/users/96b087a5-68b0-46df-be06-282cad2d6a52")

time.sleep(5)

def detail_ok():
    raw, _ = elements()
    bad = ["Couldn't load this user", "User not found", "Page not found", "404Page"]
    if any(t in raw for t in bad): return False
    return "All users" in raw and (("Role" in raw) or ("Created" in raw) or ("Status" in raw) or ("Suspended" in raw) or ("Active" in raw))

ok = wait_until(detail_ok, tries=8, sleep=2)
raw, els = elements()
print("\n=== FINAL DETAIL SNAPSHOT ===")
print(raw[:3500])
print()
print("RESULT:", "SUCCESS ✅" if ok else "STILL FAILING ❌")
sys.exit(0 if ok else 1)

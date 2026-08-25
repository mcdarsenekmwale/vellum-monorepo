#!/usr/bin/env python3
"""Browser nav: Login -> Support Agents -> Click user -> Assert detail loaded."""
import subprocess, json, time, re, sys

def sh(cmd, capture=True):
    r = subprocess.run(cmd, shell=True, text=True, capture_output=capture)
    return (r.stdout or "") + ("\nERR:"+r.stderr if r.stderr else "")

def elements():
    raw = sh("agent-browser snapshot -i")
    # print raw on debug
    # Parse ref lines
    out = []
    for line in raw.splitlines():
        m = re.search(r"\[ref=(e[0-9]+)\]", line)
        if m:
            out.append((m.group(1), line.strip()))
    return raw, out

def find_ref(lines, sub: str):
    for ref, line in lines:
        if sub.lower() in line.lower():
            return ref
    return None

def wait_until(fn, tries=8, sleep=2):
    for i in range(tries):
        if fn(): return True
        time.sleep(sleep)
    return False

# 1) Login page already visited. Fill creds & submit
print(">> Step 1: Login admin@vellbase.com / password123")
time.sleep(1.5)
raw, els = elements()
if "Sign in" not in raw and "Email" not in raw and "Dashboard" in raw:
    print("Already logged in, skip login")
else:
    # click Email field first
    email_ref = find_ref(els, "Email") or find_ref(els, "email")
    if email_ref:
        sh(f"agent-browser click ref@{email_ref}")
        sh("agent-browser type admin@vellbase.com")
        time.sleep(0.5)
    else:
        print("No email field found. Raw snippet:")
        print(raw[:1200])
    _, els = elements()
    pwd_ref = find_ref(els, "Password")
    if pwd_ref:
        sh(f"agent-browser click ref@{pwd_ref}")
        sh("agent-browser type password123")
        time.sleep(0.5)
    _, els = elements()
    btn = find_ref(els, "Sign in") or find_ref(els, "Log in") or find_ref(els, "Continue")
    if btn:
        print(f"clicking submit ref={btn}")
        sh(f"agent-browser click ref@{btn}")
    else:
        print("No submit button; try pressing Enter")
        sh("agent-browser press Enter")

# 2) Wait for dashboard
def on_dashboard():
    raw, _ = elements()
    return ("Dashboard" in raw or "Vellbase Admin" in raw) and "Sign in" not in raw

ok = wait_until(on_dashboard, tries=10, sleep=2)
print("Dashboard reached?", ok)
if not ok:
    raw, _ = elements()
    print("Current snapshot:\n", raw[:2000])
    sys.exit(1)

# 3) Navigate to Support Agents via URL directly for speed
print(">> Step 2: Navigate to Support Agents list")
sh("agent-browser open http://localhost:3002/support/agents")
time.sleep(3)

def on_agents_list():
    raw, _ = elements()
    return "Agent" in raw or "agents" in raw.lower() or "Support" in raw

ok = wait_until(on_agents_list, tries=8, sleep=2)
print("Agents list reached?", ok)
raw, els = elements()
print("list snippet:")
print(raw[:2500])

# 4) Find and click on first agent name (which is a Link to /users/:userId)
user_ref = None
for ref, line in els:
    if ("Sarah" in line or "Mike" in line or "Chen" in line or "Johnson" in line or
        "Emma" in line or "James" in line or "Agent" in line and "heading" not in line.lower()):
        # pick clickable name-like link, not the page heading "Agents"
        if "heading" not in line.lower() and "level=" not in line[1:8]:
            user_ref = ref
            break
if not user_ref:
    # fallback: try to find any clickable link in a name column that has @ or user.id-ish text
    for ref, line in els:
        if "@" in line and "link" in line.lower() or "clickable" in line.lower() and len(line) < 120:
            user_ref = ref; break

if user_ref:
    print(f">> Step 3: Clicking name ref={user_ref}: {[l for r,l in els if r==user_ref][0][:200]}")
    sh(f"agent-browser click ref@{user_ref}")
else:
    # try direct URL navigate with known UUID
    raw2, _ = elements()
    print("No clickable name, using direct URL (using real User UUID)")
    sh("agent-browser open http://localhost:3002/users/96b087a5-68b0-46df-be06-282cad2d6a52")

time.sleep(5)

# 5) Assert detail loaded
def on_detail_ok():
    raw, _ = elements()
    bad_tokens = ["Couldn't load this user", "User not found", "Page not found"]
    good_tokens = ["All users", "Role", "Created", "user"]
    if any(t in raw for t in bad_tokens): return False
    # have some confirming good tokens (not just All users button)
    if ("All users" in raw) and (("Role" in raw) or ("Created" in raw) or ("Status" in raw)):
        return True
    return False

ok = wait_until(on_detail_ok, tries=6, sleep=2)
raw, els = elements()
print("Detail page snapshot final:")
print(raw[:3000])
print()
print("SUCCESS?" if ok else "FAIL?", "detail shows no error & has All users+Role/Created/Status")

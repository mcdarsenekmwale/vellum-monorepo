#!/usr/local/bin/python3
import subprocess
import os
import sys
import time
import signal
import json
from pathlib import Path

ROOT = Path("/Users/mcdarsenemwale/projects/dev/ai_article_worskspace")
ENV = os.environ.copy()
ENV["PATH"] = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:" + str(Path.home() / ".nvm/versions/node/v22.20.0/bin") + ":" + ENV.get("PATH", "")
ENV["CI"] = "true"

results = {}

def run_cmd(label, cmd, cwd, timeout_sec=600):
    print(f"\n=== {label} ===")
    print(f"  cwd: {cwd}")
    print(f"  cmd: {cmd}")
    start = time.time()
    try:
        proc = subprocess.run(
            cmd, cwd=cwd, env=ENV,
            capture_output=True, text=True,
            timeout=timeout_sec, shell=True
        )
        elapsed = time.time() - start
        print(f"  EXIT CODE: {proc.returncode} ({elapsed:.1f}s)")
        if proc.stdout:
            tail = proc.stdout.strip().split("\n")[-10:]
            print(f"  stdout tail:\n    " + "\n    ".join(tail))
        if proc.returncode != 0 and proc.stderr:
            err_tail = proc.stderr.strip().split("\n")[-15:]
            print(f"  stderr tail:\n    " + "\n    ".join(err_tail))
        return proc.returncode
    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT after {timeout_sec}s")
        return 999

# 4c API: tsc -b then npm run build
results["api_tsc"] = run_cmd("4c API tsc -b", "npm exec --workspace=@vellbase/api -- tsc -b", ROOT, timeout_sec=300)
if results["api_tsc"] == 0:
    results["api_build"] = run_cmd("4c API npm run build", "npm run build --workspace=@vellbase/api", ROOT, timeout_sec=600)
else:
    print("  SKIP API build: tsc failed")
    results["api_build"] = -1

# 4d Admin build
results["admin_build"] = run_cmd("4d Admin npm run build", "npm run build --workspace=@vellbase/admin-dashboard", ROOT, timeout_sec=600)

# 4e Web build
results["web_build"] = run_cmd("4e Web npm run build", "npm run build --workspace=@vellbase/web-app", ROOT, timeout_sec=600)

# 4f Mobile typecheck
results["mobile_tchk"] = run_cmd("4f Mobile npm run typecheck", "npm run typecheck --workspace=@vellbase/mobile-app", ROOT, timeout_sec=300)

# 4g Runtime smoke test (only if API build succeeded)
health_http = "SKIPPED(missing env or build failed)"
if results["api_build"] == 0:
    print("\n=== 4g Optional /api/health runtime smoke ===")
    api_dir = ROOT / "packages" / "api"
    proc = None
    try:
        proc = subprocess.Popen(
            "npm run start:dev --workspace=@vellbase/api",
            cwd=ROOT, env=ENV, shell=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            preexec_fn=os.setsid
        )
        print(f"  Starting API dev server (PID {proc.pid})... waiting 12s")
        time.sleep(12)

        import urllib.request
        import urllib.error
        try:
            req = urllib.request.Request("http://localhost:3001/api/health")
            resp = urllib.request.urlopen(req, timeout=10)
            health_http = f"HTTP {resp.status}"
            body = resp.read().decode("utf-8", errors="replace")[:500]
            print(f"  /api/health {health_http}")
            print(f"  body: {body[:200]}")
        except urllib.error.HTTPError as e:
            health_http = f"HTTP {e.code}"
            print(f"  /api/health {health_http} (HTTPError)")
        except Exception as e:
            health_http = f"SKIPPED({type(e).__name__}: {e})"
            print(f"  /api/health SKIPPED: {e}")
    except Exception as e:
        health_http = f"SKIPPED(start error: {e})"
        print(f"  Failed to start server: {e}")
    finally:
        if proc and proc.poll() is None:
            print(f"  Stopping API server (PID {proc.pid})...")
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                proc.wait(timeout=10)
            except Exception as e:
                print(f"  Note on stop: {e}")
                try:
                    proc.kill()
                except:
                    pass
else:
    print(f"\n=== 4g /api/health SKIPPED (api_build exit={results['api_build']}) ===")

print("\n\n=== BUILD RESULTS SUMMARY ===")
for k, v in results.items():
    print(f"  {k}: {v}")
print(f"  /api/health: {health_http}")

with open(ROOT / ".task4_results.json", "w") as f:
    json.dump({**results, "health": health_http}, f, indent=2)

# Determine overall - builds only are hard requirements
required = ["api_tsc", "api_build", "admin_build", "web_build", "mobile_tchk"]
all_pass = all(results.get(k, -1) == 0 for k in required)
print(f"\n  All 4 required builds pass: {all_pass}")
sys.exit(0 if all_pass else 1)

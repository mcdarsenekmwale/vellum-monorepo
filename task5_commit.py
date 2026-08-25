#!/usr/local/bin/python3
import subprocess
import os
import sys
import json
import tempfile
import shutil
from pathlib import Path

ROOT = Path("/Users/mcdarsenemwale/projects/dev/ai_article_worskspace")
GIT = "/usr/bin/git"
RSYNC = "/usr/bin/rsync"

commit_msg = """chore!: rename brand + packages Vellum → Vellbase (Strategy 2 atomic with no-break excludes)
- package identities: vellum-monorepo→vellbase-monorepo, @vellum/*→@vellbase/* for 10 workspace packages, all import paths atomically updated
- visible brand copy + HTML titles + i18n renamed in admin, web, mobile
- deploy-vellum.mjs → deploy-vellbase.mjs; GitHub URLs/prisma.compute descriptions/CI updated
- Excluded: prisma schema/migrations, env var NAMES, native iOS/Android bundleIds, mobile test-output JSONs, 3rd-party URLs
- Verification: npm install exit 0; builds (api,admin,web) exit 0; mobile typecheck exit 0; /api/health HTTP 200"""

standalone_msg = """chore!: rename brand Vellum → Vellbase standalone sync
- package @vellum/api → @vellbase/api identity and imports
- deploy-vellum.mjs → deploy-vellbase.mjs
- Excluded: prisma schema/migrations/sql, env var NAMES
- Source: packages/api from vellbase-monorepo atomic rename"""

results = {}

def run(cmd, cwd=ROOT, check=False, timeout=300):
    print(f"\n$ {cmd[:200]}")
    try:
        proc = subprocess.run(
            cmd, cwd=str(cwd), shell=True,
            capture_output=True, text=True, timeout=timeout
        )
        if proc.stdout.strip():
            print(proc.stdout.strip()[:2000])
        if proc.returncode != 0 and proc.stderr.strip():
            print("STDERR:", proc.stderr.strip()[:2000])
        print(f"[exit {proc.returncode}]")
        return proc
    except subprocess.TimeoutExpired as e:
        print(f"[TIMEOUT {timeout}s]")
        return type('X', (), {'returncode': 999, 'stdout': str(e), 'stderr': 'timeout'})()

# ============ 5a: git add -A + commit ============
print("=== 5a: git add -A + commit ===")
r = run(f"{GIT} add -A")
if r.returncode != 0:
    print("WARN: git add had issues")

# Check git config user if commit fails
def commit_with_msg(msg):
    return run(f"{GIT} commit -m {json.dumps(msg)}")

r = commit_with_msg(commit_msg)
if r.returncode != 0:
    # Try with GIT_AUTHOR fallback
    print("Commit failed, checking git config and retrying once...")
    r2 = run(f"{GIT} config user.email || true")
    r3 = run(f"{GIT} config user.name || true")
    # If nothing set, set dummy (git will error)
    r = commit_with_msg(commit_msg)

results["commit_exit"] = r.returncode

# Get last commit hash
r = run(f"{GIT} rev-parse HEAD")
mono_hash = r.stdout.strip()[:12]
results["monorepo_last_hash"] = mono_hash
print(f"\nMonorepo last commit hash (short): {mono_hash}")

# ============ 5b: git push origin main ============
print("\n=== 5b: git push origin main ===")
r = run(f"{GIT} push origin main", timeout=120)
results["push_monorepo_exit"] = r.returncode
print(f"Push monorepo exit: {results['push_monorepo_exit']}")

# ============ 5c: Standalone repo sync ============
print("\n=== 5c: Standalone packages/api sync to vellbase-api (or fallback) ===")
NEW_REPO = "https://github.com/mcdarsenekmwale/vellbase-api.git"
FALLBACK_REPO = "https://github.com/mcdarsenekmwale/vellum-api.git"

tmpdir = Path(tempfile.mkdtemp(prefix="vellbase_api_sync_"))
print(f"Working in tmpdir: {tmpdir}")

clone_url = NEW_REPO
used_fallback = False
clone_cmd = f"{GIT} clone --depth 1 --branch main {clone_url} {tmpdir}/repo"
r = run(clone_cmd, cwd=tmpdir.parent, timeout=120)
if r.returncode != 0:
    print(f"\nNEW REPO 404/error. Falling back to {FALLBACK_REPO}...")
    used_fallback = True
    clone_url = FALLBACK_REPO
    clone_cmd = f"{GIT} clone --depth 1 --branch main {clone_url} {tmpdir}/repo"
    r = run(clone_cmd, cwd=tmpdir.parent, timeout=120)
    if r.returncode != 0:
        print("\nFATAL: Both new and fallback repos failed")
        results["standalone_result"] = "BOTH_FAILED"
        results["standalone_push_exit"] = 998
        results["standalone_last_hash"] = "N/A"
        used_fallback_label = "BOTH FAILED"

repo_dir = tmpdir / "repo"
used_fallback_label = "USED FALLBACK (vellum-api)" if used_fallback else "USED NEW (vellbase-api)"
results["standalone_result"] = used_fallback_label

if repo_dir.exists():
    # First: clean the repo target of source files (keep .git)
    src_root = ROOT / "packages" / "api"

    # Step 1: rsync EXCLUDING .github first
    exclude_args = [
        "--exclude=node_modules",
        "--exclude=dist",
        "--exclude=.env",
        "--exclude=.env.*",
        "--exclude=coverage",
        "--exclude=.turbo",
        "--exclude=.github",
        "--exclude=.git",
        "--exclude=prisma/migrations",
        "--exclude=_deprecated_migrations",
    ]
    src_trailing = str(src_root) + "/"
    dst_trailing = str(repo_dir) + "/"
    rsync_cmd = f"{RSYNC} -av --delete {' '.join(exclude_args)} {src_trailing} {dst_trailing}"
    r = run(rsync_cmd, timeout=120)
    print(f"Rsync main (excl .github): exit {r.returncode}")

    # Step 2: separately rsync .github
    src_gh = src_root / ".github"
    if src_gh.exists():
        gh_src = str(src_gh) + "/"
        gh_dst_d = repo_dir / ".github"
        gh_dst_d.mkdir(parents=True, exist_ok=True)
        rsync_gh_cmd = f"{RSYNC} -av --delete --exclude=.git {gh_src} {str(gh_dst_d)}/"
        r2 = run(rsync_gh_cmd, timeout=60)
        print(f"Rsync .github separately: exit {r2.returncode}")

    # Show git status in standalone repo
    run(f"{GIT} status --short", cwd=repo_dir, timeout=30)

    # Commit
    print("\nStandalone commit...")
    run(f"{GIT} add -A", cwd=repo_dir)
    r = run(f"{GIT} commit -m {json.dumps(standalone_msg)}", cwd=repo_dir)
    # allow no changes exit (1)
    if r.returncode == 0 or "nothing to commit" in (r.stdout + r.stderr):
        results["standalone_commit_exit"] = 0
    else:
        results["standalone_commit_exit"] = r.returncode

    # Get standalone last hash
    rh = run(f"{GIT} rev-parse HEAD", cwd=repo_dir)
    sa_hash = rh.stdout.strip()[:12]
    results["standalone_last_hash"] = sa_hash

    # Push
    print(f"\nPushing standalone to {clone_url}...")
    r = run(f"{GIT} push origin main", cwd=repo_dir, timeout=120)
    results["standalone_push_exit"] = r.returncode
    print(f"Standalone push exit: {r.returncode}")
else:
    results["standalone_push_exit"] = 999
    results["standalone_last_hash"] = "N/A"

# Cleanup tmpdir
try:
    shutil.rmtree(tmpdir, ignore_errors=True)
except Exception:
    pass

# ============ Final summary ============
print("\n\n========================================")
print("         TASK 5 RESULTS SUMMARY")
print("========================================")
print(f"5a commit exit:       {results['commit_exit']}")
print(f"5b push exit:         {results['push_monorepo_exit']}")
print(f"Monorepo last hash:   {results['monorepo_last_hash']}")
print(f"Standalone:           {results['standalone_result']}")
print(f"Standalone push exit: {results.get('standalone_push_exit','?')}")
print(f"Standalone last hash: {results.get('standalone_last_hash','?')}")

with open(ROOT / ".task5_results.json", "w") as f:
    json.dump(results, f, indent=2)
print(f"\nSaved to .task5_results.json")

# Also print summary structure for the answer
print("\nSTRUCTURED:")
print(json.dumps(results, indent=2))

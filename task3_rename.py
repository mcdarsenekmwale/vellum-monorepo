#!/usr/local/bin/python3
import os
import re
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path("/Users/mcdarsenemwale/projects/dev/ai_article_worskspace")

EXCLUDE_DIRS = {
    "node_modules", "dist", ".next", ".turbo", ".output", "coverage", "swagger-ui"
}
EXCLUDE_MOBILE_PATHS = ["apps/mobile-app/tests/test-output/"]
EXCLUDE_PRISMA_PATHS = [
    "packages/api/prisma/schema.prisma",
    "packages/api/prisma/migrations/",
    "packages/api/_deprecated_migrations/",
]

REPLACEMENTS_CASE = [
    (re.compile(r'VELLUM'), 'VELLBASE'),
    (re.compile(r'Vellum'), 'Vellbase'),
    (re.compile(r'vellum'), 'vellbase'),
]

GITHUB_URL_REPLACEMENTS = [
    ("github.com/mcdarsenekmwale/vellum-monorepo", "github.com/mcdarsenekmwale/vellbase-monorepo"),
    ("github.com/mcdarsenekmwale/vellum-api", "github.com/mcdarsenekmwale/vellbase-api"),
    ("vellum-monorepo-webapp.vercel.app", "vellbase-monorepo-webapp.vercel.app"),
]

BRAND_SUBDOMAIN_RE = re.compile(r'([a-zA-Z0-9_-]+\.)?vellum\.')

def is_excluded_path(file_path: Path) -> bool:
    file_str = str(file_path)
    for mp in EXCLUDE_MOBILE_PATHS:
        if mp in file_str:
            return True
    for pp in EXCLUDE_PRISMA_PATHS:
        if pp in file_str:
            return True
    parts = file_path.parts
    for d in EXCLUDE_DIRS:
        if d in parts:
            return True
    return False

def is_env_file(file_path: Path) -> bool:
    name = file_path.name
    if name.startswith(".env"):
        return True
    return False

def replace_env_line(line: str) -> tuple[str, int]:
    if "=" not in line:
        return line, 0
    idx = line.index("=")
    key = line[:idx]
    value = line[idx+1:]

    orig_value = value
    for pattern, repl in REPLACEMENTS_CASE:
        value = pattern.sub(repl, value)
    for old, new in GITHUB_URL_REPLACEMENTS:
        value = value.replace(old, new)

    count = 0
    if value != orig_value:
        count = len(re.findall(r'Vellum|vellum|VELLUM|vellum-monorepo|vellum-api', orig_value))
        for old, new in GITHUB_URL_REPLACEMENTS:
            count += orig_value.count(old)

    return key + "=" + value, count

def process_regular_content(content: str) -> tuple[str, int]:
    count = 0
    for pattern, repl in REPLACEMENTS_CASE:
        content, n = pattern.subn(repl, content)
        count += n
    for old, new in GITHUB_URL_REPLACEMENTS:
        new_content = content.replace(old, new)
        count += (content.count(old))
        content = new_content

    def subdomain_repl(m):
        return m.group(1) + "vellbase." if m.group(1) else "vellbase."
    content, n = BRAND_SUBDOMAIN_RE.subn(subdomain_repl, content)
    count += n

    return content, count

def process_file(file_path: Path) -> tuple[int, int]:
    if is_excluded_path(file_path):
        return 0, 0
    try:
        content = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, IsADirectoryError, PermissionError):
        return 0, 0

    original = content
    total_count = 0

    if is_env_file(file_path):
        lines = content.split("\n")
        new_lines = []
        for line in lines:
            new_line, cnt = replace_env_line(line)
            new_lines.append(new_line)
            total_count += cnt
        content = "\n".join(new_lines)
    else:
        content, total_count = process_regular_content(content)

    if content != original:
        file_path.write_text(content, encoding="utf-8")
        return 1, total_count
    return 0, total_count

def process_path(base_path: Path, max_depth=None) -> tuple[int, int]:
    files_changed = 0
    total_occurrences = 0

    if base_path.is_file():
        return process_file(base_path)

    base_parts = len(base_path.parts)
    for dirpath, dirnames, filenames in os.walk(base_path):
        dir_path = Path(dirpath)
        depth = len(dir_path.parts) - base_parts
        if max_depth is not None and depth > max_depth:
            dirnames[:] = []
            continue

        parts = dir_path.parts
        if any(d in EXCLUDE_DIRS for d in parts):
            dirnames[:] = []
            continue

        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for fname in filenames:
            fpath = dir_path / fname
            fc, oc = process_file(fpath)
            files_changed += fc
            total_occurrences += oc

    return files_changed, total_occurrences

def step3a_rename_script():
    src = ROOT / "packages" / "api" / "scripts" / "deploy-vellbase.mjs"
    dst = ROOT / "packages" / "api" / "scripts" / "deploy-vellbase.mjs"
    if src.exists():
        try:
            result = subprocess.run(
                ["/usr/bin/git", "-C", str(ROOT), "mv",
                 "packages/api/scripts/deploy-vellbase.mjs",
                 "packages/api/scripts/deploy-vellbase.mjs"],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                print("  3a OK: git mv deploy-vellbase.mjs -> deploy-vellbase.mjs")
                return True
            else:
                print(f"  3a WARN: git mv failed: {result.stderr}")
                if src.exists():
                    import shutil
                    shutil.move(str(src), str(dst))
                    print("  3a OK: renamed manually (shutil.move)")
                    return True
        except Exception as e:
            print(f"  3a ERROR: {e}")
    else:
        if dst.exists():
            print("  3a OK: deploy-vellbase.mjs already exists")
            return True
        print("  3a WARN: neither src nor dst exist")
    return False

def step3c_find_and_replace_deploy_refs():
    pattern = re.compile(r'deploy-vellum\.mjs')
    files_changed = 0
    occurrences = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dp = Path(dirpath)
        parts = dp.parts
        if any(d in EXCLUDE_DIRS for d in parts):
            dirnames[:] = []
            continue
        if any(pp in str(dp) for pp in EXCLUDE_PRISMA_PATHS):
            continue
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for fname in filenames:
            fpath = dp / fname
            try:
                c = fpath.read_text(encoding="utf-8")
            except:
                continue
            new_c, n = pattern.subn("deploy-vellbase.mjs", c)
            if n > 0:
                fpath.write_text(new_c, encoding="utf-8")
                files_changed += 1
                occurrences += n
    return files_changed, occurrences

def step3e_invariants_check():
    failures = []

    # (A) prisma schema/migrations: ZERO vellbase/Vellbase
    prisma_paths = [
        ROOT / "packages" / "api" / "prisma" / "schema.prisma",
        ROOT / "packages" / "api" / "prisma" / "migrations",
        ROOT / "packages" / "api" / "_deprecated_migrations",
    ]
    count_a = 0
    files_a = []
    for pp in prisma_paths:
        if not pp.exists():
            continue
        if pp.is_file():
            targets = [pp]
        else:
            targets = [p for p in pp.rglob("*") if p.is_file()]
        for f in targets:
            try:
                c = f.read_text(encoding="utf-8", errors="ignore")
                n = len(re.findall(r'Vellbase|vellbase|VELLBASE', c))
                if n > 0:
                    count_a += n
                    files_a.append(f)
            except:
                pass
    if count_a > 0:
        failures.append(f"(A) PRISMA: {count_a} vellbase/Vellbase matches in {len(files_a)} files: {[str(f) for f in files_a[:3]]}")
        print(f"  FAIL (A): {count_a} matches in prisma")
    else:
        print("  PASS (A): zero vellbase in prisma schema/migrations")

    # (B) mobile test-output: ZERO vellbase
    test_out = ROOT / "apps" / "mobile-app" / "tests" / "test-output"
    count_b = 0
    files_b = []
    if test_out.exists():
        for f in test_out.rglob("*"):
            if f.is_file():
                try:
                    c = f.read_text(encoding="utf-8", errors="ignore")
                    n = len(re.findall(r'Vellbase|vellbase|VELLBASE', c))
                    if n > 0:
                        count_b += n
                        files_b.append(f)
                except:
                    pass
    if count_b > 0:
        failures.append(f"(B) TEST-OUTPUT: {count_b} vellbase matches in {len(files_b)} files")
        print(f"  FAIL (B): {count_b} matches in test-output")
    else:
        print("  PASS (B): zero vellbase in mobile test-output")

    # (C) Env var keys unchanged
    env_key_checks = ["DATABASE_URL", "JWT_SECRET", "PRISMA_TOKEN"]
    env_files = list(ROOT.rglob(".env*"))
    env_keys_touched = []
    for ef in env_files:
        try:
            lines = ef.read_text(encoding="utf-8").split("\n")
        except:
            continue
        for line in lines:
            if "=" not in line:
                continue
            key = line.split("=", 1)[0].strip()
            for ek in env_key_checks:
                if ek in key and "vellbase" in key.lower():
                    env_keys_touched.append(f"{ef}:{key}")
    if env_keys_touched:
        failures.append(f"(C) ENV KEYS: {len(env_keys_touched)} env keys contain vellbase: {env_keys_touched[:3]}")
        print(f"  FAIL (C): env keys touched")
    else:
        print("  PASS (C): env var NAMES unchanged (DATABASE_URL etc)")

    return failures

if __name__ == "__main__":
    print("=== TASK 3: packages/CI/scripts/docs/deploy rename ===")

    total_fc = 0
    total_oc = 0

    # 3a: git mv
    print("\n-- 3a: rename deploy-vellbase.mjs file --")
    step3a_rename_script()

    # 3b: packages/** (excluding prisma schema/mig)
    print("\n-- 3b: packages/** rename --")
    packages_root = ROOT / "packages"
    fc, oc = process_path(packages_root)
    total_fc += fc
    total_oc += oc
    print(f"  packages/**: {fc} files, {oc} occurrences")

    # .github/**
    gh_root = ROOT / ".github"
    if gh_root.exists():
        fc, oc = process_path(gh_root)
        total_fc += fc
        total_oc += oc
        print(f"  .github/**: {fc} files, {oc} occurrences")

    # scripts/**
    scripts_root = ROOT / "scripts"
    if scripts_root.exists():
        fc, oc = process_path(scripts_root)
        total_fc += fc
        total_oc += oc
        print(f"  scripts/**: {fc} files, {oc} occurrences")

    # tests/**
    tests_root = ROOT / "tests"
    if tests_root.exists():
        fc, oc = process_path(tests_root)
        total_fc += fc
        total_oc += oc
        print(f"  tests/**: {fc} files, {oc} occurrences")

    # Root doc files
    root_docs = ["README.md", "CODE_WIKI.md", "TESTING_REPORT.md", "prisma.compute.json", "AGENTS.md"]
    for doc in root_docs:
        dp = ROOT / doc
        if dp.exists():
            fc, oc = process_file(dp)
            total_fc += fc
            total_oc += oc
            if fc:
                print(f"  root {doc}: {oc} occurrences")

    # 3c: any remaining deploy-vellbase.mjs references
    print("\n-- 3c: replace deploy-vellbase.mjs references --")
    fc, oc = step3c_find_and_replace_deploy_refs()
    total_fc += fc
    total_oc += oc
    print(f"  deploy-vellum refs: {fc} files, {oc} occurrences")

    # 3d: env vars were already handled by is_env_file() path in process_file
    print("\n-- 3d: env file protection (values only) --")
    print("  applied via process_file() is_env_file branch for all .env* files above")

    # 3e: invariants check
    print("\n-- 3e: post-exclusion invariants check --")
    invariant_failures = step3e_invariants_check()

    print(f"\n  Task 3 TOTAL: {total_fc} files, {total_oc} occurrences")
    with open(ROOT / ".task3_stats.txt", "w") as f:
        f.write(f"files_changed={total_fc}\noccurrences={total_oc}\n")
        f.write(f"invariant_failures={len(invariant_failures)}\n")
        for fail in invariant_failures:
            f.write(f"FAIL: {fail}\n")

    if invariant_failures:
        print("\n  !! INVARIANT FAILURES !!")
        for fail in invariant_failures:
            print(f"    - {fail}")
        sys.exit(1)
    else:
        print("\n  All invariants PASSED")
        sys.exit(0)

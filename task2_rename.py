#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

ROOT = Path("/Users/mcdarsenemwale/projects/dev/ai_article_worskspace")

EXCLUDE_DIRS = {
    "node_modules", "dist", ".next", ".turbo", ".output", "coverage", "swagger-ui"
}
EXCLUDE_MOBILE_PATHS = ["apps/mobile-app/tests/test-output/"]

ALLOWED_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".html", ".css", ".json", ".md", ".plist",
    ".storyboard", ".swift", ".m", ".h"
}
ALLOWED_BASENAMES = {"app.json", "Info.plist"}

REPLACEMENTS = [
    (re.compile(r'VELLUM'), 'VELLBASE'),
    (re.compile(r'Vellum'), 'Vellbase'),
    (re.compile(r'vellum'), 'vellbase'),
]

def should_process_dir(dir_path: Path) -> bool:
    parts = dir_path.parts
    for d in EXCLUDE_DIRS:
        if d in parts:
            return False
    dir_str = str(dir_path)
    for mp in EXCLUDE_MOBILE_PATHS:
        if mp in dir_str:
            return False
    return True

def should_process_file(file_path: Path) -> bool:
    name = file_path.name
    if name in ALLOWED_BASENAMES:
        return True
    ext = file_path.suffix
    if ext not in ALLOWED_EXTENSIONS:
        return False
    file_str = str(file_path)
    for mp in EXCLUDE_MOBILE_PATHS:
        if mp in file_str:
            return False
    return True

def process_file(file_path: Path) -> tuple[int, int]:
    if not should_process_file(file_path):
        return 0, 0
    try:
        content = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, IsADirectoryError, PermissionError):
        return 0, 0

    original = content
    count = 0
    for pattern, repl in REPLACEMENTS:
        new_content, n = pattern.subn(repl, content)
        count += n
        content = new_content

    if content != original:
        file_path.write_text(content, encoding="utf-8")
        return 1, count
    return 0, count

def process_app(app_name: str):
    app_root = ROOT / "apps" / app_name
    files_changed = 0
    total_occurrences = 0

    for dirpath, dirnames, filenames in os.walk(app_root):
        dir_path = Path(dirpath)
        if not should_process_dir(dir_path):
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for fname in filenames:
            fpath = dir_path / fname
            fc, oc = process_file(fpath)
            files_changed += fc
            total_occurrences += oc

    return files_changed, total_occurrences

def protect_mobile_app_json():
    app_json_path = ROOT / "apps" / "mobile-app" / "app.json"
    if not app_json_path.exists():
        return
    content = app_json_path.read_text(encoding="utf-8")
    data = json.loads(content)
    expo = data.get("expo", {})

    original_ios_bundle = "com.storyverse.hub"
    original_android_pkg = "com.storyverse.hub"

    ios = expo.get("ios", {})
    if "bundleIdentifier" in ios:
        current = ios["bundleIdentifier"]
        restored = current.replace("vellbase", "vellum")
        if restored != current:
            print(f"  Restoring ios.bundleIdentifier: {current} -> {restored}")
            ios["bundleIdentifier"] = restored

    android = expo.get("android", {})
    if "package" in android:
        current = android["package"]
        restored = current.replace("vellbase", "vellum")
        if restored != current:
            print(f"  Restoring android.package: {current} -> {restored}")
            android["package"] = restored

    data["expo"] = expo
    app_json_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

def spot_check():
    admin_title = ROOT / "apps" / "admin-dashboard" / "index.html"
    if admin_title.exists():
        c = admin_title.read_text()
        has_vellbase = "Vellbase" in c
        has_vellum = "Vellum" in c and "Vellbase" not in c
        print(f"  Admin <title> Vellbase={has_vellbase}, Vellum(left)={has_vellum}")

    web_title = ROOT / "apps" / "web-app" / "index.html"
    if web_title.exists():
        c = web_title.read_text()
        has_vellbase = "Vellbase" in c
        print(f"  Web <title> Vellbase={has_vellbase}")

    app_json = ROOT / "apps" / "mobile-app" / "app.json"
    if app_json.exists():
        d = json.loads(app_json.read_text())
        e = d.get("expo", {})
        print(f"  Mobile name={e.get('name')}, slug={e.get('slug')}")
        print(f"  iOS bundleId={e.get('ios',{}).get('bundleIdentifier')}")
        print(f"  Android pkg={e.get('android',{}).get('package')}")

if __name__ == "__main__":
    print("=== TASK 2: Visible app brand rename ===")
    total_fc = 0
    total_oc = 0
    for app in ["admin-dashboard", "web-app", "mobile-app"]:
        fc, oc = process_app(app)
        total_fc += fc
        total_oc += oc
        print(f"  {app}: {fc} files, {oc} occurrences replaced")

    print("\n  Protecting mobile app.json bundleIds...")
    protect_mobile_app_json()

    print("\n  Spot checks:")
    spot_check()

    print(f"\n  Task 2 TOTAL: {total_fc} files, {total_oc} occurrences")
    with open(ROOT / ".task2_stats.txt", "w") as f:
        f.write(f"files_changed={total_fc}\noccurrences={total_oc}\n")

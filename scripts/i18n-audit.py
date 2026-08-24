#!/usr/bin/env python3
"""Scans source files for hardcoded English strings that should use t()."""
import re, json, os
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
PATTERNS = {
    "jsx_text": r'>([A-Z][a-z][^<{}]{2,80})<',
    "placeholder": r'placeholder="([A-Z][^"]{2,80})"',
    "aria_label": r'aria-label="([A-Z][^"]{2,80})"',
    "title_attr": r'title="([A-Z][^"]{2,80})"',
    "accessibility_label": r'accessibilityLabel="([A-Z][^"]{2,80})"',
}
SKIP_DIRS = {"node_modules", ".expo", "dist", "build", "tests", "test-output", "__pycache__"}
SKIP_EXT = {".test.tsx", ".test.ts", ".spec.tsx", ".spec.ts", ".py", ".json", ".css", ".md"}

def should_skip(p):
    if any(part in SKIP_DIRS for part in p.parts): return True
    if any(str(p).endswith(ext) for ext in SKIP_EXT): return True
    return False

def scan_file(filepath):
    results = []
    try:
        content = filepath.read_text(encoding="utf-8")
    except: return results
    has_t = "useI18n" in content or "useTranslate" in content
    for pattern_name, pattern in PATTERNS.items():
        for m in re.finditer(pattern, content):
            text = m.group(1).strip()
            if text in {"SVG", "XML", "HTML", "CSS", "API"}: continue
            if text.startswith("http") or text.startswith("@"): continue
            results.append({
                "file": str(filepath.relative_to(ROOT)),
                "pattern": pattern_name,
                "text": text,
                "line": content[:m.start()].count("\n") + 1,
                "file_uses_t": has_t,
            })
    return results

def main():
    all_findings = []
    by_file = defaultdict(list)
    search_dirs = [
        ROOT / "apps" / "web-app" / "src",
        ROOT / "apps" / "mobile-app" / "app",
        ROOT / "apps" / "mobile-app" / "components",
    ]
    for search_dir in search_dirs:
        if not search_dir.exists(): continue
        for filepath in search_dir.rglob("*.tsx"):
            if should_skip(filepath): continue
            findings = scan_file(filepath)
            if findings:
                all_findings.extend(findings)
                by_file[str(filepath.relative_to(ROOT))].extend(findings)
    
    report = {
        "total_files_with_hardcoded": len(by_file),
        "total_hardcoded_strings": len(all_findings),
        "by_file": dict(by_file),
    }
    out_dir = ROOT / "apps" / "mobile-app" / "tests" / "test-output"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "i18n-audit-report.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"Found {len(all_findings)} hardcoded strings in {len(by_file)} files.")
    print(f"Report: {out_path}")
    ranked = sorted(by_file.items(), key=lambda x: len(x[1]), reverse=True)
    for filepath, items in ranked[:10]:
        print(f"  {len(items):3d}  {filepath}")

if __name__ == "__main__":
    main()

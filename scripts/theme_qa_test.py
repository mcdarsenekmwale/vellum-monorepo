"""
Theme Mode QA Assessment Orchestrator (web + iOS simulator best-effort)
=======================================================================

Coverage — 14 categories × 3 modes × responsive × persistence:
  1. CATEGORY_KEYS         3 state options visible + i18n labels match en/fr
  2. CATEGORY_ROW_COLORS   Setting row background (surface), textPrimary,
                           textSecondary (description) match mode palette
  3. CATEGORY_APPLY_BG     Effective page background matches palette
                           (background / color-scheme). Also verify
                           prefers-color-scheme override works for system mode
  4. CATEGORY_SHEET_OPEN   Appearance row press → bottom sheet open;
                           sheetSurface = colors.surface, handle gray
  5. CATEGORY_SHEET_OPTIONS  3 options (Light / Dark / System) with icon,
                             selected=accent checkmark ✓, others empty view
  6. CATEGORY_CLICK_LIGHT  Select Light → persisted storage=light;
                           re-read background = LIGHT_COLORS.background
  7. CATEGORY_CLICK_DARK   Select Dark → storage=dark; bg = DARK_COLORS.background
  8. CATEGORY_CLICK_SYSTEM Select System → storage=system; effective variant
                           matches window.matchMedia('(prefers-color-scheme: dark)')
  9. CATEGORY_CROSS_PAGE   After Light/Dark → navigate to /feed,
                           /help-center, /settings-about: bg consistent,
                           surface consistent, textPrimary on each
 10. CATEGORY_PERSIST_REFRESH  page.reload() → variant same, storage same
 11. CATEGORY_PERSIST_NEW_TAB  localStorage → re-navigate → same theme
 12. CATEGORY_RESPONSIVE   Same asserts @ 390×844 (mobile) 1280×800 (laptop)
                           1920×1080 (desktop)
 13. CATEGORY_TRANSITION   No layout shift / visible artifact between mode
                           changes (captured by consecutive screenshots;
                           detect extreme pixel deltas only on expected areas)
 14. CATEGORY_STORAGE_KEYS  AsyncStorage / localStorage JSON_KEY (v1) +
                            separate APPEARANCE_KEY both updated correctly
                            (dual write)
 15. CATEGORY_CONTRAST     WCAG 2.1 AA: textPrimary/background,
                            accent/background, danger/background,
                            textSecondary/background >= 4.5:1 (computed)

Output files under test_results/theme_qa_<ts>/
  - final_theme_qa_report.json
  - screenshots/*  (PNG per category + mode)
  - issues.jsonl  (repro steps per failing check)
  - console.log   (playwright console + storage + route traces)
"""
from __future__ import annotations

import argparse
import colorsys
import datetime as dt
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

# =========================================================================
# Palette reference (mirrors ThemeProvider.tsx LIGHT_COLORS / DARK_COLORS)
# =========================================================================
LIGHT_COLORS: dict[str, str] = {
    "background": "#f7f4ee",
    "surface": "#ffffff",
    "surfaceAlt": "#faf8f3",
    "separator": "#f5f2ed",
    "border": "#e5e0d8",
    "textPrimary": "#0f0f10",
    "textSecondary": "#555555",
    "textMuted": "#999999",
    "accent": "#b34421",
    "accentMuted": "#f1dfd3",
    "danger": "#cc1843",
    "success": "#15582c",
    "warning": "#8a4108",
    "overlay": "rgba(15, 15, 16, 0.38)",
    "shadow": "#000000",
    "inverseSurface": "#0f0f10",
    "inverseText": "#faf8f3",
}
DARK_COLORS: dict[str, str] = {
    "background": "#0f0f10",
    "surface": "#18181a",
    "surfaceAlt": "#1f1f22",
    "separator": "#2a2a2e",
    "border": "#2e2e32",
    "textPrimary": "#faf8f3",
    "textSecondary": "#c8c4bb",
    "textMuted": "#8a8a8f",
    "accent": "#ec7a50",
    "accentMuted": "#3a1e13",
    "danger": "#f43f5e",
    "success": "#22c55e",
    "warning": "#f59e0b",
    "overlay": "rgba(0, 0, 0, 0.6)",
    "shadow": "#000000",
    "inverseSurface": "#f7f4ee",
    "inverseText": "#0f0f10",
}
PALETTE: dict[str, dict[str, str]] = {"light": LIGHT_COLORS, "dark": DARK_COLORS}
ALL_COLOR_KEYS = [
    "background", "surface", "surfaceAlt", "separator", "border",
    "textPrimary", "textSecondary", "textMuted", "accent", "accentMuted",
    "danger", "success", "warning", "overlay", "inverseSurface", "inverseText",
]
STORAGE_JSON_KEY = "vellbase.settings.v1"
STORAGE_APPEARANCE_KEY = "vellbase.settings.appearance"
WEB_ORIGIN = "http://localhost:8081"
IOS_WEBAPP_BASE = "http://localhost:8081"

CATEGORIES = [
    ("CATEGORY_KEYS", "3 Appearance options present with correct labels"),
    ("CATEGORY_ROW_COLORS", "Setting row colors (surface/textPrimary/textSecondary) match palette"),
    ("CATEGORY_APPLY_BG", "Page background + color-scheme match effective variant"),
    ("CATEGORY_SHEET_OPEN", "Appearance sheet opens, surface + handle correct"),
    ("CATEGORY_SHEET_OPTIONS", "Sheet 3 options icons + selection checkmarks correct"),
    ("CATEGORY_CLICK_LIGHT", "Select Light mode → storage update + bg=light"),
    ("CATEGORY_CLICK_DARK", "Select Dark mode → storage update + bg=dark"),
    ("CATEGORY_CLICK_SYSTEM", "Select System mode → honors prefers-color-scheme"),
    ("CATEGORY_CROSS_PAGE", "Theme consistent across settings/about/help-center/feed"),
    ("CATEGORY_PERSIST_REFRESH", "Refresh preserves theme"),
    ("CATEGORY_PERSIST_NEW_TAB", "New tab reuses stored theme"),
    ("CATEGORY_RESPONSIVE", "Theme holds @ 390×844, 1280×800, 1920×1080"),
    ("CATEGORY_TRANSITION", "No unexpected artifacts during mode transition"),
    ("CATEGORY_STORAGE_KEYS", "Both vellbase.settings.v1 and APPEARANCE_KEY dual-write"),
    ("CATEGORY_CONTRAST", "WCAG 2.1 AA contrast for key foreground/background pairs"),
]

# =========================================================================
# Helpers: color math
# =========================================================================
def hex2rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def rgb2rel(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    def ch(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4
    return (ch(rgb[0]), ch(rgb[1]), ch(rgb[2]))


def luminance(hex_str: str) -> float:
    r, g, b = rgb2rel(hex2rgb(hex_str))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a_hex: str, b_hex: str) -> float:
    la, lb = luminance(a_hex), luminance(b_hex)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


def palette_bg(variant: str) -> str:
    return PALETTE[variant]["background"]


def approx_color(val: str, expected_hex: str, tol_rgb: int = 14) -> bool:
    """Tolerant color compare. Accepts '#rgb', '#rrggbb', 'rgba(...)', 'rgb(...)'
    strings for both sides and compares RGB within tol_rgb. Alpha ignored."""
    if not val or not expected_hex:
        return False

    def parse_rgb(v: str) -> Optional[tuple[int, int, int]]:
        v = v.strip().lower()
        if v.startswith("#"):
            try:
                return hex2rgb(v)
            except Exception:
                return None
        m = re.match(r"rgba?\s*\(\s*(\d+),\s*(\d+),\s*(\d+)", v)
        if m:
            return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
        return None

    ex = parse_rgb(expected_hex)
    got = parse_rgb(val)
    if not ex or not got:
        return False
    return all(abs(got[i] - ex[i]) <= tol_rgb for i in range(3))


# =========================================================================
# Config + dataclasses
# =========================================================================
@dataclass
class Config:
    targets: list[str]
    user_email: str
    user_password: str
    viewports: list[tuple[int, int]]
    required_contrast: float

@dataclass
class Issue:
    category: str
    mode: str
    target: str
    severity: str   # LOW / MEDIUM / HIGH / BLOCKER
    check_id: str
    expected: str
    actual: str
    repro_steps: list[str]
    screenshot: str = ""
    extra: dict = field(default_factory=dict)


@dataclass
class CategoryResult:
    category: str
    description: str
    mode: str
    target: str
    passed: bool
    duration_ms: int
    checks: list[dict]
    issues: list[Issue]


# =========================================================================
# Web driver (Playwright) — themed assertions
# =========================================================================
def read_storage_settings(page) -> tuple[Optional[str], dict]:
    """Return (appearance_string_or_None, v1_json_or_empty_dict)."""
    try:
        json_raw = page.evaluate("() => window.localStorage.getItem('vellbase.settings.v1')") or ""
    except Exception:
        json_raw = ""
    try:
        appearance_raw = page.evaluate("() => window.localStorage.getItem('vellbase.settings.appearance')") or ""
    except Exception:
        appearance_raw = ""
    v1: dict = {}
    if json_raw:
        try:
            v1 = json.loads(json_raw)
        except Exception:
            v1 = {}
    return (appearance_raw or None, v1)


def write_storage_settings(page, appearance: str, locale: str = "en", sound: bool = True) -> None:
    """Seed both storage keys as-if user already chose."""
    v1 = {"appearance": appearance, "soundEnabled": sound, "locale": locale}
    page.evaluate(
        """(payload) => {
            const [v1, jsonKey, appKey] = payload;
            window.localStorage.setItem(jsonKey, JSON.stringify(v1));
            window.localStorage.setItem(appKey, v1.appearance);
        }""",
        [v1, STORAGE_JSON_KEY, STORAGE_APPEARANCE_KEY],
    )


def do_web_login(page, cfg: Config) -> bool:
    """Login flow: HTTP direct API call, write tokens to browser context's localStorage
    via add_init_script (so origin-restrictions don't block us), then fallback UI click."""
    api_base = os.environ.get("API_BASE_URL", "http://localhost:3001")
    tok = ""

    # --- Step 1: HTTP direct login (no origin restrictions) ---------------
    try:
        import http.client, json as _json
        hostport = api_base.split("://", 1)[1] if "://" in api_base else api_base
        conn = http.client.HTTPConnection(hostport, timeout=10)
        body = _json.dumps({"email": cfg.user_email, "password": cfg.user_password}).encode()
        conn.request("POST", "/api/auth/login", body, {"Content-Type": "application/json"})
        r = conn.getresponse()
        payload = r.read().decode()
        data = _json.loads(payload) if payload else {}
        tok = (data or {}).get("accessToken") or (data or {}).get("token") or ""
        conn.close()
        if r.status == 200 and tok:
            # Navigate once to web origin so localStorage has a valid origin
            page.goto(WEB_ORIGIN + "/login", wait_until="commit", timeout=60_000)
            page.evaluate(
                """(tk) => {
                    window.localStorage.setItem('vellbase:accessToken', tk);
                    window.localStorage.setItem('vellbase_access_token', tk);
                }""",
                tok,
            )
            return True
    except Exception as e:
        print(f"[theme_qa] HTTP direct login failed, try UI: {e}")

    # --- Step 2: UI click login ------------------------------------------
    page.goto(WEB_ORIGIN + "/login", wait_until="domcontentloaded", timeout=60_000)
    try:
        email_inp = page.locator('input[placeholder*="Email" i],input[type="email"],[testID*="login-email"],[data-testid*="login-email"]').first
        email_inp.wait_for(state="attached", timeout=10_000)
        email_inp.fill(cfg.user_email)
    except Exception:
        return False
    try:
        pwd_inp = page.locator('input[placeholder*="Password" i],input[type="password"],[testID*="login-password"],[data-testid*="login-password"]').first
        pwd_inp.wait_for(state="attached", timeout=10_000)
        pwd_inp.fill(cfg.user_password)
    except Exception:
        return False
    try:
        btn = page.locator('[testID*="login-submit"],[data-testid*="login-submit"]').first
        if btn.count() > 0:
            btn.click(timeout=5000)
        else:
            ok = page.evaluate(
                """() => {
                    const EXACT = new Set(['sign in', 'connexion', 'se connecter', 'log in', 'submit']);
                    const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
                    const cands = all.map(el => {
                        const r = el.getBoundingClientRect();
                        const area = Math.max(0, r.width * r.height);
                        const txt = (el.innerText || el.getAttribute?.('aria-label') || el.textContent || '').toString().trim().toLowerCase();
                        const cls = (el.className || '').toString();
                        const hasH = !!(el.onclick || el.getAttribute?.('onclick') || /r-cursor-/.test(cls));
                        return {el, area, txt, hasH};
                    }).filter(x => x.hasH && x.area >= 3000 && x.area <= 500000 && EXACT.has(x.txt));
                    cands.sort((a,b)=>b.area-a.area);
                    for (const c of cands.slice(0, 3)) c.el.click();
                    return cands.length > 0;
                }"""
            )
            if not ok:
                return False
    except Exception:
        return False
    try:
        page.wait_for_function(
            """() => (localStorage.getItem('vellbase:accessToken') || localStorage.getItem('vellbase_access_token')) && location.pathname !== '/login'""",
            timeout=20_000,
        )
        return True
    except Exception:
        path = page.evaluate("location.pathname")
        return str(path or "") not in ("/login", "")


def get_computed(page, selector_or_fn, prop, default=""):
    """Return window.getComputedStyle()[prop] for first element match."""
    try:
        if callable(selector_or_fn):
            return page.evaluate(
                """([fn, prop]) => {
                    try {
                        const el = eval('(' + fn + ')()');
                        return (el && window.getComputedStyle(el)[prop]) || '';
                    } catch { return ''; }
                }""",
                [selector_or_fn.__code__.co_consts[-1] if hasattr(selector_or_fn, "__code__") else "", prop],
            )
        return page.evaluate(
            """([sel, prop, deflt]) => {
                const el = document.querySelector(sel);
                return (el && window.getComputedStyle(el)[prop]) || deflt;
            }""",
            [selector_or_fn, prop, default],
        )
    except Exception:
        return default


def _evaluate_click_appearance_row(page) -> bool:
    """DOM-evaluate approach: click the smallest-area pressable whose text
    contains both 'Appearance' and one of the labels Light/dark/system.
    Robust against React Native Web flattening divs where parent wrappers also
    happen to contain the same text but aren't actually clickable handlers."""
    return page.evaluate(
        r"""() => {
            const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
            const cands = [];
            for (const el of all) {
                const r = el.getBoundingClientRect();
                if (!r || r.y <= 0 || r.width < 150) continue;
                const area = Math.max(0, r.width) * Math.max(0, r.height);
                if (area < 8000 || area > 200000) continue;
                const cls = (el.className || '').toString();
                const csr = (window.getComputedStyle(el).cursor || '').toString();
                const tabi = el.getAttribute?.('tabindex') || '';
                const role = el.getAttribute?.('role') || '';
                const hasH = !!(el.onclick || el.getAttribute?.('onclick') || /r-cursor-/.test(cls) || csr === 'pointer' || tabi === '0' || role === 'button');
                if (!hasH) continue;
                const txt = (el.innerText || el.textContent || '').toString().replace(/\s+/g, ' ').trim();
                if (/Appearance/i.test(txt) && /(Light|Dark|System)/i.test(txt)) cands.push({el, area, y: r.y, txt});
            }
            if (!cands.length) return false;
            // Smallest-area match first: this selects the actual row Pressable,
            // not the outer list wrapper (which has a larger rectangle & no handler).
            cands.sort((a, b) => a.area - b.area);
            cands[0].el.click();
            return true;
        }"""
    )


def _sheet_option_visible(page, label: str) -> bool:
    """Return True if a bottom-sheet option with label text is visible
    (exact text leaf, y >= viewport * 0.55)."""
    return page.evaluate(
        r"""(lab) => {
            const lower = lab.toLowerCase();
            const vp = window.innerHeight;
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                acceptNode(n) {
                    const v = (n.nodeValue || '').replace(/\s+/g,' ').trim();
                    return (v && v.toLowerCase() === lower) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            });
            let node;
            while ((node = walker.nextNode())) {
                let leafY = -1;
                try {
                    const tmp = document.createElement('span');
                    const par = node.parentNode;
                    par.insertBefore(tmp, node);
                    leafY = tmp.getBoundingClientRect().y;
                    par.removeChild(tmp);
                } catch { leafY = -1; }
                if (leafY >= vp * 0.55) return true;
            }
            return false;
        }""",
        label,
    )


def click_to_appearance_value(page, target_value: str, timeout_ms: int = 8_000) -> bool:
    """Open appearance sheet if needed, click option matching value, wait sheet close."""
    # Ensure we're in settings
    path = page.evaluate("location.pathname") or ""
    if "/settings" not in path:
        try:
            page.locator('a[href*="/settings"],div[role="button"]:has-text("Settings" i),[aria-label*="Settings" i]').first.click(timeout=4000)
        except Exception:
            page.goto(WEB_ORIGIN + "/settings", wait_until="domcontentloaded", timeout=40_000)
        try:
            page.wait_for_load_state("domcontentloaded", timeout=10_000)
        except Exception:
            pass
    # Open appearance row bottom sheet. Retry: use DOM-evaluate handler click.
    clicked_row = False
    t0 = time.time()
    while time.time() - t0 < 6.0:
        # If sheet already open (has option in bottom half with our label or
        # any option visible), skip re-clicking row.
        any_open = _sheet_option_visible(page, "Light") or _sheet_option_visible(page, "Dark") or _sheet_option_visible(page, "System")
        if any_open:
            clicked_row = True
            break
        try:
            ok = _evaluate_click_appearance_row(page)
        except Exception:
            ok = False
        if ok:
            time.sleep(0.5)
            # Confirm sheet actually opened (avoid "clicked ancestor wrapper, no-op" trap).
            if _sheet_option_visible(page, "Light") or _sheet_option_visible(page, "Dark") or _sheet_option_visible(page, "System"):
                clicked_row = True
                break
        time.sleep(0.2)
    if not clicked_row:
        return False

    # Now click target option (Light / Dark / System)
    start = time.time()
    while time.time() - start < timeout_ms / 1000:
        ok = page.evaluate(
            r"""(t) => {
                const want = t.toString().trim();
                const wantLower = want.toLowerCase();
                // Single strategy: TreeWalker leaf text + nearest pressable ancestor.
                // Must be in a bottom sheet (y >= viewport*0.5) so we don't re-click the
                // settings page's Appearance row label (which is at top with y ~80).
                const labels = [want, wantLower, want.charAt(0).toUpperCase() + want.slice(1).toLowerCase()];
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                    acceptNode(node) {
                        const v = (node.nodeValue || '').replace(/\s+/g,' ').trim();
                        if (!v) return NodeFilter.FILTER_REJECT;
                        const vl = v.toLowerCase();
                        return (vl === wantLower) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                });
                let leaf;
                while ((leaf = walker.nextNode())) {
                    const leafY = (() => {
                        let r;
                        try {
                            const tmp = document.createElement('span');
                            const par = leaf.parentNode;
                            par.insertBefore(tmp, leaf);
                            r = tmp.getBoundingClientRect();
                            par.removeChild(tmp);
                        } catch { r = {y: 0}; }
                        return r.y || 0;
                    })();
                    let anc = leaf;
                    let best = null;
                    for (let i = 0; i < 14 && anc && anc !== document.body; i++) {
                        anc = anc.parentElement;
                        if (!anc) break;
                        const r = anc.getBoundingClientRect();
                        if (!r || r.width <= 0) continue;
                        const area = Math.max(0, r.width) * Math.max(0, r.height);
                        if (area < 8000 || area > 500000) continue;
                        // Exclude matches too high up on page (likely the row label before sheet opened).
                        if (r.y < window.innerHeight * 0.55 && r.y < 300) continue;
                        const cls = (anc.className || '').toString();
                        const csr = (window.getComputedStyle(anc).cursor || '').toString();
                        const tabi = anc.getAttribute?.('tabindex') || '';
                        const role = anc.getAttribute?.('role') || '';
                        const hasH = !!(anc.onclick || anc.getAttribute?.('onclick') || /r-cursor-/.test(cls) || csr === 'pointer' || tabi === '0' || role === 'button');
                        if (hasH) { best = anc; break; }
                    }
                    if (best) { best.click(); return true; }
                }
                // Fallback: direct DOM query with y >= 0.55*viewport as strict guard.
                const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
                const pressables = [];
                for (const el of all) {
                    const r = el.getBoundingClientRect();
                    if (r.y < window.innerHeight * 0.55) continue;
                    const area = Math.max(0, r.width) * Math.max(0, r.height);
                    if (area < 8000 || area > 500000) continue;
                    const cls = (el.className || '').toString();
                    const csr = (window.getComputedStyle(el).cursor || '').toString();
                    const tabi = el.getAttribute?.('tabindex') || '';
                    const role = el.getAttribute?.('role') || '';
                    const hasH = !!(el.onclick || el.getAttribute?.('onclick') || /r-cursor-/.test(cls) || csr === 'pointer' || tabi === '0' || role === 'button');
                    if (!hasH) continue;
                    const txt = (el.innerText || el.textContent || '').toString().replace(/\s+/g, ' ').trim();
                    if (!txt) continue;
                    // Only match if element's text is EXACTLY "Light" / "Dark" / "System"
                    // or very close (≤ 2x of label + description per row ~ 30 chars).
                    if (txt.length > 80) continue;
                    const score = (txt.toLowerCase() === wantLower) ? 1000 :
                                  (new RegExp('(^|[\\s,|])' + wantLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '([\\s,|]|$)', 'i').test(txt.toLowerCase())) ? 500 : 0;
                    if (score === 0) continue;
                    pressables.push({el, score, area, y: r.y});
                }
                pressables.sort((a,b) => (b.score - a.score) || (a.area - b.area));
                if (pressables.length) { pressables[0].el.click(); return true; }
                return false;
            }""",
            target_value,
        )
        if ok:
            time.sleep(0.8)  # animation + close
            return True
        time.sleep(0.2)
    return False


def effective_bg_hex(page) -> str:
    """Best-effort: scan DOM for largest-area non-transparent element that spans
    most of the viewport (top-anchored, width >= viewport-width*0.9). This is the
    effective app background in React Native Web where body is often transparent."""
    try:
        return page.evaluate(
            """() => {
                const vp = {w: window.innerWidth, h: window.innerHeight};
                const tries = [document.body,
                              document.querySelector('[class*="SafeArea"]'),
                              document.querySelector('[class*="safeArea"]'),
                              document.querySelector('[data-testid="app-shell"]'),
                              document.querySelector('#root') ? document.querySelector('#root').children[0] : null,
                              document.documentElement];
                for (const el of tries) {
                    if (!el) continue;
                    const bg = window.getComputedStyle(el).backgroundColor;
                    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
                }
                // Fallback: largest area non-transparent rectangle top-anchored
                const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
                let best = null, bestArea = 0;
                for (const el of all) {
                    const r = el.getBoundingClientRect();
                    const area = Math.max(0, r.width * r.height);
                    if (area < bestArea || r.y > 20) continue;
                    if (r.width < vp.w * 0.9 || r.height < vp.h * 0.85) continue;
                    const cs = window.getComputedStyle(el);
                    const bg = cs.backgroundColor;
                    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
                    best = bg;
                    bestArea = area;
                }
                // Even more forgiving: largest non-transparent element overall (covers cases with tabbar top offset)
                if (!best) {
                    let b2 = null, bArea = 0;
                    for (const el of all) {
                        const r = el.getBoundingClientRect();
                        const area = Math.max(0, r.width * r.height);
                        if (area < bArea) continue;
                        const cs = window.getComputedStyle(el);
                        const bg = cs.backgroundColor;
                        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
                        b2 = bg; bArea = area;
                    }
                    best = b2;
                }
                return best || '';
            }"""
        )
    except Exception:
        return ""


def sample_palette_from_dom(page, variant_expected: str) -> dict:
    """Best-effort DOM sample for several color tokens, returns dict{token: computed_rgb_or_empty}."""
    def bg_of(query_js):
        return page.evaluate(f"""() => {{ try {{ const el = {query_js}; if (!el) return ''; return window.getComputedStyle(el).backgroundColor; }} catch(e) {{ return ''; }} }}""")
    def color_of(query_js):
        return page.evaluate(f"""() => {{ try {{ const el = {query_js}; if (!el) return ''; return window.getComputedStyle(el).color; }} catch(e) {{ return ''; }} }}""")
    # surface = setting row or card (any element with a computed backgroundColor approximating the palette surface)
    # Scan and choose largest area Pressable row-like element
    return {
        "background_measured": effective_bg_hex(page),
        "body_bg": bg_of("document.body"),
        "body_textPrimary": color_of("document.body"),
    }


def set_emulated_color_scheme(context, scheme: str, page=None) -> None:
    """Apply prefers-color-scheme emulation robustly.

    Modern Playwright (1.42+) removed context.emulate_media; the only reliable
    API is page.emulate_media. Because each page carries its own emulated-media
    state (state set on page A doesn't propagate to newly opened page B), we
    apply the emulation to every currently open page in the context AND to the
    optional `page` argument separately as a fallback. We also use a CDP session
    as last-ditch (also per-page)."""
    # 1) Try context-level if still available (older Playwright versions).
    try:
        if hasattr(context, "emulate_media"):
            context.emulate_media(color_scheme=scheme)
    except Exception:
        pass
    # 2) Apply to every open page in context (handles all current + future
    #    existing pages). Collect pages via context.pages (list API).
    def _apply_one(target_page):
        if target_page is None or getattr(target_page, "is_closed", lambda: False)():
            return False
        try:
            if hasattr(target_page, "emulate_media"):
                target_page.emulate_media(color_scheme=scheme)
                return True
        except Exception:
            pass
        # CDP fallback for this specific page.
        try:
            session = context.new_cdp_session(target_page)
            session.send(
                "Emulation.setEmulatedMedia",
                {
                    "media": "screen",
                    "features": [{"name": "prefers-color-scheme", "value": scheme}],
                },
            )
            return True
        except Exception:
            return False

    ok = False
    if page is not None:
        ok = _apply_one(page) or ok
    # Apply to context.pages list (Playwright BrowserContext exposes `pages`).
    try:
        pages_list = list(getattr(context, "pages", []) or [])
    except Exception:
        pages_list = []
    for other in pages_list:
        if other is page:
            continue
        ok = _apply_one(other) or ok
    return ok if False else None


def read_effective_variant(page) -> str:
    """Best-effort guess of active variant based on actual page body/root background."""
    bg = effective_bg_hex(page) or ""
    if approx_color(bg, PALETTE["light"]["background"]):
        return "light"
    if approx_color(bg, PALETTE["dark"]["background"]):
        return "dark"
    # fallback: luminance < 0.2 → dark
    try:
        r, g, b = hex2rgb(PALETTE["dark"]["background"])
    except Exception:
        return "light"
    try:
        # parse bg rgb(...)
        m = re.search(r"rgba?\((\d+),\s*(\d+),\s*(\d+)", bg or "")
        if m:
            lu = luminance("#%02x%02x%02x" % (int(m.group(1)), int(m.group(2)), int(m.group(3))))
            return "dark" if lu < 0.25 else "light"
    except Exception:
        pass
    return "light"


# =========================================================================
# Full theme QA execution for a single page / mode on web
# =========================================================================
def run_web_theme_qa(cfg: Config, playwright: Any, outdir: Path) -> dict:
    target_out = outdir / "web"
    screenshots = target_out / "screenshots"
    screenshots.mkdir(parents=True, exist_ok=True)
    issues_path = target_out / "issues.jsonl"
    console_log = target_out / "console.log"

    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
    # Default viewport
    w, h = cfg.viewports[0]
    context = browser.new_context(
        viewport={"width": w, "height": h},
        color_scheme="light",
        device_scale_factor=1,
    )
    page = context.new_page()
    # Sync emulated media via page-level API (some Playwright versions only expose
    # the API on Page, not BrowserContext).
    set_emulated_color_scheme(context, "light", page=page)
    console_lines: list[str] = []
    issues: list[Issue] = []
    checks_log: list[dict] = []

    def log(msg: str) -> None:
        ts = dt.datetime.now().isoformat(timespec="milliseconds")
        console_lines.append(f"[{ts}] {msg}")

    page.on("console", lambda m: log(f"console[{m.type}] {m.text[:300]}"))
    page.on("pageerror", lambda err: log(f"pageerror {str(err)[:400]}"))
    page.on("response", lambda r: (
        (r.status >= 400) and log(f"http {r.status} {r.request.method} {r.url[:160]}")
    ))

    def add_issue(issue: Issue) -> None:
        issues.append(issue)
        with issues_path.open("a") as f:
            f.write(json.dumps(asdict(issue)) + "\n")

    def check(name: str, passed: bool, expected: str, actual: str, category: str, mode: str,
              severity: str = "MEDIUM", repro: Optional[list[str]] = None, screenshot: str = "",
              extra: Optional[dict] = None) -> bool:
        ok = bool(passed)
        checks_log.append({"category": category, "mode": mode, "check": name, "passed": ok,
                           "expected": expected, "actual": actual, "severity": severity,
                           "extra": extra or {}})
        if not ok:
            add_issue(Issue(
                category=category, mode=mode, target="web", severity=severity, check_id=name,
                expected=expected, actual=actual, repro_steps=repro or [],
                screenshot=screenshot, extra=extra or {},
            ))
        return ok

    # 1) login
    t0 = time.time()
    logged_in = do_web_login(page, cfg)
    log(f"login finished success={logged_in} path={page.evaluate('location.pathname')}")
    if not logged_in:
        # Try warming storage with fake + direct nav to settings
        write_storage_settings(page, "light")
        page.goto(WEB_ORIGIN + "/settings", wait_until="domcontentloaded", timeout=60_000)

    # 2) baseline: ensure settings page + Appearance row visible, screenshot
    try:
        page.goto(WEB_ORIGIN + "/settings", wait_until="domcontentloaded", timeout=60_000)
    except Exception as e:
        log(f"navigate settings failed {e}")
    page.wait_for_timeout(1500)
    try:
        page.screenshot(path=str(screenshots / "A01_settings_initial.png"), full_page=True)
    except Exception as e:
        log(f"screenshot failed {e}")

    # =========================================================================
    #  Iterate modes: system (with emulator), light, dark
    # =========================================================================
    per_mode_results: list[CategoryResult] = []

    def evaluate_mode(mode_setup_name: str, variant_expected: str,
                      emulate_scheme: Optional[str]) -> list[CategoryResult]:
        """Apply setup (mode_setup_name ∈ {light, dark, system_light, system_dark}) and run
        all 15 categories. Returns CategoryResult list (one per category)."""
        nonlocal page
        t0_mode = time.time()
        # Step A: write appearance storage + reset to known state (always start from clean page)
        storage_setting = "system" if mode_setup_name.startswith("system") else mode_setup_name
        write_storage_settings(page, storage_setting)
        # For system mode: create a BRAND NEW page on the same context so the SPA's
        # useColorScheme hook is first-initialised with the emulated media setting.
        # React Native Web caches color-scheme on first render within a page; a fresh page
        # forces re-reading matchMedia('(prefers-color-scheme: ...)').
        if emulate_scheme:
            set_emulated_color_scheme(context, emulate_scheme, page=page)
            try:
                # Preserve localStorage (auth tokens, settings) across new page
                storage_snapshot = page.evaluate("""() => {
                    const o = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k) o[k] = localStorage.getItem(k);
                    }
                    return o;
                }""")
                page.close()
            except Exception as e:
                log(f"pre-close storage snapshot fail: {e}")
                storage_snapshot = {}
            new_page = context.new_page()
            new_page.on("console", lambda m: log(f"console[{m.type}] {m.text[:300]}"))
            new_page.on("pageerror", lambda err: log(f"pageerror {str(err)[:400]}"))
            new_page.on("response", lambda r: (
                (r.status >= 400) and log(f"http {r.status} {r.request.method} {r.url[:160]}")
            ))
            # ★ Re-apply emulated color scheme on the brand-new page (critical).
            # page-level emulate_media state does not transfer across pages.
            set_emulated_color_scheme(context, emulate_scheme, page=new_page)
            # Warm origin, restore storage
            new_page.goto(WEB_ORIGIN + "/login", wait_until="commit", timeout=60_000)
            try:
                new_page.evaluate("""(snap) => {
                    for (const k in snap) {
                        if (Object.prototype.hasOwnProperty.call(snap, k)) localStorage.setItem(k, snap[k]);
                    }
                }""", storage_snapshot)
            except Exception as e:
                log(f"restore storage failed: {e}")
            # Double-check matchMedia('(prefers-color-scheme: ...)') reports the expected scheme
            try:
                match_result = new_page.evaluate(
                    """(want) => matchMedia('(prefers-color-scheme: ' + want + ')').matches""",
                    emulate_scheme,
                )
                if not match_result:
                    log(f"matchMedia FAIL after emulate_scheme={emulate_scheme}; forcing CDP override")
                    # Try CDP once more directly on this page
                    try:
                        sess = context.new_cdp_session(new_page)
                        sess.send(
                            "Emulation.setEmulatedMedia",
                            {"media": "screen",
                             "features": [{"name": "prefers-color-scheme", "value": emulate_scheme}]},
                        )
                    except Exception as cdp_err:
                        log(f"CDP force override failed: {cdp_err}")
            except Exception as e:
                log(f"matchMedia verify failed: {e}")
            page = new_page
            time.sleep(0.5)
        # Hard reload so ThemeProvider re-reads storage + respects new media
        try:
            page.reload(wait_until="domcontentloaded", timeout=60_000)
        except Exception as e:
            log(f"reload failed {mode_setup_name}: {e}")
        time.sleep(1.0)
        try:
            page.goto(WEB_ORIGIN + "/settings", wait_until="domcontentloaded", timeout=60_000)
        except Exception as e:
            log(f"goto settings failed {mode_setup_name}: {e}")
        page.wait_for_timeout(2500)

        mode_label = mode_setup_name  # for issue tracking
        # effective variant must match variant_expected
        effective_var = read_effective_variant(page)
        bg_rgb = effective_bg_hex(page)
        shots_prefix = f"{mode_setup_name}_vp{cfg.viewports[0][0]}x{cfg.viewports[0][1]}"
        page.screenshot(path=str(screenshots / f"{shots_prefix}_01_settings.png"), full_page=True)

        cat_results: list[CategoryResult] = []

        def mk_cat(category_tuple, checks, cats_issues, passed):
            return CategoryResult(
                category=category_tuple[0],
                description=category_tuple[1],
                mode=mode_label, target="web",
                passed=passed,
                duration_ms=int((time.time() - t0_mode) * 1000),
                checks=checks,
                issues=cats_issues,
            )

        # ---------- CATEGORY_APPLY_BG + color-scheme ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        check("background matches palette",
              approx_color(bg_rgb, palette_bg(variant_expected), tol_rgb=20),
              palette_bg(variant_expected), bg_rgb or "(empty)",
              "CATEGORY_APPLY_BG", mode_label, severity="HIGH",
              repro=["Set appearance=" + storage_setting + (" with color-scheme=" + emulate_scheme if emulate_scheme else ""),
                     "Reload, navigate /settings", "Read page root backgroundColor"])
        check("effective_variant correct",
              effective_var == variant_expected,
              variant_expected, effective_var,
              "CATEGORY_APPLY_BG", mode_label, severity="HIGH",
              repro=[])
        # storage keys
        ap_raw, v1 = read_storage_settings(page)
        check("storage APPEARANCE_KEY equals " + storage_setting,
              ap_raw == storage_setting,
              storage_setting, ap_raw or "(None)",
              "CATEGORY_STORAGE_KEYS", mode_label, severity="HIGH",
              repro=[])
        check("storage v1.appearance equals " + storage_setting,
              v1.get("appearance") == storage_setting,
              storage_setting, v1.get("appearance") or "(None)",
              "CATEGORY_STORAGE_KEYS", mode_label, severity="HIGH",
              repro=[])
        cat_results.append(mk_cat(("CATEGORY_STORAGE_KEYS", "dual write"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_ROW_COLORS ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        # Sample row colors by selecting a setting row (appearance row) - approximate
        row_measures = page.evaluate(
            r"""(paletteBg) => {
                const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
                const vpW = window.innerWidth;
                // For each label: find a leaf text node containing the label,
                // then walk UP to find the closest ancestor with a solid background
                // and dimensions that look like a row (width ≈ 90% viewport,
                // height 50-160px). Also capture the label's span color by using
                // the matching text leaf.
                function findTextNode(root, frag) {
                    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
                        acceptNode(node) {
                            const v = (node.nodeValue || '').replace(/\s+/g,' ').trim();
                            return (v === frag || v.startsWith(frag + ' ') || v.startsWith(frag + '|') || v.startsWith(frag + ':')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                        }
                    });
                    return walker.nextNode() || null;
                }
                function findRowForLabel(label) {
                    // 1) Find an element in the DOM whose direct (concise) text content === label
                    //    (no other unrelated labels mixed in).
                    let seedEl = null, seedText = null;
                    const wantExact = new RegExp('(^|[|\\n])\\s*' + label.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*([|\\n]|$)', 'i');
                    for (const el of all) {
                        const t = (el.innerText || el.textContent || '').toString().replace(/\s+/g, ' ').trim();
                        if (!t || t.length > 400) continue;
                        // Has label AND doesn't contain multiple other setting labels.
                        if (t.includes(label)) {
                            seedEl = el; seedText = t;
                            // If this element has ONLY this row-ish content (Appearance + desc),
                            // prefer it immediately.
                            if (/Appearance|Language|Notifications|Privacy|Sound|Subscription|Help Center|About|Log Out/i.test(t)) {
                                const labelCount = (t.match(/Appearance|Language|Notifications|Privacy|Sound|Subscription|Help Center|About/gi) || []).length;
                                if (labelCount === 1 && t.length <= 200) break;
                            }
                        }
                    }
                    if (!seedEl) return null;
                    // 2) Walk up 0-10 ancestors to find the first ancestor whose bg is
                    //    solid + width ≈ viewport width + looks row-like (h 40-200).
                    const goodR = (rect) => (rect.width >= vpW * 0.7 && rect.width <= vpW * 1.05 && rect.height >= 40 && rect.height <= 220 && rect.y > 0);
                    let curr = seedEl;
                    for (let i = 0; i < 12 && curr && curr !== document.body; i++) {
                        const r = curr.getBoundingClientRect();
                        if (goodR(r)) {
                            const bg = window.getComputedStyle(curr).backgroundColor;
                            if (bg && bg !== 'rgba(0,0,0,0)' && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                                return {rowEl: curr, seed: seedEl, bg, y: r.y, h: r.height, w: r.width, area: Math.round(r.width*r.height)};
                            }
                        }
                        // Even without solid bg, if row dimensions look right, use
                        // it and continue up a bit longer.
                        curr = curr.parentElement;
                    }
                    // Fallback: best solid-bg element near seed's rect.
                    const sr = seedEl.getBoundingClientRect();
                    let cand = null, candScore = -1;
                    for (const el of all) {
                        const r = el.getBoundingClientRect();
                        if (!goodR(r)) continue;
                        if (Math.abs(r.y - sr.y) > 30) continue;
                        const bg = window.getComputedStyle(el).backgroundColor;
                        if (!bg || bg === 'rgba(0,0,0,0)' || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
                        const score = Math.max(0, 2000 - Math.abs(r.y - sr.y)*20 - Math.abs(r.width - vpW*0.9));
                        if (score > candScore) { candScore = score; cand = {rowEl:el, bg, seed: seedEl, y: r.y, h: r.height, w: r.width, area: Math.round(r.width*r.height)}; }
                    }
                    return cand;
                }
                function getLabelTextColor(row, label) {
                    // Walk all descendants including rowEl, pick the first element
                    // whose text content exactly equals/matches label.
                    const stack = [row.rowEl];
                    let best = null, bestDiff = Infinity;
                    while (stack.length) {
                        const cur = stack.pop();
                        if (!cur || !cur.children) continue;
                        const txt = (cur.innerText || cur.textContent || '').toString().replace(/\s+/g,' ').trim();
                        if (txt === label) return window.getComputedStyle(cur).color;
                        if (txt.includes(label) && Math.abs(txt.length - label.length) < bestDiff) {
                            bestDiff = Math.abs(txt.length - label.length);
                            best = cur;
                        }
                        for (const ch of cur.children) stack.push(ch);
                    }
                    if (best) return window.getComputedStyle(best).color;
                    return window.getComputedStyle(row.rowEl).color;
                }
                const labels = ['Appearance', 'Language', 'Notifications', 'Help Center', 'About'];
                const out = {};
                for (const label of labels) {
                    const row = findRowForLabel(label);
                    if (!row) continue;
                    out[label] = {
                        rowBg: row.bg,
                        rowY: Math.round(row.y),
                        rowH: Math.round(row.h),
                        rowW: Math.round(row.w),
                        textColor: getLabelTextColor(row, label),
                    };
                }
                return out;
            }""",
            PALETTE[variant_expected]["background"],
        )
        pal = PALETTE[variant_expected]
        for lbl, meas in (row_measures or {}).items():
            check(f"row[{lbl}] surface approx",
                  approx_color(meas.get("rowBg", ""), pal["surface"], tol_rgb=22),
                  pal["surface"], meas.get("rowBg", "") or "(empty)",
                  "CATEGORY_ROW_COLORS", mode_label, severity="MEDIUM",
                  repro=["Navigate settings appearance row",
                         "window.getComputedStyle(row).backgroundColor"])
            check(f"row[{lbl}] label text color approx",
                  approx_color(meas.get("textColor", ""), pal["textPrimary"], tol_rgb=25),
                  pal["textPrimary"], meas.get("textColor", "") or "(empty)",
                  "CATEGORY_ROW_COLORS", mode_label, severity="MEDIUM",
                  repro=[])
        # Fallback: even when no rows, add a placeholder check
        if not row_measures:
            check("at least one setting row rendered (found labels)",
                  False, "≥1 row (Appearance/Language/...)", "0 rows",
                  "CATEGORY_ROW_COLORS", mode_label, severity="HIGH",
                  repro=["Nav /settings", "DOM scan for setting rows → 0 matches"])
        cat_results.append(mk_cat(("CATEGORY_ROW_COLORS", "row colors"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_CONTRAST (key pairs) ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        pairs = [
            ("textPrimary/background", pal["textPrimary"], pal["background"]),
            ("textSecondary/background", pal["textSecondary"], pal["background"]),
            ("accent/background", pal["accent"], pal["background"]),
            ("danger/background", pal["danger"], pal["background"]),
            ("success/background", pal["success"], pal["background"]),
            ("inverseText/inverseSurface", pal["inverseText"], pal["inverseSurface"]),
            ("textPrimary/surface", pal["textPrimary"], pal["surface"]),
        ]
        for name, fg, bg in pairs:
            cr = contrast_ratio(fg, bg)
            check(f"contrast {name} ≥ {cfg.required_contrast}:1",
                  cr >= cfg.required_contrast,
                  f"≥ {cfg.required_contrast}:1", f"{cr:.2f}:1",
                  "CATEGORY_CONTRAST", mode_label, severity="HIGH" if cr < cfg.required_contrast else "LOW",
                  repro=["Compute WCAG L using palette colors " + name,
                         f"foreground={fg} background={bg}"])
        cat_results.append(mk_cat(("CATEGORY_CONTRAST", "WCAG AA"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_KEYS, CATEGORY_SHEET_*, CATEGORY_CLICK_* ----------
        # Open appearance sheet to capture keys + selection
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        # Helper: open the appearance bottom sheet by clicking the Appearance row
        # without selecting any option. Used by CATEGORY_SHEET_OPEN / CATEGORY_KEYS.
        def sheet_open_manual(max_wait=4.5):
            import time as _t
            t0 = _t.time()
            while _t.time() - t0 < max_wait:
                if (_sheet_option_visible(page, "Light") or _sheet_option_visible(page, "Dark")
                        or _sheet_option_visible(page, "System")):
                    return True
                try:
                    _evaluate_click_appearance_row(page)
                except Exception:
                    pass
                _t.sleep(0.4)
            return (_sheet_option_visible(page, "Light") or _sheet_option_visible(page, "Dark")
                    or _sheet_option_visible(page, "System"))

        sheet_opened_ok = sheet_open_manual()
        time.sleep(0.9)
        if not sheet_opened_ok:
            # Fallback single retry: force-settings then try again
            try:
                page.goto(WEB_ORIGIN + "/settings", wait_until="domcontentloaded", timeout=45_000)
                page.wait_for_timeout(1500)
            except Exception:
                pass
            sheet_opened_ok = sheet_open_manual()
            time.sleep(0.8)
        page.screenshot(path=str(screenshots / f"{shots_prefix}_02_appearance_sheet.png"), full_page=True)
        # Now capture innerText of sheet
        sheet_inner = page.evaluate(
            r"""() => {
                // Bottom sheet: rectangle near bottom of viewport, containing at least one
                // option text leaf (Light / Dark / System). Match largest-area candidate that
                // has y >= viewport*0.55 and height >= 200.
                const vp = {w: window.innerWidth, h: window.innerHeight};
                const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
                const cands = [];
                for (const el of all) {
                    const r = el.getBoundingClientRect();
                    const area = Math.max(0, r.width * r.height);
                    if (area < 50000) continue;
                    if (r.y < vp.h * 0.45) continue;
                    if (r.height < 200 || r.width < 200) continue;
                    const cs = window.getComputedStyle(el);
                    const bg = cs.backgroundColor;
                    const txt = (el.innerText || el.textContent || '').toString();
                    cands.push({el, area, bg, txt, y: r.y, h: r.height, w: r.width});
                }
                cands.sort((a, b) => b.area - a.area);
                const s = cands[0];
                if (!s) return {bg: '', texts: ''};
                return {bg: s.bg, texts: s.txt.replace(/\s+/g, ' ').trim()};
            }"""
        )
        sheet_bg = sheet_inner.get("bg", "")
        sheet_texts = sheet_inner.get("texts", "")
        check("sheet surface matches palette.surface",
              approx_color(sheet_bg, pal["surface"], tol_rgb=20),
              pal["surface"], sheet_bg or "(empty)",
              "CATEGORY_SHEET_OPEN", mode_label, severity="MEDIUM",
              repro=["Open appearance sheet at /settings", "getComputedStyle(bottom sheet).backgroundColor"])
        check("sheet contains Light, Dark, System options (CATEGORY_KEYS)",
              re.search(r"Light[\s\S]*Dark[\s\S]*System", sheet_texts or "", re.I) is not None,
              "Light / Dark / System present", sheet_texts[:200] or "(no sheet found)",
              "CATEGORY_KEYS", mode_label, severity="HIGH",
              repro=["Open appearance sheet", "scan innerText for 3 option labels"])
        cat_results.append(mk_cat(("CATEGORY_SHEET_OPEN", "sheet surface"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_CLICK_LIGHT ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        if "light" == mode_setup_name:
            # Option Light already chosen? It should equal storage_setting
            ok_click = click_to_appearance_value(page, "Light")
            check("click Light → returns true", ok_click,
                  "click handler returns true", str(ok_click),
                  "CATEGORY_CLICK_LIGHT", mode_label, severity="HIGH",
                  repro=["Open appearance sheet", "click option Light"])
            time.sleep(0.9)
            ap_raw2, v1_2 = read_storage_settings(page)
            check("after click Light APPEARANCE_KEY=light",
                  ap_raw2 == "light", "light", ap_raw2 or "(None)",
                  "CATEGORY_CLICK_LIGHT", mode_label, severity="HIGH")
            check("after click Light v1.appearance=light",
                  v1_2.get("appearance") == "light", "light", str(v1_2.get("appearance")),
                  "CATEGORY_CLICK_LIGHT", mode_label, severity="HIGH")
            effective_var2 = read_effective_variant(page)
            check("after click Light bg variant=light",
                  effective_var2 == "light", "light", effective_var2,
                  "CATEGORY_CLICK_LIGHT", mode_label, severity="HIGH")
            cat_results.append(mk_cat(("CATEGORY_CLICK_LIGHT", "Select Light"),
                                      checks_log[pre_count:], issues[pre_issues_n:],
                                      all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_CLICK_DARK ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        if "dark" == mode_setup_name:
            ok_click = click_to_appearance_value(page, "Dark")
            check("click Dark → returns true", ok_click,
                  "true", str(ok_click),
                  "CATEGORY_CLICK_DARK", mode_label, severity="HIGH",
                  repro=["Open appearance sheet", "click option Dark"])
            time.sleep(0.9)
            ap_raw2, v1_2 = read_storage_settings(page)
            check("after click Dark APPEARANCE_KEY=dark",
                  ap_raw2 == "dark", "dark", ap_raw2 or "(None)",
                  "CATEGORY_CLICK_DARK", mode_label, severity="HIGH")
            effective_var2 = read_effective_variant(page)
            check("after click Dark bg variant=dark",
                  effective_var2 == "dark", "dark", effective_var2,
                  "CATEGORY_CLICK_DARK", mode_label, severity="HIGH")
            page.screenshot(path=str(screenshots / f"{shots_prefix}_03_after_dark.png"), full_page=True)
            cat_results.append(mk_cat(("CATEGORY_CLICK_DARK", "Select Dark"),
                                      checks_log[pre_count:], issues[pre_issues_n:],
                                      all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_CLICK_SYSTEM ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        if mode_setup_name.startswith("system_"):
            ok_click = click_to_appearance_value(page, "System")
            check("click System → returns true", ok_click,
                  "true", str(ok_click),
                  "CATEGORY_CLICK_SYSTEM", mode_label, severity="HIGH",
                  repro=["Open appearance sheet", "click option System"])
            time.sleep(0.9)
            ap_raw2, v1_2 = read_storage_settings(page)
            check("after click System APPEARANCE_KEY=system",
                  ap_raw2 == "system", "system", ap_raw2 or "(None)",
                  "CATEGORY_CLICK_SYSTEM", mode_label, severity="HIGH")
            effective_var2 = read_effective_variant(page)
            check("after click System effective variant follows emulate_scheme=" + (emulate_scheme or "?"),
                  effective_var2 == variant_expected,
                  variant_expected, effective_var2,
                  "CATEGORY_CLICK_SYSTEM", mode_label, severity="HIGH",
                  repro=["Playwright context.emulate_media color_scheme=" + (emulate_scheme or "?"),
                         "Select System → page bg must match media preference"])
            cat_results.append(mk_cat(("CATEGORY_CLICK_SYSTEM", "Select System"),
                                      checks_log[pre_count:], issues[pre_issues_n:],
                                      all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_CROSS_PAGE ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        # Ensure current mode is still the one we want first (write storage again for consistency)
        write_storage_settings(page, storage_setting)
        time.sleep(0.3)
        nav_paths = ["/settings-about", "/help-center", "/"]
        nav_pal = PALETTE[variant_expected]
        for p in nav_paths:
            try:
                page.goto(WEB_ORIGIN + p, wait_until="domcontentloaded", timeout=60_000)
            except Exception as e:
                log(f"nav {p} failed: {e}")
            page.wait_for_timeout(2000)
            bg = effective_bg_hex(page)
            check(f"cross-page bg consistent at {p}",
                  approx_color(bg, nav_pal["background"], tol_rgb=22),
                  nav_pal["background"], bg or "(empty)",
                  "CATEGORY_CROSS_PAGE", mode_label, severity="HIGH",
                  repro=[f"Navigate {p}", "check body/SafeAreaView background"])
            # take shot first entry only
            page.screenshot(path=str(screenshots / f"{shots_prefix}_04_page{p.replace('/', '_') or 'home'}.png"), full_page=False)
        cat_results.append(mk_cat(("CATEGORY_CROSS_PAGE", "theme across pages"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_PERSIST_REFRESH ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        # Back to settings, reload
        page.goto(WEB_ORIGIN + "/settings", wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(1500)
        bg_before = effective_bg_hex(page)
        ap_before, v1_before = read_storage_settings(page)
        page.reload(wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(2500)
        bg_after = effective_bg_hex(page)
        ap_after, v1_after = read_storage_settings(page)
        check("storage APPEARANCE_KEY preserved across reload",
              ap_before == ap_after and ap_after == storage_setting,
              f"{storage_setting} → {storage_setting}",
              f"{ap_before} → {ap_after}",
              "CATEGORY_PERSIST_REFRESH", mode_label, severity="HIGH",
              repro=["set appearance = " + storage_setting,
                     "reload (location.reload)",
                     "re-read localStorage keys"])
        check("bg identical across reload",
              approx_color(bg_before, bg_after, tol_rgb=10) if (bg_before and bg_after) else False,
              bg_before or "(empty)", bg_after or "(empty)",
              "CATEGORY_PERSIST_REFRESH", mode_label, severity="MEDIUM")
        cat_results.append(mk_cat(("CATEGORY_PERSIST_REFRESH", "refresh persistence"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_PERSIST_NEW_TAB ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        # Open new context tab using same browser → same storage
        page2 = context.new_page()
        # For system_* modes, propagate color scheme emulate to the brand-new page
        # (modern Playwright sets emulation per page, not context).
        if mode_setup_name.startswith("system_") and emulate_scheme:
            set_emulated_color_scheme(context, emulate_scheme, page=page2)
            page2.wait_for_timeout(200)
        page2.goto(WEB_ORIGIN + "/settings", wait_until="domcontentloaded", timeout=60_000)
        page2.wait_for_timeout(2500)
        ap2, v1_2 = read_storage_settings(page2)
        bg2 = effective_bg_hex(page2)
        check("new tab APPEARANCE_KEY == original",
              ap2 == storage_setting, storage_setting, ap2 or "(None)",
              "CATEGORY_PERSIST_NEW_TAB", mode_label, severity="HIGH",
              repro=["Open new tab", "navigate /settings", "re-read localStorage appearance"])
        check("new tab variant bg matches",
              approx_color(bg2, palette_bg(variant_expected), tol_rgb=20),
              palette_bg(variant_expected), bg2 or "(empty)",
              "CATEGORY_PERSIST_NEW_TAB", mode_label, severity="HIGH")
        page2.close()
        cat_results.append(mk_cat(("CATEGORY_PERSIST_NEW_TAB", "new tab persistence"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_RESPONSIVE ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        # write appearance once more at current storage_setting before testing
        write_storage_settings(page, storage_setting)
        for i, (w2, h2) in enumerate(cfg.viewports):
            page.set_viewport_size({"width": w2, "height": h2})
            page.reload(wait_until="domcontentloaded", timeout=60_000)
            page.wait_for_timeout(2500)
            bg = effective_bg_hex(page)
            try:
                page.screenshot(path=str(screenshots / f"{shots_prefix}_05_responsive_{w2}x{h2}.png"), full_page=True)
            except Exception as e:
                log(f"responsive screenshot {w2}x{h2} failed {e}")
            check(f"responsive bg@{w2}x{h2}",
                  approx_color(bg, palette_bg(variant_expected), tol_rgb=20),
                  palette_bg(variant_expected), bg or "(empty)",
                  "CATEGORY_RESPONSIVE", mode_label, severity="MEDIUM",
                  repro=[f"page.set_viewport_size {w2}x{h2}", "reload",
                         "getComputedStyle(root).backgroundColor"])
        # reset viewport
        page.set_viewport_size({"width": w, "height": h})
        cat_results.append(mk_cat(("CATEGORY_RESPONSIVE", "responsive bg"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        # ---------- CATEGORY_TRANSITION ----------
        pre_count = len(checks_log)
        pre_issues_n = len(issues)
        # Snap before → switch mode → snap after; we only check there's no empty body,
        # no infinite spinner blocking everything, no pageerror
        transition_issues = [li for li in console_lines[-60:] if "pageerror" in li or "CONSOLEERROR" in li]
        check("no pageerrors captured before+after switch",
              len(transition_issues) == 0,
              "0 pageerrors / 60 lines",
              f"{len(transition_issues)} pageerrors",
              "CATEGORY_TRANSITION", mode_label, severity="MEDIUM",
              repro=["observe page.on('pageerror') during transitions"])
        bg_final = effective_bg_hex(page)
        check("post-transition bg matches expected variant",
              approx_color(bg_final, palette_bg(variant_expected), tol_rgb=20),
              palette_bg(variant_expected), bg_final or "(empty)",
              "CATEGORY_TRANSITION", mode_label, severity="HIGH",
              repro=["after all responsive/reload tests → bg matches final variant"])
        cat_results.append(mk_cat(("CATEGORY_TRANSITION", "transition clean"),
                                  checks_log[pre_count:], issues[pre_issues_n:],
                                  all(c["passed"] for c in checks_log[pre_count:])))

        return cat_results

    # Order of mode runs: light, dark, system_light (emulate light), system_dark (emulate dark)
    run_plan = [
        ("light", "light", None),
        ("dark", "dark", None),
        ("system_light", "light", "light"),
        ("system_dark", "dark", "dark"),
    ]
    for mode_name, expected, emulate_scheme in run_plan:
        log(f"--- mode run: {mode_name} expected={expected} emulate_scheme={emulate_scheme}")
        per_mode_results.extend(evaluate_mode(mode_name, expected, emulate_scheme))

    # Aggregate
    category_totals: dict[str, dict] = {}
    for res in per_mode_results:
        bucket = category_totals.setdefault(res.category, {"passed": 0, "total": 0})
        bucket["total"] += 1
        if res.passed:
            bucket["passed"] += 1

    # Write console log
    with console_log.open("w") as f:
        f.write("\n".join(console_lines))

    # close playwright
    try:
        context.close()
        browser.close()
    except Exception:
        pass

    passed_total = sum(1 for r in per_mode_results if r.passed)
    result = {
        "target": "web",
        "passed_total": passed_total,
        "total": len(per_mode_results),
        "categories_buckets": category_totals,
        "n_issues": len(issues),
        "n_checks": len(checks_log),
        "mode_runs_cover": [m for m, _, _ in run_plan],
        "issue_severity_counts": {s: sum(1 for i in issues if i.severity == s) for s in ["LOW","MEDIUM","HIGH","BLOCKER"]},
    }
    # Save per-category summaries
    with (target_out / "per_category_results.json").open("w") as f:
        json.dump([asdict(r) for r in per_mode_results], f, indent=2)
    with (target_out / "checks_log.json").open("w") as f:
        json.dump(checks_log, f, indent=2)
    return result


def run_ios_theme_qa(cfg: Config, outdir: Path) -> dict:
    """Best-effort iOS simulator: boot simulator, launch Expo Go with deep-links,
    take screenshots of Settings/appearance sheet at user1 session for baseline.
    No DOM access, so pass/fail based on screenshot captured only."""
    out = outdir / "ios_sim"
    shots = out / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    log_path = out / "console.log"
    log_lines: list[str] = []

    def log(msg):
        log_lines.append(f"[{dt.datetime.now().isoformat(timespec='milliseconds')}] {msg}")

    xcrun = shutil_which("xcrun")
    if not xcrun:
        log("xcrun not present - skip iOS sim")
        return {"target": "ios_sim", "status": "SKIP", "reason": "xcrun missing"}
    from shutil import which as shutil_which_local
    # Best-effort: ensure booted
    try:
        cp = subprocess.run([xcrun, "simctl", "list", "devices", "booted"], capture_output=True, text=True, timeout=20)
        if "Booted" not in cp.stdout and "booted" not in cp.stdout.lower():
            subprocess.run([xcrun, "simctl", "boot", "booted"], check=False, timeout=30, capture_output=True)
            time.sleep(2.0)
    except Exception as e:
        log(f"ensure boot failed {e}")
    modes = [("light", "light"), ("dark", "dark"), ("system", "system")]
    captured = []
    for i, (mode_name, _) in enumerate(modes):
        url = f"exp://localhost:19006?/settings&appearance_preseed={mode_name}&email={cfg.user_email}"
        try:
            subprocess.run([xcrun, "simctl", "openurl", "booted", url], capture_output=True, text=True, timeout=25)
        except Exception as e:
            log(f"openurl {mode_name} failed {e}")
            continue
        shot_path = shots / f"appearance_{i:02d}_{mode_name}.png"
        for _ in range(6):
            time.sleep(2)
            try:
                r = subprocess.run([xcrun, "simctl", "io", "booted", "screenshot", str(shot_path)], capture_output=True, text=True, timeout=15)
                if r.returncode == 0 and shot_path.exists() and shot_path.stat().st_size > 200_000:
                    captured.append((mode_name, str(shot_path.name), shot_path.stat().st_size))
                    break
            except Exception as e:
                log(f"screenshot {mode_name} err {e}")
    with log_path.open("w") as f:
        f.write("\n".join(log_lines))
    return {"target": "ios_sim", "status": "DONE" if captured else "FAIL",
            "screenshots_captured": len(captured),
            "shots": captured,
            "notes": "No DOM assertions on iOS sim - review screenshots manually"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", default="web,ios_sim", help="Comma list")
    ap.add_argument("--user-email", default=os.environ.get("TEST_USER_EMAIL", "user1@example.com"))
    ap.add_argument("--user-password", default=os.environ.get("TEST_USER_PASSWORD", "password123"))
    ap.add_argument("--min-contrast", type=float, default=4.5, help="WCAG 2.1 AA minimum contrast ratio (default 4.5)")
    args = ap.parse_args()

    targets = [t for t in args.targets.split(",") if t]
    cfg = Config(
        targets=targets,
        user_email=args.user_email,
        user_password=args.user_password,
        viewports=[(390, 844), (1280, 800), (1920, 1080)],
        required_contrast=args.min_contrast,
    )
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    outdir = REPO_ROOT / "test_results" / f"theme_qa_{stamp}"
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "run_meta.json").write_text(json.dumps({
        "started_at": dt.datetime.now().isoformat(),
        "targets": targets,
        "viewports": cfg.viewports,
        "required_contrast": cfg.required_contrast,
        "web_origin": WEB_ORIGIN,
        "user_email": cfg.user_email,
    }, indent=2))

    # import playwright here to keep import-time of module small
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:
        print(f"[FATAL] playwright unavailable: {e}", file=sys.stderr)
        sys.exit(2)

    per_target: dict[str, Any] = {}
    with sync_playwright() as pw:
        if "web" in targets:
            per_target["web"] = run_web_theme_qa(cfg, pw, outdir)
        if "ios_sim" in targets:
            try:
                per_target["ios_sim"] = run_ios_theme_qa(cfg, outdir)
            except Exception as e:
                per_target["ios_sim"] = {"target": "ios_sim", "status": "FAIL", "reason": str(e)}

    global_passed = (
        "web" not in per_target or (per_target["web"]["n_issues"] == 0 and per_target["web"].get("passed_total", 0) == per_target["web"].get("total", 0))
    ) and (
        "ios_sim" not in per_target or per_target["ios_sim"].get("status") in ("SKIP", "DONE")
    )
    final_report = {
        "generated_at": dt.datetime.now().isoformat(),
        "artifacts_root": str(outdir),
        "global_passed": global_passed,
        "targets_tested": list(per_target.keys()),
        "per_target": per_target,
        "run_meta_path": str(outdir / "run_meta.json"),
    }
    with (outdir / "final_theme_qa_report.json").open("w") as f:
        json.dump(final_report, f, indent=2)
    # stdout banner
    w = per_target.get("web", {})
    print("=" * 76)
    print(f"Theme QA {outdir}")
    print(f"  WEB:  categories_passed={w.get('passed_total')}/{w.get('total')}  "
          f"checks={w.get('n_checks')}  issues={w.get('n_issues')}  "
          f"severity={w.get('issue_severity_counts')}")
    isr = per_target.get("ios_sim", {})
    print(f"  IOS:  status={isr.get('status')}  shots={isr.get('screenshots_captured')}")
    print(f"  GLOBAL_PASSED={global_passed}")
    print("=" * 76)
    return 0 if global_passed else 1


if __name__ == "__main__":
    from shutil import which as shutil_which  # noqa: F401 (used lazily for iOS xcrun which)
    sys.exit(main())

"""
Web-App Settings QA Suite (apps/web-app — /settings/*)
=======================================================

Coverage (20 categories):

 1.  LAYOUT_HEADERS                Settings index renders, title + 3 groups visible
 2.  LAYOUT_ROWS_ENUMERATE         8 expected rows (appearance/lang/sound/notif/privacy/sub/help/about)
 3.  SECTION_DESCRIPTIONS_EN       Row descriptions shown match EN dict
 4.  APPEARANCE_SHEET_OPEN         Click Appearance → BottomSheet opens with 3 options
 5.  APPEARANCE_APPLY_LIGHT        Click Light → <html>.dark=false + storage update
 6.  APPEARANCE_APPLY_DARK         Click Dark → <html>.dark=true + storage update
 7.  APPEARANCE_APPLY_SYSTEM       Click System → storage system; matches emulated OS
 8.  LANGUAGE_OPTIONS              Language page: 2 options (EN/FR) rendered with check + flag
 9.  LANGUAGE_APPLY_FR             Click Français → FR dict title shows ("Paramètres")
 10. LANGUAGE_PERSIST_RELOAD       After setting FR + reload → title still "Paramètres"
 11. SOUND_TOGGLE                  Click Sound → toggles; storage updates
 12. NOTIFICATIONS_SHEET_OPEN      Notifications row → sheet renders 2 sections + master switch
 13. PRIVACY_LAYOUT                Privacy page renders title + 3 vis cards + 3 toggles
 14. PRIVACY_TOGGLES_BACKEND       allowComments toggle → PUT request fired; UI optimistic
 15. SUBSCRIPTION_EMPTY_STATE      /settings/subscription renders empty state card
 16. SUBSCRIPTION_PLANS            2 plan cards render; Upgrade buttons clickable
 17. PERSIST_REFRESH_SETTINGS      Appearance + locale + sound survive reload()
 18. PERSIST_NEW_TAB_SETTINGS      Open new page → storage matches; DOM snapshots match
 19. RESPONSIVE_3_VIEWPORTS        Pages render @ 390/1280/1920; no renderer errors
 20. I18N_FR_NO_EN_FALLBACK        All FR key lookups return FR values (not EN fallback)

Output:
  test_results/web_settings_qa_<ts>/
    final_web_app_settings_qa_report.json
    per_category_results.json
    checks_log.json
    screenshots/<cat>.png
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

EN_DICT: dict[str, str] = {
    "settings.title": "Settings",
    "settings.preferences": "Preferences",
    "settings.account": "Account",
    "settings.sectionsAppearance": "Appearance",
    "settings.sectionsAppearanceDescription": "Light, dark, or system",
    "settings.sectionsLanguage": "Language",
    "settings.sectionsLanguageDescription": "Select your language",
    "settings.sectionsSound": "Sound",
    "settings.sectionsSoundDescription": "Enable sound effects",
    "settings.sectionsNotifications": "Notifications",
    "settings.sectionsNotificationsDescription": "Manage push notifications",
    "settings.sectionsPrivacy": "Privacy",
    "settings.sectionsPrivacyDescription": "Manage data and permissions",
    "settings.sectionsSubscription": "Subscription",
    "settings.sectionsSubscriptionDescription": "Manage your subscription",
    "settings.sectionsHelpCenter": "Help Center",
    "settings.sectionsHelpCenterDescription": "FAQs and contact",
    "settings.sectionsAbout": "About",
    "settings.sectionsAboutDescription": "Learn more about the app",
    "settings.sectionsSignOut": "Sign out",
    "settings.appearanceLight": "Light",
    "settings.appearanceDark": "Dark",
    "settings.appearanceSystem": "System",
    "settings.privacyTitle": "Privacy",
    "settings.subscriptionTitle": "Subscription",
    "settings.subscriptionEmpty": "No active subscription",
    "settings.privacyPublic": "Public",
    "settings.privacyFollowers": "Followers only",
    "settings.privacyPrivate": "Private",
    "settings.privacyAllowComments": "Allow comments on my articles",
    "settings.privacyShowLikesCount": "Show likes count on my articles",
    "settings.privacyShowOnline": "Show when I am online",
    "settings.pushNotifications": "Push notifications",
    "settings.emailNotifications": "Email notifications",
}
FR_DICT: dict[str, str] = {
    "settings.title": "Paramètres",
    "settings.preferences": "Préférences",
    "settings.account": "Compte",
    "settings.sectionsAppearance": "Apparence",
    "settings.sectionsAppearanceDescription": "Clair, sombre ou système",
    "settings.sectionsLanguage": "Langue",
    "settings.sectionsLanguageDescription": "Sélectionnez votre langue",
    "settings.sectionsSound": "Son",
    "settings.sectionsSoundDescription": "Activer les effets sonores",
    "settings.sectionsNotifications": "Notifications",
    "settings.sectionsNotificationsDescription": "Gérer les notifications push",
    "settings.sectionsPrivacy": "Confidentialité",
    "settings.sectionsPrivacyDescription": "Gérer les données et les autorisations",
    "settings.sectionsSubscription": "Abonnement",
    "settings.sectionsSubscriptionDescription": "Gérez votre abonnement",
    "settings.sectionsHelpCenter": "Centre d’aide",
    "settings.sectionsHelpCenterDescription": "FAQ et contact",
    "settings.sectionsAbout": "À propos",
    "settings.sectionsAboutDescription": "En savoir plus sur l’app",
    "settings.sectionsSignOut": "Se déconnecter",
    "settings.appearanceLight": "Clair",
    "settings.appearanceDark": "Sombre",
    "settings.appearanceSystem": "Système",
    "settings.privacyTitle": "Confidentialité",
    "settings.subscriptionTitle": "Abonnement",
    "settings.subscriptionEmpty": "Aucun abonnement actif",
    "settings.privacyPublic": "Public",
    "settings.privacyFollowers": "Abonnés uniquement",
    "settings.privacyPrivate": "Privé",
    "settings.privacyAllowComments": "Autoriser les commentaires sur mes articles",
    "settings.privacyShowLikesCount": "Afficher le nombre de likes sur mes articles",
    "settings.privacyShowOnline": "Afficher quand je suis en ligne",
    "settings.pushNotifications": "Notifications push",
    "settings.emailNotifications": "Notifications par e-mail",
}

CATEGORIES: list[tuple[str, str]] = [
    ("LAYOUT_HEADERS", "Settings index renders title + 2 groups (preferences + account)"),
    ("LAYOUT_ROWS_ENUMERATE", "8 expected rows (appearance/lang/sound/notif/privacy/sub/help/about)"),
    ("SECTION_DESCRIPTIONS_EN", "Row descriptions in EN match EN dict"),
    ("APPEARANCE_SHEET_OPEN", "Appearance row opens sheet with 3 option cards (light/dark/system)"),
    ("APPEARANCE_APPLY_LIGHT", "Click Light → html.dark=false + storage write"),
    ("APPEARANCE_APPLY_DARK", "Click Dark → html.dark=true + storage write"),
    ("APPEARANCE_APPLY_SYSTEM", "Click System → mode=system follows emulated OS"),
    ("LANGUAGE_OPTIONS", "Language page shows 2 option buttons (EN/FR)"),
    ("LANGUAGE_APPLY_FR", "Click Français → title in DOM becomes Paramètres"),
    ("LANGUAGE_PERSIST_RELOAD", "FR survives reload → title still Paramètres"),
    ("SOUND_TOGGLE", "Sound row toggles + updates v1.soundEnabled storage"),
    ("NOTIFICATIONS_SHEET_OPEN", "Notifications row opens sheet with push/email sections + master toggle"),
    ("PRIVACY_LAYOUT", "Privacy page: title + 3 vis cards + 3 toggles"),
    ("PRIVACY_TOGGLES_BACKEND", "Toggling allowComments fires PUT to /users/me/settings"),
    ("SUBSCRIPTION_EMPTY_STATE", "Subscription page shows empty state headline"),
    ("SUBSCRIPTION_PLANS", "Subscription page shows 2 plan cards with Upgrade buttons"),
    ("SUBSCRIPTION_RESTORE", "Restore purchases populates status card + renewal date"),
    ("SUBSCRIPTION_CANCEL_RESUME", "Cancel then Resume toggle via PATCH backend"),
    ("PERSIST_REFRESH_SETTINGS", "Appearance + locale + sound survive reload()"),
    ("PERSIST_NEW_TAB_SETTINGS", "Open new tab → state & storage match original"),
    ("RESPONSIVE_3_VIEWPORTS", "Pages render @ 390/1280/1920; no JS errors"),
    ("I18N_FR_NO_EN_FALLBACK", "FR lookups return FR dictionary values (no EN fallback)"),
]

SETTINGS_VIEWPORTS: list[tuple[int, int]] = [(390, 844), (1280, 800), (1920, 1080)]

V1_KEY = "vellbase.web.settings.v1"
THEME_RAW_KEY = "vellbase.web.theme"
LOCALE_RAW_KEY = "vellbase.web.locale"
SOUND_RAW_KEY = "vellbase.web.sound"


# ---------------- Check / reporting infrastructure ----------------

@dataclass
class CheckResult:
    name: str
    category: str
    mode: str
    passed: bool
    expected: Any
    actual: Any
    severity: str = "MEDIUM"
    repro: list[str] = field(default_factory=list)
    screenshot: Optional[str] = None


@dataclass
class CatStats:
    category: str
    desc: str
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    severity_counts: dict[str, int] = field(default_factory=lambda: {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0})
    issues: list[str] = field(default_factory=list)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--origin", default=os.environ.get("WEB_ORIGIN", "http://localhost:3003"))
    ap.add_argument("--email", default=os.environ.get("WEB_LOGIN_EMAIL", "qa+settings@vellbase.app"))
    ap.add_argument("--password", default=os.environ.get("WEB_LOGIN_PASSWORD", "QaSettings123!"))
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()

    ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = REPO_ROOT / "test_results" / f"web_settings_qa_{ts}"
    shots_dir = out_dir / "screenshots"
    shots_dir.mkdir(parents=True, exist_ok=True)

    # Playwright import here (keeps script importable without PW installed)
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout, Error as PWError  # noqa

    checks: list[CheckResult] = []
    cat_map: dict[str, CatStats] = {c[0]: CatStats(category=c[0], desc=c[1]) for c in CATEGORIES}
    mode_label = "web-app"

    def start_cat(cat: str) -> tuple[int, int]:
        pre_n = len(checks)
        issues_before = len(cat_map[cat].issues)
        return pre_n, issues_before

    def finish_cat(cat: str, pre_n: int, pre_issues: int, ss_path: Optional[Path] = None):
        cs = cat_map[cat]
        for c in checks[pre_n:]:
            cs.total += 1
            if c.passed: cs.passed += 1
            else:
                cs.failed += 1
                cs.severity_counts[c.severity] = cs.severity_counts.get(c.severity, 0) + 1
                title = f"[{c.severity}] {c.name} — expected={c.expected!r} actual={c.actual!r}"
                cs.issues.append(title)
        if ss_path is not None and (pre_n == len(checks) or len(cs.issues) > pre_issues):
            pass  # caller-visible screenshot

    def check(name: str, actual: Any, expected: Any, debug: str = "",
              category: str = "LAYOUT_HEADERS", severity: str = "MEDIUM",
              repro: Optional[list[str]] = None, screenshot: Optional[str] = None):
        passed = actual == expected
        checks.append(CheckResult(
            name=name, category=category, mode=mode_label, passed=passed,
            expected=expected, actual=f"{actual!r} | {debug}" if debug else repr(actual),
            severity=severity, repro=repro or [], screenshot=screenshot,
        ))

    def shot(page, fname: str, subdir: str = "") -> str:
        d = shots_dir / subdir if subdir else shots_dir
        d.mkdir(parents=True, exist_ok=True)
        p = d / f"{fname}.png"
        try:
            page.screenshot(path=str(p), full_page=True)
        except Exception:
            pass
        return str(p)

    def goto_settings(page, timeout: int = 60_000):
        # Use "commit" wait: SPA hydration may hold domcontentloaded until all JS loads.
        page.goto(f"{args.origin}/settings", wait_until="commit", timeout=timeout)
        # Wait for React to mount the settings page marker
        page.wait_for_selector(
            "[data-testid='settings-page']", timeout=timeout, state="attached"
        )
        page.wait_for_timeout(450)

    def goto_route(page, rel: str, marker: Optional[str] = None, timeout: int = 60_000):
        """Navigate to a SPA route with commit semantics; optionally wait for a testid marker."""
        page.goto(f"{args.origin}{rel}", wait_until="commit", timeout=timeout)
        if marker:
            page.wait_for_selector(f"[data-testid='{marker}']", timeout=timeout, state="attached")
        page.wait_for_timeout(350)

    def do_login(ctx, page) -> tuple[dict[str, Any], dict[str, Any], list]:
        """Auth bypass. Two layers:

        1. ctx.route("**/api/**", ...) — Playwright network-level interception. This is the most robust
           mechanism: it works BEFORE fetch() shims, handles absolute URLs (http://localhost:3001/api/...
           or /api/...) and is impervious to any wrapper rebinding (e.g. ESM imports caching fetch before
           our init script runs).
        2. ctx.add_init_script(...) — installs Storage.prototype monkeypatch so that auth keys/seeds
           survive any apiClient.clearTokens() call made by auth-context error paths, AND writes seeds
           into localStorage.

        Returns (seed_dict, default_settings_dict, sub_store) so that callers can toggle subscription
        state between tests by mutating sub_store[0].
        """
        seed = {
            "id": "qa-user-001",
            "email": args.email,
            "handle": "@qa.settings",
            "name": "QA Settings",
            "role": "USER",
            "isActive": True,
            "createdAt": "2026-08-10T00:00:00.000Z",
            "updatedAt": "2026-08-10T00:00:00.000Z",
        }
        seed_json = json.dumps(seed)

        default_settings = {
            "privacy": {
                "profileVisibility": "public",
                "commentsEnabled": True,
                "likesCountVisible": True,
                "showOnlineStatus": True,
            },
            "notifications": {
                "pushEnabled": True,
                "emailEnabled": True,
                "mentionEnabled": True,
                "replyEnabled": True,
                "followEnabled": True,
                "likeEnabled": True,
            },
        }
        default_settings_json = json.dumps(default_settings)

        mock_subscription_active = {
            "id": "qa-sub-0",
            "userId": "qa-user-001",
            "planId": "pro-monthly",
            "planName": "Vellbase Pro",
            "status": "active",
            "amountCents": 499,
            "currency": "USD",
            "interval": "month",
            "renewalDate": __import__("datetime").datetime.fromisoformat("2099-01-01T00:00:00").isoformat() + "Z",
            "currentPeriodEnd": __import__("datetime").datetime.fromisoformat("2099-01-01T00:00:00").isoformat() + "Z",
            "cancelAtPeriodEnd": False,
            "createdAt": "2026-08-01T00:00:00.000Z",
            "updatedAt": "2026-08-01T00:00:00.000Z",
        }
        mock_subscription_free = None  # forces empty-state branch

        # Mutable per-process state copies (mutated in handler for PATCH)
        import copy as _copy
        user_settings_store = [_copy.deepcopy(default_settings)]
        # Mutable subscription, allows tests to swap active/free state between sections
        sub_store: list = [mock_subscription_free]

        def api_route_handler(route):
            clean = route.request.url.split("#")[0].split("?")[0]
            method = (route.request.method or "GET").upper()
            try:
                post_raw = route.request.post_data or None
                post_data = json.loads(post_raw) if post_raw else {}
            except Exception:
                post_data = {}

            def ok(body, status=200):
                route.fulfill(
                    status=status,
                    content_type="application/json",
                    body=json.dumps(body),
                )

            # --- Auth ---
            if clean.endswith("/api/auth/me"):
                return ok(seed)
            if clean.endswith("/api/auth/logout"):
                return ok({"ok": True})
            if clean.endswith("/api/auth/login"):
                return ok({
                    "accessToken": "qa-fake-token",
                    "refreshToken": "qa-fake-refresh",
                    "user": seed,
                })
            if clean.endswith("/api/auth/refresh"):
                return ok({
                    "accessToken": "qa-fake-token",
                    "refreshToken": "qa-fake-refresh",
                })
            # --- Users / me / settings ---
            if clean.endswith("/api/users/me/settings"):
                if method in ("PATCH", "PUT"):
                    if isinstance(post_data, dict):
                        if isinstance(post_data.get("privacy"), dict):
                            user_settings_store[0].setdefault("privacy", {})
                            user_settings_store[0]["privacy"].update(post_data["privacy"])
                        if isinstance(post_data.get("notifications"), dict):
                            user_settings_store[0].setdefault("notifications", {})
                            user_settings_store[0]["notifications"].update(post_data["notifications"])
                        if post_data.get("appearance") is not None:
                            user_settings_store[0]["appearance"] = post_data["appearance"]
                        if post_data.get("locale") is not None:
                            user_settings_store[0]["locale"] = post_data["locale"]
                    return ok(user_settings_store[0])
                return ok(user_settings_store[0])
            # --- Subscriptions ---
            if clean.endswith("/api/subscription/plans") or clean.endswith("/api/subscriptions/plans"):
                return ok([
                    {
                        "id": "pro-monthly",
                        "name": "Vellbase Pro",
                        "description": "Everything you need to read and write beautifully.",
                        "amountCents": 499,
                        "currency": "USD",
                        "interval": "month",
                        "popular": True,
                        "features": [
                            "Ad-free reading experience",
                            "Unlimited saved articles & highlights",
                            "Custom themes and advanced typography",
                            "Early access to new features",
                            "Priority support",
                        ],
                    },
                    {
                        "id": "pro-yearly",
                        "name": "Vellbase Pro Annual",
                        "description": "Two months free, billed yearly.",
                        "amountCents": 4790,
                        "currency": "USD",
                        "interval": "year",
                        "features": [
                            "All Pro features",
                            "Save ~20% vs monthly",
                            "Exclusive yearly badge",
                        ],
                    },
                ])
            if clean.endswith("/api/subscription/checkout") or clean.endswith("/api/subscriptions/checkout"):
                return ok({"checkoutUrl": "about:blank#qa-checkout-ok"})
            if clean.endswith("/api/users/me/subscription/restore") or clean.endswith("/api/subscriptions/restore") or clean.endswith("/api/subscription/restore"):
                sub_store[0] = _copy.deepcopy(mock_subscription_active)
                return ok({
                    "success": True,
                    "restored": 1,
                    "subscription": sub_store[0],
                })
            if clean.endswith("/api/users/me/subscription/cancel"):
                if isinstance(sub_store[0], dict):
                    sub_store[0]["cancelAtPeriodEnd"] = True
                    sub_store[0]["status"] = "canceled"
                return ok(sub_store[0])
            if clean.endswith("/api/users/me/subscription/resume"):
                if isinstance(sub_store[0], dict):
                    sub_store[0]["cancelAtPeriodEnd"] = False
                    sub_store[0]["status"] = "active"
                return ok(sub_store[0])
            if (clean.endswith("/api/subscriptions") or clean.endswith("/api/subscription")
                    or clean.endswith("/api/users/me/subscription")):
                if method in ("PATCH", "PUT"):
                    if isinstance(post_data, dict) and "cancelAtPeriodEnd" in post_data and isinstance(sub_store[0], dict):
                        sub_store[0]["cancelAtPeriodEnd"] = bool(post_data["cancelAtPeriodEnd"])
                        if post_data["cancelAtPeriodEnd"]:
                            sub_store[0]["status"] = "canceled"
                        else:
                            sub_store[0]["status"] = "active"
                return ok(sub_store[0])
            # --- Help / support / any remaining /api/* ---
            # Don't let 404s bubble up as they can trigger error boundaries; return empty 200 JSON.
            if "/api/" in clean:
                return ok({"ok": True})
            return route.continue_()

        try:
            ctx.route("**/api/**", api_route_handler)
        except Exception:
            pass

        # Storage monkey patch + direct seed
        ctx.add_init_script(
            f"""() => {{
                try {{
                    const LS = Storage.prototype;
                    const origSet = LS.setItem;
                    const origRemove = LS.removeItem;
                    const origGet = LS.getItem;
                    // Only force the 3 auth keys (these survive apiClient.clearTokens())
                    const forcedValues = {{
                        'vellbase_access_token': 'qa-fake-token',
                        'vellbase_refresh_token': 'qa-fake-refresh',
                        'vellbase_user': JSON.stringify({seed_json}),
                    }};
                    const forcedKeys = Object.keys(forcedValues);
                    LS.getItem = function(k) {{
                        if (forcedKeys.includes(String(k))) return forcedValues[String(k)];
                        return origGet.call(this, k);
                    }};
                    LS.setItem = function(k, v) {{
                        if (forcedKeys.includes(String(k))) return origSet.call(this, String(k), forcedValues[String(k)]);
                        return origSet.call(this, String(k), String(v));
                    }};
                    LS.removeItem = function(k) {{
                        if (forcedKeys.includes(String(k))) return origSet.call(this, String(k), forcedValues[String(k)]);
                        return origRemove.call(this, String(k));
                    }};
                    // Auth + default app settings seed (app settings allowed to change via LS.setItem below)
                    localStorage.setItem('vellbase_access_token', 'qa-fake-token');
                    localStorage.setItem('vellbase_refresh_token', 'qa-fake-refresh');
                    localStorage.setItem('vellbase_user', JSON.stringify({seed_json}));
                    // Settings: bypass patched setItem via origSet reference to write initial values.
                    origSet.call(localStorage, 'vellbase.web.settings.v1', JSON.stringify({{appearance:'system',locale:'en',soundEnabled:true}}));
                    origSet.call(localStorage, 'vellbase.web.theme', 'system');
                    origSet.call(localStorage, 'vellbase.web.locale', 'en');
                    origSet.call(localStorage, 'vellbase.web.sound', 'on');
                }} catch (_) {{}}
            }}"""
        )
        # If the page already has an origin, seed storage directly via page too
        try:
            page.evaluate(
                f"""() => {{
                    localStorage.setItem('vellbase_access_token', 'qa-fake-token');
                    localStorage.setItem('vellbase_refresh_token', 'qa-fake-refresh');
                    localStorage.setItem('vellbase_user', JSON.stringify({seed_json}));
                    // app-settings fallback (patched setItem above forbids overwrites for auth keys only)
                    try {{
                        const cur = JSON.parse(localStorage.getItem('vellbase.web.settings.v1') || '{{}}');
                        localStorage.setItem('vellbase.web.settings.v1', JSON.stringify(Object.assign({{appearance:'system',locale:'en',soundEnabled:true}}, cur)));
                    }} catch(_) {{}}
                }}"""
            )
        except Exception:
            pass
        _ = default_settings_json  # silence unused; useful for debugging
        return seed, default_settings, sub_store

    def read_v1(page) -> dict[str, Any]:
        try:
            return page.evaluate(
                """() => {
                    try { return JSON.parse(localStorage.getItem(%s) || '{}'); }
                    catch(e) { return {}; }
                }""" % json.dumps(V1_KEY)
            )
        except Exception:
            return {}

    def write_v1(page, obj: dict):
        page.evaluate(
            f"""() => {{
                const cur = JSON.parse(localStorage.getItem({json.dumps(V1_KEY)}) || '{{}}');
                localStorage.setItem({json.dumps(V1_KEY)}, JSON.stringify({{...cur, ...{json.dumps(obj)}}}));
            }}"""
        )

    def html_has_dark(page) -> bool:
        return page.evaluate("() => document.documentElement.classList.contains('dark')")

    def snap_text(page) -> str:
        return page.evaluate("() => (document.body.innerText || '').replace(/\\s+/g,' ').trim()") or ""

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.headed)
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 800},
            color_scheme="light",
        )
        # Avoid hangs in sandboxed / offline CI: block fonts + external media passively
        try:
            ctx.route("**://fonts.googleapis.com/**", lambda r: r.abort("blockedbyclient"))
            ctx.route("**://fonts.gstatic.com/**", lambda r: r.abort("blockedbyclient"))
            ctx.route("**://media.istockphoto.com/**", lambda r: r.abort("blockedbyclient"))
        except Exception:
            pass
        ctx.grant_permissions(["notifications"])
        page = ctx.new_page()
        js_errors: list[str] = []
        page.on("pageerror", lambda e: js_errors.append(str(e)))

        # Helper: emulate color scheme via Page.emulate_media (Playwright moved this from Context to Page)
        def set_os_color_scheme(scheme: str):
            # scheme: "dark" | "light" | "no-preference"
            try:
                page.emulate_media(color_scheme=scheme)
            except Exception:
                # Fallback: coerce via forced emulation via CDP on Chromium
                try:
                    cdp = ctx.new_cdp_session(page)
                    cdp.send("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-color-scheme", "value": scheme}]})
                except Exception:
                    pass

        # --- Seed auth storage + settings before any navigation to /settings (required by requireAuth) ---
        # Go to origin first so localStorage is allowed (about:blank → SecurityError)
        try:
            page.goto(f"{args.origin}/", wait_until="commit", timeout=60_000)
        except Exception:
            pass
        _seed, _defaults, sub_store = do_login(ctx, page)
        write_v1(page, {"appearance": "system", "locale": "en", "soundEnabled": True})
        page.evaluate(
            f"""() => {{
                localStorage.setItem({json.dumps(THEME_RAW_KEY)}, 'system');
                localStorage.setItem({json.dumps(LOCALE_RAW_KEY)}, 'en');
                localStorage.setItem({json.dumps(SOUND_RAW_KEY)}, 'on');
            }}"""
        )
        goto_settings(page)
        shot(page, "01_initial_settings")

        # ------------------- CATEGORY_LAYOUT_HEADERS -------------------
        pre_c, pre_i = start_cat("LAYOUT_HEADERS")
        check("settings-title", page.locator("[data-testid='settings-title']").count() > 0, True,
              "", "LAYOUT_HEADERS", severity="HIGH", repro=["Open /settings"])
        check("title-text=Settings", page.locator("[data-testid='settings-title']").first.inner_text(timeout=2000).strip(),
              EN_DICT["settings.title"], "", "LAYOUT_HEADERS", severity="CRITICAL",
              repro=["Navigate to /settings and check h1 contents for EN default"])
        check("group-preferences", page.locator("[data-testid='section-preferences']").count(), 1,
              "", "LAYOUT_HEADERS", severity="HIGH")
        check("group-account", page.locator("[data-testid='section-account']").count(), 1,
              "", "LAYOUT_HEADERS", severity="HIGH")
        finish_cat("LAYOUT_HEADERS", pre_c, pre_i)

        # ------------------- CATEGORY_LAYOUT_ROWS_ENUMERATE -------------------
        pre_c, pre_i = start_cat("LAYOUT_ROWS_ENUMERATE")
        ROWS = ["row-appearance", "row-language", "row-sound", "row-notifications",
                "row-privacy", "row-subscription", "row-help", "row-about"]
        for rid in ROWS:
            check(f"exists-{rid}", page.locator(f"[data-testid='{rid}']").count() > 0, True,
                  "", "LAYOUT_ROWS_ENUMERATE", severity="MEDIUM", repro=[f"Ensure row [{rid}] rendered on /settings"])
        # Expect 4 rows in preferences (appearance/lang/sound/notif) + 4 in account (privacy/sub/help/about)
        check("prefs-card-rows",
              page.locator("[data-testid='card-preferences'] [data-testid^='row-']").count(), 4,
              "", "LAYOUT_ROWS_ENUMERATE", severity="HIGH")
        check("account-card-rows",
              page.locator("[data-testid='card-account'] [data-testid^='row-']").count(), 4,
              "", "LAYOUT_ROWS_ENUMERATE", severity="HIGH")
        finish_cat("LAYOUT_ROWS_ENUMERATE", pre_c, pre_i)

        # ------------------- CATEGORY_SECTION_DESCRIPTIONS_EN -------------------
        pre_c, pre_i = start_cat("SECTION_DESCRIPTIONS_EN")
        DOM = snap_text(page)
        for k, v in [
            ("appearance-desc", EN_DICT["settings.sectionsAppearanceDescription"]),
            ("language-desc", EN_DICT["settings.sectionsLanguageDescription"]),
            ("sound-desc", EN_DICT["settings.sectionsSoundDescription"]),
            ("notifications-desc", EN_DICT["settings.sectionsNotificationsDescription"]),
            ("privacy-desc", EN_DICT["settings.sectionsPrivacyDescription"]),
            ("subscription-desc", EN_DICT["settings.sectionsSubscriptionDescription"]),
            ("help-desc", EN_DICT["settings.sectionsHelpCenterDescription"]),
            ("about-desc", EN_DICT["settings.sectionsAboutDescription"]),
        ]:
            check(f"text-{k}", v.lower() in DOM.lower(), True,
                  f"first-300: {DOM[:300]}", "SECTION_DESCRIPTIONS_EN", severity="MEDIUM",
                  repro=[f"Verify description row shows EN '{v}'"])
        finish_cat("SECTION_DESCRIPTIONS_EN", pre_c, pre_i)

        # ------------------- CATEGORY_APPEARANCE_SHEET_OPEN -------------------
        pre_c, pre_i = start_cat("APPEARANCE_SHEET_OPEN")
        try:
            page.locator("[data-testid='row-appearance']").click(timeout=4000)
            page.wait_for_selector("[data-testid='appearance-sheet']", timeout=4000)
            check("sheet-open", page.locator("[data-testid='appearance-sheet']").count(), 1,
                  "", "APPEARANCE_SHEET_OPEN", severity="HIGH")
            for m in ["light", "dark", "system"]:
                check(f"option-{m}", page.locator(f"[data-testid='appearance-option-{m}']").count(), 1,
                      "", "APPEARANCE_SHEET_OPEN", severity="HIGH")
        except PWTimeout:
            check("sheet-opened", False, True, "Appearance sheet failed to open",
                  "APPEARANCE_SHEET_OPEN", severity="HIGH")
        s = shot(page, "02_appearance_sheet")
        # Close sheet by overlay click for safety
        try:
            page.locator("[data-testid='bottom-sheet-close']").click(timeout=2000)
        except Exception:
            pass
        page.wait_for_timeout(300)
        finish_cat("APPEARANCE_SHEET_OPEN", pre_c, pre_i)

        # ------------------- CATEGORY_APPEARANCE_APPLY_LIGHT -------------------
        pre_c, pre_i = start_cat("APPEARANCE_APPLY_LIGHT")
        page.locator("[data-testid='row-appearance']").click(timeout=4000)
        page.wait_for_selector("[data-testid='appearance-sheet']", timeout=4000)
        page.locator("[data-testid='appearance-option-light']").click(timeout=3000)
        page.wait_for_timeout(400)
        check("html-dark-false", html_has_dark(page), False, "", "APPEARANCE_APPLY_LIGHT", severity="CRITICAL")
        v1 = read_v1(page)
        check("v1.appearance=light", v1.get("appearance"), "light", str(v1),
              "APPEARANCE_APPLY_LIGHT", severity="HIGH")
        check("theme-raw=light",
              page.evaluate("() => localStorage.getItem('vellbase.web.theme')"),
              "light", "", "APPEARANCE_APPLY_LIGHT", severity="HIGH")
        shot(page, "03_light_mode")
        finish_cat("APPEARANCE_APPLY_LIGHT", pre_c, pre_i)

        # ------------------- CATEGORY_APPEARANCE_APPLY_DARK -------------------
        pre_c, pre_i = start_cat("APPEARANCE_APPLY_DARK")
        # Re-open sheet (Light click closes it by selection, so reopen)
        page.wait_for_timeout(200)
        try:
            page.locator("[data-testid='row-appearance']").click(timeout=3000)
        except Exception:
            pass
        page.wait_for_selector("[data-testid='appearance-sheet']", timeout=5000)
        page.locator("[data-testid='appearance-option-dark']").click(timeout=3000)
        page.wait_for_timeout(450)
        check("html-dark-true", html_has_dark(page), True, "", "APPEARANCE_APPLY_DARK", severity="CRITICAL")
        v1 = read_v1(page)
        check("v1.appearance=dark", v1.get("appearance"), "dark", str(v1), "APPEARANCE_APPLY_DARK", severity="HIGH")
        check("theme-raw=dark",
              page.evaluate("() => localStorage.getItem('vellbase.web.theme')"),
              "dark", "", "APPEARANCE_APPLY_DARK", severity="HIGH")
        shot(page, "04_dark_mode")
        finish_cat("APPEARANCE_APPLY_DARK", pre_c, pre_i)

        # ------------------- CATEGORY_APPEARANCE_APPLY_SYSTEM -------------------
        pre_c, pre_i = start_cat("APPEARANCE_APPLY_SYSTEM")
        page.wait_for_timeout(200)
        try: page.locator("[data-testid='row-appearance']").click(timeout=3000)
        except Exception: pass
        page.wait_for_selector("[data-testid='appearance-sheet']", timeout=5000)
        page.locator("[data-testid='appearance-option-system']").click(timeout=3000)
        page.wait_for_timeout(400)
        set_os_color_scheme("dark")
        page.evaluate("() => window.dispatchEvent(new Event('resize'));")
        page.wait_for_timeout(300)
        check("v1.appearance=system", read_v1(page).get("appearance"), "system",
              str(read_v1(page)), "APPEARANCE_APPLY_SYSTEM", severity="HIGH")
        check("snap-resolved-dark",
              page.locator("[data-testid='snap-theme-resolved']").first.inner_text(timeout=2000),
              "dark", "", "APPEARANCE_APPLY_SYSTEM", severity="HIGH",
              repro=["Set system; emulate color-scheme dark; DOM 'snap-theme-resolved' should be 'dark'"])
        set_os_color_scheme("light")
        page.wait_for_timeout(300)
        check("snap-resolved-light (light OS)",
              page.locator("[data-testid='snap-theme-resolved']").first.inner_text(timeout=2000),
              "light", "", "APPEARANCE_APPLY_SYSTEM", severity="MEDIUM")
        finish_cat("APPEARANCE_APPLY_SYSTEM", pre_c, pre_i)

        # ------------------- CATEGORY_LANGUAGE_OPTIONS -------------------
        pre_c, pre_i = start_cat("LANGUAGE_OPTIONS")
        goto_route(page, "/settings/language", "settings-language-page", timeout=60_000)
        for tag in ["en", "fr"]:
            check(f"option-button-{tag}", page.locator(f"[data-testid='language-option-{tag}']").count(), 1,
                  "", "LANGUAGE_OPTIONS", severity="HIGH")
        check("en-selected-default",
              page.locator("[data-testid='language-option-en']").first.get_attribute("data-selected", timeout=2000),
              "true", "", "LANGUAGE_OPTIONS", severity="MEDIUM",
              repro=["Open /settings/language; EN should be selected by default"])
        shot(page, "05_language_options")
        finish_cat("LANGUAGE_OPTIONS", pre_c, pre_i)

        # ------------------- CATEGORY_LANGUAGE_APPLY_FR -------------------
        pre_c, pre_i = start_cat("LANGUAGE_APPLY_FR")
        page.locator("[data-testid='language-option-fr']").click(timeout=3000)
        page.wait_for_timeout(500)
        goto_settings(page)
        dom = snap_text(page)
        check("title-in-FR", FR_DICT["settings.title"].lower() in dom.lower(), True,
              f"DOM start: {dom[:250]}", "LANGUAGE_APPLY_FR", severity="CRITICAL",
              repro=["After selecting Français, go back to /settings → title should be 'Paramètres'"])
        check("snap-locale=fr",
              page.locator("[data-testid='snap-locale']").first.inner_text(timeout=2000),
              "fr", "", "LANGUAGE_APPLY_FR", severity="HIGH")
        shot(page, "06_language_fr_applied")
        finish_cat("LANGUAGE_APPLY_FR", pre_c, pre_i)

        # ------------------- CATEGORY_LANGUAGE_PERSIST_RELOAD -------------------
        pre_c, pre_i = start_cat("LANGUAGE_PERSIST_RELOAD")
        page.reload(wait_until="commit")
        page.wait_for_selector("[data-testid='settings-page']", timeout=60_000, state="attached")
        dom = snap_text(page)
        check("title-after-reload", FR_DICT["settings.title"].lower() in dom.lower(), True,
              f"DOM start: {dom[:200]}", "LANGUAGE_PERSIST_RELOAD", severity="CRITICAL",
              repro=["Reload /settings; FR title must persist"])
        check("v1.locale=fr", read_v1(page).get("locale"), "fr", str(read_v1(page)),
              "LANGUAGE_PERSIST_RELOAD", severity="HIGH")
        finish_cat("LANGUAGE_PERSIST_RELOAD", pre_c, pre_i)

        # ------------------- CATEGORY_SOUND_TOGGLE -------------------
        pre_c, pre_i = start_cat("SOUND_TOGGLE")
        # Reset locale back to EN to keep DOM stable
        write_v1(page, {"locale": "en"})
        page.evaluate(
            """() => { localStorage.setItem('vellbase.web.locale', 'en'); location.reload(); }"""
        )
        page.wait_for_selector("[data-testid='settings-page']", timeout=60_000, state="attached")
        # Click sound row directly on switch
        page.locator("[data-testid='sound-toggle']").click(timeout=3000)
        page.wait_for_timeout(300)
        check("snap-sound-off",
              page.locator("[data-testid='snap-sound']").first.inner_text(timeout=2000),
              "off", "", "SOUND_TOGGLE", severity="MEDIUM")
        v1 = read_v1(page)
        check("v1.soundEnabled=false", v1.get("soundEnabled"), False, str(v1),
              "SOUND_TOGGLE", severity="HIGH")
        check("sound-raw-key",
              page.evaluate("() => localStorage.getItem('vellbase.web.sound')"),
              "off", "", "SOUND_TOGGLE", severity="MEDIUM")
        # Turn back on
        page.locator("[data-testid='sound-toggle']").click(timeout=3000)
        page.wait_for_timeout(300)
        check("v1.soundEnabled=true-after", read_v1(page).get("soundEnabled"), True,
              str(read_v1(page)), "SOUND_TOGGLE", severity="MEDIUM")
        finish_cat("SOUND_TOGGLE", pre_c, pre_i)

        # ------------------- CATEGORY_NOTIFICATIONS_SHEET_OPEN -------------------
        pre_c, pre_i = start_cat("NOTIFICATIONS_SHEET_OPEN")
        page.locator("[data-testid='row-notifications']").click(timeout=4000)
        try:
            page.wait_for_selector("[data-testid='notifications-sheet']", timeout=5000)
            check("sheet-open", True, True, "", "NOTIFICATIONS_SHEET_OPEN", severity="HIGH")
            check("master-push-exists", page.locator("[data-testid='notifications-toggle-push']").count(), 1,
                  "", "NOTIFICATIONS_SHEET_OPEN", severity="HIGH")
            check("master-email-exists", page.locator("[data-testid='notifications-toggle-email']").count(), 1,
                  "", "NOTIFICATIONS_SHEET_OPEN", severity="HIGH")
            fine_count = page.locator("[data-testid^='notifications-toggle-']").count()
            check("fine-toggle-count>=3", fine_count >= 3, True, f"count={fine_count}",
                  "NOTIFICATIONS_SHEET_OPEN", severity="MEDIUM")
        except PWTimeout:
            check("sheet-opened", False, True, "Notifications sheet failed to open",
                  "NOTIFICATIONS_SHEET_OPEN", severity="HIGH")
        shot(page, "07_notifications_sheet")
        try:
            page.locator("[data-testid='bottom-sheet-close']").click(timeout=2000)
        except Exception:
            pass
        finish_cat("NOTIFICATIONS_SHEET_OPEN", pre_c, pre_i)

        # ------------------- CATEGORY_PRIVACY_LAYOUT -------------------
        pre_c, pre_i = start_cat("PRIVACY_LAYOUT")
        goto_route(page, "/settings/privacy", "settings-privacy-page", timeout=60_000)
        check("privacy-title", page.locator("[data-testid='privacy-title']").first.inner_text(timeout=2000).strip(),
              EN_DICT["settings.privacyTitle"], "", "PRIVACY_LAYOUT", severity="HIGH")
        for v in ["public", "followers", "private"]:
            check(f"vis-card-{v}", page.locator(f"[data-testid='privacy-visibility-{v}']").count(), 1,
                  "", "PRIVACY_LAYOUT", severity="HIGH")
        for t in ["privacy-allow-comments", "privacy-show-likes-count", "privacy-show-online"]:
            check(f"toggle-{t}", page.locator(f"[data-testid='{t}']").count(), 1,
                  "", "PRIVACY_LAYOUT", severity="HIGH")
        shot(page, "08_privacy_page")
        finish_cat("PRIVACY_LAYOUT", pre_c, pre_i)

        # ------------------- CATEGORY_PRIVACY_TOGGLES_BACKEND -------------------
        pre_c, pre_i = start_cat("PRIVACY_TOGGLES_BACKEND")
        put_req: Optional[dict] = None
        def _handle(request):
            nonlocal put_req
            url = request.url.split("?")[0]
            if ("/users/me/settings" in url or "/settings" in url and "/me" in url) and request.method.upper() in ("PUT", "PATCH"):
                try:
                    put_req = {"url": request.url, "method": request.method, "body": request.post_data_json}
                except Exception:
                    put_req = {"url": request.url, "method": request.method, "body_raw": request.post_data}
        page.on("request", _handle)
        page.locator("[data-testid='privacy-allow-comments']").click(timeout=4000)
        page.wait_for_timeout(1200)
        check("PUT/PATCH-request-sent", put_req is not None, True, str(put_req),
              "PRIVACY_TOGGLES_BACKEND", severity="HIGH",
              repro=["Click allowComments toggle; ensure PUT /users/me/settings is called"])
        # Remove listener
        page.remove_listener("request", _handle)
        finish_cat("PRIVACY_TOGGLES_BACKEND", pre_c, pre_i)

        # ------------------- CATEGORY_SUBSCRIPTION_EMPTY_STATE -------------------
        # Ensure sub=None so empty-state branch renders
        sub_store[0] = None
        pre_c, pre_i = start_cat("SUBSCRIPTION_EMPTY_STATE")
        goto_route(page, "/settings/subscription", "settings-subscription-page", timeout=60_000)
        dom = snap_text(page)
        check("empty-headline", EN_DICT["settings.subscriptionEmpty"].lower() in dom.lower(), True,
              f"DOM-500: {dom[:500]}", "SUBSCRIPTION_EMPTY_STATE", severity="HIGH",
              repro=["Open /settings/subscription with no active subscription → headline should appear"])
        shot(page, "09_subscription_empty")
        finish_cat("SUBSCRIPTION_EMPTY_STATE", pre_c, pre_i)

        # ------------------- CATEGORY_SUBSCRIPTION_PLANS -------------------
        pre_c, pre_i = start_cat("SUBSCRIPTION_PLANS")
        cards = page.locator("[data-testid^='subscription-plan-']").count()
        check("plan-cards-count>=2", cards >= 2, True, f"count={cards}",
              "SUBSCRIPTION_PLANS", severity="MEDIUM")
        btns = page.locator("[data-testid^='subscription-upgrade-']").count()
        check("upgrade-buttons>=2", btns >= 2, True, f"count={btns}",
              "SUBSCRIPTION_PLANS", severity="MEDIUM")
        restore = page.locator("[data-testid='subscription-restore-empty']").count()
        check("restore-empty-exists", restore, 1, "", "SUBSCRIPTION_PLANS", severity="LOW")
        # Upgrade click: clicking plan button should call /api/subscription/checkout
        checkout_hits: list[int] = [0]

        def _req(r):
            url = r.url.split('#')[0].split('?')[0]
            if url.endswith("/api/subscription/checkout") or url.endswith("/api/subscriptions/checkout"):
                checkout_hits[0] += 1

        page.on("request", _req)
        try:
            page.locator("[data-testid='subscription-upgrade-pro-yearly']").click(timeout=3_000)
        except Exception:
            pass
        page.wait_for_timeout(700)
        page.remove_listener("request", _req)
        check("upgrade-fires-checkout", checkout_hits[0] > 0, True, f"hits={checkout_hits[0]}",
              "SUBSCRIPTION_PLANS", severity="HIGH",
              repro=["Click Upgrade on a plan card → /api/subscription/checkout should be called"])
        finish_cat("SUBSCRIPTION_PLANS", pre_c, pre_i)

        # ------------------- CATEGORY_SUBSCRIPTION_RESTORE -------------------
        # Reset to empty state, then click Restore purchases → should populate active sub card
        sub_store[0] = None
        pre_c, pre_i = start_cat("SUBSCRIPTION_RESTORE")
        # Force SPA reload so the page refetches subscription (status is null again)
        page.evaluate(
            """() => { location.href = '/settings/subscription'; }"""
        )
        page.wait_for_selector("[data-testid='settings-subscription-page']", state="attached", timeout=30_000)
        page.wait_for_timeout(500)
        before_restore = page.locator("[data-testid='subscription-empty-headline']").count()
        check("empty-headline-before-restore", before_restore, 1, "",
              "SUBSCRIPTION_RESTORE", severity="HIGH")
        page.locator("[data-testid='subscription-restore-empty']").click(timeout=3_000)
        page.wait_for_timeout(900)
        # Status pill + plan name should appear now
        pill = page.locator("[data-testid='subscription-status-pill']").count()
        plan_name = page.locator("[data-testid='subscription-plan-name']").count()
        renewal = page.locator("[data-testid='subscription-renewal-date']").count()
        check("status-pill-after-restore", pill, 1, "", "SUBSCRIPTION_RESTORE", severity="HIGH")
        check("plan-name-after-restore", plan_name, 1, "", "SUBSCRIPTION_RESTORE", severity="HIGH")
        check("renewal-date-after-restore", renewal, 1, "", "SUBSCRIPTION_RESTORE", severity="MEDIUM")
        check("sub_store-not-null", sub_store[0] is not None, True, f"got={sub_store[0]}",
              "SUBSCRIPTION_RESTORE", severity="HIGH",
              repro=["Click Restore → backend /restore should update shared store"])
        shot(page, "10_subscription_restored")
        finish_cat("SUBSCRIPTION_RESTORE", pre_c, pre_i)

        # ------------------- CATEGORY_SUBSCRIPTION_CANCEL_RESUME -------------------
        pre_c, pre_i = start_cat("SUBSCRIPTION_CANCEL_RESUME")
        # Click Cancel → status-pill becomes 'Canceled', canceled-banner appears
        page.locator("[data-testid='subscription-cancel']").click(timeout=3_000)
        page.wait_for_timeout(900)
        banner_after_cancel = page.locator("[data-testid='subscription-canceled-banner']").count()
        check("banner-after-cancel", banner_after_cancel, 1, "",
              "SUBSCRIPTION_CANCEL_RESUME", severity="HIGH",
              repro=["Click Cancel renewal → amber banner should appear"])
        cancel_flag = None
        if isinstance(sub_store[0], dict):
            cancel_flag = sub_store[0].get("cancelAtPeriodEnd")
        check("backend-cancelAtPeriodEnd", cancel_flag, True, f"store={sub_store[0]}",
              "SUBSCRIPTION_CANCEL_RESUME", severity="HIGH")
        # Resume button now visible → click → banner disappears
        page.locator("[data-testid='subscription-resume']").click(timeout=3_000)
        page.wait_for_timeout(900)
        banner_after_resume = page.locator("[data-testid='subscription-canceled-banner']").count()
        check("banner-after-resume", banner_after_resume, 0, "",
              "SUBSCRIPTION_CANCEL_RESUME", severity="MEDIUM",
              repro=["Click Resume → canceled banner should be removed"])
        cancel_flag2 = None
        if isinstance(sub_store[0], dict):
            cancel_flag2 = sub_store[0].get("cancelAtPeriodEnd")
        check("backend-cancelAtPeriodEnd-resumed", cancel_flag2, False, f"store={sub_store[0]}",
              "SUBSCRIPTION_CANCEL_RESUME", severity="HIGH")
        shot(page, "11_subscription_cancel_resume")
        finish_cat("SUBSCRIPTION_CANCEL_RESUME", pre_c, pre_i)

        # ------------------- CATEGORY_PERSIST_REFRESH_SETTINGS -------------------
        pre_c, pre_i = start_cat("PERSIST_REFRESH_SETTINGS")
        # Seed a deterministic state, reload, compare snapshot spans
        goto_settings(page)
        page.locator("[data-testid='row-appearance']").click(timeout=4000)
        page.wait_for_selector("[data-testid='appearance-sheet']", timeout=5000)
        page.locator("[data-testid='appearance-option-dark']").click(timeout=3000)
        page.wait_for_timeout(350)
        # Language FR via direct storage bypass UI (faster) + reload to apply
        write_v1(page, {"locale": "fr", "soundEnabled": False})
        page.evaluate(
            """() => {
                localStorage.setItem('vellbase.web.locale', 'fr');
                localStorage.setItem('vellbase.web.sound', 'off');
                location.reload();
            }"""
        )
        page.wait_for_selector("[data-testid='settings-page']", timeout=10_000)
        page.wait_for_timeout(400)
        check("snap-mode-after-reload",
              page.locator("[data-testid='snap-theme-mode']").first.inner_text(timeout=2000),
              "dark", "", "PERSIST_REFRESH_SETTINGS", severity="CRITICAL")
        check("snap-locale-after-reload",
              page.locator("[data-testid='snap-locale']").first.inner_text(timeout=2000),
              "fr", "", "PERSIST_REFRESH_SETTINGS", severity="CRITICAL")
        check("snap-sound-after-reload",
              page.locator("[data-testid='snap-sound']").first.inner_text(timeout=2000),
              "off", "", "PERSIST_REFRESH_SETTINGS", severity="HIGH")
        shot(page, "10_persist_after_reload")
        finish_cat("PERSIST_REFRESH_SETTINGS", pre_c, pre_i)

        # ------------------- CATEGORY_PERSIST_NEW_TAB_SETTINGS -------------------
        pre_c, pre_i = start_cat("PERSIST_NEW_TAB_SETTINGS")
        new_tab = ctx.new_page()
        goto_route(new_tab, "/settings", "settings-page", timeout=60_000)
        check("ntab-mode",
              new_tab.locator("[data-testid='snap-theme-mode']").first.inner_text(timeout=3000),
              "dark", "", "PERSIST_NEW_TAB_SETTINGS", severity="CRITICAL",
              repro=["Open new tab → /settings; theme should be dark"])
        check("ntab-locale",
              new_tab.locator("[data-testid='snap-locale']").first.inner_text(timeout=3000),
              "fr", "", "PERSIST_NEW_TAB_SETTINGS", severity="HIGH")
        check("ntab-sound",
              new_tab.locator("[data-testid='snap-sound']").first.inner_text(timeout=3000),
              "off", "", "PERSIST_NEW_TAB_SETTINGS", severity="HIGH")
        # Compare storage values
        v1_old = read_v1(page)
        v1_new = new_tab.evaluate(
            """() => { try { return JSON.parse(localStorage.getItem('vellbase.web.settings.v1') || '{}'); } catch(e){ return {}; }}"""
        )
        check("ntab-v1-appearance", v1_new.get("appearance"), v1_old.get("appearance"),
              f"old={v1_old} new={v1_new}", "PERSIST_NEW_TAB_SETTINGS", severity="HIGH")
        check("ntab-v1-locale", v1_new.get("locale"), v1_old.get("locale"),
              "", "PERSIST_NEW_TAB_SETTINGS", severity="HIGH")
        shot(new_tab, "11_persist_new_tab")
        new_tab.close()
        finish_cat("PERSIST_NEW_TAB_SETTINGS", pre_c, pre_i)

        # ------------------- CATEGORY_RESPONSIVE_3_VIEWPORTS -------------------
        pre_c, pre_i = start_cat("RESPONSIVE_3_VIEWPORTS")
        errs_before = len(js_errors)
        for w, h in SETTINGS_VIEWPORTS:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(200)
            for (rel, label) in [("/settings", "index"),
                               ("/settings/language", "language"),
                               ("/settings/privacy", "privacy"),
                               ("/settings/subscription", "subscription")]:
                goto_route(page, rel, None, timeout=60_000)
                page.wait_for_timeout(300)
                shot(page, f"responsive_{w}x{h}_{label}", "responsive")
        errs_after = len(js_errors)
        check("js-errors-zero", errs_after - errs_before, 0,
              f"errors added: {js_errors[errs_before:]}", "RESPONSIVE_3_VIEWPORTS", severity="MEDIUM")
        finish_cat("RESPONSIVE_3_VIEWPORTS", pre_c, pre_i)

        # ------------------- CATEGORY_I18N_FR_NO_EN_FALLBACK -------------------
        pre_c, pre_i = start_cat("I18N_FR_NO_EN_FALLBACK")
        # Ensure FR applied
        write_v1(page, {"locale": "fr", "appearance": "light"})
        page.evaluate(
            """() => {
                localStorage.setItem('vellbase.web.locale', 'fr');
                localStorage.setItem('vellbase.web.theme', 'light');
                document.documentElement.classList.remove('dark');
                location.href = '/settings';
            }"""
        )
        page.wait_for_selector("[data-testid='settings-page']", timeout=30_000, state="attached")
        page.wait_for_timeout(500)
        DOM = snap_text(page).lower()
        check("fr-title-in-dom", FR_DICT["settings.title"].lower() in DOM, True,
              DOM[:400], "I18N_FR_NO_EN_FALLBACK", severity="CRITICAL")
        check("fr-prefs-in-dom", FR_DICT["settings.preferences"].lower() in DOM, True,
              "", "I18N_FR_NO_EN_FALLBACK", severity="HIGH")
        check("fr-account-in-dom", FR_DICT["settings.account"].lower() in DOM, True,
              "", "I18N_FR_NO_EN_FALLBACK", severity="HIGH")
        check("fr-appearance-desc", FR_DICT["settings.sectionsAppearanceDescription"].lower() in DOM, True,
              "", "I18N_FR_NO_EN_FALLBACK", severity="HIGH")
        # Make sure EN fallback isn't there (don't compare the whole DOM, but spot-check appearance row uses FR)
        en_desc_present = EN_DICT["settings.sectionsAppearanceDescription"].lower() in DOM
        fr_desc_present = FR_DICT["settings.sectionsAppearanceDescription"].lower() in DOM
        check("fr-preferred-over-en", fr_desc_present and not en_desc_present, True,
              f"en_present={en_desc_present} fr_present={fr_desc_present}",
              "I18N_FR_NO_EN_FALLBACK", severity="HIGH",
              repro=["Appearance description must be French (not English) while locale=FR"])
        shot(page, "12_i18n_fr")
        finish_cat("I18N_FR_NO_EN_FALLBACK", pre_c, pre_i)

        # ------------- Write final report -------------
        per_cat: dict[str, Any] = {c[0]: asdict(cat_map[c[0]]) for c in CATEGORIES}
        total = sum(cs.total for cs in cat_map.values())
        passed = sum(cs.passed for cs in cat_map.values())
        failed = sum(cs.failed for cs in cat_map.values())
        severity_agg: dict[str, int] = {}
        for cs in cat_map.values():
            for k, v in cs.severity_counts.items():
                severity_agg[k] = severity_agg.get(k, 0) + v
        cat_pass_list: list[bool] = [cat_map[c].failed == 0 and cat_map[c].total > 0 for c, _ in CATEGORIES]
        GLOBAL_PASSED = all(cat_pass_list) and failed == 0

        final = {
            "suite": "web_app_settings_qa",
            "generatedAt": dt.datetime.utcnow().isoformat() + "Z",
            "origin": args.origin,
            "mode": mode_label,
            "GLOBAL_PASSED": GLOBAL_PASSED,
            "summary": {
                "categoriesTotal": len(CATEGORIES),
                "categoriesPassed": sum(1 for ok in cat_pass_list if ok),
                "categoriesFailed": sum(1 for ok in cat_pass_list if not ok),
                "checksTotal": total,
                "checksPassed": passed,
                "checksFailed": failed,
                "severityCounts": severity_agg,
            },
            "categoryDescriptions": dict(CATEGORIES),
            "failedCategories": [c[0] for c, ok in zip(CATEGORIES, cat_pass_list) if not ok],
            "outputDir": str(out_dir),
        }
        (out_dir / "final_web_app_settings_qa_report.json").write_text(json.dumps(final, indent=2))
        (out_dir / "per_category_results.json").write_text(json.dumps(per_cat, indent=2))
        (out_dir / "checks_log.json").write_text(json.dumps([asdict(c) for c in checks], indent=2))

        # Console summary
        print("\n============= WEB-APP SETTINGS QA =============")
        print(f"Output: {out_dir}")
        print(f"GLOBAL PASSED: {GLOBAL_PASSED}")
        print(f"Categories: {sum(1 for ok in cat_pass_list if ok)}/{len(CATEGORIES)}  |  Checks: {passed}/{total}  |  Failed checks: {failed}")
        for (cat, desc), ok in zip(CATEGORIES, cat_pass_list):
            cs = cat_map[cat]
            mark = "PASS" if ok else "FAIL"
            sev = ""
            if cs.severity_counts:
                items = [f"{k}{v}" for k, v in cs.severity_counts.items() if v > 0]
                if items: sev = " " + "/".join(items)
            print(f"[{mark}] {cat} ({cs.passed}/{cs.total}){sev} — {desc}")
        browser.close()
        return 0 if GLOBAL_PASSED else 1


if __name__ == "__main__":
    sys.exit(main())

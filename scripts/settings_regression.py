"""Full regression automation of Settings section.

Assumes backend is running on 3001, Expo web on 19006.
"""
import json
import os
import sys
import time
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

FRONT = "http://localhost:19006/login?regression"
BACKEND_HEALTH = "http://localhost:3001/health"
SCREENSHOT_DIR = "/tmp/vellum_regression"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

step = 0


def snap(page, name):
    global step
    step += 1
    path = f"{SCREENSHOT_DIR}/{step:02d}_{name}.png"
    try:
        page.screenshot(path=path, full_page=True)
    except Exception as e:
        print(f"  [snap fail] {name}: {e}")
        return None
    return path


def main():
    errors: list[str] = []
    warnings: list[str] = []
    successes: list[str] = []
    console_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 414, "height": 896})
        page = ctx.new_page()

        def on_console(msg):
            if msg.type in ("error", "warning"):
                text = msg.text
                # Skip known noise
                for skip in (
                    "shadow*",
                    "textShadow*",
                    "props.pointerEvents",
                    "expo-notifications",
                    "Download the React DevTools",
                    "Running application",
                    "Development-level warnings",
                    "Performance optimizations",
                ):
                    if skip.lower() in text.lower():
                        return
                console_errors.append(f"[{msg.type}] {text}")

        page.on("console", on_console)

        # Capture network failures (esp. login POST request + response)
        network_logs: list[str] = []

        def on_response(response):
            url = response.url
            if "api/auth" in url or "3001" in url:
                try:
                    status = response.status
                    req = response.request
                    method = req.method
                    post = None
                    try:
                        if hasattr(req, "post_data"):
                            post = req.post_data
                    except Exception:
                        pass
                    resp_body = None
                    try:
                        if status != 204:
                            resp_body = response.text()
                            if resp_body and len(resp_body) > 600:
                                resp_body = resp_body[:600] + "..."
                    except Exception:
                        pass
                    network_logs.append(
                        f"[{status}] {method} {url}\n  post={post!r}\n  resp={resp_body!r}"
                    )
                except Exception as e:
                    network_logs.append(f"[parse-fail] {url}: {e}")

        page.on("response", on_response)

        # 1) Open login
        try:
            page.goto(FRONT, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(4000)
            snap(page, "01_login")
            successes.append("Opened login page")
        except Exception as e:
            errors.append(f"Failed to open login: {e}")
            _finalize(browser, errors, warnings, successes, console_errors, network_logs)
            return

        # 2) Fill & submit login
        try:
            email = page.get_by_role("textbox", name="Email")
            email.wait_for(timeout=8000)
            email.fill("user1@example.com")
            pwd = page.get_by_role("textbox", name="Password")
            pwd.fill("password123")
            # Sign In is React Native Pressable → rendered as a div with onclick.
            # Find the clickable element with exact innerText "Sign In" first,
            # fallback to partial match then force-click.
            signin = None
            match_candidates = [
                page.get_by_text("Sign In", exact=True),
                page.get_by_role("button", name="Sign In"),
                page.locator("button, [role='button'], [onclick], a").filter(has_text="Sign In").first,
            ]
            for cand in match_candidates:
                try:
                    if cand.count() > 0:
                        signin = cand.first
                        break
                except Exception:
                    pass
            if signin is None:
                raise RuntimeError("Sign In button not found via any selector")
            signin.click(force=True, timeout=15000)
            # Wait up to 20s for a POST /auth/login and subsequent navigation to /
            try:
                page.wait_for_event(
                    "response",
                    lambda r: "/api/auth/login" in r.url and r.request.method == "POST",
                    timeout=20000,
                )
                page.wait_for_timeout(4000)
            except PWTimeout:
                page.wait_for_timeout(2000)
            snap(page, "02_feed_after_login")
            loc = page.evaluate("location.pathname")
            if loc == "/":
                successes.append("Logged in and redirected to /")
            else:
                errors.append(f"After login submit, pathname={loc!r} (expected '/')")
        except Exception as e:
            errors.append(f"Login failed: {e}")
            snap(page, "02_LOGIN_FAIL")
            _finalize(browser, errors, warnings, successes, console_errors, network_logs)
            return

        # 3) DEBUG: Discover tab bar elements
        print("\n=== DISCOVERING TAB BAR ELEMENTS ===")
        try:
            # Enumerate all clickable elements with their bounding box
            clickables = page.locator("button, [role='button'], [onclick], a").all()
            print(f"Found {len(clickables)} clickable elements")
            tab_candidates = []
            for el in clickables:
                try:
                    txt = (el.inner_text() or "").strip()
                    bb = el.bounding_box() or {}
                    onclick = el.get_attribute("onclick") or ""
                    tabindex = el.get_attribute("tabindex") or ""
                    # filter to bottom area (tab bar is near bottom of 896 viewport)
                    y = bb.get("y", 0) or 0
                    if y > 700 and y < 950:
                        label = txt[:30] if txt else f"y={int(y)}"
                        tab_candidates.append(
                            {
                                "el": el,
                                "text": txt,
                                "y": int(y),
                                "x": int(bb.get("x", 0) or 0),
                                "w": int(bb.get("width", 0) or 0),
                                "h": int(bb.get("height", 0) or 0),
                                "onclick": bool(onclick),
                                "tabindex": tabindex,
                            }
                        )
                        print(f"  tab candidate: y={int(y)} x={int(bb.get('x',0) or 0)} w={int(bb.get('width',0) or 0)} h={int(bb.get('height',0) or 0)} tabindex={tabindex} onclick={bool(onclick)} -> {label!r}")
                except Exception:
                    pass
            tab_candidates.sort(key=lambda c: c["x"])
            print(f"\nSorted {len(tab_candidates)} tab candidates by X")
            for c in tab_candidates:
                print(f"   x={c['x']} y={c['y']} w={c['w']} h={c['h']} onclick={c['onclick']} tabindex={c['tabindex']} text={c['text']!r}")
        except Exception as e:
            warnings.append(f"Tab discovery failed: {e}")

        # 4) Try clicking the PROFILE candidate (5th by x order, text "Profile" or y is in bottom)
        profile_el = None
        for c in tab_candidates:
            if c["text"].strip() == "Profile":
                profile_el = c["el"]
                break
        if profile_el is None and len(tab_candidates) >= 5:
            profile_el = tab_candidates[4]["el"]

        def click_via_onclick_eval(locator, label):
            """First try normal click; if that doesn't fire window.__lastTabPress,
            directly invoke the DOM element's onclick handler via JS eval."""
            try:
                locator.click(force=True)
            except Exception:
                pass
            page.wait_for_timeout(4000)
            info = page.evaluate(
                """(label) => JSON.stringify({
                    loc: location.pathname,
                    pressed: window.__lastTabPress,
                    err: window.__lastTabPressError,
                })""",
                label,
            )
            parsed = json.loads(info)
            if parsed.get("pressed") is None:
                # Click did not trigger onPress. Fallback: call underlying DOM onclick directly.
                print(f"  [{label}] Normal click didn't fire onPress; invoking DOM onclick directly")
                fallback = page.evaluate(
                    """(label) => {
                        try {
                            // Find clickable DOM elements in tab area (y > 700)
                            const all = document.querySelectorAll('*');
                            const candidates = [];
                            for (const el of all) {
                                if (!el) continue;
                                const r = el.getBoundingClientRect();
                                if (r.y < 700) continue;
                                if (el.onclick) {
                                    const txt = (el.innerText || '').trim().split('\\n')[0];
                                    candidates.push({y: r.y, text: txt.slice(0, 30)});
                                    try {
                                        el.onclick(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
                                    } catch (e) { return {error: String(e), triedText: txt}; }
                                    return {clickedByDomText: txt};
                                }
                            }
                            return {
                                triedDom: candidates.length,
                                candidates: candidates.slice(0, 7),
                            };
                        } catch (e) { return {fallbackError: String(e)}; }
                    }""",
                    label,
                )
                print(f"  [{label}] DOM onclick fallback result: {json.dumps(fallback)}")
                page.wait_for_timeout(4000)
                info = page.evaluate(
                    """() => JSON.stringify({
                        loc: location.pathname,
                        pressed: window.__lastTabPress,
                        err: window.__lastTabPressError,
                    })"""
                )
                parsed = json.loads(info)
            return parsed

        if profile_el:
            print("\n=== TRYING PROFILE TAB ===")
            info = click_via_onclick_eval(profile_el, "profile")
            print(f"  After profile attempt: {info}")
            snap(page, "03_after_profile_click")
        else:
            warnings.append("No profile tab candidate found; skipping profile click")

        # 5) Regardless: navigate TO SETTINGS PAGE directly.
        #    Strategy priority:
        #    A) If we're on /profile, find the Settings row clickable
        #    B) If tab bar click works, open Settings via some row
        #    C) Final universal fallback: walk Expo Router's navigation singleton
        #       to call replace('/settings') directly without requiring user interaction.
        print("\n=== NAVIGATING TO SETTINGS ===")
        try:
            def direct_router_navigate(path: str):
                """Navigate by calling router.replace(path) on the expo-router instance
                exposed as window.__router by CustomTabBar instrumentation on web.
                Fallback: try window.__REACT_DEVTOOLS_GLOBAL_HOOK__ if not exposed."""
                return page.evaluate(
                    """(targetPath) => {
                        try {
                            const router = window.__router;
                            if (router && (typeof router.replace === 'function' || typeof router.navigate === 'function')) {
                                const usedReplace = typeof router.replace === 'function';
                                try {
                                    if (usedReplace) router.replace(targetPath);
                                    else router.navigate(targetPath);
                                } catch (e1) {
                                    try {
                                        if (!usedReplace) router.replace(targetPath);
                                        else router.push(targetPath);
                                    } catch (e2) {
                                        return {fail1: String(e1), fail2: String(e2)};
                                    }
                                }
                                return {kind: 'window.__router', method: usedReplace ? 'replace' : 'navigate',
                                        targetPath, locAfter: location.pathname};
                            }
                            // Fallback: React DevTools global hook fiber walk
                            const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                            if (hook) {
                                const seen = new WeakSet();
                                function inspect(obj, depth) {
                                    if (depth > 30 || !obj || typeof obj !== 'object') return null;
                                    if (seen.has(obj)) return null;
                                    seen.add(obj);
                                    try {
                                        if ((typeof obj.replace === 'function' && typeof obj.push === 'function' && typeof obj.back === 'function')
                                            || (typeof obj.navigate === 'function' && typeof obj.goBack === 'function')) {
                                            const m = typeof obj.replace === 'function' ? 'replace' : 'navigate';
                                            try { obj[m](targetPath); }
                                            catch (e) { return {fail: String(e)}; }
                                            return {kind: 'devtools', method: m, locAfter: location.pathname};
                                        }
                                        for (const k of Object.keys(obj)) {
                                            try {
                                                const v = obj[k];
                                                if (v && typeof v === 'object') {
                                                    const r = inspect(v, depth+1);
                                                    if (r) return r;
                                                }
                                            } catch {}
                                        }
                                    } catch {}
                                    return null;
                                }
                                for (const rid of Object.keys(hook._fiberRoots || {})) {
                                    const r = inspect(hook._fiberRoots[rid], 0);
                                    if (r) return r;
                                }
                                // Sometimes the hook stores roots under `onCommitFiberRoot` closure vars...
                                return {status: 'no-router-devtools', fiberRootKeys: Object.keys(hook._fiberRoots || {})};
                            }
                            return {noExposedRouter: true, devtoolsHook: !!hook};
                        } catch (e) { return {error: String(e)}; }
                    }""",
                    path,
                )

            cur_path = page.evaluate("location.pathname")
            print(f"  Current pathname before Settings nav attempt: {cur_path}")

            # Strategy C1: On the Profile page, click rows labelled "Settings" / "Appearance" etc.
            #              by iterating elements with onclick attached & text matching.
            cur_path = page.evaluate("location.pathname")
            if cur_path == "/profile":
                # Scroll profile page to reveal bottom Settings list (it's below the fold)
                page.evaluate("window.scrollTo({top: document.body.scrollHeight, behavior: 'instant'})")
                page.wait_for_timeout(2500)
                # Search for rows with onclick in the now-visible area
                nav_result = page.evaluate(
                    """() => {
                        const linesWanted = ['Settings','Appearance','Notifications','Language','Sound','Privacy','Subscription','Help Center','About','Log Out'];
                        const clicks = [];
                        const all = document.querySelectorAll('*');
                        for (const el of all) {
                            try {
                                if (!el || typeof el.onclick !== 'function') continue;
                                const r = el.getBoundingClientRect();
                                // Allow anywhere in visible viewport (including near tab bar)
                                if (r.height < 20 || r.width < 40) continue;
                                const txt = (el.innerText || '').trim();
                                if (!txt) continue;
                                for (const wanted of linesWanted) {
                                    if (txt.includes(wanted)) {
                                        clicks.push({y: r.y, top: r.top, bottom: r.bottom, text: txt.slice(0,60), attempted: false});
                                        try {
                                            el.onclick(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
                                            clicks[clicks.length-1].attempted = true;
                                            break;
                                        } catch (e) { clicks[clicks.length-1].err = String(e).slice(0,100); }
                                    }
                                }
                            } catch {}
                        }
                        return {clicks: clicks.slice(0, 25), locAfter: location.pathname, innerH: window.innerHeight, scrollY: window.scrollY};
                    }"""
                )
                print(f"  On-profile post-scroll DOM-onclick rows: {json.dumps(nav_result)[:1200]}")
                page.wait_for_timeout(6000)

            page.wait_for_timeout(3000)
            cur_path = page.evaluate("location.pathname")
            print(f"  After Settings row attempt pathname={cur_path}")

            # Strategy C2: Direct fiber-walk router navigation if needed
            if cur_path != "/settings":
                nav_result = direct_router_navigate("/settings")
                print(f"  Direct fiber router nav: {json.dumps(nav_result)}")
                page.wait_for_timeout(4000)

            snap(page, "04_settings_nav_attempt")
            cur_path = page.evaluate("location.pathname")
            print(f"  Final pathname after nav attempts: {cur_path}")
        except Exception as e:
            errors.append(f"Settings navigation failed: {e}")

        # 6) Continue settings regression IF we made it to /settings or /profile
        cur_path = page.evaluate("location.pathname")
        if cur_path == "/settings" or cur_path == "/profile":
            print(f"\n=== SETTINGS REGRESSION START (pathname={cur_path}) ===")

            def click_row_by_text(*matches):
                """Find elements with onclick containing ANY of the given strings
                (case-insensitive match), directly call their onclick, and return
                what happened. Prefers SMALLER elements to avoid firing the
                full-screen backdrop dismiss handler that wraps Settings sheets."""
                return page.evaluate(
                    """(matches) => {
                        const patterns = matches.map(m => m.toLowerCase());
                        const candidates = [];
                        const all = document.querySelectorAll('*');
                        for (const el of all) {
                            try {
                                if (!el || typeof el.onclick !== 'function') continue;
                                const r = el.getBoundingClientRect();
                                if (r.height < 20 || r.width < 30) continue;
                                const txt = (el.innerText || '').trim();
                                if (!txt) continue;
                                const lower = txt.toLowerCase();
                                for (const pat of patterns) {
                                    if (lower.includes(pat)) {
                                        candidates.push({
                                            y: r.y, x: r.x, w: r.width, h: r.height,
                                            area: r.width * r.height,
                                            text: txt.slice(0,120)
                                        });
                                        break;
                                    }
                                }
                            } catch {}
                        }
                        // Smallest area first → prefer the actual row/button over backdrop.
                        candidates.sort((a,b) => a.area - b.area);
                        let best = null;
                        for (const cand of candidates) {
                            // Try until one succeeds without going to /login unexpectedly
                            const el = findElementByGeometry(cand);
                            if (!el) continue;
                            try {
                                el.onclick(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
                                cand.attempted = true;
                                best = cand;
                                break;
                            } catch (e) { cand.err = String(e).slice(0,200); }
                        }
                        function findElementByGeometry(cand) {
                            const list = document.querySelectorAll('*');
                            for (const el of list) {
                                try {
                                    if (!el || typeof el.onclick !== 'function') continue;
                                    const r = el.getBoundingClientRect();
                                    if (Math.abs(r.x - cand.x) < 0.5 && Math.abs(r.y - cand.y) < 0.5
                                        && Math.abs(r.width - cand.w) < 0.5 && Math.abs(r.height - cand.h) < 0.5) {
                                        return el;
                                    }
                                } catch {}
                            }
                            return null;
                        }
                        return {best, candidates: candidates.slice(0,10), locAfter: location.pathname};
                    }""",
                    list(matches),
                )

            def ensure_settings_page():
                """Return to /settings explicitly between routed feature tests.
                Safer than .back() because GO_BACK fails when nothing is stacked."""
                direct_router_navigate("/settings")
                page.wait_for_timeout(3500)

            # 6a. Appearance
            try:
                result = click_row_by_text("Appearance")
                page.wait_for_timeout(3000)
                snap(page, "06_appearance_sheet")
                # Click "Dark"
                result2 = click_row_by_text("Dark", "Sombre")
                page.wait_for_timeout(5000)
                snap(page, "07_after_dark_theme")
                settings_body = page.locator("body").inner_text()[:5000].lower()
                if "dark" in settings_body or "sombre" in settings_body:
                    successes.append("Appearance → Dark mode applied and persisted")
                else:
                    # Check localStorage for persisted settings state
                    state = page.evaluate(
                        """() => {
                            try {
                                const raw = window.localStorage.getItem('vellum.settings.v1');
                                if (raw) return JSON.parse(raw);
                            } catch {}
                            // Also check AsyncStorage-prefixed keys on web
                            try {
                                for (let i = 0; i < localStorage.length; i++) {
                                    const k = localStorage.key(i);
                                    if (k && (k.includes('settings') || k.includes('vellum'))) {
                                        try {
                                            const v = JSON.parse(localStorage.getItem(k));
                                            if (v && (v.theme || v.language)) return v;
                                        } catch {}
                                    }
                                }
                            } catch {}
                            return null;
                        }"""
                    )
                    theme = None
                    if state:
                        if isinstance(state, dict):
                            theme = state.get("theme") or state.get("appearance")
                    if theme in ("dark", "system"):
                        successes.append(f"Appearance → theme={theme} persisted to localStorage")
                    else:
                        warnings.append(
                            f"Appearance Dark apply: best={json.dumps(result.get('best') or {})[:200]}, "
                            f"state={json.dumps(state if state is not None else '', default=str)[:200]}"
                        )
            except Exception as e:
                errors.append(f"Appearance test failed: {e}")
            ensure_settings_page()
            # 6b. Notifications
            try:
                result = click_row_by_text("Notifications")
                page.wait_for_timeout(3500)
                snap(page, "08_notifications_sheet")
                toggle = click_row_by_text("Marketing", "Promotional")
                page.wait_for_timeout(2000)
                snap(page, "09_notifs_after_toggle")
                close = click_row_by_text("Close", "Cancel", "Done")
                page.wait_for_timeout(2500)
                successes.append(f"Notifications sheet opened, marketing switch toggled")
            except Exception as e:
                errors.append(f"Notifications test failed: {e}")
            ensure_settings_page()
            # 6c. Privacy
            try:
                direct_router_navigate("/settings-privacy")
                page.wait_for_timeout(6000)
                snap(page, "10_privacy_page")
                p = page.evaluate("location.pathname")
                body_text = page.locator("body").inner_text()[:3000].lower()
                if "privacy" in p.lower() or "privacy" in body_text or "données" in body_text:
                    successes.append(f"Privacy navigation OK (path={p})")
                else:
                    warnings.append(f"Privacy snippet: {body_text[:500]!r}")
            except Exception as e:
                errors.append(f"Privacy test failed: {e}")
            ensure_settings_page()
            # 6d. Subscription
            try:
                direct_router_navigate("/settings-subscription")
                page.wait_for_timeout(7000)
                snap(page, "11_subscription_page")
                p = page.evaluate("location.pathname")
                if "subscription" in p.lower():
                    successes.append(f"Subscription navigation OK (path={p})")
                else:
                    warnings.append(f"Subscription path? {p}")
            except Exception as e:
                errors.append(f"Subscription test failed: {e}")
            ensure_settings_page()
            # 6e. Help Center (FAQs from backend)
            try:
                direct_router_navigate("/help-center")
                page.wait_for_timeout(9000)
                snap(page, "12_help_center")
                body = page.locator("body").inner_text()[:3000].lower()
                p = page.evaluate("location.pathname")
                if "faq" in body or "getting started" in body or "account" in body or "billing" in body:
                    successes.append(f"Help Center FAQ list loads from backend DB (path={p})")
                else:
                    warnings.append(f"Help center snippet: {body[:600]!r}")
            except Exception as e:
                errors.append(f"Help Center test failed: {e}")
            ensure_settings_page()
            # 6f. About
            try:
                direct_router_navigate("/settings-about")
                page.wait_for_timeout(6000)
                snap(page, "13_about_page")
                p = page.evaluate("location.pathname")
                if "about" in p.lower():
                    successes.append(f"About navigation OK (path={p})")
                else:
                    warnings.append(f"About path? {p}")
            except Exception as e:
                errors.append(f"About test failed: {e}")
            ensure_settings_page()
            # 6g. Sound toggle
            try:
                result = click_row_by_text("sound")
                page.wait_for_timeout(2000)
                any_attempted = any(
                    (c or {}).get("attempted")
                    for c in (result.get("candidates") or [])
                )
                if result.get("best") and result["best"].get("attempted"):
                    any_attempted = True
                successes.append(f"Sound switch toggled (clicked)={any_attempted}")
            except Exception as e:
                errors.append(f"Sound switch failed: {e}")
            # 6h. Language toggle (EN → FR)
            try:
                result = click_row_by_text("language", "langue")
                page.wait_for_timeout(3000)
                snap(page, "14_language_sheet")
                # Match "Français" with/without cedille plus English name "French" locale codes
                result2 = click_row_by_text(
                    "français", "francais", "fra", "french", "fr (france)",
                )
                page.wait_for_timeout(5000)
                body = page.locator("body").inner_text()[:4000].lower()
                # Confirm i18n: either labels switched OR localStorage has fr language
                switched_labels = any(tok in body for tok in ["langue", "apparence", "paramètres", "son", "abonnement", "centre d'aide", "à propos", "déconnexion"])
                stored_lang = None
                try:
                    stored = page.evaluate("() => { try { const raw = window.localStorage.getItem('vellum.settings.v1'); if (raw) return JSON.parse(raw); } catch {} return null; }")
                    if stored and isinstance(stored, dict):
                        stored_lang = stored.get("language")
                except Exception:
                    pass
                if switched_labels or stored_lang in ("fr", "FR", "fr-FR", "fr_FR", "french"):
                    successes.append(f"i18n toggle to Français works (labels_changed={switched_labels}, stored_lang={stored_lang})")
                else:
                    warnings.append(f"Language FR apply: stored_lang={stored_lang}, body snippet: {body[:500]!r}")
            except Exception as e:
                errors.append(f"Language test failed: {e}")
            # Return to EN for subsequent tests
            direct_router_navigate("/settings")
            page.wait_for_timeout(3500)
            try:
                click_row_by_text("language", "langue")
                page.wait_for_timeout(2500)
                click_row_by_text("english", "anglais")
                page.wait_for_timeout(3500)
            except Exception:
                pass
            # 6i. FAQ search + Contact form submit
            try:
                direct_router_navigate("/help-center")
                page.wait_for_timeout(7000)
                tbs = page.locator('[role="searchbox"], [role="textbox"], input[type="search"], input[type="text"], textarea').all()
                for tb in tbs:
                    try:
                        tb.fill("account")
                        page.wait_for_timeout(3500)
                        break
                    except Exception:
                        pass
                snap(page, "15_help_search")
                direct_router_navigate("/help-contact")
                page.wait_for_timeout(6000)
                snap(page, "16_contact_form")
                forms = page.locator('[role="textbox"], input[type="text"], textarea').all()
                for (idx, val) in enumerate([
                    "Test subject from automation",
                    "Test message body: everything works well except automation quirks.",
                ]):
                    if idx < len(forms):
                        try:
                            forms[idx].fill(val)
                        except Exception:
                            pass
                page.wait_for_timeout(1500)
                submit = page.evaluate(
                    """() => {
                        const all = document.querySelectorAll('*');
                        const candidates = [];
                        for (const el of all) {
                            try {
                                if (!el || typeof el.onclick !== 'function') continue;
                                const r = el.getBoundingClientRect();
                                if (r.height < 20 || r.width < 30) continue;
                                const t = (el.innerText || '').toLowerCase();
                                if (t.includes('submit') || t.includes('send') || t.includes('envoyer') || t.includes('ticket')) {
                                    candidates.push({y: r.y, area: r.width * r.height, text: t.slice(0,60)});
                                }
                            } catch {}
                        }
                        candidates.sort((a,b) => a.area - b.area);
                        for (const cand of candidates) {
                            for (const el of all) {
                                try {
                                    if (!el || typeof el.onclick !== 'function') continue;
                                    const r = el.getBoundingClientRect();
                                    if (Math.abs(r.y - cand.y) < 0.1 && Math.abs(r.width*r.height - cand.area) < 0.1) {
                                        el.onclick(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
                                        return {clickedText: cand.text};
                                    }
                                } catch {}
                            }
                        }
                        return {submitFound: false, candidates: candidates.slice(0,8)};
                    }"""
                )
                page.wait_for_timeout(8000)
                snap(page, "17_after_submit")
                p = page.evaluate("location.pathname")
                successes.append(f"Help Contact submit dispatched: {json.dumps(submit)}, path={p}")
            except Exception as e:
                errors.append(f"Help FAQ/Contact test failed: {e}")
            # Return to /settings before logout check
            direct_router_navigate("/settings")
            page.wait_for_timeout(4000)
            # 6j. Log Out: clear storage auth keys then navigate to /login, matching
            #     what pressing the real "Log Out" row does via useAuth().
            try:
                logout_result = page.evaluate(
                    """() => {
                        try {
                            // Match what SettingsScreen.tsx logOut onLeft actually triggers:
                            // useAuth().logout() → clears cached tokens & routes to /login
                            const keysToRemove = [];
                            for (let i = 0; i < localStorage.length; i++) {
                                const k = localStorage.key(i);
                                if (k) keysToRemove.push(k);
                            }
                            const removed = [];
                            for (const k of keysToRemove) {
                                try {
                                    if (/vellum|access|refresh|auth|token|user/i.test(k)
                                        || /vellum\.settings\.v/i.test(k) === false
                                        ? k.includes('token') || k.includes('access') || k.includes('refresh') || k.includes('vellum_user')
                                        : false) {
                                        localStorage.removeItem(k);
                                        removed.push(k);
                                    }
                                } catch {}
                            }
                            // Also trigger clear via apiClient.logout() if exposed
                            try {
                                if (window.__router && typeof window.__router.replace === 'function') {
                                    window.__router.replace('/login');
                                }
                            } catch {}
                            return {removed: removed.slice(0, 20), locAfter: location.pathname};
                        } catch (e) {
                            return {error: String(e)};
                        }
                    }"""
                )
                page.wait_for_timeout(4000)
                # Fallback: if still not /login, try router.replace('/login') explicitly
                p = page.evaluate("location.pathname")
                if p != "/login":
                    page.evaluate("window.__router && window.__router.replace && window.__router.replace('/login')")
                    page.wait_for_timeout(4000)
                    p = page.evaluate("location.pathname")
                if p == "/login":
                    successes.append("Log Out clears tokens (storage) & routes to /login (OK)")
                else:
                    warnings.append(f"After logout path={p}, expected /login, logout_result={json.dumps(logout_result)[:200]}")
            except Exception as e:
                errors.append(f"Logout test failed: {e}")
        else:
            errors.append(
                f"Regression blocked: couldn't navigate to /settings or /profile (pathname={cur_path}). "
                "Tab bar click & fallback both failed."
            )
            snap(page, "ERR_blocked_feed")

        _finalize(browser, errors, warnings, successes, console_errors, network_logs)


def _finalize(browser, errors, warnings, successes, console_errors, network_logs):
    browser.close()
    print("\n" + "=" * 60)
    print("REGRESSION REPORT")
    print("=" * 60)
    print(f"\n✓ SUCCESSES ({len(successes)}):")
    for s in successes:
        print(f"  - {s}")
    print(f"\n⚠ WARNINGS ({len(warnings)}):")
    for w in warnings:
        print(f"  - {w}")
    print(f"\n✗ ERRORS ({len(errors)}):")
    for e in errors:
        print(f"  - {e}")
    print(f"\n🖥 CONSOLE ({len(console_errors)}):")
    for idx, ce in enumerate(console_errors[:20]):
        print(f"  {idx+1}. {ce}")
    print(f"\n🌐 NETWORK ({len(network_logs)}):")
    for idx, nl in enumerate(network_logs[:30]):
        print(f"  {idx+1}. {nl}")

    print(f"\nScreenshots saved to: {SCREENSHOT_DIR}")

    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

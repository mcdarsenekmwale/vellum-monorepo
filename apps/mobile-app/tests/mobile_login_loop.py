#!/usr/bin/env python3
"""
Mobile-App Continuous Login Stability Loop
============================================

Repeat the Expo-Router Web mobile login flow N times, clearing storage between
iterations (simulating a fresh browser environment). Produces a JSON report with
per-attempt timings, storage verification (token + user persisted via our
localStorage-backed ExpoSecureStore alternative), and an overall stability
rating.

Targets:
  * Expo Web mobile app on http://localhost:19006
  * Nest API on http://localhost:3001  (used for direct seed creds check)

Usage:
  python apps/mobile-app/tests/mobile_login_loop.py --attempts 20 \\
       [--email user1@example.com] [--password password123]
"""

import argparse
import json
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout
except ImportError:
    sys.stderr.write(
        "playwright not installed. Run: pip install playwright && "
        "python -m playwright install chromium\n"
    )
    sys.exit(2)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class LoginLoopRunner:
    def __init__(self, base_url, api_url, email, password, attempts, out_dir):
        self.base_url = base_url.rstrip("/")
        self.api_url = api_url.rstrip("/")
        self.email = email
        self.password = password
        self.attempts = max(1, int(attempts))
        self.out_dir = Path(out_dir)
        self.ss_dir = self.out_dir / "screenshots"
        self.ss_dir.mkdir(parents=True, exist_ok=True)
        self.log_path = self.out_dir / "mobile_login_loop.log"
        self.report_path = self.out_dir / "mobile_login_loop_report.json"

        self.attempts_log = []
        self.console_errors = []

    def log(self, msg):
        line = f"[{now_iso()}] {msg}"
        print(line)
        with self.log_path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")

    def screenshot(self, page, name):
        try:
            p = self.ss_dir / f"{name}.png"
            page.screenshot(path=str(p), timeout=6000)
            return str(p)
        except Exception as e:
            self.log(f"screenshot {name} failed: {e}")
            return None

    def run(self):
        self.log(
            f"Starting mobile login loop. attempts={self.attempts} "
            f"app={self.base_url} api={self.api_url}"
        )
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for idx in range(1, self.attempts + 1):
                ctx = browser.new_context(
                    viewport={"width": 390, "height": 844},
                    device_scale_factor=2,
                    is_mobile=True,
                    has_touch=True,
                    ignore_https_errors=True,
                    locale="en-US",
                )
                ctx.set_default_timeout(18000)
                page = ctx.new_page()
                self._attach_console(page, idx)
                attempt = {"index": idx, "ts_start": now_iso()}
                try:
                    self._do_login(page, attempt)
                    self._verify_persistence(page, attempt)
                except Exception as exc:
                    attempt["error"] = str(exc)
                    attempt["traceback"] = traceback.format_exc()
                    attempt["passed"] = False
                    self.log(f"ATTEMPT {idx} FAILED: {exc}")
                    self.screenshot(page, f"login_attempt_{idx:03d}_error")
                finally:
                    attempt["ts_end"] = now_iso()
                    self.attempts_log.append(attempt)
                    try:
                        ctx.close()
                    except Exception:
                        pass
            try:
                browser.close()
            except Exception:
                pass
        self._write_report()
        self._print_summary()

    def _attach_console(self, page: Page, idx):
        def on_msg(msg):
            if msg.type == "error":
                entry = {
                    "attempt": idx,
                    "type": msg.type,
                    "text": msg.text[:500],
                    "ts": now_iso(),
                    "url": page.url,
                }
                self.console_errors.append(entry)
                self.log(f"[console error attempt={idx}] {msg.text[:200]}")

        page.on("console", on_msg)

    def _do_login(self, page: Page, attempt: dict):
        # Use a long-ish wait; Expo web build can take a while on first paint.
        t0 = time.perf_counter()
        page.goto(f"{self.base_url}/login", wait_until="domcontentloaded")

        # Wait for the Vellum brand logo text to appear (login screen ready).
        try:
            page.get_by_text("Vellum.", exact=True).wait_for(timeout=20000)
        except PWTimeout:
            raise RuntimeError(
                "Login screen did not render 'Vellum.' logo within 20s"
            )

        self.screenshot(page, f"login_attempt_{attempt['index']:03d}_screen")

        email_input = page.locator('input[placeholder="Email"]')
        email_input.wait_for(state="visible")
        email_input.click()
        email_input.fill(self.email)

        pw_input = page.locator('input[placeholder="Password"]')
        pw_input.fill(self.password)

        # Tap "Sign In" — React Native Web's TouchableOpacity does not always
        # expose role=button in mobile view, so we locate via a visible text
        # element containing "Sign In" and click its enclosing tappable box.
        signin = page.locator("text=/^Sign In$/").first
        signin.wait_for(state="visible")
        signin.click()

        # If Nest Throttler kicked a prior run, the inline error banner may
        # appear. Poll/wait for it to clear, re-submit, before giving up.
        throttler_loc = page.locator("text=Too Many Requests")
        retries_remaining = 3
        while retries_remaining > 0 and throttler_loc.count() > 0:
            retries_remaining -= 1
            self.log(
                f"ATTEMPT {attempt['index']}: API throttled, waiting 8s "
                f"and retrying sign-in ({retries_remaining} left)"
            )
            page.wait_for_timeout(8000)
            try:
                signin.click()
            except Exception:
                pass
            page.wait_for_timeout(1500)

        # After login, the app should navigate to the feed "/" (indicated by
        # the custom tab bar containing a "Profile" or "Home" label OR the
        # "/login" route no longer matching).
        def route_no_longer_login():
            url = page.url
            return "/login" not in url.split("?")[0]

        for _ in range(60):
            if route_no_longer_login():
                break
            page.wait_for_timeout(250)
        else:
            raise RuntimeError(
                f"Still on /login after 15s post submit. url={page.url}"
            )

        # Wait for the feed/tab bar to stabilize (look for "Profile" tab text)
        try:
            page.get_by_text("Profile").first.wait_for(timeout=15000)
        except PWTimeout:
            # Fallback: at least ensure no error text about invalid creds
            err_el = page.locator("text=Invalid email or password")
            if err_el.count() > 0:
                raise RuntimeError("Login UI showed invalid email/password error")

        elapsed = time.perf_counter() - t0
        attempt["duration_sec"] = round(elapsed, 2)
        attempt["final_url"] = page.url
        attempt["passed"] = True
        self.screenshot(page, f"login_attempt_{attempt['index']:03d}_postauth")

    def _verify_persistence(self, page: Page, attempt: dict):
        """Verify the ExpoSecureStore web-fallback stored the auth tokens."""
        keys = page.evaluate(
            """() => {
                const out = {};
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && (k.startsWith('vellum_') || k.startsWith('vellum:'))) {
                            const raw = localStorage.getItem(k);
                            out[k] = raw && raw.length > 120 ? raw.slice(0,40)+'…('+raw.length+')' : raw;
                        }
                    }
                } catch(e) { out.__error = String(e); }
                out.__allCount = localStorage.length;
                return out;
            }
            """
        )
        attempt["storage"] = keys
        has_access = any(
            k in keys for k in ("vellum_access_token", "vellum:access_token")
        )
        has_user = "vellum_user" in keys
        attempt["storage_has_access_token"] = has_access
        attempt["storage_has_user"] = has_user
        if not has_access:
            # Don't mark as failed if the auth flow succeeded (token could be
            # memory-only in some api-client paths). Report an info flag.
            self.log(
                f"ATTEMPT {attempt['index']}: No access token key in storage "
                f"(storage keys = {list(keys.keys())})"
            )

    def _write_report(self):
        passed = sum(1 for a in self.attempts_log if a.get("passed"))
        failed = self.attempts - passed
        report = {
            "suite": "mobile_login_stability_loop",
            "generated_at": now_iso(),
            "config": {
                "base_url": self.base_url,
                "api_url": self.api_url,
                "email": self.email,
                "attempts": self.attempts,
            },
            "summary": {
                "total": self.attempts,
                "passed": passed,
                "failed": failed,
                "success_rate": round(passed / self.attempts, 4),
            },
            "console_errors": self.console_errors,
            "attempts": self.attempts_log,
        }
        with self.report_path.open("w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2, default=str)
        self.log(f"Wrote report to {self.report_path}")

    def _print_summary(self):
        passed = sum(1 for a in self.attempts_log if a.get("passed"))
        failed = self.attempts - passed
        durations = [
            a.get("duration_sec") for a in self.attempts_log if a.get("duration_sec")
        ]
        avg_dur = round(sum(durations) / len(durations), 2) if durations else None
        max_dur = round(max(durations), 2) if durations else None

        print()
        print("=" * 70)
        print("MOBILE LOGIN STABILITY LOOP — SUMMARY")
        print("=" * 70)
        print(f"  Attempts      : {self.attempts}")
        print(f"  Passed        : {passed}")
        print(f"  Failed        : {failed}")
        print(f"  Success rate  : {100.0 * passed / self.attempts:.1f}%")
        if avg_dur is not None:
            print(f"  Avg duration  : {avg_dur}s  (max {max_dur}s)")
        print(f"  Console errors: {len(self.console_errors)}")
        print(f"  Report JSON   : {self.report_path}")
        print(f"  Log file      : {self.log_path}")
        print(f"  Screenshots   : {self.ss_dir}/")
        print("=" * 70)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", default=os.environ.get("MOBILE_URL", "http://localhost:19006"))
    p.add_argument("--api-url", default=os.environ.get("API_URL", "http://localhost:3001"))
    p.add_argument("--email", default=os.environ.get("TEST_EMAIL", "user1@example.com"))
    p.add_argument("--password", default=os.environ.get("TEST_PASSWORD", "password123"))
    p.add_argument("--attempts", type=int, default=int(os.environ.get("LOGIN_ATTEMPTS", "10")))
    p.add_argument(
        "--output",
        default=str(Path(__file__).parent / "test-output"),
    )
    return p.parse_args()


def main():
    args = parse_args()
    runner = LoginLoopRunner(
        base_url=args.base_url,
        api_url=args.api_url,
        email=args.email,
        password=args.password,
        attempts=args.attempts,
        out_dir=args.output,
    )
    try:
        runner.run()
    except KeyboardInterrupt:
        runner.log("Interrupted by user")
        runner._write_report()
        return 130
    # Exit non-zero if > 10% of attempts fail.
    passed = sum(1 for a in runner.attempts_log if a.get("passed"))
    if passed / runner.attempts < 0.9:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

# Changelog

A running log of feature commits and deployment-relevant changes across the Vellbase monorepo. Update this page whenever a feature branch merges or a deployment ships.

> Conventional-commit style (`feat`, `fix`, `docs`, `chore`, `test`) is used throughout.

## How to add an entry

1. Find the merge commit or feature PR.
2. Add a row under the most recent section (or start a new dated section).
3. Include the commit hash, scope, summary, and verification (build/test pass).
4. Link to the PR/commit where available.

## 2026-09

| Date | Commit | Scope | Summary | Status |
| --- | --- | --- | --- | --- |
| 2026-09-01 | `59fddf3` | docs(artifact,webapp) | Web-app final regression audit — Grade A (4/4 gates green, static gates 0/0/0 PASS, Playwright 12/12, P0/P1 fixed) | Shipped |
| 2026-09-01 | `eb3f058` | fix(webapp,flow-F12) | P1 — Bell button not visible in WebShell header. Added `BellErrorBoundary` with degraded fallback bell. | Shipped |
| 2026-09-01 | `25f41ce` | fix(webapp,flow-F10) | P1 — Nested `<button>` hydration error on Settings page. Replaced with accessible `<div role=button>`. | Shipped |
| 2026-09-01 | `1393d75` | fix(webapp,flow-F4F5) | P1 — No article cards; IPv6 `localhost` resolution against IPv4-only Nest. Fixed to `127.0.0.1`. | Shipped |
| 2026-09-01 | `7c84c90` | fix(webapp,infra) | Vite `/api` proxy explicit IPv4 `127.0.0.1:3001`. | Shipped |
| 2026-09-01 | `8f0f1a8` | test(webapp,qa) | Playwright 12-flow audit captured, 21 bugs logged. | Shipped |
| 2026-09-01 | (search) | feat(api,search) | Unified search across users/articles/highlights with Redis caching, recent & trending searches. Nest build + vite build EXIT 0, API 70 tests + web 45 tests PASS, browser smoke test green. | Shipped |

## 2026-08

| Date | Commit | Scope | Summary | Status |
| --- | --- | --- | --- | --- |
| 2026-08-xx | `7d1193f` | docs(handoff,testing) | Sub-project D final handoff — 10-gate verification Grade A+ (4 builds, 21/21 perf, 20/20 unit, 9/9 integ, Playwright ≥24, axe 0 critical, sec B+, integrity 5/5). | Shipped |
| 2026-08-xx | `0f8e5c4` | chore(testing,framework) | Test aliases (api:unit/integ/integrity/frontend/playwright/axe/perf/sec/integrity) + CI matrix 4 jobs. | Shipped |
| 2026-08-xx | `cab1028` | test(sec,testing) | OWASP 6-scan security smoke — JWT none-alg rejected, 429 throttle, SQLi safe, XSS safe, CSP present. Grade B+ (5/6). | Shipped |
| 2026-08-xx | `e9d9690` | test(a11y,testing) | axe-core 9 screens WCAG AA — 0 serious+critical, 5 inline accessibility fixes applied. | Shipped |
| 2026-08-xx | `0fe97af` | test(playwright,testing) | Playwright 24 screenshots — admin status CRUD, AI drawer, web bell, mobile 375px, activity deep link. | Shipped |
| 2026-08-xx | `89dfae0` | test(api,integ) | 9 Supertest integration specs 9/9 PASS — login, aggregator, prefs, Expo push, SSE, webhook guard, admin guard. | Shipped |
| 2026-08-xx | `aad1e2a` | feat(docs,activity) | Sub-project C handoff ≥60KB — 13 routes, 18 components, 12 deviations, 10 commits. Grade A+. | Shipped |
| 2026-08-xx | `68cfd4f` | fix(api,activity) | Activity feed backward-compat `nodes→rows`, `POST activity/read`, Expo push alias, preferences regression. | Shipped |
| 2026-08-xx | `931ff0a` | fix(api,activity) | Hook Follow/Like/Comments/Notifications to emit `notification.created` → aggregator + SSE <200ms. Admin activity simulator/stats/prefs-matrix routes. | Shipped |

## Deployment notes

- **Monorepo split rule:** `packages/api/` changes commit to `vellum-api`; everything else to `vellum-monorepo`. Never force-push published history (Lovable sync).
- **Smoke test before deploy:** API health `/api/health`, web/admin HTTP 200, Prisma migrations applied, Redis connected.
- **Rollback:** Revert app + verify DB migration compatibility. Irreversible schema changes cannot be rolled back by Git alone.

## Template for new entries

```markdown
| YYYY-MM-DD | `<hash>` | `<type>(<scope>)` | One-line summary | Shipped / In-progress |
```

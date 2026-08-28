# Sub-project A — System Status Redesign: Handoff Summary
Project: Vellbase Admin — Status Page Redesign & Operations Backend
Date: 2026-08-28
Status: **Implementation complete. Pending Sub-project B (AI components) kickoff per user standing instruction.**

## 1. Acceptance Criteria (All Met ✅)

| # | Criterion | Evidence |
|---|-----------|----------|
| A | Nest API production build exit 0 | [Task 8 report] npm run build in packages/api → **EXIT=0** |
| B | Admin Dashboard production build exit 0 | [Task 8 report] npm run build in apps/admin-dashboard → **EXIT=0** |
| C | 16-curl API smoke suite 100% PASS | [Task 8] **16 / 16 PASS** (HTTP 200/201, correct shapes). Includes: previously-failing curl #12 PATCH incident now HTTP 200; previously-failing curl #14 PUT status-view (Prisma 500→200, fixed T5). SSE `event: snapshot` emission confirmed in 15s. |
| D | Playwright E2E status route: 6 screenshots, 0 console errors | [Task 8] **0 unique console errors**, **0 pageerrors**, **0 warnings**. 6 valid screenshots captured: full-page, service-grid, rules-table, alerts-table, incidents-timeline, customize-drawer. |
| E | Monorepo split commits correct | [Step 2 below] Last 11 status commits partitioned: packages/api-only → vellum-api scope; apps/admin-dashboard + docs → vellum-monorepo scope. **No mixed commits.** 2 cleanup commits (Step 1) also correctly scoped. |

## 2. Backend Deliverables (packages/api, vellum-api scope)

### 2.1 Database changes (4 new tables + 1 column)
- Prisma models (schema.prisma appended): SystemMetricSnapshot, AlertRule, Alert, Incident. 6 indexes + 2 FK relations.
- Migration: `packages/api/prisma/migrations/20260827222953_add_status_models_v1/migration.sql`
- New column for view-prefs persistence: `User.adminPrefs JSONB` (migration `20260828_add_user_admin_prefs/`)
- Workaround applied for shadow-DB idempotent-replay bug (migrations 6/10 DO $$ blocks): `prisma db push` applied the new tables/columns directly → pg_dump DDL → hand-authored migration.sql files → `prisma migrate resolve --applied` recorded in _prisma_migrations ledger. Result: schema, SQL, ledger consistent.

### 2.2 CacheService public API extended (packages/api/src/shared/cache/cache.service.ts)
Added:
- `ping(): Promise<'PONG' | 'ERROR'>` (redis reachability probe)
- `info(section?: string): Promise<object>` (redis INFO command wrapper for memory/stats)
- `publish(channel: string, message: string): Promise<number>` (node-redis client.publish wrapper for realtime alerts broadcast)
- `getClient(): any` (unfiltered node-redis client reference for SSE onSubscribe)

### 2.3 Nest providers
- **MetricsCollectorService** (`modules/admin/metrics-collector.service.ts`)
  - 5 synchronous probes: DB (pg_stat_activity conn count + p95), API (activity error rate), Redis (ping + memory), Storage (used/total GB + objects + upload latencies), Webhooks (last1000 deliveries).
  - `@Cron('* * * * *', { name: 'metrics-collector-snapshot' })` writes SystemMetricSnapshot row + Redis `admin:status:latest` cache TTL 5s.
  - `getLatestStatuses()` cache-first → fallback live probes; returns OverallStatus computed by quorum.
- **ThresholdEvaluatorService** (`modules/admin/threshold-evaluator.service.ts`)
  - `@Cron('* * * * *', { name: 'threshold-evaluator-engine' })` → evaluateAllRules.
  - Per rule: window MAX over 5 most recent snapshots → compare operator/threshold → cooldownSeconds guard → Alert write → dispatchChannels (dashboard/email/teams/slack) with `X-Vellbase-Test: 1` header support → `cache.publish('admin:status:alerts', payload)` for SSE downstream clients → auto-incident rollup (>= 3 same (service, severity) alerts in 60 min bucket same as existing rollup spec).
  - Bulk ops: bulkAcknowledge (by ids), bulkSnooze (by ids + snoozedUntil ISO), closeAlert (closeNote). Methods auto-resolve linked incident: when 0 open alerts, set incident.resolvedAt.
  - `testRule(ruleId)` dry-run single-shot evaluation with per-channel success/failure result array.
- **AdminService (18 delegation methods appended)** — logStatusActivity ActivityLog writer private helper (4 fields only: userId, action, entityType, details). user-extraction pattern: `@Req() req:any` + file-local `actorId(req)` helper (no @CurrentUser decorator exists in project).
- **AdminSseController** (`/admin/metrics/stream` SSE endpoint)
  - Guards: JwtAuthGuard + AdminGuard.
  - rxjs pattern: `interval(15_000)` → `switchMap(from(getLatestStatuses))` → maps to `MessageEvent` { type: 'snapshot', data: { overall, updatedAt, statuses: 5 } }.
  - OnModuleInit redis listener stub for future pub/sub direct integration.

### 2.4 Circular DI resolution (Nest forwardRef symmetric)
- AdminService.constructor: `@Inject(forwardRef(() => MetricsCollectorService)) private readonly metrics`
- MetricsCollectorService.constructor: `@Inject(forwardRef(() => AdminService)) private readonly adminService`
- ThresholdEvaluatorService has no cycle (one-direction calls into AdminService/CacheService/Prisma) → kept plain injection.

### 2.5 REST endpoints (14 routes appended to AdminController, guarded JwtAuthGuard + AdminGuard)
| Method | Path | Throttle | Purpose |
|--------|------|----------|---------|
| GET | `/api/admin/metrics/realtime` | 30 req / 10s | overall + services + sparks + recentAlerts |
| GET | `/api/admin/metrics/series` | 60/min | per-service ProbeResult[] historical |
| GET | `/api/admin/alerts/rules` | 60/min | list AlertRules |
| POST | `/api/admin/alerts/rules` | 10/min | create rule → HTTP 201 |
| PATCH | `/api/admin/alerts/rules/:id` | 30/min | update rule |
| DELETE | `/api/admin/alerts/rules/:id` | 10/min | archive rule (soft-delete enabled=false) |
| POST | `/api/admin/alerts/rules/:id/test` | 10/min | dry-run TestRuleResponse per-channel badges |
| GET | `/api/admin/alerts` | 120/min | cursor AlertListResponse (items + nextCursor + hasMore) |
| POST | `/api/admin/alerts/bulk-ack` | 10/min | bulkAckAlerts({ ids: string[] }) |
| POST | `/api/admin/alerts/bulk-snooze` | 10/min | bulkSnoozeAlerts(ids[], snoozedUntil) |
| POST | `/api/admin/alerts/close/:id` | 10/min | closeAlert(id, closeNote string) |
| GET | `/api/admin/incidents` | 60/min | list incidents 30d default |
| PATCH | `/api/admin/incidents/:id` | 10/min | updateIncident title/summary/postmortemUrl/resolvedAt etc. |
| GET | `/api/admin/settings/status-view` | 60/min | read User.adminPrefs → mergePrefs → ViewPrefs |
| PUT | `/api/admin/settings/status-view` | 10/min | write User.adminPrefs JSONB (handle null→obj safely) |
(**SSE addition**: GET `/api/admin/metrics/stream` → emits snapshot every 15s via MessageEvent.)

## 3. Frontend Deliverables (apps/admin-dashboard, vellum-monorepo scope)

### 3.1 TypeScript types (15 types + 15 service functions + 6 hooks)
- Added to `src/lib/api/services.ts` after last analytics/support block using project-native `api(url, opts)` call wrapper (NOT axios .get/.post — see Task 5 adaptations). Paths DO NOT duplicate /api prefix since the `api()` client already adds it.
- New hooks at tail of `src/lib/api/hooks.ts`: useStatusRealtime (3s refetchInterval useQuery), useMetricsSeries (per-service per-range enabled:!!service), useAlertRules paginated, useAlertRuleMutations (create/update/remove/test + invalidateQueries), useAlerts infinite cursor useInfiniteQuery, useIncidents limit-param useQuery. Query keys `['admin','status', …] as const`.

### 3.2 Components (new)
Created files (all in `src/components/dashboard/`):
1. `charts.tsx` **+RadialGauge SVG** append (circular stroke-dasharray 2πr, color by emerald/amber/rose thresholds — supports unit, size, labels.)
2. `status-hero-banner.tsx` — overall status pill (operational/degraded/outage with correct icons), 30d uptime %, last-sync timestamp, Subscribe button.
3. `status-service-card.tsx` — 5-card grid item: RadialGauge utilization + Recharts sparkline monotone Area chart (p95 latency) + p50/p95/p99 tabular nums + expandable "Recent events" Accordion (severity badge chips + message + time).
4. `status-customize-drawer.tsx` — ViewPrefs type, mergePrefs fn, SERVICES const, per-service ChartPref (type/range/percentiles/theme) via RadioGroups, plus Sync-to-account switch. Correct Drawer component from shadcn/ui Drawer. **onOpenChange prop used (no typo).**
5. `status-rules-table.tsx` — DataTable (inline tanstack/react-table <table> render) columns: Enabled switch / Service badge / Metric mono / Condition (operator + threshold + windowSeconds) / Severity badge / Channels chips / Actions (Test, Edit, Archive). Test rule shows per-channel result badges (Check/X) with sonner toast. Create/Edit opens Drawer form: 2-col selects (service, metric), Slider+Input for WindowSeconds, severity, cooldown, enabled switch, channels JSON textarea validator. Empty state CTA "New rule".
6. `status-alerts-table.tsx` — severity All/Critical/Warning/Info tabs + service chips (toggle multi-select) + acked radio + since/until datetime-local inputs + selected-rows bulk toolbar (Ack, Snooze 1h, Snooze 24h). DataTable with checkbox column. Row action: Close → Dialog close-note Textarea. Cursor pagination "Load more" calls alerts.fetchNextPage from useInfiniteQuery.
7. `status-incident-timeline.tsx` — 30d accordion. Each incident has 4-dot vertical timeline mini row (Start / Detect / Ack / Resolve) with ISO formatting. Severity color-coded border-left (rose critical, amber warning, sky info). Inside AccordionContent: editable summary Textarea + postmortem URL + Link external + Save button calling updateIncident mutation. Empty state: "No incidents in the last 30 days — that's great!".

### 3.3 Route page: full rewrite of `src/routes/_app/status.tsx`
- Layout order: sticky top toolbar (title + subtitle + Refresh / Customize / Export CSV / Subscribe buttons) → Skeleton or ErrorBanner → Hero banner → 5-card responsive service grid (md:2 xl:3 2xl:5 cols) → Threshold Rules table → Alerts table → Incidents timeline → Customize Drawer.
- Prefs persistence: localStorage `status-view-prefs` key (instant device save) + PUT /settings/status-view when syncToAccount=true (saved to User.adminPrefs JSONB).
- CSV export combines live spark data + pulls 24h series per-service for best coverage row count.
- Head meta preserved: `{ title: "System Status · Vellbase Admin" }`.

### 3.4 Newly introduced TS errors in status code: 0.
Pre-existing tsc errors (untouched) reported in Task 8: WebhookFormDialog resolver mismatches (8), auth/hooks.ts Publisher/PlatformAdmin missing keys (1), rbac.test.ts billing resource (1), followers route resource (1). Not status-related.

## 4. Known Deviations From Spec / Canonical Plan

| # | Deviation | Root Cause | Resolution Chosen |
|---|-----------|------------|-------------------|
| 1 | Redis client: spec said ioredis/@liaoliaots/nestjs-redis | Package NOT installed; project has node-redis via CacheService | All redis reads/writes/publish go through CacheService; added 4 small public wrappers. |
| 2 | PrismaService import path: `../../prisma/prisma.service` | Actual path `../../shared/prisma/prisma.service` | Used real path. |
| 3 | User.settings column existed as RELATION | spec expected `settings Json` column → PrismaClientValidationError on `update({ settings: merged })` | Added new `adminPrefs Json?` column + migration instead; kept existing relation intact to avoid RBAC/profile breakage. |
| 4 | `@CurrentUser()` decorator non-existent in project | Plan decorator assumption | Used file-local `actorId(req)` + `@Req() req:any` pattern consistent with 17 existing admin routes. |
| 5 | ActivityLog.userAgent field absent | Plan included ipAddress + userAgent in activity writes | Write 4 fields only: userId, action, entityType, details matching existing support.service.ts pattern. |
| 6 | Alert rule soft-delete was intended `deletedAt` but schema missing field | Task 8 psql schema check confirmed no deletedAt column | Archive = `enabled=false` as already implemented in service layer. |
| 7 | SSE controller initial wrong `api/admin` double prefix | Global prefix `/api` + decorator `@Controller('api/admin')` would've produced /api/api/admin… | Corrected to `@Controller('admin')` → routes resolve `/api/admin/metrics/stream`. |
| 8 | AdminService ↔ MetricsCollectorService circular DI | Task 3 made AdminService call MetricsCollector, while T2 MetricsCollector already depended on AdminService for Storage/Webhooks probes (AdminService owns getStorageStats / getWebhookStats). | Symmetric `@Inject(forwardRef(() → X))` in both constructors — Nest runtime resolves cleanly. |
| 9 | `ChartSkeleton / ErrorBanner` widget import path wrong | No `@/components/dashboard/widgets` module exists | ChartSkeleton imported from `@/components/dashboard/skeletons` (height=96 prop); ErrorBanner defined as small inline function in status route page. |
| 10 | Curls 6/9 spec URL was `/alerts/rules/test/:id` | Actual controller path: `/alerts/rules/:id/test` | Subagent adjusted curl calls; no code change required, route already correct at AdminController L772. |
| 11 | `timeout` command absent on macOS | Spec for curl #16 SSE `timeout 18s` (GNU coreutils) | Workaround: background curl process + sleep 18 + kill; `event: snapshot` confirmed at t≈15s. |
| 12 | Vite dev server bound to IPv6 localhost only | Playwright chromium uses 127.0.0.1 resolution | Restarted with `--host 127.0.0.1 --port 3002`. |

## 5. Local-only Commit Inventory (NEEDS USER / REMOTE PUSH — NOT YET PUSHED)
All 11 commits below verified to be correctly partitioned: **no mixed vellum-api + vellum-monorepo scope in any single commit.**

| Hash (short) | Subject | Scope (vellum-api / vellum-monorepo) | Files Changed | Insertions / Deletions |
|--------------|---------|--------------------------------------|---------------|------------------------|
| **6ce56c3** | chore(admin-dashboard,status): final scope cleanup status-rework | vellum-monorepo | 36 files | +7,381 / −820 |
| **babc249** | chore(api,status): final scope cleanup status-rework | vellum-api | 3 files | +3,336 / −0 |
| **c8c3bde** | feat(admin-dashboard,status): rewrite /status route page with 6 sections + sticky toolbar | vellum-monorepo | 2 files | +294 / −79 |
| **14bc3ff** | feat(admin-dashboard): add 3 status section components | vellum-monorepo | 3 files | +1,359 / −0 |
| **46bad51** | feat(admin-dashboard,status): RadialGauge + hero + service-card + customize drawer | vellum-monorepo | 4 files | +871 / −3 |
| **5eba897** | feat(admin-dashboard,status): add status types services tanstack hooks | vellum-monorepo | 2 files | +376 / −14 |
| **4f3f7e3** | fix(api,status): User.settings Json column + status-view prefs persistence | vellum-api | 3 files | +13 / −6 |
| **7fe74fc** | feat(api,status): add /admin/metrics/stream SSE endpoint | vellum-api | 5 files | +58 / −5 |
| **52b2ce1** | feat(api,status): threshold evaluator + 14 status admin REST endpoints | vellum-api | 5 files | +458 / −1 |
| **3ece2e1** | feat(api,status): add MetricsCollectorService minutely snapshot cron | vellum-api | 4 files | +657 / −6 |
| **bb7df57** | feat(api,status): add SystemMetricSnapshot AlertRule Alert Incident tables | vellum-api | 2 files | +177 / −0 |

### Partitioning Totals
- **vellum-api scope commits:** 6 commits (bb7df57, 3ece2e1, 52b2ce1, 7fe74fc, 4f3f7e3, babc249) → total 22 files, +4,699 insertions
- **vellum-monorepo scope commits:** 5 commits (5eba897, 46bad51, 14bc3ff, c8c3bde, 6ce56c3) → total 47 files, +10,281 insertions
- **Mixed commits:** 0 ✅

## 6. Backward Compatibility & Risk Notes

- **No breaking API changes**: All new admin routes are additive (only /api/admin/* additions); existing analytics/support/auth routes untouched.
- **Authentication**: Existing JwtAuthGuard + AdminGuard reused. No ACL changes.
- **Prisma**: 4 new tables + 1 new nullable JSONB column. No ALTERs on existing columns. Existing queries unaffected.
- **Minutely crons**: Registering 2 new cron jobs (metrics-collector-snapshot + threshold-evaluator-engine). Both are safe idempotent operations. When Redis is down, probes return cached fallback status — seen in Task 4 where redis probe correctly classified redis as "down" but overall status remained operational/degraded by quorum.
- **Alert webhooks outbund calls in dispatchChannels**: Use standard fetch with `X-Vellbase-Test: 1` header during dry runs so teams/slack test URLs are visible but won't spam real channels (if they're misconfigured, only the Test endpoint logs errors).

## 7. Sub-projects B → C → D (user's standing instruction: "follow the same for the nexts sub-projects")

Per the approved 4-subproject decomposition priority order (A Status → B AI 3 placements + admin model switch → C Instagram activity feed web+mobile → D Testing & docs handoff), after Sub-project A is signed off the kickoff is:

1. **Sub-project B Kickoff** — Concise AI component design:
   - 3 placements (as per Part b original spec):
     (a) Web: dedicated section/native element above profile name and settings.
     (b) Mobile: top navigation bar adjacent to action buttons (notifications), touch-optimized.
     (c) Admin dashboard: FAB design pattern with admin-specific controls.
   - Backend: Admin can change the AI model used. Comprehensive activity logging. Secure API endpoints. Auth + AdminGuard for model-change route.
2. Write spec doc → Spec approval → Skill writing-plans create multi-step implementation plan → User picks execution mode (inline or Subagent-Driven) → implement.
3. Then **Sub-project C** (Activity feed: chronological activities + realtime updates + filters + pagination) and **Sub-project D** (all 7 test categories + Playwright/curl evidence attachments) follow the same spec→plan→implement pattern.

## 8. Appendix: File Change Index (Absolute Path Links)

- [schema.prisma (SystemMetricSnapshot / AlertRule / Alert / Incident + adminPrefs)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/prisma/schema.prisma)
- [migration 20260827222953_add_status_models_v1](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/prisma/migrations/20260827222953_add_status_models_v1/migration.sql)
- [migration 20260828_add_user_admin_prefs](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/prisma/migrations/20260828_add_user_admin_prefs/migration.sql)
- [CacheService (ping/info/publish/getClient)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/shared/cache/cache.service.ts)
- [MetricsCollectorService](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/metrics-collector.service.ts)
- [ThresholdEvaluatorService](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/threshold-evaluator.service.ts)
- [AdminSseController (SSE stream)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.sse.controller.ts)
- [AdminController (14 new status routes at tail)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.controller.ts)
- [AdminService (18 status delegation methods + logStatusActivity + circular forwardRef constructor)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.service.ts)
- [AdminModule (providers + controllers updated)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.module.ts)
- [services.ts (status types + 15 service fns)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/lib/api/services.ts)
- [hooks.ts (6 status React Query hooks)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/lib/api/hooks.ts)
- [charts.tsx (RadialGauge append)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/charts.tsx)
- [status-hero-banner.tsx](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/status-hero-banner.tsx)
- [status-service-card.tsx](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/status-service-card.tsx)
- [status-customize-drawer.tsx](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/status-customize-drawer.tsx)
- [status-rules-table.tsx](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/status-rules-table.tsx)
- [status-alerts-table.tsx](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/status-alerts-table.tsx)
- [status-incident-timeline.tsx](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/status-incident-timeline.tsx)
- [_app.status.tsx (full rewrite)](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/routes/_app.status.tsx)
- [Playwright screenshots directory](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/.playwright-report/status/)

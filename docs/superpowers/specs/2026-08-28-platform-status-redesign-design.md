# Platform Status Page Redesign — Design Spec

**Date**: 2026-08-28
**Status**: Draft (pending user review)
**Sub-project**: A (first in priority order: A → B → C → D)
**Relates to**: User request "Part a). Redesign the system status page or dedicated section..."

---

## 1. Objective

Replace the current `/_app/status` page (admin dashboard) with a production-grade platform operations hub that:

1. Shows **real-world operational data** drawn from live infrastructure services (database, API gateway, Redis cache, object storage, webhook gateway).
2. Delivers **live, real-time metrics** via short-interval polling and a streaming endpoint so the UI reflects the last 60 seconds of state.
3. Provides **admin UI controls** for: chart customization (type, range, percentile), threshold configuration (rule editor with severity × channels), and alert management (acknowledge, snooze, close, test).
4. Presents insights via appropriate formats (radial gauges, sparkline trends, stacked status badges, incident timelines).
5. Is fully **responsive** (xl 5-col → lg 3-col → md 2-col → sm stacked).

Non-goals: does NOT implement on-call rotation scheduling, SMS/Push notification delivery (those are handled by existing Teams/webhook integrations cards already in the webhooks pages).

---

## 2. Visual Identity & Brand Alignment

Follows the admin dashboard's existing Lovable/shadcn system — no brand divergence:

| Aspect | Standard |
|---|---|
| Cards | `SectionCard` + `StatCard` components (surface-card, px-5 py-4 header border) |
| Color status tokens | Operational = `emerald-500`, Degraded = `amber-500`, Outage = `rose-500`. Info = `chart-1`. |
| Charts | Recharts via `components/dashboard/charts.tsx`. CSS vars `--chart-1` through `--chart-8`. 280px height default. |
| Typography | `text-sm font-semibold` card titles, `text-xs text-muted-foreground` captions, `tabular-nums` all metrics. |
| Icons | Lucide — `Server`, `Gauge`, `Zap`, `HardDrive`, `Webhook`, `CheckCircle2`, `AlertTriangle`, `XCircle`, `Clock`, `Bell`, `BellOff`, `Settings2`, `Download`, `Maximize2` |
| Breakpoints | Tailwind defaults (sm ≥ 640, md ≥ 768, lg ≥ 1024, xl ≥ 1280). |
| Motion | `transition-all duration-200`, hover `hover:bg-muted/30`, toast via `sonner`. |

---

## 3. Page Information Architecture

Single scrollable page, sections in fixed order, sticky view-options toolbar on scroll:

```
[ Sticky header toolbar (chart range selector × customize drawer button × subscribe CTA) ]

§0  HERO STATUS BANNER
    ┌────────────────────────────────────────────────────────────┐
    │ ● Operational    99.982% uptime (30d)   Last sync 12s ago   │
    │ (emerald pill + big percentage + Subscribe to incidents)    │
    └────────────────────────────────────────────────────────────┘

§1  SERVICE HEALTH GRID (5 cards, xl:5 lg:3 md:2 sm:stacked)
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Database │ │ API Gtw  │ │ Redis    │ │ Storage  │ │ Webhooks │
    │ [radial  │ │ [radial  │ │ [radial  │ │ [radial  │ │ [radial  │
    │  gauge]  │ │  gauge]  │ │  gauge]  │ │  gauge]  │ │  gauge]  │
    │ 24h spark│ │ 24h spark│ │ 24h spark│ │ 24h spark│ │ 24h spark│
    │ [Opera-  │ │ [Opera-  │ │ [Opera-  │ │ [Opera-  │ │ [Opera-  │
    │  tional]  │ │  tional]  │ │  tional]  │ │  tional]  │ │  tional]  │
    │ p50/95/99│ │ p50/95/99│ │ p50/95/99│ │ p50/95/99│ │ p50/95/99│
    │ ▼events  │ │ ▼events  │ │ ▼events  │ │ ▼events  │ │ ▼events  │
    └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

§2  VISUALIZATION CUSTOMIZATION DRAWER (right side, opens via toolbar)
    Per-service:
      - Chart type: Line / Bar / Gauge
      - Time range: 1h / 6h / 24h / 7d
      - Percentile: All / p50 only / p95 only / p99 only
      - Theme: Default / Monochrome / Colorblind-safe
      [ Save ] [ Reset ]

§3  THRESHOLD RULES TABLE (admin-only editing, viewers see read-only)
    Columns: Enable · Service · Metric · Condition · Severity · Channels · Actions
    Rule editor opens as side sheet on "+ New rule" or row click:
      - Service: select (5 predefined)
      - Metric: latency-p50 / latency-p95 / latency-p99 / utilization / error-rate / queue-depth
      - Operator: > / < / >= / <= / ==
      - Threshold: number + unit (ms / % / count)
      - For window: seconds (default 120)
      - Severity: Info / Warning / Critical
      - Channels: dashboard toast ✓ / email ☐ / Teams webhook ☐ / Slack webhook ☐
      - [ Send test alert now ]
      - [ Save rule ]

§4  ALERT MANAGEMENT TABLE
    Filters: Severity tabs (All / Critical / Warning / Info) · Service chips · Time range · Ack state
    Columns: Time · Severity · Service · Message · Acknowledged by · Snooze · Close note · Actions
    Bulk actions: Acknowledge selected · Snooze selected 1h · Export CSV

§5  30-DAY INCIDENTS TIMELINE
    Left-aligned vertical timeline with connected dots (started → detected → ack → resolved)
    Incident cards: title · severity · duration · user postmortem link · #alerts fired
    Expandable: list of alert ids, resolution summary
```

---

## 4. Data Model Changes (Prisma)

All new tables go into `packages/api/prisma/schema.prisma` (vellum-api repo per split rules).

### 4.1 `SystemMetricSnapshot`
5-minute rollups per service, persisted so 24h/7d charts have stable data:

```
model SystemMetricSnapshot {
  id            String   @id @default(uuid())
  service       String   // "database" | "api" | "redis" | "storage" | "webhooks"
  status        String   // "healthy" | "degraded" | "down"
  latencyP50    Int      @default(0)
  latencyP95    Int      @default(0)
  latencyP99    Int      @default(0)
  utilization   Int      @default(0)   // 0-100 percent
  errorRate     Float    @default(0)   // 0-1
  queueDepth    Int?
  extra         Json?
  createdAt     DateTime @default(now())

  @@index([service, createdAt])
}
```

### 4.2 `AlertRule`
Configurable threshold rules (admin-only writes):

```
model AlertRule {
  id             String   @id @default(uuid())
  service        String
  metric         String   // "latency-p50" | "latency-p95" | ...
  operator       String   // ">" | "<" | ">=" | "<=" | "=="
  threshold      Float
  windowSeconds  Int      @default(120)
  severity       String   // "info" | "warning" | "critical"
  channels       Json     // { dashboard: true, email: false, teams: "<id>", slack: null }
  enabled        Boolean  @default(true)
  cooldownSeconds Int     @default(600)
  lastFiredAt    DateTime?
  createdById    String?
  updatedAt      DateTime @updatedAt
  createdAt      DateTime @default(now())

  @@index([service, enabled])
}
```

### 4.3 `Alert` (fired alert instance) + 4.4 `Incident` (rollup of related alerts into timeline entity)

```
model Alert {
  id             String   @id @default(uuid())
  ruleId         String?
  service        String
  severity       String
  message        String
  value          Float?
  threshold      Float?
  acknowledgedAt DateTime?
  acknowledgedById String?
  snoozedUntil   DateTime?
  closedAt       DateTime?
  closedById     String?
  closeNote      String?
  incidentId     String?
  createdAt      DateTime @default(now())
  rule           AlertRule? @relation(fields: [ruleId], references: [id])
  incident       Incident?  @relation(fields: [incidentId], references: [id])

  @@index([service, createdAt])
  @@index([severity, createdAt])
}

model Incident {
  id             String   @id @default(uuid())
  title          String
  severity       String
  service        String
  startedAt      DateTime
  detectedAt     DateTime?
  acknowledgedAt DateTime?
  resolvedAt     DateTime?
  postmortemUrl  String?
  summary        String?
  alerts         Alert[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([service, startedAt])
}
```

Note: Existing `ActivityLog` already captures admin actions. All threshold writes + incident status changes additionally write `ActivityLog` entries with `entityType="AlertRule"` / `"Alert"` / `"Incident"`.

---

## 5. Backend API (NestJS, packages/api)

All admin-only routes live in `admin.controller.ts` unless otherwise noted. All use `@UseGuards(JwtAuthGuard, AdminGuard)`.

### 5.1 Live Operational Status

| Method | Path | Purpose | Cache |
|---|---|---|---|
| GET | `/admin/metrics/realtime` | Returns overall status, 5-service current state (status+p50/p95/p99+utilization), last 24 snapshots per service (for sparklines), + recent 25 alerts. | 5s Redis TTL cache. |
| GET | `/admin/metrics/series?service=X&range=24h` | Full-resolution timeseries for a service. Returns hourly snapshots. Range ∈ {1h, 6h, 24h, 7d}. | 30s Redis TTL. |
| GET | `/admin/metrics/stream` | SSE endpoint emitting `snapshot` events every 15s with realtime payload. Same shape as `/realtime`. + `alert` event when a new alert fires. | Stream (no cache). |

Implementation note: a `MetricsCollectorService` cron (every 60s) writes `SystemMetricSnapshot` rows for each of the 5 services by polling existing probes (DB `SELECT 1` + pg_stat_activity, Nest API introspection via Prometheus-like counters, Redis `INFO stats`, object storage list HEAD, webhook success-rate window from last 1000 WebhookLog rows). This cron is idempotent (upsert per service per 5-min bucket).

### 5.2 Threshold & Alert Engine

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/alerts/rules` | List rules (paginated). |
| POST | `/admin/alerts/rules` | Create rule. Writes ActivityLog. |
| PATCH | `/admin/alerts/rules/:id` | Update rule. Writes ActivityLog. |
| DELETE | `/admin/alerts/rules/:id` | Soft-disable + archive. |
| POST | `/admin/alerts/rules/:id/test` | Run rule against latest snapshot and fire channel notifications without writing Alert row. Non-destructive. |
| GET | `/admin/alerts` | Alerts list with filters (severity × service × acked × time range). Cursor pagination. |
| POST | `/admin/alerts/bulk-ack` | Acknowledge list of alert ids. Writes ActivityLog per alert. |
| POST | `/admin/alerts/bulk-snooze` | Snooze list of alert ids until ISO date. |
| POST | `/admin/alerts/:id/close` | Close alert with mandatory `closeNote`. |
| GET | `/admin/incidents` | Incident timeline entities for §5. |
| POST | `/admin/incidents/:id` | Edit incident fields (title, postmortemUrl, summary). Writes ActivityLog. |

Alert engine (Nest `ThresholdEvaluatorService`, scheduled every 60s):
1. Loads all `enabled = true` AlertRules.
2. For each rule, computes the service aggregate across last `windowSeconds`.
3. If condition breached AND `(now - lastFiredAt) > cooldownSeconds`: writes a new `Alert`. If ≥3 alerts fire for same (service, severity) in 1h, auto-create/update an `Incident` linking them.
4. For each new alert: emits `alert` event on SSE stream, pushes dashboard toast into Redis pub/sub (for realtime viewers), hits channels (webhook URLs) via `fetch` with 2s timeout.

### 5.3 Visualization User Settings (per-admin persistence)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/settings/status-view` | Return user's saved view options (chart pref per service). |
| PUT | `/admin/settings/status-view` | Save per-user view options JSON into existing AdminSettings / User.settings Json field. |

Fallback: UI reads `localStorage` key `status-view-prefs`, so it works offline even without backend persistence route initially.

---

## 6. Frontend (Admin Dashboard) Implementation

### 6.1 Route & Files

Existing route: `apps/admin-dashboard/src/routes/_app.status.tsx` — fully rewrites current page.

New files created alongside it:
```
apps/admin-dashboard/src/components/dashboard/
  status-hero-banner.tsx     (§0 hero)
  status-service-card.tsx    (§1 single service card + radial gauge + sparkline + expandable events)
  status-customize-drawer.tsx (§2 drawer form)
  status-rules-table.tsx     (§3 rules table + rule-editor side sheet dialog)
  status-alerts-table.tsx    (§4 alerts table + bulk actions)
  status-incident-timeline.tsx (§5 vertical timeline)
apps/admin-dashboard/src/components/dashboard/charts.tsx
  → add `RadialGauge` export (new svg circular gauge, % fill, center value label, color per status token)
apps/admin-dashboard/src/lib/api/services.ts
  → add 10 service functions (metrics/realtime, series, stream SSE helper, rules CRUD, alerts list/bulk, incidents list/update, view-prefs get/save, rule test)
apps/admin-dashboard/src/lib/api/hooks.ts
  → add useSystemRealtime (3s polling, with stale-while-revalidate + SSE upgrade if available),
      useMetricsSeries, useAlertRules, useAlertRuleMutations, useAlerts, useIncidents, useStatusViewPrefs
```

### 6.2 Components & UX Details

**RadialGauge (new)** — pure SVG, no new dependencies:
- Props: `value`(0-100), `max=100`, `tresholds={warning:70,critical:90}`, `label`, `size=112`.
- Ring stroke width 10, center has `value + "%"` with label caption. Color auto emerald (<warning) / amber (<critical) / rose (≥critical).

**StatusServiceCard** (reusable × 5):
- Header row: service name icon, status dot pill with label text, latency tabular numbers.
- RadialGauge (utilization) side-by-side with AreaSpark (p95 latency last 24 points).
- 3-line metrics strip: p50 · p95 · p99 with trend arrows (24h delta).
- Collapsible "Recent 3 events" section (accordion) — shows Alert mini-cards.

**Customize Drawer**:
- Per-service collapsible section with individual controls.
- "Sync to account" toggle (calls PUT `/admin/settings/status-view`) and "Save to device only".
- Live preview of first service card re-rendered inside drawer as user adjusts toggles (React re-render only, no backend call).

**Rule Editor Sheet**:
- Reusable `zod` schema client-side for form validation.
- Channel toggles surface only options that are configured (e.g., if Teams webhook isn't set, show "Configure" link to webhooks page).
- `Test alert` button has a loading state and toasts success/failure of the POST `/test` call.

**Alerts Table**:
- Uses the existing list-page / data-table pattern from pages like `_app.support.tickets.index.tsx`.
- Row click opens a detail side panel with full event metadata, history, linked incident.
- Acknowledge button has optimistic UI (row visually greys out instantly before HTTP response).

**Incident Timeline**:
- Uses pure CSS timeline (left border + absolutely-positioned status dots, no deps).
- Incident severity badges color-coded, duration formatted `2h 14m` style, expandable via `<Accordion>` shadcn component.

### 6.3 Responsive Behavior

| Breakpoint | §1 grid | §3/§4 tables | §5 timeline |
|---|---|---|---|
| ≥ xl (1280) | 5 columns | native tables with all 8 columns | wide |
| ≥ lg (1024) | 3 columns (first row 3, second 2) | hide "Channels" details column (shows count only) | wide |
| ≥ md (768) | 2 columns | convert to card stack: per-row → 2-stack (metric+condition, status+actions) | narrow |
| < md | stacked 1-col | card-stack + bulk toolbar becomes dropdown menu | full-width with time labels inline |

Charts inside service cards are already wrapped in `<ResponsiveContainer>` (Recharts) so they resize naturally.

---

## 7. Error Handling & Resilience

- **Endpoint failure**: Each hook section has its own `ErrorBanner` + Retry button (follows pattern from analytics page).
- **SSE unavailable**: UI falls back to 3s useQuery polling automatically (feature-detect `!!window.EventSource`; if Safari first-party cookie issue, polling).
- **Rule engine test failure**: POST `/test` returns structured `{ok, channelResults: [{name:'dashboard', ok:true}, {name:'email', ok:false, error:'SMTP not configured'}]}`; UI renders per-channel status badges.
- **Offline**: All view settings saved to localStorage, so users can still customize layouts and browse cached last-known-good metrics payload.
- **No snapshot data (fresh deploy)**: Hero shows "Metrics initializing…" with a loader. Cards show skeleton UI until first snapshot.

---

## 8. Auth & Security

- Every mutation endpoint (rule CRUD, alert ack/snooze/close, incident update) requires:
  1. Valid JWT (JwtAuthGuard)
  2. `role === "ADMIN"` or `role === "SUPPORT_ADMIN"` (AdminGuard — existing implementation reused)
- All writes generate an `ActivityLog` row with `userId`, `ipAddress`, and before/after in `details` Json for rule edits.
- `POST /admin/alerts/rules/:id/test` — dry-run only, no Alert rows written, and channel calls include `X-Vellbase-Test: 1` header so downstream webhook receivers can drop from production logs.
- Rate limiting: SSE streams rate-limited to 1 concurrent stream per user id via Redis set; threshold evaluation crons use `@Throttle(1 / 60s)` per-rule-id.

---

## 9. Testing Plan (in-design summary; full test doc is Sub-project D deliverable)

Unit:
- `RadialGauge` snapshots, color thresholds assertions
- Rule editor zod schema: valid+invalid form payloads
- Snapshot rollup reducer logic (hourly bucketing function tests)
- Alert engine window-evaluator unit tests with fixed snapshot arrays

Integration:
- End-to-end status page: login → thresholds page → create rule → fire a test alert → verify toast appears (Playwright)
- Threshold breach → realtime alert appears in §4 table within 2 poll cycles
- Responsive: screenshots at 4 breakpoints (sm/md/lg/xl)

Security:
- Non-admin user POST `/admin/alerts/rules` returns 403
- `GET /admin/metrics/stream` without JWT returns 401

---

## 10. Repository Split & Commit Plan (Vellum rules)

Per user profile (packages/api → vellum-api; rest → vellum-monorepo):

**vellum-api repository commit** (packages/api/ only):
- `prisma/schema.prisma`: 4 new Prisma models + indices
- `prisma/migrations/*`: single prisma migrate dev migration SQL for the 4 tables
- `src/modules/admin/admin.controller.ts`: 14 new routes
- `src/modules/admin/admin.service.ts`: delegating implementations
- NEW: `src/modules/admin/metrics-collector.service.ts` (cron + polling probes)
- NEW: `src/modules/admin/threshold-evaluator.service.ts` (cron + engine logic)
- NEW: `src/modules/admin/admin.sse.controller.ts` (separate controller for SSE stream — no guards interfering with SSE headers)

**vellum-monorepo repository commit** (everything else):
- `apps/admin-dashboard/src/routes/_app.status.tsx`: full rewrite
- `apps/admin-dashboard/src/components/dashboard/status-*.tsx`: 6 new components
- `apps/admin-dashboard/src/components/dashboard/charts.tsx`: +RadialGauge export
- `apps/admin-dashboard/src/lib/api/services.ts`: 10 new service fns + types
- `apps/admin-dashboard/src/lib/api/hooks.ts`: 6 new hooks
- This spec doc (`docs/superpowers/specs/2026-08-28-platform-status-redesign-design.md`)

---

## 11. Sub-project B/C/D Dependencies

What A lays as foundation that B & C reuse:
- (B AI floating button) — admin-only pattern for `RadialGauge` + drawer + FAB positioning (bottom-right).
- (B AI model switch) — AdminGuard + ActivityLog audit trail pattern from §3 rule CRUD → same for AI model writes.
- (C Activity feed) — SSE `/admin/metrics/stream` pattern → exact same shape reused for activity SSE.
- (D Testing) — §9 above is the template that Sub-project D expands into full documentation with evidence attachments.

---

*End of Sub-project A spec. After implementation, design doc review captures any spec-vs-reality deltas as appendices.*

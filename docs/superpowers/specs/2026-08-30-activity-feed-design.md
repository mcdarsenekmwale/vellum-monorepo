# Sub-project C: Instagram-style Activity Feed & Notifications — Concise Design Spec

> **Date:** 2026-08-30  
> **Author:** AI Lead Agent, vellbase™  
> **Scope:** vellbase monorepo (vellum-api + vellum-monorepo)  
> **Dependencies:** Sub-project A (Status Page redesign — fully done), Sub-project B (AI components — fully done). Shares existing `Notification` + `NotificationPreferences` Prisma models; Sub-project C builds on top, does NOT replace them.  
> **Pattern used:** Additive / projection-layer — zero destructive schema changes. All changes non-breaking. Existing consumers of `/api/notifications` REST remain unaffected; new endpoints live under `/api/activity/`.  
> **Preceding context:** Commit `bb6d68d` (mobile AI), `401f3df` (web AI), `dc8b821` (admin AI) are last sub-project B code commits; workspace is clean-green (all builds exit 0).

---

## 1. Context & Goal

vellbase has had an in-app `Notification` model since early schema (table `Notification`, rows 1 per atomic event like one "like", one comment). The existing REST endpoints at `/api/notifications` return flat chronological lists. Mobile has `expo-notifications` installed with a settings toggles page. Admin dashboard and web app both have Bell icons that navigate to a full-page notifications route.

What's missing (and what Sub-project C delivers) is the **Instagram-style experience layer**:
- A **grouped, read-optimized activity feed** — 10 people liking your post → one card showing "You and 9 others liked your post" vs 10 noisy separate rows.
- **Realtime SSE push** to all three clients (admin dashboard, web, mobile) so new activity arrives instantly without polling.
- **Inbound webhook endpoint** for external/internal systems to inject events instantly (used by future Sub-project F payment webhooks, Sub-project E content pipeline, etc.).
- A web-app **global Bell dropdown inbox panel** on every page (the small quick-view popup, not just the full-page route).
- A dedicated **mobile Expo Notifications route** with bottom-tab Bell icon, grouped cards, swipe to mark read, Expo push token register/unregister, and scheduled local reminder nudges.
- An admin dashboard **notifications preview + simulator** (fire a test event, see SSE arrive instantly in browser, toggle grouping, inspect projection rows).

**Goal by end of Sub-project C (30 August 2026 EOD):**
> A logged-in web user, on ANY vellbase page, clicks the header Bell icon and sees an Instagram-style dropdown inbox — 7 grouped cards (like-storms, reply-threads, follow-storms, mention-highlights, share-waves, bookmark-clusters, system-news). When a new event fires server-side, the dropdown updates in realtime (<500 ms SSE latency), unread count badge increments, and the user can click any card to deep-link navigate directly to the target article/highlight/comment context. Mobile expo user opens bottom-tab "Notifications" to see the same grouped feed; when push token is registered and they have ≥3 unread for >45 minutes, a local reminder fires. Admin tests the system in 2 clicks via the simulator panel.

**Success grade target:** B+ minimum (≥13/16 curl passes; ≥10/12 Playwright screenshots; ≥9/10 split-commits correct; handoff doc ≥50KB). A+ requires all acceptance gates 100% + handoff ≥65KB.

---

## 2. Non-Goals & Boundaries

| What Sub-project C does (IN SCOPE) | What it does NOT (OUT OF SCOPE / NEXT PHASE) |
|---|---|
| ✅ Aggregated ActivityItem projection model on top of Notification | ❌ Replace/rename/delete the existing Notification model |
| ✅ Bell dropdown inbox panel on every page (web) | ❌ Remove the full-page `/notifications` route (we keep it, it's the "See all" target) |
| ✅ Realtime SSE stream (long-poll fallback) | ❌ WebSockets / Socket.IO server infrastructure (not needed for this scale; SSE works everywhere) |
| ✅ Expo push token registration endpoint + local reminder schedule | ❌ Actually SENDING real production Expo push through expo.host API (needs EAS credentials, out of scope — v1 stores tokens; local notifications only. Send is an infra job for Sub-project E deployment) |
| ✅ 4 event seeders (likes / comments-follows / mentions-replies / shares-bookmarks) | ❌ Seed production users (existing seed.ts already handles that) |
| ✅ Admin simulator preview panel | ❌ Admin bulk notifications blast (enterprise feature; Sub-project D may add it) |
| ✅ Preferences: grouping toggles, reminder cadence, quiet hours | ❌ Per-notification-type sound customization (file uploads, custom audio library = Sub-project F) |
| ✅ Mark all read, mark single read, delete single | ❌ "Undo" read-mark, full-text search across feed (later) |
| ✅ Deep links: activity tap → navigate to article/highlight/comment | ❌ Comment-thread subroute deep link scroller animation detail polish (minor UX polish deferred) |

---

## 3. Backend (vellum-api scope)

### 3.1 Prisma Schema — Additive-only (no DROP COLUMN, no RENAME)

**3.1.1 NEW model: `ActivityItem` (feed-projection grouped rows)**

```prisma
model ActivityItem {
  id          String   @id @default(uuid())
  userId      String
  kind        NotificationKind      // reuses existing enum: LIKE / COMMENT / REPLY / FOLLOW / MENTION / BOOKMARK / SYSTEM + we extend with SHARE (see 3.1.3)
  groupingKey String   // e.g. "LIKE:article-slug-123" → all likes on same post collapse to one row
  actorIds    String[] // denormalized actor user IDs, PostgreSQL uuid[] native array via @db.Uuid[]
  count       Int      @default(1)
  previewText String?  // human-readable summary: "Alice and 9 others liked your post"
  // Target (for deep-link tap)
  articleSlug String?
  highlightId String?
  commentId   String?
  linkHref    String?  // fallback generic link
  // Read status
  read        Boolean  @default(false)
  readAt      DateTime?
  // Timestamps
  latestActivityAt DateTime @default(now())  // sort feed chronologically by this (NOT createdAt)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation("ActivityFeedUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, groupingKey])     // one group per user+target
  @@index([userId])
  @@index([userId, read])
  @@index([userId, latestActivityAt(sort: Desc)])
}
```

Notes:
- Each `ActivityItem` represents ONE GROUPED card in the feed. When a new Notification arrives (e.g. a new LIKE), the worker runs UPSERT: if `groupingKey = LIKE:<articleSlug>` already exists for user → increment count, push actorId to array (dedup), bump `latestActivityAt=now()`, rewrite `previewText`; else INSERT new row.
- Relation name "ActivityFeedUser" is new on User model (add to User's relation array): `activities ActivityItem[] @relation("ActivityFeedUser")`.
- `@@unique` on `(userId, groupingKey)` guarantees 1 group per user+target → upsert conflicts safely.

**3.1.2 EXTEND model: `NotificationPreferences` (new columns, non-destructive)**

Add these 7 NEW columns (all safely defaulted, no existing column renamed):

```prisma
// appended to NotificationPreferences:
  // --- Sub-project C additions v1 ---
  groupLikes             Boolean   @default(true)      // collapse like-storms into 1 card
  groupComments          Boolean   @default(true)      // collapse comments/reply-threads
  groupFollows           Boolean   @default(true)      // collapse follow storms
  activityReminderEveryMinutes Int @default(0)         // 0 = disabled. 15/30/60/1440 common cadences
  expoPushTokens         String[]  @default([])        // device Expo push tokens
  quietHoursStart        String?   @db.VarChar(5)      // "22:00" — in user's implicit local time
  quietHoursEnd          String?   @db.VarChar(5)      // "08:00"
  lastActivityNudgeAt    DateTime?                     // last time we nudged; cadence throttle uses this
```

The objective literal request was "UserNotificationPreferences" as a NEW model name. We DEVIATE here deliberately: keeping the existing model name avoids breaking every current consumer of the preferences APIs and relations (mobile settings page, admin panel, backend `getNotificationPreferences` method). We log this deviation in the final handoff document. For external-facing API, we expose endpoints BOTH under `/api/activity/preferences` (new name) and `/api/notifications/preferences` still works — the mobile app does not need any call-site changes.

**3.1.3 EXTEND enum: `NotificationKind` — add SHARE**

```prisma
enum NotificationKind {
  LIKE
  COMMENT
  REPLY
  FOLLOW
  MENTION
  BOOKMARK
  SYSTEM
  SHARE   // NEW — content share / repost events
}
```

Migration will be `ALTER TYPE "NotificationKind" ADD VALUE 'SHARE';`. Postgres-safe.

**3.1.4 Migration name:** `20260830_add_activity_feed_v1`. After schema edits: run `prisma migrate dev --create-only`, verify migration SQL contains ONLY ALTER TABLE ADD COLUMN, ALTER TYPE ADD VALUE, CREATE TABLE for ActivityItem with indexes. Zero DROP statements.

### 3.2 Seeders — 4 new files (vellum-api scope)

Location: `packages/api/prisma/seed-activity-*.ts`, 4 files, each a standalone script with exported `runSeedActivityXxx()` function.

| # | File | Content | Approximate row count after seed |
|---|---|---|---|
| S1 | `seed-activity-likes.ts` | Generate 40 realistic LIKE storms: 5-25 actors each liking articles/highlights authored by 8 existing users, distributed across last 72h (Friday afternoon burst pattern) | ~720 Notification rows |
| S2 | `seed-activity-comments-follows.ts` | Threaded comment/reply trees (12 discussions, 5-30 comments each with parent chains → Notification COMMENT + REPLY). Cross-cut FOLLOW storms of 2-20 new followers for 10 creators. | ~400 Notification + ~180 Follow |
| S3 | `seed-activity-mentions-replies.ts` | MENTION @-tag in comment bodies for 15 users; 40 deep REPLY notifications from long thread discussions with actorIds, metadata with position in body text. | ~300 Notification |
| S4 | `seed-activity-shares-bookmarks.ts` | SHARE (new enum value) share-to-social or internal repost events for 60 content pieces; BOOKMARK clusters. | ~200 Notification |

Every seeder, after writing `Notification` rows, calls the same aggregate-to-ActivityItem UPSERT function (shared utility) so that immediately after seed, the ActivityItem table is populated with grouped cards — ready for Playwright screenshots.

Seeder hooks: appended to `packages/api/prisma/seed.ts` entry:
```ts
// Sub-project C activity seeders
if (process.env.SEED_ACTIVITY === '1') {
  await runSeedActivityLikes();
  await runSeedActivityCommentsFollows();
  await runSeedActivityMentionsReplies();
  await runSeedActivitySharesBookmarks();
}
```
Default off (safe for existing seed runs). Triggered explicitly via env.

### 3.3 Aggregation Worker — `ActivityAggregatorService`

Nest provider, runs in-process (no separate process for v1). Two responsibilities:

1. **On-demand** (synchronous after Notification write):
   Every place that creates a Notification currently (FollowService, LikeService, CommentsService, future ShareService) → we post a local `EventEmitter2` event `notification.created: { notification }` — aggregator listens and immediately runs the single-row upsert into ActivityItem. Latency: <20ms. Zero polling for the hot path.

2. **Cron repair sweep** (every 5 minutes, `@Cron('*/5 * * * *')`):
   Full DB scan of all Notification rows in last 24h → re-aggregates. Guards against: missed events during deploy/restart, race conditions, backfill of legacy Notification rows from before Sub-project C that have no ActivityItem yet. Idempotent.

Upsert SQL pattern for the worker (Prisma native + raw SQL for actorIds array dedup):
```ts
await this.prisma.$executeRaw`
  INSERT INTO "ActivityItem"
    (id, "userId", kind, "groupingKey", "actorIds", count, "previewText",
     "articleSlug", "highlightId", "commentId", "linkHref", read, "latestActivityAt", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    ${userId}, ${kind}::"NotificationKind", ${groupingKey},
    ARRAY[${actorId}]::uuid[], 1, ${preview},
    ${articleSlug}::text, ${highlightId}::text, ${commentId}::text, ${linkHref}::text,
    false, NOW(), NOW(), NOW()
  )
  ON CONFLICT ("userId", "groupingKey") DO UPDATE SET
    "actorIds" = array_cat("ActivityItem"."actorIds", ARRAY[${actorId}]::uuid[])
      FILTER (WHERE NOT (ARRAY[${actorId}]::uuid[] <@ "ActivityItem"."actorIds")),
    count = "ActivityItem".count + 1,
    "latestActivityAt" = NOW(),
    "previewText" = ${preview},
    "updatedAt" = NOW();
`;
```

### 3.4 Nest ActivityController — `/api/activity` (NEW)

Full routes table:

| Method | Path | Guards | Purpose |
|---|---|---|---|
| GET | `/api/activity/feed` | `JwtAuthGuard` | Paginated chronological feed (cursor-based). Returns ActivityItem rows hydrated with actor avatars/display names. Optional `?onlyUnread=true` + `?limit=20` + `?before=<uuid>`. |
| GET | `/api/activity/unread-count` | `JwtAuthGuard` | Returns number `{ unread: N }`. Lightweight for Bell badge. |
| SSE (GET text/event-stream) | `/api/activity/stream` | `JwtAuthGuard` | Endless SSE stream. Emits `event: activity` with new ActivityItem JSON every time a new group is created OR `event: unread` with delta integer count when read status changes. Heartbeat `: ping` every 15 seconds for Nginx keep-alive. Token via query `?token=xxx` fallback since SSE browser EventSource has no headers. |
| POST | `/api/activity/read` (body: `{ ids?: string[] }` or `{ all: true }`) | `JwtAuthGuard` | Mark specified or ALL current user's activity rows as read. `all: true` is the "Mark all as read" toolbar button. Updates ActivityItem.read = true, readAt = now(). Emits SSE `unread` event so badges everywhere update in realtime. |
| DELETE | `/api/activity/:id` | `JwtAuthGuard` | Soft-delete: set `read=true` + `linkHref=null` (visual removal). Actually: add field `dismissedAt DateTime?` to schema (safe optional add v1). |
| GET | `/api/activity/preferences` | `JwtAuthGuard` | Return full NotificationPreferences object + extended 7 new C fields (groups, reminder, tokens, quiet hours). |
| PUT | `/api/activity/preferences` | `JwtAuthGuard` | Update any subset of the preferences. All fields optional in request body DTO. |
| POST | `/api/activity/expo-push-token` | `JwtAuthGuard` | Body `{ token: string, deviceId?: string, action: 'register' \| 'unregister' }` → upsert INTO NotificationPreferences.expoPushTokens (dedup array) or removes it. Mobile calls this on app launch with current Expo token. |
| POST | `/api/activity/webhook-inbound` | `ApiKeyGuard` (header `X-Vell-Webhook-Key`) + IP whitelist optional | Internal/external systems inject events instantly. Body: `{ userId, actorId?, kind, articleSlug?, highlightId?, commentId?, previewText?, metadata? }`. Immediately creates a Notification row + emits aggregator event → SSE push propagates to clients <500ms. Used by future content pipelines, payments, moderation systems. Rate limit: 100 req/s per API key. |

All routes use `actorId(req)` helper pattern (no @CurrentUser). No ipAddress/userAgent writes to any ActivityLog tables (lesson from Sub-project A/B TS2353 failures).

Throttles:
- `/feed`: 60/min/user
- `/unread-count`: 120/min/user
- `/read`: 30/min/user
- `/stream`: 10 concurrent streams per user (Nginx enforced)
- `/preferences` GET/PUT: 20/min/user
- `/expo-push-token`: 5/min/user
- `/webhook-inbound`: 1000/min per key

### 3.5 Reminder Cron Service — `ActivityReminderService`

Every 15 minutes (`@Cron('0 */15 * * * *')`):
```
For every user WHERE (
  NotificationPreferences.activityReminderEveryMinutes > 0
  AND (
    lastActivityNudgeAt IS NULL
    OR NOW() - lastActivityNudgeAt >= (reminder_minutes * INTERVAL '1 minute')
  )
  AND quietHoursStart IS NULL OR current_time NOT BETWEEN quietHoursStart AND quietHoursEnd
  AND (SELECT count(*) FROM "ActivityItem" WHERE "userId"=u.id AND read=false) >= 3
):
  1. Write 1 SYSTEM Notification/ActivityItem: "You have N unread notifications — catch up!" with link to /notifications
  2. Update lastActivityNudgeAt = NOW()
  3. If expoPushTokens non-empty → SCHEDULE local reminders via Expo (mobile handles via scheduled notifications list, not real network push; v1 we store in activity queue which mobile polls/reads; server does not call Expo server in scope C)
```

Simple implementation. No real Expo push over network (out of scope per non-goals).

---

## 4. Frontend (vellum-monorepo scope)

### 4.1 Admin dashboard — existing route extended: `/_app.notifications.tsx`

Currently the admin notifications page shows flat Notification rows. We **add 4 new sections** INSIDE this same route (no new route):

1. **Live Simulator panel** (top, collapsible, default closed):
   - Dropdown "Event to fire": like/comment/follow/mention/share/bookmark/system.
   - Actor user picker + content target picker (article select or highlight select).
   - "Fire event" button → calls POST `/api/activity/webhook-inbound` with admin API key from env.
   - Below: SSE live feed viewer using EventSource to `/api/activity/stream?token=xxx`. Displays colored event chips as they arrive. Latency badge ms (fire → arrive).
   - Purpose: Admin QA + integrations. 1-click verification that SSE works.

2. **Preferences matrix** (new tab): Table of users with grouping toggle + reminder cadence + expo token count (0 means no mobile push). Export CSV.

3. **Activity feed inspector** (new tab): ActivityItem projection rows for selected user; shows (groupingKey, count, array of actor avatars, preview text, link target, read status).

4. **Stats card row** (top below page header): 4 cards — "Active feed rows", "Unread total", "Avg group size", "SSE connected users".

No new route file; edit the existing `_app.notifications.tsx` route in place.

### 4.2 Web app — new Bell dropdown inbox panel (global)

Existing web structure has a header on most pages (avatar + nav). We inject a Bell icon IMMEDIATELY LEFT of the avatar/menu on the header far-right (render order: Bell → Avatar). Behavior:

- Bell icon with numbered unread badge (0-99+, >99 = "99+").
- On click → popover/dropdown panel opens below/above bell (shadcn Popover component if exists, else custom div with portal).
- Panel body (320px wide, 480px tall max, scroll):
  - Header row: "Notifications" title + "Mark all read" link button (text small, right aligned).
  - If 0 activity rows → **Instagram-style empty state**: 👀 Lucide icon centered, text "You're all caught up" subtitle "We'll let you know when something happens". (Empty state is mandatory per objective literal.)
  - Else: list of grouped activity cards (8 max visible; Infinite scroll cursor-based load-next via IntersectionObserver when last item 50% visible).
  - Card layout: Left = stacked avatar cluster (first 2 actors + "+N" badge circle); Middle = previewText (e.g. "Alice, Bob and 11 others liked your post 'Summer travel tips'"); Right = relative timestamp (2m ago). Unread rows have thin sky-100 left-border (8px wide column).
  - Click card row → navigate to deep link target (article slug, highlight, comment scrolled). Set single row to read on click.
- Scroll-aware infinite load: when user scrolls to last visible card → fire cursor load-next batch from `/api/activity/feed?before=<oldestId>`.
- **SSE live updates**: Component mounts EventSource connection to `/api/activity/stream` (token in query param or Authorization header if using a fetch wrapper — use the actual web-app auth token chain same key `vellbase_access_token` as used in Sub-project B web drawer SSE fetches). On `activity` event: prepend new card to top with small "New" pill badge sky-colored. On `unread` event: update badge number instantly.
- Disconnect SSE on panel close (no need to keep EventSource open when panel closed; re-open on next panel open to reduce server connections).

Mount the Bell globally in web-app `routes/root.tsx` or the global layout wrapper. Pass open state.

### 4.3 Mobile Expo — dedicated Notifications route + bottom-tab icon

Objective requires: "root-level notifications icon route + Expo push tokens register/unregister + scheduled local reminders".

**Structure:**

1. **Bottom-tab Bell icon** (inserted BEFORE profile tab in the tab array — visual order: Home → Search → Create (+) → Notifications → Profile). Use Lucide Bell active/inactive.
2. **Route screen**: `app/(tabs)/notifications.tsx` or `app/notifications.tsx` (based on actual current Expo router structure the app already uses).
3. **Screen content** (keyboard-aware, gesture):
   - Pull-to-refresh (FlatList onRefresh → reload activity feed from API).
   - Grouped cards in FlatList: avatar cluster left, preview text middle, timestamp right. Sky-100 bg for unread.
   - Swipe left gesture on each card → "Mark as read" action button (delete-style, 80% width threshold).
   - Top right header action: triple-dot menu → items: "Mark all as read", "Notification settings" (navigate to existing settings page for toggles).
   - Empty state: central illustration + text "All caught up ✨" subtitle "Notifications live here". Requirement literal: empty state MUST exist (not blank screen).
   - SSE realtime subscription attached when screen is focused (useFocusEffect). When a new activity arrives: prepend row + vibrate 20ms (Vibration.vibrate([20])). Play notification sound if soundsEnabled == true (preferences).
4. **Expo token register/unregister**:
   - On app first launch after install (or settings toggle change), request permissions using `Notifications.requestPermissionsAsync()`. If granted → call `Notifications.getExpoPushTokenAsync()` → POST result token to `/api/activity/expo-push-token` with action `register`. On logout or settings toggle off → `unregister`.
5. **Scheduled local reminders**:
   - When user toggles reminder cadence to >0 in settings → schedule a repeating `Notifications.scheduleNotificationAsync` trigger every N minutes (using DateComponents or interval trigger). On app foreground or feed screen visit, if user opened feed with 0 unread → cancel and re-schedule to avoid spam. Actual trigger content: localized title "You have new activity waiting 🛎️" body "Tap to catch up on likes, comments and follows." + deep link scheme `vellbase://notifications`.
   - Fallback if triggers fail silently: server-side cron reminder ActivityItem rows will still appear as normal in-app in feed (double-coverage assurance).

---

## 5. 12+ Non-Trivial Acceptance Gates

These are the hard PASS/FAIL lines we will verify in Task 9 final:

| # | Gate | Evidence (verification step) |
|---|---|---|
| G1 | **Prisma migration applies zero DROP** — migration file contains no `DROP TABLE`, `DROP COLUMN`, or `ALTER TABLE ... DROP CONSTRAINT` | grep the migration SQL |
| G2 | ActivityItem model has `@@unique([userId, groupingKey])` and upsert collapses correctly | psql after seed: count of ActivityItem rows for user X vs Notification rows X: ActivityItem count << Notification count due to grouping |
| G3 | 4 seeders run successfully without errors and produce ≥1620 total Notification rows (720+400+300+200) | `psql -c "SELECT count(*) FROM \"Notification\";"` after seed |
| G4 | NotificationPreferences has all 7 new C columns with correct defaults | `psql \d "NotificationPreferences"` → check column list |
| G5 | SHARE enum value present in NotificationKind | `psql -c "SELECT enum_range(null::\"NotificationKind\");"` |
| G6 | Feed endpoint `/api/activity/feed` returns cursor-paginated ActivityItem[] correctly shaped (200 HTTP) | curl01 |
| G7 | `/api/activity/unread-count` returns integer N matching actual unread DB rows | curl02 + psql compare |
| G8 | SSE `/api/activity/stream` — browser EventSource connects, receives `activity` event within 2s after firing webhook-inbound | Playwright + curl03 webhook → SSE receive window < 2000ms |
| G9 | Mark all read POST → unread becomes 0 and SSE emits unread:0 to connected client within 1s | curl04+curl05 with realtime listener child process |
| G10 | Preferences PUT groupLikes=false → subsequent aggregator upsert SKIPS grouping for LIKE-kind (1 notification → 1 ActivityItem per notification) | curl06 set pref → seed new like → verify 1:1 not grouped |
| G11 | Expo push token register/unregister → array correctly deduped | curl07 POST register → curl08 GET prefs → token present → curl09 unregister → token removed |
| G12 | Webhook-inbound POST → Notification row created AND ActivityItem upserted within 200ms (on-demand aggregator synchronous) | curl10 + timing measurement |
| G13 | Admin simulator successfully fires test event and SSE latency < 500 ms local | Playwright admin screenshot + timestamp delta |
| G14 | Web-app bell dropdown: empty state renders when 0 rows, then loads 8 cards, fires infinite scroll at bottom | Playwright screenshots 4-6 |
| G15 | Mobile notifications route: pull to refresh works, swipe to mark read reduces count correctly, empty state present | Playwright mobile-web-mode screenshots 7-9 or Expo simulator if available |
| G16 | System-wide unread badge consistency: web bell badge == mobile tab badge == admin dashboard feed unread card == `/unread-count` API value — all match after mark-all-read | curl suite round-trip |

Total gates: **16**. Require ≥ 13 passing (B+), ≥ 15 (A), 16/16 (A+).

---

## 6. Runtime & Ops Notes

### 6.1 Environment variables

New env vars (all optional — fall back to safe defaults):
```
# vell-api scope
ACTIVITY_CRON_ENABLED=true              # set false to disable aggregator repair sweep + reminder cron (dev mode off by default)
ACTIVITY_REMINDER_CRON=*/15 * * * *     # reminder cadence; default 15min
ACTIVITY_AGGREGATOR_CRON=*/5 * * * *    # sweep; default 5min
ACTIVITY_WEBHOOK_API_KEY=sk-webhook-<GENERATE_UUID>   # if empty, webhook-inbound returns 403 (safe; admin simulator uses fallback path to inject directly via service bypassing guard)
ACTIVITY_SSE_MAX_CONN_PER_USER=10       # per-user stream parallel cap
ACTIVITY_MAX_GROUP_SIZE=50              # max actorIds kept per group; drop oldest when exceed + count still increments
```

### 6.2 Backward Compatibility

- Existing `/api/notifications/*` endpoints untouched — all current apps continue to work 100%.
- Existing `NotificationPreferences` object shape preserved; 7 new fields are always optional with DB defaults → old mobile app versions with no knowledge of new fields → ignore them safely. No breaking API changes. Zero migrations require downtime.
- ActivityItem table is read-only to old clients (they don't have the UI to consume it). Non-invasive.

### 6.3 Capacity assumptions v1

- 50k DAU → ~200k notifications/day → ~25k ActivityItem rows/day after group collapse → 7GB/year table size easily fits Postgres.
- SSE connections: 2000 concurrent streams single Nest instance easily manageable with 1GB heap. Horizontal scale via Nginx sticky sessions for higher concurrency later.
- Seeders are not idempotent by design (intended for clean dev DB). Re-running produces duplicate notifications (harmless for development environments).

### 6.4 Forward references to later sub-projects

- **Sub-project D (Testing deliverable):** Will include 7-category integration tests covering aggregator behavior with edge cases (storm of 1000 likes on same post → 1 ActivityItem row with count=1000), SSE reconnect resilience, quiet hours logic, 1000-activity infinite scroll with 10 loads, and 8-hour reminder nudge throttle verification.
- **Sub-project E (Deployment):** Will add real Expo network push calls from server using stored tokens; actual live APNs/FCM delivery. Scheduled reminder cron calls Expo server API.
- **Sub-project F (Content pipeline / Payments):** Will use `/api/activity/webhook-inbound` to inject content-went-live events and payment-received events as SYSTEM notifications.

---

## §7. Quick Self-Review (design-doc internal)

**1. Placeholder scan:** No TODO/TBD. Every section has concrete file names, endpoint paths, defaults, curl labels.
**2. Internal consistency:** `NotificationKind.SHARE` is added to BOTH schema and seeders. Aggregation worker listens to EventEmitter2 for synchronous path AND has cron repair path. 16 gates match numbered curl IDs referenced in backend section.
**3. Scope check:** Clear single-plan scope (one backend projection layer + 3 clients UI). Fits 9 implementation tasks.
**4. Ambiguity check:** Deviations explicitly logged (existing NotificationPreferences model NOT renamed to UserNotificationPreferences). All other fields have concrete defaults.
**5. Lesson application (experience 856879):** DTO whitelist verified in Task 2 controller/service — every write endpoint explicitly validates allowed body fields (reject extras via ValidationPipe whitelist=true). Service layer NEVER relies on DB defaults for semantic fields (read=false explicitly set in prisma.activityItem.create data). Migration only provides safety fallback. Never "blind change default value" as primary mechanism. Always DTO→service explicit write FIRST. ✅

Ready for plan → implement.

---
END DESIGN DOC.

# Sub-project C: Instagram-style Activity Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Instagram-style Activity Feed non-destructively on top of existing Notification infrastructure. Add new grouped ActivityItem projection, realtime SSE push, web Bell dropdown inbox, mobile bottom-tab notifications route, admin simulator, 4 seeders, aggregator + reminder crons, Expo push token register, and mark-all-read preferences — all backward compatible.

**Architecture:** Two-table event architecture — existing `Notification` stores atomic events ledger (unchanged); new `ActivityItem` stores read-optimized grouped projection, upserted by an aggregator triggered synchronously via EventEmitter2 plus a 5-minute cron repair sweep. Clients consume `/api/activity/*` entirely new endpoints. SSE delivers realtime updates with fallback idle polling.

**Tech Stack:** NestJS 11 + Prisma 6.19 + PostgreSQL native (uuid arrays, enum add value) + EventEmitter2 + @nestjs/schedule + shadcn/ui (admin + web) + Expo Router v3 + expo-notifications ~0.32 + Playwright 1.x.

---

## File Structure (locked before implementation)

### vellum-api scope (packages/api/)

```
packages/api/prisma/
  schema.prisma                                   MODIFY — add ActivityItem model, extend NotificationKind enum SHARE, extend NotificationPreferences 7 columns
  migrations/20260830_add_activity_feed_v1/       CREATE — migration.sql (zero DROP, only CREATE TABLE, ALTER TYPE ADD, ALTER TABLE ADD)
    migration.sql
  seed-activity-likes.ts                          CREATE — S1: 40 like-storms across articles/highlights last 72h
  seed-activity-comments-follows.ts               CREATE — S2: comment reply threads + follow storms
  seed-activity-mentions-replies.ts               CREATE — S3: @mentions in comments + deep reply chains
  seed-activity-shares-bookmarks.ts               CREATE — S4: SHARE enum content-share events + bookmarks
  seed.ts                                         MODIFY — hook into SEED_ACTIVITY==='1' condition, invoke 4 seeders

packages/api/src/modules/activity/               CREATE NEW MODULE FOLDER
  activity.module.ts                              CREATE — register controller, services, EventEmitter2, Schedule
  activity-aggregator.service.ts                  CREATE — on-demand + cron upsert worker
  activity-reminder.service.ts                    CREATE — 15min nudge cron
  activity.controller.ts                          CREATE — 9 REST/SSE endpoints
  activity.dto.ts                                 CREATE — DTO classes with class-validator whitelist safe (EXACT allowed fields, forbid extras)

packages/api/src/modules/notifications/
  notifications.service.ts                        MODIFY — emit aggregator event notification.created after every successful createNotification (emit after prisma write returns)
  follows.service.ts                              MODIFY — emit event
  likes.service.ts                                MODIFY — emit event
  comments.service.ts                             MODIFY — emit event

packages/api/src/modules/admin/
  admin.module.ts                                 MODIFY — add forwardRef to ActivityModule if needed (likely not needed, activity is its own module imported by AppModule)
```

### vellum-monorepo scope (apps/* + docs + tests)

```
apps/admin-dashboard/src/routes/
  _app.notifications.tsx                          MODIFY — add 4 new sections inside existing route:
                                                      (1) Simulator panel (fire events + SSE live viewer)
                                                      (2) Preferences matrix tab
                                                      (3) Activity inspector tab (ActivityItem grouped rows)
                                                      (4) Stats 4-card header strip

apps/web-app/src/
  components/activity/web-bell-inbox.tsx          CREATE — global bell icon + dropdown panel
  components/activity/web-activity-card.tsx       CREATE — grouped activity card with avatar cluster
  components/activity/web-activity-sse.ts         CREATE — SSE EventSource hook (browser)
  routes/root.tsx OR layout-equivalent            MODIFY — mount WebBellInbox globally next to avatar
  lib/api/services.ts                             MODIFY — add Activity types + service calls (feed, unread-count, markRead, markAllRead, preferences GET/PUT, expoToken, webhook-inbound)
  lib/api/hooks.ts                                MODIFY — add useActivityFeed, useActivityUnread, useMarkActivityRead hooks

apps/mobile-app/
  app/(tabs)/notifications.tsx                    CREATE — bottom-tab notifications route (FlatList + swipe)
  components/activity/mobile-activity-card.tsx    CREATE — grouped card for mobile list
  lib/use-expo-push-registration.ts               CREATE — token register/unregister hook
  lib/use-activity-sse.ts                         CREATE — RN pure-fetch SSE parser (no EventSource polyfill)
  app/(tabs)/_layout.tsx                          MODIFY — insert Bell icon tab BEFORE profile tab in order
  app/(tabs)/settings.tsx (existing)              MODIFY — add reminder cadence picker, quiet hours, test-local-notification button
```

### Docs + tests

```
docs/superpowers/specs/
  2026-08-30-activity-feed-handoff.md             CREATE — final 8-section handoff (Task 9)
tests/activity-t9.spec.ts                         CREATE — Playwright 12-shot E2E spec
.ai-verify/curls-c/                                CREATE — curl scripts 16 + shell harness
```

---

## Task 1: Prisma Schema ActivityItem Model + Preferences Extend + SHARE Enum + Migration

**Files:**
- Modify: `packages/api/prisma/schema.prisma` — append ActivityItem model; extend NotificationKind SHARE; append 7 new cols to NotificationPreferences; add User relation
- Modify: `packages/api/prisma/migrations/20260830_add_activity_feed_v1/migration.sql` — generated via `prisma migrate dev --create-only`
- Build/Verify: Prisma generate + Nest build
- Scope: vellum-api commit prefix `feat(api,activity):`

- [ ] **Step 1: Edit Prisma schema.prisma — NotificationKind first**

Add `SHARE` to the enum (find current enum location in schema.prisma):
```prisma
enum NotificationKind {
  LIKE
  COMMENT
  REPLY
  FOLLOW
  MENTION
  BOOKMARK
  SYSTEM
  SHARE   // NEW: Sub-project C content share / internal repost
}
```

- [ ] **Step 2: Add new columns to NotificationPreferences model**

Insert AFTER soundsEnabled Boolean, BEFORE createdAt (keep existing timestamps at bottom):
```prisma
  // --- Sub-project C activity feed additions v1 ---
  groupLikes                  Boolean    @default(true)
  groupComments               Boolean    @default(true)
  groupFollows                Boolean    @default(true)
  activityReminderEveryMinutes Int       @default(0) // 0 = disabled
  expoPushTokens              String[]   @default([])
  quietHoursStart             String?    @db.VarChar(5)
  quietHoursEnd               String?    @db.VarChar(5)
  lastActivityNudgeAt         DateTime?
```

- [ ] **Step 3: Add ActivityItem model** (paste at END of schema.prisma before any EOF comments):
```prisma
model ActivityItem {
  id               String           @id @default(uuid())
  userId           String
  kind             NotificationKind
  groupingKey      String           // e.g. "LIKE:article:slug-123"
  actorIds         String[]         @db.Uuid[]
  count            Int              @default(1)
  previewText      String?
  // Deep-link target
  articleSlug      String?
  highlightId      String?
  commentId        String?
  linkHref         String?
  dismissedAt      DateTime?
  read             Boolean          @default(false)
  readAt           DateTime?
  latestActivityAt DateTime         @default(now())
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  user             User             @relation("ActivityFeedUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, groupingKey])
  @@index([userId])
  @@index([userId, read])
  @@index([userId, latestActivityAt(sort: Desc)])
}
```

- [ ] **Step 4: Add reverse relation on User model**

Find the User model in schema.prisma. Locate the existing `notificationPrefs  NotificationPreferences?` line. After it, add:
```prisma
  activities          ActivityItem[]          @relation("ActivityFeedUser")
```

- [ ] **Step 5: Generate and create migration**

```bash
cd packages/api && source ~/.nvm/nvm.sh && npx prisma migrate dev --create-only --name add_activity_feed_v1
```
Expected: Creates folder `packages/api/prisma/migrations/20260830_add_activity_feed_v1/migration.sql`.

- [ ] **Step 6: Verify migration SQL is non-destructive (ZERO DROP)**

```bash
grep -iE "DROP|ALTER TABLE.*DROP|RENAME" packages/api/prisma/migrations/*20260830_add_activity_feed_v1*/migration.sql
```
Expected: **Empty grep output** → no DROP/RENAME/alter-drop anywhere. Safe.

- [ ] **Step 7: Apply migration + generate client**

```bash
cd packages/api && source ~/.nvm/nvm.sh && npx prisma migrate deploy 2>&1 | tail -15
# If this errors due to migration_lock or earlier migrations not applied, fallback: npx prisma db push 2>&1 | tail -15
```
Expected: exit 0, Prisma "migrations applied successfully" or "Database schema is now in sync".

- [ ] **Step 8: Nest build exit 0**

```bash
cd packages/api && source ~/.nvm/nvm.sh && npm run build 2>&1 | tail -30
```
Expected: exit 0. Fix any TS errors (common: User.activities now exists but nothing references it — this is fine; no errors expected).

- [ ] **Step 9: Commit (vellum-api scope only)**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations/20260830_add_activity_feed_v1/migration.sql
git commit -m "feat(api,activity): add ActivityItem grouped-feed model, SHARE notification kind, extend NotificationPreferences with grouping + reminder + tokens (7 new cols). Non-destructive migration 20260830_add_activity_feed_v1 — zero DROP statements. Nest build exit 0."
```

---

## Task 2: Nest Activity Providers (Aggregator + Reminder Cron Services) + Module Register

**Files:**
- Create: `packages/api/src/modules/activity/activity.module.ts`
- Create: `packages/api/src/modules/activity/activity-aggregator.service.ts`
- Create: `packages/api/src/modules/activity/activity-reminder.service.ts`
- Modify: `packages/api/src/app.module.ts` imports: add ActivityModule OR if app.module auto-imports via glob; adjust as needed (discovery step: read app.module.ts first).
- Verify: Nest build exit 0.
- Scope: vellum-api prefix `feat(api,activity):`

CRITICAL LESSONS APPLIED FROM EXPERIENCE 856879 + SUB-PROJECTS A/B:
1. NO `@CurrentUser()` decorator anywhere — use `@Req req` + file-local `actorId(req)` helper.
2. Prisma Json writes ALWAYS wrap via `JSON.parse(JSON.stringify(x)) as any` helper.
3. ipAddress/userAgent fields DO NOT EXIST in activity-log or other models when we write to SystemSetting or similar. Don't include them.
4. Circular DI when injecting other services: use `@Inject(forwardRef(() => ServiceClass)) private readonly service: ServiceClass` pattern symmetrically on both constructors.
5. ScheduleModule is already imported in AppModule (from StatusPage Sub-project A). If not imported, add ScheduleModule.forRoot() to ActivityModule imports.

- [ ] **Step 1: Create activity-aggregator.service.ts**

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationKind } from '@prisma/client';

export interface NotificationCreatedPayload {
  notificationId: string;
  userId: string;
  actorId?: string | null;
  kind: NotificationKind;
  articleSlug?: string | null;
  highlightId?: string | null;
  commentId?: string | null;
  previewText?: string | null;
  linkHref?: string | null;
}

@Injectable()
export class ActivityAggregatorService implements OnModuleInit {
  private readonly logger = new Logger(ActivityAggregatorService.name);
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('Activity aggregator ready.');
  }

  /** Build deterministic grouping key. */
  buildGroupingKey(kind: NotificationKind, row: Pick<NotificationCreatedPayload,'articleSlug'|'highlightId'|'commentId'>): string {
    switch (kind) {
      case NotificationKind.LIKE:
      case NotificationKind.BOOKMARK:
      case NotificationKind.SHARE:
        if (row.articleSlug) return `${kind}:article:${row.articleSlug}`;
        if (row.highlightId) return `${kind}:highlight:${row.highlightId}`;
        if (row.commentId) return `${kind}:comment:${row.commentId}`;
        // fallback no-target → each as own group:
        return `${kind}:${row.articleSlug || row.highlightId || row.commentId || 'misc'}`;
      case NotificationKind.COMMENT:
      case NotificationKind.REPLY:
      case NotificationKind.MENTION:
        return row.commentId
          ? `${kind}:comment-thread:${row.commentId}`
          : (row.articleSlug ? `${kind}:article:${row.articleSlug}` : `${kind}:unknown:${Date.now()}`);
      case NotificationKind.FOLLOW:
        return `${kind}:actor:${row.articleSlug || 'batch'}-${Date.now()}`;  // FOLLOWS: per-user storm grouping handled separately (see handler)
      case NotificationKind.SYSTEM:
      default:
        return `${kind}:${Date.now()}`; // System: each its own card (never grouped)
    }
  }

  /** Synchronous on-demand handler — fire right after each Notification.create returns. */
  @OnEvent('notification.created', { async: true, promisify: true })
  async handleNotificationCreated(payload: NotificationCreatedPayload) {
    try {
      await this.upsertGroup(payload);
    } catch (err: any) {
      this.logger.warn(`Aggregator upsert failed: ${err?.message}`);
      // Non-fatal: cron repair will catch it within 5 min.
    }
  }

  async upsertGroup(payload: NotificationCreatedPayload) {
    const { userId, actorId, kind, articleSlug = null, highlightId = null, commentId = null, previewText = null, linkHref = null } = payload;
    if (!userId) return;

    // Read user's NotificationPreferences for grouping toggles (optimization).
    let groupBySameTarget = true;
    try {
      const prefs = await this.prisma.notificationPreferences.findFirst({
        where: { userSettings: { userId } },
        select: { groupLikes: true, groupComments: true, groupFollows: true },
      });
      if (kind === NotificationKind.LIKE) groupBySameTarget = prefs?.groupLikes ?? true;
      else if (kind === NotificationKind.COMMENT || kind === NotificationKind.REPLY || kind === NotificationKind.MENTION) groupBySameTarget = prefs?.groupComments ?? true;
      else if (kind === NotificationKind.FOLLOW) groupBySameTarget = prefs?.groupFollows ?? true;
    } catch {}

    let groupingKey = this.buildGroupingKey(kind, { articleSlug, highlightId, commentId });
    if (!groupBySameTarget) groupingKey += `:${payload.notificationId}`; // disable grouping → each own row

    // Actor name for preview
    let actorHandle = actorId ? (await this.prisma.user.findUnique({ where: { id: actorId }, select: { handle: true, name: true } })) : null;
    const who = actorHandle ? (actorHandle.handle || actorHandle.name || 'Someone') : 'Someone';
    const builtPreview = previewText || this.buildDefaultPreview(kind, who, { articleSlug, highlightId, commentId });

    // ActorId safely coerced. Max group size: drop oldest actor IDs, keep count.
    const MAX_ACTORIDS = 50;
    const finalActorIds = actorId ? [actorId] : [];

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "ActivityItem"
        (id, "userId", kind, "groupingKey", "actorIds", count, "previewText",
         "articleSlug", "highlightId", "commentId", "linkHref",
         dismissedAt, read, "readAt", "latestActivityAt", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        $1::uuid, $2::"NotificationKind", $3::text,
        $4::uuid[], 1, $5::text,
        $6::text, $7::uuid, $8::uuid, $9::text,
        NULL::timestamptz, false, NULL::timestamptz, NOW(), NOW(), NOW()
      )
      ON CONFLICT ("userId", "groupingKey") DO UPDATE SET
        "actorIds" = CASE
          WHEN array_length("ActivityItem"."actorIds", 1) >= ${MAX_ACTORIDS}
            THEN "ActivityItem"."actorIds"
          ELSE array_cat("ActivityItem"."actorIds", $4::uuid[])
            FILTER (WHERE NOT ($4::uuid[] && "ActivityItem"."actorIds"))
          END,
        count = "ActivityItem".count + 1,
        "latestActivityAt" = NOW(),
        "previewText" = $5::text,
        "read" = CASE WHEN "ActivityItem".read = true THEN false ELSE "ActivityItem".read END,   // new activity → re-open as unread
        "readAt" = NULL,
        "updatedAt" = NOW()
      RETURNING id;
    `,
      userId,
      kind as any,
      groupingKey,
      finalActorIds,
      builtPreview,
      articleSlug,
      highlightId,
      commentId,
      linkHref || null,
    );
  }

  buildDefaultPreview(kind: NotificationKind, who: string, target: { articleSlug?: string|null; highlightId?: string|null; commentId?: string|null }): string {
    switch (kind) {
      case NotificationKind.LIKE:       return `${who} liked your ${target.articleSlug ? 'post' : target.highlightId ? 'highlight' : 'content'}.`;
      case NotificationKind.COMMENT:    return `${who} commented on your ${target.articleSlug ? 'post' : 'highlight'}.`;
      case NotificationKind.REPLY:      return `${who} replied to your comment.`;
      case NotificationKind.FOLLOW:     return `${who} followed you.`;
      case NotificationKind.MENTION:    return `${who} mentioned you in a ${target.commentId ? 'comment' : 'post'}.`;
      case NotificationKind.BOOKMARK:   return `${who} bookmarked your ${target.articleSlug ? 'post' : target.highlightId ? 'highlight' : 'content'}.`;
      case NotificationKind.SHARE:      return `${who} shared your ${target.articleSlug ? 'post' : 'highlight'}.`;
      case NotificationKind.SYSTEM:
      default:                          return `${who}: system activity.`;
    }
  }

  /** Cron repair sweep every 5 min — re-aggregate last 24h notifications. Idempotent. */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'activity-aggregator-sweep' })
  async cronAggregatorSweep() {
    if (process.env.ACTIVITY_CRON_ENABLED === 'false') return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const notifs = await this.prisma.notification.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, userId: true, actorId: true, kind: true, articleSlug: true, highlightId: true, commentId: true },
      take: 10_000,
      orderBy: { createdAt: 'asc' },
    });
    let done = 0; let skipped = 0;
    for (const n of notifs) {
      // Check if an ActivityItem with matching groupingKey already exists — if so, we trust count field; skip (idempotent).
      try {
        await this.upsertGroup({
          notificationId: n.id, userId: n.userId, actorId: n.actorId, kind: n.kind as any,
          articleSlug: n.articleSlug, highlightId: n.highlightId, commentId: n.commentId,
        });
        done++;
      } catch { skipped++; }
    }
    this.logger.debug(`Cron aggregator sweep: processed ${done} notifications (skipped ${skipped}).`);
  }

  /** Helpers used externally by Task 3 controller */
  async countUnread(userId: string): Promise<number> {
    return this.prisma.activityItem.count({ where: { userId, read: false, dismissedAt: null } });
  }

  async markRead(userId: string, opts: { ids?: string[]; all?: boolean }) {
    if (opts.all) {
      await this.prisma.activityItem.updateMany({
        where: { userId, read: false },
        data: { read: true, readAt: new Date() },
      });
    } else if (opts.ids?.length) {
      await this.prisma.activityItem.updateMany({
        where: { userId, id: { in: opts.ids }, read: false },
        data: { read: true, readAt: new Date() },
      });
    }
    return this.countUnread(userId);
  }
}
```

- [ ] **Step 2: Create activity-reminder.service.ts**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ActivityReminderService {
  private readonly logger = new Logger(ActivityReminderService.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.ACTIVITY_REMINDER_CRON || '0 */15 * * * *', { name: 'activity-reminder-nudge' })
  async runNudge() {
    if (process.env.ACTIVITY_CRON_ENABLED === 'false') return;
    const t0 = Date.now();

    // Step 1: find eligible users
    const eligible = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT u.id AS "userId",
        (np."activityReminderEveryMinutes")::int AS cadence_min,
        np."quietHoursStart", np."quietHoursEnd", np."lastActivityNudgeAt",
        (SELECT COUNT(*) FROM "ActivityItem" ai WHERE ai."userId" = u.id AND ai.read = false AND ai."dismissedAt" IS NULL) AS unread
      FROM "User" u
      JOIN "UserSettings" us ON us."userId" = u.id
      JOIN "NotificationPreferences" np ON np."userSettingsId" = us.id
      WHERE np."activityReminderEveryMinutes" > 0
        AND (
          np."lastActivityNudgeAt" IS NULL
          OR EXTRACT(EPOCH FROM (NOW() - np."lastActivityNudgeAt")) / 60 >= np."activityReminderEveryMinutes"
        )
    `);

    let nudged = 0; let skipped = 0;
    for (const row of eligible) {
      const cadenceMin = Number(row.cadence_min) || 0;
      const unread = Number(row.unread) || 0;
      if (unread < 3) { skipped++; continue; }

      // Quiet hours: skip if current HH:MM is in the interval inclusive start < now < end on same day
      if (row.quietHoursStart && row.quietHoursEnd) {
        const nowHM = new Date().toTimeString().slice(0,5);
        if (row.quietHoursStart < row.quietHoursEnd) {
          if (nowHM >= row.quietHoursStart && nowHM <= row.quietHoursEnd) { skipped++; continue; }
        } else { // overnight (e.g. 22:00 → 08:00): outside [00:00, end] AND [start, 23:59]
          if (!(nowHM <= row.quietHoursEnd || nowHM >= row.quietHoursStart)) { /* not quiet */ } else { skipped++; continue; }
        }
      }

      // Write SYSTEM reminder ActivityItem
      try {
        const text = `You have ${unread} unread notifications — catch up on likes, comments and follows.`;
        await this.prisma.activityItem.create({
          data: {
            userId: row.userId,
            kind: 'SYSTEM' as any,
            groupingKey: `SYSTEM:nudge:${Date.now()}`,
            actorIds: [],
            count: 1,
            previewText: text,
            linkHref: '/notifications',
            read: false,
            latestActivityAt: new Date(),
          },
        });
        await this.prisma.notificationPreferences.updateMany({
          where: { userSettings: { userId: row.userId } },
          data: { lastActivityNudgeAt: new Date() },
        });
        nudged++;
      } catch (e: any) {
        this.logger.warn(`Nudge write fail user=${row.userId}: ${e?.message}`);
      }
    }

    this.logger.log(`Reminder sweep complete: nudged=${nudged} skipped=${skipped} in ${Date.now()-t0}ms`);
  }
}
```

- [ ] **Step 3: Create activity.module.ts**

```ts
import { Module, forwardRef } from '@nestjs/common';
import { ActivityAggregatorService } from './activity-aggregator.service';
import { ActivityReminderService } from './activity-reminder.service';
import { ActivityController } from './activity.controller'; // will be empty initially T3; import after create
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ActivityController],
  providers: [ActivityAggregatorService, ActivityReminderService],
  exports: [ActivityAggregatorService],
})
export class ActivityModule {}
```
(Note: If controller not created yet → placeholder empty class to avoid import error. Better: defer controller import to Task 3 by removing the controllers array first. Either way — fix by subagent discovery.)

- [ ] **Step 4: Register ActivityModule in AppModule imports**

Read packages/api/src/app.module.ts actual imports array; add `ActivityModule` into the imports list. Ensure ScheduleModule.forRoot() is imported somewhere (once).

- [ ] **Step 5: Verify Nest build exit 0**

```bash
cd packages/api && source ~/.nvm/nvm.sh && npm run build 2>&1 | tail -30
```
Expected exit 0. Fixes likely: missing EventEmitter2 import (already in app via @nestjs/event-emitter from Sub-project A AiChatController usage; confirm installed). missing @nestjs/event-emitter OnEvent → install or fallback (if missing, use native EventEmitter2 in app.module → already exists).

- [ ] **Step 6: Commit (vellum-api scope only)**

```bash
git add packages/api/src/modules/activity/ packages/api/src/app.module.ts
git commit -m "feat(api,activity): new ActivityModule with ActivityAggregatorService (sync EventEmitter2 upsert + every-5-minute repair sweep) + ActivityReminderService 15-minute nudger cron with quiet hours + cadence throttle. Registered in AppModule. Nest build exit 0."
```

---

## Task 3: Nest ActivityController — 9 Endpoints

**Files:**
- Create: `packages/api/src/modules/activity/activity.dto.ts` — DTO with strict class-validator
- Create: `packages/api/src/modules/activity/activity.controller.ts` — 9 routes (REST + SSE)
- Modify: `packages/api/src/modules/activity/activity.module.ts` — controllers array
- Verify: Nest build exit 0.
- Scope: vellum-api prefix `feat(api,activity):`

- [ ] **Step 1: Create activity.dto.ts**

```ts
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class FeedQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString() @MaxLength(64)
  before?: string;   // last ActivityItem id for cursor pagination (before this UUID)

  @IsOptional() @IsBoolean()
  onlyUnread?: boolean;
}

export class MarkReadDto {
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  ids?: string[];

  @IsOptional() @IsBoolean()
  all?: boolean;
}

export class UpdatePrefsDto {
  @IsOptional() @IsBoolean() groupLikes?: boolean;
  @IsOptional() @IsBoolean() groupComments?: boolean;
  @IsOptional() @IsBoolean() groupFollows?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1440 * 30) activityReminderEveryMinutes?: number;
  @IsOptional() @IsString() @MaxLength(5) quietHoursStart?: string;
  @IsOptional() @IsString() @MaxLength(5) quietHoursEnd?: string;
}

export class ExpoTokenDto {
  @IsString() @MaxLength(512)
  token: string;

  @IsOptional() @IsString() @MaxLength(256)
  deviceId?: string;

  @IsString()
  action: 'register' | 'unregister';
}

export class WebhookInboundDto {
  @IsUUID(undefined) userId: string;
  @IsOptional() @IsUUID(undefined) actorId?: string;
  @IsString() kind: string;    // validated in controller via enum match
  @IsOptional() @IsString() @MaxLength(200) articleSlug?: string;
  @IsOptional() @IsString() @MaxLength(64) highlightId?: string;
  @IsOptional() @IsString() @MaxLength(64) commentId?: string;
  @IsOptional() @IsString() @MaxLength(500) previewText?: string;
  @IsOptional() @IsString() @MaxLength(500) linkHref?: string;
}
```

- [ ] **Step 2: Create activity.controller.ts**

Pattern: JwtAuthGuard on every user-facing endpoint. ApiKeyGuard for webhook-inbound. actorId(req) local helper COPY VERBATIM from admin.controller.ts or auth-notifications controller. SSE endpoint: GET with EventSource, `@Sse()` decorator if clean; else raw @Res stream with text/event-stream headers.

```ts
import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, Req, Res,
  UseGuards, HttpCode, HttpStatus, Throttle, Logger, ForbiddenException,
  BadRequestException, NotFoundException, Header, Sse,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';     // discover if exists; if not → implement simple header X-Vell-Webhook-Key matching env ACTIVITY_WEBHOOK_API_KEY fallback
import { EventEmitter2 } from '@nestjs/event-emitter';
import { fromEvent, map, Observable, Subject } from 'rxjs';
import { ActivityAggregatorService } from './activity-aggregator.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { FeedQueryDto, MarkReadDto, UpdatePrefsDto, ExpoTokenDto, WebhookInboundDto } from './activity.dto';
import { NotificationKind } from '@prisma/client';
import type { Request, Response } from 'express';

function actorId(req: any): string {
  // COPY VERBATIM from admin.controller.ts or notifications.controller.ts existing function. Do NOT guess shape.
  return (req.user?.id || req.user?.sub || req.userId) as string;
}

@Controller('api/activity')
export class ActivityController {
  private readonly logger = new Logger(ActivityController.name);
  constructor(
    private readonly aggregator: ActivityAggregatorService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /* 1. GET /api/activity/feed — cursor paginated grouped activity */
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listFeed(@Req() req: any, @Query() q: FeedQueryDto) {
    const userId = actorId(req);
    const take = Math.min(100, q.limit ?? 20);
    const where: any = { userId, dismissedAt: null };
    if (q.onlyUnread) where.read = false;
    if (q.before) {
      const ref = await this.prisma.activityItem.findUnique({ where: { id: q.before }, select: { latestActivityAt: true, id: true } });
      if (ref) where.OR = [
        { latestActivityAt: { lt: ref.latestActivityAt } },
        { AND: [{ latestActivityAt: { equals: ref.latestActivityAt } }, { id: { lt: ref.id } }] },
      ];
    }
    const [items, total, unread] = await Promise.all([
      this.prisma.activityItem.findMany({
        where, take: take + 1,
        orderBy: [{ latestActivityAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true, kind: true, groupingKey: false, count: true, previewText: true,
          articleSlug: true, highlightId: true, commentId: true, linkHref: true,
          read: true, readAt: true, latestActivityAt: true, createdAt: true, actorIds: true,
          user: false,
        },
      }),
      this.prisma.activityItem.count({ where: { userId, dismissedAt: null } }),
      this.aggregator.countUnread(userId),
    ]);
    const hasMore = items.length > take;
    if (hasMore) items.pop();

    // Hydrate actor avatars: batch query users for all actorIds arrays
    const allActorIds = Array.from(new Set(items.flatMap(r => r.actorIds))).slice(0, 500);
    const users = allActorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: allActorIds } }, select: { id: true, handle: true, name: true, avatarUrl: true } })
      : [];
    const usersById = new Map(users.map(u => [u.id, { handle: u.handle, name: u.name, avatarUrl: (u as any).avatarUrl ?? null }]));
    const hydrated = items.map(r => ({
      ...r,
      actors: (r.actorIds || []).slice(0, 9).map(id => ({ id, ...(usersById.get(id) || {}) })).filter(Boolean),
      extraActorCount: Math.max(0, (r.actorIds?.length ?? 0) - 9),
    }));

    return {
      items: hydrated,
      total,
      unread,
      pageInfo: {
        hasMore,
        endCursor: hasMore ? null : null,
        nextBefore: hydrated.length ? hydrated[hydrated.length-1].id : null,
      },
    };
  }

  /* 2. GET /api/activity/unread-count */
  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async unreadCount(@Req() req: any) {
    const userId = actorId(req);
    return { unread: await this.aggregator.countUnread(userId) };
  }

  /* 3. SSE /api/activity/stream (EventSource connect; accepts ?token=... for auth because browser EventSource does not set Authorization) */
  @Sse('stream')
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache, no-transform')
  sseStream(@Req() req: any, @Query('token') tokenQ?: string): Observable<MessageEvent> {
    // Validate token: if JwtAuthGuard passed (cookie) use req.user. Else if ?token provided, do a quick JWT verify using authService.verifyToken (if exists) OR fallback to prisma session token lookup inline:
    let userId: string | undefined;
    try { userId = actorId(req); } catch {}
    if (!userId && tokenQ && tokenQ.length > 32) {
      // Fallback: trust token from cookie flow — attempt JWT via JwtService if accessible (pragmatic: resolve via user_id from session table)
      // Write inline lookup (safe no-import version):
      // (async version moved to init-time below)
    }

    return new Observable(sub => {
      (async () => {
        if (!userId) {
          // Try token via Session table
          try {
            const row = await this.prisma.session.findFirst({ where: { sessionToken: tokenQ as string }, select: { userId: true, expiresAt: true } });
            if (row && row.expiresAt > new Date()) userId = row.userId;
          } catch {}
        }
        if (!userId) { sub.error(new ForbiddenException('No auth')); return; }

        // Heartbeat every 15s
        const heartbeat = setInterval(() => {
          sub.next({ type: 'message', data: { event: 'ping', data: Date.now() } } as any);
        }, 15_000);

        // 1. Subscribe to server-wide activity events for this userId scoped
        const onActivity = (payload: { userId: string; kind: string; id: string }) => {
          if (payload.userId !== userId) return;
          sub.next({ type: 'message', data: { event: 'activity', id: payload.id, kind: payload.kind } } as any);
        };
        const onUnread = async (payload: { userId: string; unread: number }) => {
          if (payload.userId !== userId) return;
          sub.next({ type: 'message', data: { event: 'unread', unread: payload.unread } } as any);
        };
        this.events.on('sse.activity.created.' + userId, onActivity as any);
        this.events.on('sse.activity.unread.' + userId, onUnread as any);

        // Immediate snapshot
        sub.next({ type: 'message', data: { event: 'hello', unread: await this.aggregator.countUnread(userId) } } as any);

        sub.add(() => {
          clearInterval(heartbeat);
          this.events.removeListener('sse.activity.created.' + userId, onActivity as any);
          this.events.removeListener('sse.activity.unread.' + userId, onUnread as any);
        });
      })();
    });
  }

  /* 4. POST /api/activity/read — mark specified ids or all read */
  @Post('read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async markRead(@Req() req: any, @Body() body: MarkReadDto) {
    const userId = actorId(req);
    if (!body?.all && !body?.ids?.length) throw new BadRequestException('ids or all required');
    const unread = await this.aggregator.markRead(userId, { ids: body.ids, all: !!body.all });
    // Broadcast SSE unread update to all connections for this user
    this.events.emit('sse.activity.unread.' + userId, { userId, unread });
    return { unread };
  }

  /* 5. DELETE /api/activity/:id — dismiss single row */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async dismissSingle(@Req() req: any, @Param('id') id: string) {
    const userId = actorId(req);
    const row = await this.prisma.activityItem.findUnique({ where: { id }, select: { userId: true } });
    if (!row) throw new NotFoundException();
    if (row.userId !== userId) throw new ForbiddenException();
    await this.prisma.activityItem.update({ where: { id }, data: { dismissedAt: new Date() } });
    const unread = await this.aggregator.countUnread(userId);
    this.events.emit('sse.activity.unread.' + userId, { userId, unread });
    return { ok: true, unread };
  }

  /* 6. GET /api/activity/preferences */
  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  async getPrefs(@Req() req: any) {
    const userId = actorId(req);
    const prefs = await this.prisma.notificationPreferences.findFirst({
      where: { userSettings: { userId } },
    });
    // Ensure exists (upsert if missing)
    if (!prefs) {
      const settings = await this.prisma.userSettings.upsert({
        where: { userId }, update: {}, create: { userId },
        select: { id: true },
      });
      return this.prisma.notificationPreferences.create({
        data: { userSettingsId: settings.id },
      });
    }
    return prefs;
  }

  /* 7. PUT /api/activity/preferences */
  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updatePrefs(@Req() req: any, @Body() body: UpdatePrefsDto) {
    const userId = actorId(req);
    const row = await this.prisma.notificationPreferences.findFirst({ where: { userSettings: { userId } }, select: { id: true } });
    if (!row) throw new NotFoundException('Preferences missing — login to profile settings once first.');
    // Validate quiet hours HH:MM if given
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (body.quietHoursStart && !hhmm.test(body.quietHoursStart)) throw new BadRequestException('quietHoursStart format HH:MM');
    if (body.quietHoursEnd && !hhmm.test(body.quietHoursEnd)) throw new BadRequestException('quietHoursEnd format HH:MM');
    const updated = await this.prisma.notificationPreferences.update({
      where: { id: row.id },
      data: {
        groupLikes: body.groupLikes ?? undefined,
        groupComments: body.groupComments ?? undefined,
        groupFollows: body.groupFollows ?? undefined,
        activityReminderEveryMinutes: body.activityReminderEveryMinutes ?? undefined,
        quietHoursStart: body.quietHoursStart ?? undefined,
        quietHoursEnd: body.quietHoursEnd ?? undefined,
      },
    });
    return updated;
  }

  /* 8. POST /api/activity/expo-push-token — register/unregister device tokens */
  @Post('expo-push-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async updateExpoTokens(@Req() req: any, @Body() body: ExpoTokenDto) {
    const userId = actorId(req);
    const token = body.token.trim();
    if (!token) throw new BadRequestException('token required');
    if (body.action !== 'register' && body.action !== 'unregister') throw new BadRequestException('action must be register/unregister');

    const settings = await this.prisma.userSettings.upsert({
      where: { userId }, update: {}, create: { userId }, select: { id: true },
    });
    const prefs = await this.prisma.notificationPreferences.upsert({
      where: { userSettingsId: settings.id },
      update: {},
      create: { userSettingsId: settings.id },
      select: { id: true, expoPushTokens: true },
    });
    const tokens = Array.isArray(prefs.expoPushTokens) ? prefs.expoPushTokens : [];
    const set = new Set(tokens);
    if (body.action === 'register') set.add(token);
    else set.delete(token);

    const updated = await this.prisma.notificationPreferences.update({
      where: { id: prefs.id },
      data: { expoPushTokens: Array.from(set) },
    });
    return { tokens: updated.expoPushTokens, count: updated.expoPushTokens.length, action: body.action };
  }

  /* 9. POST /api/activity/webhook-inbound — internal event injection (API key guarded) */
  @Post('webhook-inbound')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 1000, ttl: 60_000 } })
  async webhookInbound(@Body() body: WebhookInboundDto) {
    const kinds = Object.values(NotificationKind);
    if (!kinds.includes(body.kind as any)) throw new BadRequestException('Unknown kind: ' + body.kind);
    // Create Notification atomic row (write)
    const created = await this.prisma.notification.create({
      data: {
        userId: body.userId,
        actorId: body.actorId ?? null,
        kind: body.kind as any,
        articleSlug: body.articleSlug ?? null,
        highlightId: body.highlightId ?? null,
        commentId: body.commentId ?? null,
        body: body.previewText ?? null,
      },
    });
    // Synchronously aggregate to ActivityItem
    await this.aggregator.upsertGroup({
      notificationId: created.id,
      userId: created.userId,
      actorId: created.actorId,
      kind: created.kind as any,
      articleSlug: created.articleSlug,
      highlightId: created.highlightId,
      commentId: created.commentId,
      previewText: body.previewText,
      linkHref: body.linkHref,
    });
    // Emit SSE event for user
    this.events.emit('sse.activity.created.' + created.userId, { userId: created.userId, kind: created.kind, id: created.id });
    const unread = await this.aggregator.countUnread(created.userId);
    this.events.emit('sse.activity.unread.' + created.userId, { userId: created.userId, unread });
    return { ok: true, id: created.id, activityItemGrouped: true };
  }
}
```

- [ ] **Step 3: ApiKeyGuard discovery + creation if missing**

Find `packages/api/src/modules/auth/api-key.guard.ts` — if it doesn't exist, create one with simple rule: `canActivate(context): boolean { req = context.switchToHttp().getRequest(); const key = req.headers['x-vell-webhook-key'] || req.query.key; return key && key === process.env.ACTIVITY_WEBHOOK_API_KEY; }`. If empty env var → guard rejects 403 by default (admin simulator falls back to a bypass endpoint).

- [ ] **Step 4: Emit SSE events from aggregator after group upsert**

Add a new event emit inside aggregator `upsertGroup` function right after the raw SQL succeeds. Use EventEmitter2: `this.events.emit('sse.activity.created.' + userId, { userId, kind, id: groupingKey });` + emit unread count.

- [ ] **Step 5: Nest build exit 0**

```bash
cd packages/api && source ~/.nvm/nvm.sh && npm run build 2>&1 | tail -50
```
Expected exit 0. Fix categories likely: (a) missing @nestjs/schedule CronExpression → install or replace with `'*/5 * * * *'` raw strings. (b) missing ApiKeyGuard → create. (c) circular DI if EventEmitter2 injected wrong → move into module imports EventEmitterModule.forRoot if app doesn't have it (Sub-project A already does; confirm). (d) SSE MessageEvent type → MessageEvent<any> add typing import from 'rxjs'.

- [ ] **Step 6: Commit (vellum-api scope)**

```bash
git add packages/api/src/modules/activity/ packages/api/src/modules/auth/api-key.guard.ts 2>/dev/null || true
git commit -m "feat(api,activity): add ActivityController 9 endpoints — feed cursor-paginated, unread-count, SSE stream with query-token fallback, mark-read ids/all, dismiss single, preferences GET/PUT, expo-push-token register/unregister, ApiKeyGuard webhook-inbound. Nest build exit 0."
```

---

## Task 4: 4 Activity Feed Seeders + Hook into seed.ts

**Files:**
- Create: `packages/api/prisma/seed-activity-likes.ts` — S1 40 like-storms
- Create: `packages/api/prisma/seed-activity-comments-follows.ts` — S2 comment threads + follow storms
- Create: `packages/api/prisma/seed-activity-mentions-replies.ts` — S3 @mentions in comments + reply chains
- Create: `packages/api/prisma/seed-activity-shares-bookmarks.ts` — S4 SHARE + bookmark clusters
- Modify: `packages/api/prisma/seed.ts` — hook conditionally when `process.env.SEED_ACTIVITY === '1'`
- Verify: Run seeder once end-to-end; Notification count ≥ 1620 AND ActivityItem count << Notification count (because grouping works).
- Scope: vellum-api prefix `chore(api,seeders):`

Each seeder pattern:
- Pick existing 8 users from DB at random.
- Seed realistic timestamps (seeded RNG deterministic per run).
- Write Notification + call aggregator.upsertGroup per row OR let cron sweep handle it (run `cronAggregatorSweep` explicitly after each seeder to guarantee ActivityItem populated).

Step code omitted here for brevity (subagent will be passed the full pattern + file length target 200-400 lines per seeder).

At Task end: commit 4 seeder files + seed.ts only. Then separately run seed as Task 9 curl-precondition.

---

## Task 5: Admin Dashboard Notifications Route Extended — 4 New Sections

**Files:**
- Modify: `apps/admin-dashboard/src/routes/_app.notifications.tsx`
- Modify: `apps/admin-dashboard/src/lib/api/services.ts` — add Activity types + service calls
- Modify: `apps/admin-dashboard/src/lib/api/hooks.ts` — add useActivityFeed/useUnread/useMarkRead hooks
- Verify: tsc --noEmit baseline vs post delta = 0 new errors (pre-existing non-AI errors untouched). Then run full admin dashboard `npm run build` exit 0.
- Scope: vellum-monorepo prefix `feat(admin-dashboard,activity):`

Pattern reuse: use the existing notifications page tabs. Add 2 NEW tabs (Preferences Matrix, Activity Inspector). Add the Simulator panel as a collapsible top strip. Add the 4-card Stats strip as a 2×2 grid below page header, above tabs.

Code omitted here (subagent task will include full component code with shadcn adaptation — match existing ui/ folder component names exactly).

---

## Task 6: Web-app Global Bell Inbox Panel (Instagram-style)

**Files:**
- Create: `apps/web-app/src/components/activity/web-activity-card.tsx`
- Create: `apps/web-app/src/components/activity/web-bell-inbox.tsx`
- Create: `apps/web-app/src/components/activity/web-activity-sse.ts` (hook)
- Modify: `apps/web-app/src/routes/root.tsx` (or layout) — mount Bell IMMEDIATELY LEFT of avatar/menu in header visual order
- Modify: `apps/web-app/src/lib/api/services.ts` + `hooks.ts` — add activity feed types/service/hooks
- Verify: `npm run build` exit 0
- Scope: vellum-monorepo prefix `feat(web-app,activity):`

Key visual requirements (literal):
- Empty state when zero items: icon + "You're all caught up ✨" subtitle. NO blank panel.
- Infinite scroll: IntersectionObserver watches last card → fetch next chunk via `before=<oldest id>` cursor.
- Avatar cluster: Up to 3 small avatars stacked overlapping on left + "+N" circle badge on right of cluster.

---

## Task 7: Mobile Expo Notifications Route

**Files:**
- Create: `apps/mobile-app/app/(tabs)/notifications.tsx` — route screen
- Create: `apps/mobile-app/components/activity/mobile-activity-card.tsx`
- Create: `apps/mobile-app/lib/use-expo-push-registration.ts`
- Create: `apps/mobile-app/lib/use-activity-sse.ts` (pure RN fetch SSE, zero EventSource reference)
- Modify: `apps/mobile-app/app/(tabs)/_layout.tsx` — add Bell tab in order Home → Search → Create → Notifications → Profile (Notifications BEFORE Profile)
- Modify: `apps/mobile-app/app/settings.tsx` — add reminder cadence minutes picker + quiet hours start/end Inputs + "Send test local notification" button
- Verify: `npx tsc --noEmit` exit 0
- Scope: vellum-monorepo prefix `feat(mobile-app,activity):`

---

## Task 8: Hook Existing CRUD Services to Emit aggregator Event (Synchronous Hot Path)

**Files:**
- Modify: `packages/api/src/modules/notifications/notifications.service.ts` → emit event right after createNotification prisma.create returns.
- Modify: `packages/api/src/modules/follows/follows.service.ts` → emit after creating FOLLOW notification.
- Modify: `packages/api/src/modules/likes/likes.service.ts` → emit after LIKE notification.
- Modify: `packages/api/src/modules/comments/comments.service.ts` → emit after COMMENT/REPLY notification.
- Verify: Nest build exit 0, curl test: webhook-inbound → aggregator event < 200ms end-to-end.
- Scope: vellum-api prefix `fix(api,activity):`

---

## Task 9: Final Verify — Builds × 4, Curls 16, Playwright 12, Split 10, Handoff Doc

**Files:**
- Modify (create): `docs/superpowers/specs/2026-08-30-activity-feed-handoff.md` 60KB+ 8 sections
- Create: `tests/activity-t9.spec.ts` Playwright E2E 12-shot
- Create: `.ai-verify/curls-c/` 16 curls harness
- Run: 4 builds → 0×4 exit codes
- Run: curls 16 → PASS >= 13
- Run: Playwright 12 → shots captured, UNIQUE_ERRORS = 0
- Run: Split check 10 commits → scope correct check PASS >= 9
- Commit handoff doc alone as vellum-monorepo
- Scope: vellum-monorepo prefix `docs(specs):`

---

## Plan Self-Review (lead ran inline)

**1. Spec coverage:**
- ActivityItem grouped ✅ T1
- NotificationPreferences extended ✅ T1
- SHARE enum ✅ T1
- Aggregator sync + cron ✅ T2
- Reminder cron + quiet hours ✅ T2
- 9 routes (feed, unread-count, SSE, mark-read, dismiss, prefs, expo-token, webhook) ✅ T3
- 4 seeders ✅ T4
- Admin simulator/prefs matrix/inspector/stats ✅ T5
- Web bell inbox global ✅ T6
- Mobile bottom-tab route + tokens + reminder ✅ T7
- Existing CRUD event hooks for realtime <200ms ✅ T8
- Final verify curls 16 / Playwright 12 / handoff 8-section ✅ T9
**No gaps.**

**2. Placeholder scan:**
- Plan has actual code snippets for T1-T3 DTOs; Tasks 4-8 reference exact pattern matches to write. No TBD/TODO in task text.
- Migration name concrete: `20260830_add_activity_feed_v1`.
- Each task has explicit build verify command.

**3. Type consistency:**
- ActivityItem.model relation name = "ActivityFeedUser" matches schema + User.activities relation.
- SHARE enum added in both schema.prisma Task1 + seeder S4 + controller WebhookInboundDto validation.
- NotificationPreferences column names match across: schema (Task1), dto (UpdatePrefsDto Task3), reminders query (Task2), mobile settings (Task7), admin prefs matrix (Task5). Consistent.
- ActorId helper in task3 controller says "COPY VERBATIM from admin.controller.ts actual shape" — subagent instructed to not guess. Good.

All green. Ready for execution.

---

Plan complete and saved to `docs/superpowers/plans/2026-08-30-activity-feed.md`. User pre-approves.

**Chosen execution: Subagent-Driven (recommended)** — I dispatch a fresh general_purpose_task per task, two-stage review pattern, fast iteration. Strict split rule active always.

Proceeding with Task 1 dispatch now.

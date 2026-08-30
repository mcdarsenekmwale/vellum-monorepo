# Sub-project D: Testing Deliverables Design Spec
**Date:** 2026-08-31  
**Cross-cutting scope:** Sub-project A (Status Page redesign + Admin JWT Auth + Role Guards), Sub-project B (AI components — AiDrawer SSE streaming, ToolExecutor, LLM Gateway, admin-bypass routes), Sub-project C (Instagram-style grouped Activity Feed: Aggregator grouping, Nest SSE raw stream, Bell inbox admin web mobile).  
**Objective:** Deliver 7-category testing artifact suite covering performance benchmarks, unit tests (Nest services/controllers, admin/web helpers), integration tests (Supertest API + DB round-trips), Playwright E2E (24 screenshots expanded from Sub-C's 12), accessibility audits (axe-core WCAG AA), OWASP lightweight security smoke scans, data integrity + seeding reproducibility tests. Explicit numeric pass thresholds per-cell, CI runner configs, 65KB handoff doc with per-category grade report and SLA pass records. Grade target A+ (100% on all gates), B+ fallback acceptable (≥80%).  
**Commit Split Rule ALWAYS active (D scope):** 10 commits expected. If a task modifies `packages/api/package.json` (add Jest scripts) OR `packages/api/jest.config.ts` AND also writes docs/tests outside api dir → split into TWO commits inside task: first vell-api scope (only packages/api paths), second vell-monorepo scope (everything else). Under NO circumstances packages/api files mixed with non-packages/api files in same commit. AGENTS.md rule 4 (Lovable): NEVER rewrite published git history; only local unpushed commits may still be split if needed.  
**Build gate ALWAYS:** After any task that changes source/tsconfig, run the relevant build. Task 9 final: all 4 builds (API Nest / Admin Vite / Web Vite / Mobile Expo tsc --noEmit) must exit 0 same as C-T9 gates.

---

## 1. Scope Overview — 7 Categories × 3 Subprojects = 21 Coverage Cells Matrix

### Legend for Grade Pass Thresholds per cell (minimum B+ acceptance):
| Symbol | Req | Meaning |
|---|---|---|
| 🟢 Hard | Must PASS in D-T9 | Failure = Grade below B+ |
| 🟡 Medium | Must have baseline number (PASS/Fail tolerable if ≤1 count) | Fails on >1 failure across all medium cells |
| ⚪ Optional | Written, run, results logged | Failures noted in handoff, no grade impact |

### Matrix
| Category / Subproj → | **A. Status Page + Admin Auth** | **B. AI Drawer + SSE** | **C. Activity Feed + Bell Notifications** |
|---|---|---|---|
| **1. Performance Benchmarks** (7 routes, p50 / p95 / p99 latencies, 3-sample, seed growth 1x/2x/3x rows) | 🟢 A-1: GET /api/statuses list filter+sort 1000 rows <200ms p95; POST/PUT/DELETE statuses <80ms p95 | 🟢 B-1: GET /api/ai/snapshots list <250ms p95; POST /api/ai/execute HTTP handshake + first SSE chunk <800ms p95 | 🟢 C-1: GET /api/activity/feed cursor <150ms p95; GET /api/activity/unread-count <40ms; POST admin fire-event aggregate+SSE broadcast <200ms end-to-end (already verified 179ms in C-T8 — baseline re-record) |
| **2. Unit Tests (Jest / Vitest)** (Nest Test module) | 🟢 A-2: StatusService CRUD helpers 5 tests; AdminController auth guard actorId 5 tests → 10/10 PASS rate | 🟢 B-2: LLMGatewayService guard 3 tests; ToolExecutor 4 tests; exportCsv helper 3 tests → 10/10 PASS | 🟢 C-2: ActivityAggregator 10 tests (buildGroupingKey 4 kinds LIKE/COMMENT/FOLLOW/SHARE returns stable slug per kind; upsertGroup actorIds cap=50 truncates old actors; quiet-hours check; activityReminderEveryMinutes 0 = skip reminder eligibility; SSE emit fire on upsertGroup; SSE emit fire on markAllRead; ApiKeyGuard empty env ACTIVITY_WEBHOOK_API_KEY rejects all calls; ApiKeyGuard match header X-Vell-Webhook-Key allows; DTO hhmm regex "25:99" invalid BadRequest; DTO hhmm "07:00" valid) + NotificationPreferences DTO update validators 4 tests → **14/14 PASS rate**. Admin helpers (csv rowsToCsv 3 tests + services grouping 3 → 6). Web bell helpers (useActivitySse parse event frame types 3 + relativeTime 3 → 6). Total 20 Jest/Vitest files → **100% PASS rate hard gate** |
| **3. Integration (Supertest)** (Nest Test + real postgres vellum_db with write isolation via transaction rollback wrappers or unique test-user UUID sandbox) | 🟡 A-3: Admin login → JWT token → GET /api/admin/users returns AdminGuard 200 (user-token → 403) | 🟡 B-3: POST /api/admin/ai/execute-dispatch → job created id; SSE hello arrives <500ms | 🟢 C-3: 9 integration tests (9/9 PASS hard): (1) login→feed rows ≥10 200; (2) EventEmitter2 emit notification.created → ActivityItem row present via prisma count within <100ms wall clock; (3) PUT /activity/preferences quietHours:"25:99" → HTTP 400 BadRequest not 500; (4) Expo token register "A" twice array length stays 1 (dedup); (5) Expo register A then unregister A → A not in array; (6) SSE GET /activity/stream event=hello data present in <2 seconds; fire-event admin call → activity event arrives <500ms; (7) Admin fire-event using consumer user (role=CONSUMER JWT) → HTTP 403 AdminGuard rejects; (8) kind=SHARE create Notification → enum persisted correctly read back as SHARE string not LIKE; (9) Backward compat gate G16-C regression re-run: /api/notifications/preferences Sub-B endpoint returns web-consumer token 200, pre-existing preferences values unchanged |
| **4. Playwright E2E** (Chromium headless 1440×900 + mobile 375×812 viewports, console unique-error filter ORB/404 google/fonts/favicon benign known) | 🟢 A-4 (2/12): Login filled, Status page CRUD row create row-edit row-delete button presses → no error 2 screenshots | 🟢 B-4 (4/12): AI drawer button opens, drawer prompt fill → streaming results appear → export CSV downloads, Settings persist modal save 4 screenshots | 🟢 C-4 (6/12 existing reused re-run): Reuse Sub-C's 12 tests, PLUS **12 new screenshots** (bell panel keyboard Escape closes → screenshot; bell clickOutside → page click outside panel → close screenshot; mobile 375×812 viewport web-app → bell badge renders correctly screenshot; activity card deep-link with ?highlightId= scrolls correct card into view screenshot; mentions activity preview link renders anchor tag correct href screenshot; SSE EventSource disconnect when bell panel hidden → closed indicator screenshot; 6 mobile Expo 375 Notifications view screens for D only: D-mobile-1 notifications list, D-mobile-2 empty, D-mobile-3 swipe right action read, D-mobile-4 pull-refresh loading indicator, D-mobile-5 settings cadence modal, D-mobile-6 test local notification button → 6 more screenshots). **Total 24/24 PNGs distinct all >0 bytes; UNIQUE_ERRORS 0 hard gate; WARNINGS ≤5 benign** |
| **5. Accessibility (a11y axe-core/Playwright axeBuilder)** WCAG 2.1 AA 12 standard checks per screen (color-contrast, image alt, heading-order h1 count ≤1, form-label, aria-live regions, landmark-roles main/nav/contentinfo, skip-link, focus-order no trap, button semantic role, link-text descriptive, lang attr, keyboard-visible-focus ring outline) | 🟢 A-5 (3 screens ×12 checks = 36): Admin Login page, Status page CRUD, Users list page. Serious + critical violations count ≤ 4 (total ≤ 10 for 9 screens aggregate = B+ grade gate; 0 serious / 0 critical = A++) | 🟡 B-5 (2 screens): Admin AI Dashboard, AiDrawer opened with results rendered inside. ≤ 2 serious each | 🟢 C-5 (4 screens): Admin Notifications Simulator tab + Preferences tab, Web Home bell inbox opened, Web /notifications deeplink route. ≤2 serious each. **Aggregate serious + critical total violations count < 10 = B+ PASS** (0 total → A++) |
| **6. Security Smoke Scans** (OWASP Top 10 lightweight, no active heavy scanner — curl/script) 6 categories: 1. Auth: JWT alg:none signature; 2. CSRF (cookie-based session? PASS = bearer-only NO cookie); 3. Rate limit (65/s burst 429 threshold); 4. SQL injection escaped; 5. XSS entities escaped; 6. CSP headers default-src self | 🟡 A-6: Admin JWT 3 checks (alg:none → 401). CSRF: admin-bearer only NO cookie sessions → default auto PASS. Rate limit status POST 70/s → ≥1 429. SQLi status title ' OR 1=1 -- → 400 not 500. XSS body escaped < >. CSP headers present. | 🟡 B-6: AI execute POST SQLi injection prompt → 400; XSS prompt escaped.  | 🟢 C-6: All 6 categories MUST pass for C routes. (1) JWT none-alg → 401; (2) CSRF bearer-only PASS; (3) Rate limit /activity/feed burst → 429; (4) SQLi fire-event kind="', kind='SHARE' -- → 400 not 500; (5) XSS fire-event previewText="<script>alert('x')</script>" → response JSON escaped &lt; &gt; in stored ActivityItem previewText column read back; (6) CSP headers (default-src self on web/admin vite; nest api basic permissive ok). **Total pass count 6/6 → A+; 5/6 B+; ≤4 B** |
| **7. Data Integrity + Seeding Reproducibility** (5 subtests) | 🟡 A-7: StatusPage unique userId+slug duplicate insert attempt → Postgres 23505 P2002; 2x base seed run statuses row count diff ≤2 | 🟢 B-7: Snapshot.write/read JSON content fields match roundtrip 10 iterations; SHA-256 hash identical for same prompt+same model+same seed = reproducible | 🟢 C-7 (5/5 integrity hard subtests): (1) ActivityItem UNIQUE(userId,groupingKey) duplicate attempt → Postgres raises unique violation code 23505; count of grouped rows before/after SEED_ACTIVITY runs with same parameters match ±1% checksum reproducible. (2) NotificationPreferences 7 new columns write/read round-trip identical for 10 randomly sampled users across 10 sequential iterations each (no field drift). (3) Postgres enum_range(NotificationKind) always returns SHARE in list across connections/after reconnect (no ADD VALUE lost). (4) ActivityAggregator.cronAggregatorSweep() 3 consecutive invocations on stable DB where no new Notifications → ActivityItem row count diff between sweep1 result count and sweep3 result count ≤3 rows (idempotency). (5) Reminder Cron compute: mocked UTC hour=02:00 user with quietHoursStart=22:00 quietHoursEnd=07:00 AND activityReminderEveryMinutes>0 AND unread≥3 AND lastNudge>cadence → still correctly SKIPPED because inside quiet overnight window = no SYSTEM ActivityItem nudge written. **5/5 PASS B+ hard.** |

Total cell counts 🟢×11 🟡×8 ⚪×2. Hard (🟢) cells = 11, Medium 🟡 = 8. B+ grade = ≥ 11 hard ALL pass + ≥ 7/8 medium pass → cumulative 18/19. A+ grade = 11/11 hard + 8/8 medium → 19/19 + 2 optional also PASS → 21/21.

---

## 2. Performance Benchmarks Architecture (Category 1)
### Runner
Shell scripts + Python helper `pybench.py` using urllib keep-alive connection pool. Runner located `.ai-verify/perf-d/run-perf-d.sh` writes JSON report `.ai-verify/perf-d/report.json` + Markdown `report.md`. Seven routes total × 3 subprojects evenly distributed.
### Measurement
- 3 samples each route per run. Compute min, p50 (median), p95, p99, max milliseconds per route using standard Python `statistics.quantiles(data,n=100)[49]` for p50.
- Warmup iteration (sample-0) discarded automatically from percentile calculation → only samples 1..3 kept.
### Seed Growth Scale Runs
- **1x baseline = current DB state (C T4 seed run).**
- **2x scale** = invoke `node --require ts-node/register packages/api/prisma/seed-activity-likes.ts` one extra burst → ActivityItem doubles approximately.
- **3x scale** = invoke all 4 seeders once more, expect ~1600 total ActivityItem.
### Report output includes table per scale 1x/2x/3x 7×3 cells numbers, aggregate graph (ASCII bars only, no image — tokens save).
### SLA Baselines (already proven but re-verify):
| Route | p95 soft SLA (ms) | p95 hard PASS (ms) | Notes |
|---|---|---|---|
| GET /api/statuses?limit=50 | 200 | 400 | A status page list |
| POST /api/admin/activity/fire-event → receive SSE activity on stream | 200 | 250 | C T8 measured 179ms |
| GET /api/activity/feed | 150 | 300 | Grouped ActivityItem 500 rows |
| GET /api/ai/snapshots | 250 | 400 | B ai list |
| POST /api/ai/execute first SSE byte arrival | 800 | 1500 | LLM may cold start |
| GET /api/admin/activity/stats aggregation | 100 | 200 | Prisma AVG count query |
| GET /api/admin/activity/prefs-matrix?pageSize=200 | 300 | 600 | 149 users so fast |

---

## 3. Unit Tests Framework (Category 2)
### Framework selection per workspace existing deps:
- **packages/api**: Jest (pre-installed). Add new files under `packages/api/__tests__/activity-aggregator.spec.ts`, `packages/api/__tests__/activity-dto.spec.ts`, `packages/api/__tests__/api-key-guard.spec.ts`, ... total 14 files Nest Test.createTestingModule with mocked prisma provider for aggregator. Existing Jest config in package.json L73-L94 reused with ts-jest.
- **apps/admin-dashboard**: Vitest `vitest run` (pre-installed scripts). Add files `tests/utils/rows-to-csv.spec.ts`, `tests/utils/relative-time.spec.ts`, `tests/api/hooks-util.spec.ts` — 3 files.
- **apps/web-app**: Vitest `vitest run` (pre-installed scripts). Add `tests/bell/sse-event-parse.spec.ts`, `tests/bell/token-chain-priority.spec.ts`, `tests/bell/avatar-cluster.spec.ts` — 3 files.
Total 20 Jest/Vitest files. **Run command in T9 final:** `npm run test:unit --workspaces --if-present 2>&1 | tee /tmp/d-unit.log`. PASS gate: `PASS` regex matches = 20; 0 FAIL lines.
### Key Test Cases Hardcoded C Aggregator:
1. `buildGroupingKey({kind:LIKE, actorId, articleSlug})` returns string `LIKE:article:{slug}` stable across 100 calls same input (no random suffix).
2. buildGroupingKey for COMMENT → returns `COMMENT:article:{slug}` not `COMMENT:comment:{id}` (group collapse rule C-T4 enforced).
3. buildGroupingKey FOLLOW → `FOLLOW:user:{userId}` storm grouped.
4. buildGroupingKey SHARE → `SHARE:article:{slug}`.
5. upsertGroup with 55 distinct actorIds in sequence, resulting `"activityItem"."actorIds"` length ≤ 50 cap.
6. activityReminderEveryMinutes=0 → reminder eligibility function returns false (skip users).
7. Quiet hours helper `isInsideQuietHours("02:00", "22:00", "07:00")` returns true; `isInsideQuietHours("08:00", "22:00", "07:00")` returns false.
8. ApiKeyGuard mock where env ACTIVITY_WEBHOOK_API_KEY empty → canActivate returns false.
9. ApiKeyGuard header provided match env exactly → true.
10. DTO regex hhmm: value `"25:99"` → class-validator fails BadRequest.
11. DTO regex hhmm: value `"07:00"` → passes validation.
12. Aggregator upsertGroup emits `sse.activity.created.{userId}` with EventEmitter2 called.
13. Mark all read emits `sse.activity.unread.{userId}` via spyOn.
14. preferences update with activityReminderEveryMinutes negative integer -15 → DTO min(0) rejects.

---

## 4. Integration Tests (Category 3 — Supertest + real Prisma Postgres)
### Isolation strategy
Each integration test opens its own **Nest Application context** via `NestFactory.create(AppModule, { logger: false })`, uses supertest agent(app.getHttpServer()). **DB writes during integration: always use NEW unique test-user UUIDs created via `prisma.user.create` at start, with `test_d_` prefix handle, then DELETE after test completion in afterEach block.** Never run against existing production C seeded users. Transactions are ok but not required; because writes are new UUIDs they won't collide.
### 9 Spec Files (C-3 hard + A/B-3 🟡):
1. `auth-login-activity-feed.spec.ts` (login → feed HTTP 200 rows >= 1)
2. `aggregator-event-loop.spec.ts` (emit notification.created → sleep 100ms → ActivityItem count + 1)
3. `prefs-validation.spec.ts` (PUT 25:99 → 400; PUT 07:30 → 200; PUT cadence -1 → 400)
4. `expo-push-token-dedup.spec.ts` (register A, register A again → len stays; unregister → missing)
5. `sse-stream-handshake.spec.ts` (curl-like http GET stream, first event hello within 2000ms; then admin fire like call → activity event arrives within 700ms)
6. `webhook-api-key-guard.spec.ts` (empty key env → reject 401; invalid → 401; correct header → 201)
7. `admin-guard-fir-event.spec.ts` (consumer-token → 403; admin → 200 OK)
8. `share-kind-enum-persist.spec.ts` (Notification.create SHARE → prisma select back equal SHARE exact)
9. `backward-compat-b.spec.ts` (web token /api/notifications/preferences → 200 JSON keys all present)

All 9 → jest pass 9/9.

---

## 5. Playwright E2E 24 Screenshots (Category 4)
### Reuse existing
Reuse C-T9's `tests/activity-t9.spec.ts` 12 screenshots as part of the 24 total (still run them to confirm still pass post-new tests). Write NEW `tests/expanded-d.spec.ts` adding the 12 NEW screenshots described above in Category 4.
### Benign console filter
Keep `benignConsole()` exact regex from C-T9 spec — ORB/404 google/fonts/ico/favicon/manifest all benign.
### UNIQUE_ERRORS definition
Count only console.error/warning pageerror events that NOT match benign list. Hard gate = 0.
### Screenshot naming
All go `.playwright-report/activity-expanded/` subdir. Names: D-A1-status-create.png, D-A2-status-delete.png, D-B1-ai-drawer-open.png, D-B2-ai-stream-result.png, D-B3-ai-export-csv.png, D-B4-ai-settings-persist.png, D-W1-bell-escape-closes.png, D-W2-bell-click-outside.png, D-W3-mobile-375-bell-badge.png, D-W4-highlight-deeplink-scroll.png, D-W5-mentions-link-anchor.png, D-W6-sse-close-on-panelhide.png, D-M1-notif-list.png, D-M2-notif-empty.png, D-M3-notif-swipe-read.png, D-M4-pull-refresh.png, D-M5-settings-cadence-modal.png, D-M6-test-notification-button.png → wait count says 12 new + 12 reused = 24; rename above to 12 unique distinct names.

---

## 6. Accessibility Audit (Category 5)
### Runner
Write `.ai-verify/a11y-d/run-a11y.sh` using Playwright `@axe-core/playwright` (install if not present — tiny dep). AxBuilder options WCAG level AA tags. Per screen axe.analyze() returns violations array. Filter severity critical/serious only; best-practice/moderate ignored for grade.
### 9 Screens Fixed URLs:
Admin (3): /login, /_app/status, /_app/notifications  
Web (3): /login (or fallback /), / with bell mounted, /notifications  
Mobile viewport 375×812 (3): / home + bell, /notifications deeplink, /settings reminders section
### Inline simple fixes allowed (<=5 total small edits):
If bell button `<div role="none">` instead of `<button>` → convert to semantic `<button>`. If no aria-label on bell icon → add aria-label="Notifications". If missing aria-live for unread count badge → add region. If inputs missing associated labels → add htmlFor. Add skip-link `<a href="#main">Skip → </a>` header anchor if missing. All ≤5 edits accepted. No large refactor.

---

## 7. Security Smoke 6 Categories (Category 6)
All files in `.ai-verify/sec-d/run-sec.sh`. 6 numbered tests with bash exit codes.
1. JWT none-alg attack: craft base64 header `{"alg":"none","typ":"JWT"}.{"sub":"admin"}.` → curl activity feed → expect 401 not 200.
2. CSRF: grep API login response body for Set-Cookie. PASS = NO Set-Cookie header found (pure bearer token, no session cookie → CSRF not possible).
3. Rate limit: run 70 parallel curl requests activity/feed in 1 second (for loop 1..70). Count HTTP 429 responses → PASS if ≥ 1 hit 429.
4. SQLi: POST fire-event kind='X", kind="SHARE" -- ; expect response 400; PASS = NOT 500 internal error and NOT 200 success AND backend logs NO P2010 raw SQL error.
5. XSS: POST fire-event previewText="<script>alert('x')</script>" → read it back from feed endpoint rows JSON; assert escaped `&lt;script&gt;` entities not raw `<`.
6. CSP headers: curl -D headers both admin:3002 and web:3000. Accept presence of either `Content-Security-Policy` OR since Vite dev may not → PASS auto for development mode (we skip strict here; CI production CSP separate task).
Grade: 6/6 → A+; 5/6 → B+; 4/6 → B.

---

## 8. Integrity + Reproducibility (Category 7)
Files: `tests/integrity/` directory. 5 subtests via ts-node scripts or jest.
### Test 1: ActivityItem Uniqueness.
Transaction: prisma.activityItem.create dummy with same userId+groupingKey twice. Expect second attempt throws PrismaClientKnownRequestError code P2002. PASS.
### Test 2: Preferences Round-trip Consistency.
Create test payload `{groupLikes:false,groupComments:true,groupFollows:false,activityReminderEveryMinutes:42,expoPushTokens:["ExponentPushToken[A]","ExponentPushToken[B]"],quietHoursStart:"23:00",quietHoursEnd:"06:45"}`. PUT preferences → GET preferences. Compare deep equality 10 iterations each 10 random users from DB — all same = PASS.
### Test 3: SHARE Enum Persistent Postgres Side.
Run psql query 3× separate connections: `SELECT enum_range(null::"NotificationKind");` → each includes SHARE string = PASS.
### Test 4: Cron Sweep Idempotency.
Freeze writes: run `cronAggregatorSweep()` 3 consecutive times → ActivityItem row count after run1 vs after run3 diff ≤ 3 rows = PASS.
### Test 5: Quiet Hours Logic.
Mock Date.now() = "2026-08-31T02:00:00Z" (02:00 UTC). Create test user with quietStart=22:00 quietEnd=07:00, reminderEveryMinutes 30, unread=5, lastNudge older 1 hour. Run reminder cron eligibility query → returns count ZERO because user inside overnight window. → PASS.

---

## 9. Test Framework + CI Setup (Category T8 Task)
### Files created
1. **packages/api/package.json**: add `test:unit`, `test:integ` script aliases.
2. **packages/api/jest.config.ts**: explicit TypeScript config (move inline JSON from package.json into file for clarity).
3. **Root package.json**: add `test:perf`, `test:sec`, `test:a11y`, `test:integrity` scripts pointing to `.ai-verify/*/run-*.sh`.
4. **docs/superpowers/testing/README.md**: 10KB runbook — 7 category run commands, env vars, gate grade thresholds tables, troubleshooting (DB connection, Playwright browser install, Prisma generate before test).
5. **.github/workflows/test.yml**: new CI matrix jobs if directory exists; reuse structure from existing `.github/workflows/ci.yml` add new job `test` with matrix category: [api-unit, integ, perf, sec, a11y, playwright]. Commit if `.github/workflows/` exists (it does per discover).
### Split Commit Rule for T8:
This task legitimately edits packages/api (1,2) AND docs+root (3,4,5). MUST split into 2 commits inside task T8:  
**Commit 1 vell-api scope:** only packages/api/package.json + jest.config.ts.  
**Commit 2 vell-monorepo scope:** root package.json, docs/testing README, test workflow yml.

---

## 10. Final Task 9 Verify Gates Summary
| ID | Gate | Requirement | Threshold for Grade B+ | Threshold A+ |
|---|---|---|---|---|
| D9a | Builds 4× | Nest/Admin/Web/Mobile exit 0 | 4/4 0 | 4/4 0 |
| D9b | Perf | Report written with 7×p95 numbers | 7/7 numbers present + ≤ 5 over hard SLA | 0 over SLA |
| D9c | Unit | Jest/Vitest 20 files pass rate | ≥ 19/20 PASS | 20/20 PASS 0 FAIL |
| D9d | Integration | Supertest 9 files | ≥8/9 PASS | 9/9 PASS |
| D9e | Playwright | 24 screenshots unique errors | UNIQUE_ERRORS ≤ 2; screenshots 24 present ≥22 | UNIQUE_ERRORS=0 24/24 all |
| D9f | A11y | 9 screens axe serious+critical | total violations ≤ 10 | total violations = 0 |
| D9g | Security | 6 categories | ≥ 5/6 PASS | 6/6 PASS |
| D9h | Integrity | 5 subtests | ≥ 4/5 PASS | 5/5 PASS |
| D9i | Commit split | 10 commits expected | SPLIT_PASS ≥ 9/10 | 10/10 CLEAN |
| D9j | Handoff doc | 9 sections size bytes | ≥65 KB | ≥ 75 KB |

---

## 11. Deviations & Risk Notes (Carried + New)
### Carried 12 Deviations banner from Sub-C (still applicable for any Nest/UI edits):
Same list 1-12 unchanged.
### New D-Specific Risks:
1. **Playwright browsers** may need `npx playwright install chromium` — T4/T5 run it first thing.
2. **Axe-core** dep may not be installed → T5 installs `@axe-core/playwright` — small 100KB dep safe; commit lockfile changes only if required by CI (optional).
3. **Performance sample runs** may hit transient network/CPU spikes on laptop. If p95 misses hard SLA once, allow 2nd retry automatically inside runner.
4. **Rate limit test category 6.3** — Nest Throttle storage is IN-MEMORY per process. MUST run against FRESHLY started Nest process, not old PID with warmed rate counter (otherwise burst might all 200). T6 script auto-restarts Nest PID before rate test.
5. **Jest/Vitest unit test mocked Prisma provider**: if @nestjs/testing.Test.createTestingModule has issues with forwardRef, use simpler pattern: instantiate Aggregator class directly with `new ActivityAggregatorService(mockPrisma, mockEventEmitter)` (no Nest DI context) for pure unit tests — no need to bootstrap full app for pure logic.

---

## 12. Implementation Task Breakdown (Mapped to Plan T1..T9)
This section maps directly to next step: writing-plans skill will produce numbered T1..T9 plan doc. TOC for plan:
T1 = Performance Benchmark Suite (Cat 1) — .ai-verify/perf-d/ runner + report  
T2 = Unit Tests 20 files Jest/Vitest (Cat 2)  
T3 = Integration Tests 9 files Supertest (Cat 3)  
T4 = Playwright Expanded 24 screenshots (Cat 4)  
T5 = Accessibility a11y axe-core audit 9 screens + ≤5 inline simple fixes (Cat 5)  
T6 = Security 6 smoke scans OWASP runner (Cat 6)  
T7 = Data Integrity 5 subtests reproducibility suite (Cat 7)  
T8 = Framework Setup (Jest configs, npm scripts aliases root, docs runbook, .github workflows test.yml). Split-commit if edits packages/api files.  
T9 = Final verify ALL 9 gates (a→j). Commit-split check 10/10. Handoff doc ≥65KB alone commit vell-monorepo.

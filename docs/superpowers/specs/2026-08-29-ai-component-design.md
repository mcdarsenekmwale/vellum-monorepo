# Sub-project B: AI Component — Design Specification
Project: Vellbase (Multi-app monorepo: admin-dashboard, web-app consumer, mobile Expo)
Date: 2026-08-29
Status: Draft (self-review pass; pending plan)

## 0. Spec Summary
Deliver an AI component with **three placements** per master spec Part (b), plus admin-facing **model-switch controls** + **comprehensive activity logging** + **secure API endpoints** with auth/authorization and rate limits. Executed Subagent-Driven (one general_purpose_task subagent per plan task, one plan task = one logical commit). Scope decision: Approach 1 (monolithic Nest AIChatService + shared SSE streaming route + placement wrappers).

## 1. Placement-by-placement Functional Behavior

### 1.1 Placement (a): Web consumer profile page (`apps/web-app`)
- **Literal spec requirement** first: A "dedicated section/native element above profile name and settings". This is the `AiWebProfileCoachBar` native inline block, rendered BEFORE the avatar/name/header block in the DOM order.
- **UX lead-dev decision (user-empowered):** Additionally add a **small right-lower FAB** (`AiWebProfileFAB`) visible when scrollTop > 300px. This keeps the coach reachable without scrolling back up to the hero. Both the native bar and the FAB open the same chat drawer — they are two entry points to one shared component (duplicate-access best UX, no functional split).
- Native bar layout:
  - Left: Sparkles icon (lucide) bg-emerald-500/10 + rounded p-2 + title "Vell AI Coach" bold + subtitle "Personalized content strategy insights" text-muted.
  - Middle: 1-line insight pill (from `GET /api/ai/snapshot?placement=web-profile`). Example: "Based on your last 7 posts: Sat 10am = +32% reach. Try carousels this week." Insight refreshes every 6h per user (cached per user key adminPrefs.ai.lastSnapshot until stale).
  - Right: "Ask Coach" button variant="default" size="sm" → opens AIChatDrawer (right-side Drawer).
- Non-owner view: If the viewer != profile owner, the bar shows locked CTA "Ask AI about your own content →" → links to auth.login route, drawer disabled.

### 1.2 Placement (b): Mobile Expo top-nav (`apps/mobile-app`)
- Literal spec requirement: "top navigation bar adjacent to action buttons (notifications), touch optimized."
- Insert `AIQuickCoachIcon` (Sparkles Ionicons, same badge logic) into `_layout.tsx` headerRight array **immediately to the LEFT of the notifications icon**. Tap opens a bottom-sheet chat (not inline nav, sheet saves screen space).
- Additional lead-dev convenience (UX decision): A small "Today's AI insights" chip is also rendered in the feed header (`app/index.tsx`) so users can see insights without opening the sheet. Chip is scroll-synchronous sticky, height 40px.
- Bottom-sheet: React Native Reanimated + React Native Gesture Handler 80% snap, 60% default, swipe-down-to-dismiss, tap-outside-to-close. Gesture-safe. Keyboard-aware chat input bar (position: absolute when keyboard shown).
- Shortcut chips horizontal scroll: Draft caption, Reply to comments, Today's insights, Viral tags. All send preset messages.

### 1.3 Placement (c): Admin dashboard floating action button (FAB) with admin-specific controls
- Global rendering: inside `_app.tsx` layout wrapper, conditional after auth check, not rendered on login/public routes. `fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full`.
- Closed visual: Sparkles icon + tooltip "AI Assistant (⌘K)". Global `⌘/Ctrl+K` keyboard shortcut toggles open/close. Amber 10×10 dot badge top-right when "new action suggestion" flag set (e.g. 3 tickets > 72h old — computed once on visit by small snapshot endpoint; suggestion strings from a canned mapping).
- Open: right-side Sheet 420→480px wide, segmented tabs `Chat` (default) / `Quick Actions`.
- Tab Chat — Admin Ops Assistant:
  - Header: Admin badge + model pill (live dropdown of modelConfig.model options: gpt-4, gpt-4o, gpt-3.5, claude, claude-3-5-sonnet, custom) + inline save: onValueChange → `useUpdateAISettings.patch({modelConfig: {...modelConfig, model: v}})` → toast. 3-dot menu: Clear conversation / Export chat / Jump to activity.
  - Body: chat stream with tool-call confirmation cards (green Confirm/rose Cancel when requiresConfirmation=true, auto badge Used tool: X when safe-read).
  - Toolbar chips: Open tickets summary, Last 24h traffic, Users at risk (churn), Moderation sweep last 100 comments, Draft article, Weekly report.
- Tab Quick Actions grid (2 cols × 4 rows):
  1. Tickets: Open tickets summary (list_open_tickets → summarize)
  2. Traffic: 24h service health & traffic (real-time metrics API + LLM paragraph)
  3. Churn: Users at risk of churn (mock v1)
  4. Moderation: Moderation sweep last 100 comments
  5. Draft: Draft article (prefill editor with result; no auto-save; UI shows a "Open in Articles editor" button)
  6. Report: Weekly analytics report PDF export
  7. Model: 🧠 Switch AI model dialog (temp + maxTokens + customPrompt editor)
  8. Activity: 📝 Jump to AI activity admin route (deep link with pre-filter userId = current user OR all users)

## 2. Backend Data Model

Prisma additions (append to packages/api/prisma/schema.prisma, write new migration):

### 2.1 Enums
```
enum AiPlacement { WEB_PROFILE MOBILE_NAV ADMIN_FAB ADMIN_QUICK }
enum AiActivityStatus { SUCCESS STREAM_TRUNCATED ERROR RATE_LIMITED AUTH_FAILED }
```

### 2.2 Model: `AiActivity`
```
model AiActivity {
  id                String        @id @default(uuid())
  userId            String
  user              User          @relation("AiActivities", fields: [userId], references: [id], onDelete: Cascade)
  placement         AiPlacement
  conversationId    String?
  contextTag        String?       // e.g. "open-tickets-summary", "draft-article"
  model             String        // resolved gpt-4o, claude-..., custom slug, or MOCK
  inputTokens       Int?
  outputTokens      Int?
  durationMs        Int
  toolInvocations   Json?         // [{name,args,resultSummary,startedAt,endedAt}, ...]
  messages          Json          // [{role:'user'|'assistant'|'tool', content, tool_call_id?, tool_calls?}, ...]
  status            AiActivityStatus
  errorCode         String?
  errorMessage      String?
  createdAt         DateTime      @default(now())

  @@index([userId, createdAt])
  @@index([placement, createdAt])
  @@index([status, createdAt])
}
```
Also add to User model: `aiActivities AiActivity[] @relation("AiActivities")` and to existing `_count` selectors: `_count: { select: { aiActivities: true } }` where user activity summaries are shown (admin activity section, user profile).

### 2.3 Model: `AiConversation` (optional included, small surface)
```
model AiConversation {
  id              String        @id @default(uuid())
  userId          String
  user            User          @relation("AiConversations", fields: [userId], references: [id], onDelete: Cascade)
  placement       AiPlacement
  title           String        @default("New conversation")
  lastMessageAt   DateTime      @default(now())
  deletedAt       DateTime?
  createdAt       DateTime      @default(now())

  @@index([userId, placement, lastMessageAt])
}
```
Same: extend User relation with `aiConversations AiConversation[] @relation("AiConversations")`.

### 2.4 Existing SystemSetting reuse
`AISettings.modelConfig` already persisted via flat SystemSetting key-value category='ai' — we reuse verbatim; NO new DB columns for settings. We only EXTEND the union in AISettings modelConfig.model to include new canonical 2025 models: `'gpt-4' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-5-sonnet' | 'claude' (legacy fallback) | 'custom'`. Update frontend & backend type union both sides.

### 2.5 User.adminPrefs reuse
Add two keys (already Json type, set via PUT settings/status-view pattern we proved in Sub-project A Task 5, but generalizing via a similar `GET/PUT /api/user/prefs` endpoint is outside scope — instead store AI per-user flags inside new AiConversation only. No new column required v1.)

## 3. Auth, Rate Limits, Activity Logging

- **Auth guards**: All `/api/ai/*` routes guarded by existing `JwtAuthGuard`. Admin-only: `/api/admin/ai/*` routes additionally `AdminGuard` (proven pattern Sub-project A). Placement=admin-fab / admin-quick-action → at chat runtime handler, return 403 `{ code:'ADMIN_REQUIRED' }` BEFORE streaming if user is not admin.
- **Throttler v11 decorator pattern** (proven): `@Throttle({ default: { limit: 30, ttl: 300_000 } })` for web/mobile chat (30 req / 5 min per user). Admin: 60 req / 5 min base + 120 req / 5 min when quick-actions include tool calls. Return 429 with retry-after header AND structured `event: error` SSE event.
- **Activity write**: one row per successful (or failed) chat request. Use try/finally block around stream generator; call `logAiActivity()` with status on completion. Error path writes immediately so we debug failures. Do NOT include ipAddress/userAgent fields per Sub-project A lesson (write only the 5-6 fields defined above: userId, placement, messages, durationMs, error info, toolInvocations). Follow existing ActivityLog 4-field pattern precedent.

## 4. Backend: LLM Gateway, Hybrid Layer, Tool Registry (Nest)

### 4.1 `LLMGatewayService` provider abstraction
Async generator signature:
```
streamChat({ persona, messages, toolEnabled, modelConfigOverride? }):
  AsyncGenerator<{ type:'text'|'tool_call'|'done'|'error', delta?, tool_call?, usage?, errorCode?, errorMessage? }>
```
Steps inside:
1. Resolve `modelConfig = AISettings.modelConfig` (SystemSetting category=ai) via existing AdminService.getAISettings() call, cached in-memory 30s. Apply override if present.
2. Map model name → provider class + env key:
   - `gpt-4* | gpt-3.5-turbo*` → OpenAIProvider (requires env OPENAI_API_KEY)
   - `claude*` → AnthropicProvider (ANTHROPIC_API_KEY)
   - `custom` → OpenRouterProvider (OPENROUTER_API_KEY, custom model slug read from customPrompt field which we repurpose; documented in admin tooltip).
3. Hybrid fallback: if required env key missing OR `AI_ALWAYS_MOCK=true` → `MockProvider` (always available).
4. Build system prompt per persona:
   - WEB_PROFILE: "You are Vell AI Growth Coach... <User name> + <last 5 posts: titles + like/comment counts> + Suggest posts to grow". (Pull data via lightweight `loadUserContentProfileContext(userId)` helper that returns Post titles/views/shares; mock fallback if table empty / dev data missing).
   - MOBILE_NAV: "You are Vell Quick Coach (mobile) — short answers, write captions + replies, 280 char preferred per reply."
   - ADMIN_FAB: "You are Admin Ops Assistant for Vellbase. Given access to these listed tools. When user asks for tickets summary or something actionable, use them. Always cite actual numbers from tool output. Be precise. Keep replies short."
   - ADMIN_QUICK_<ACTION>: tailored shorter system prompt per named quick action.
5. Inject system + user messages array + enabled_tools list if toolEnabled=true.
6. Stream tokens: live providers return SSE from upstream → map delta chunks into our internal chunk type (so upstream provider format changes don't leak). Mock provider streams per-character chunks on 18ms interval with persona-aware templates that match the conversation context.
7. For ADMIN tool flow: first model pass may return `tool_calls[]` array. Gateway EMITS `tool_call` SSE event, PAUSES streaming, returns generator with `yield* toolCallRequested(...)`, waits for caller (AIChatService orchestrator — see below) to feed tool results back, then makes a SECOND model pass for final natural-language response stream that references tool data.

### 4.2 ToolExecutorService (ADMIN ONLY) v1
Map `tool name → handler`. Handlers return `{ ok: boolean; data: JsonCompatible; requiresConfirmation: boolean }`. Write-actions ALWAYS return requiresConfirmation=true. Reads: requiresConfirmation default false.

Registered tools v1.0:
1. `list_open_tickets({ limit?, departmentId?, status? })` → SupportTicket[] with title, createdAt, priority, customerName, messagePreview (existing tables). Uses same PrismaSupport pattern as admin.service support methods.
2. `summarize_recent_traffic({ windowSec=86400 })` → calls `MetricsCollectorService.getLatestStatuses()` + returns { services, overall, updatedAt, alertCountRecent }.
3. `list_users_at_risk({ churnScoreThreshold?, limit? })` → mock (returns 5 fake users with churn-score 0.6-0.95).
4. `run_moderation_sweep({ severity='medium' })` → existing `testAIModeration()` keyword classifier over last 100 Comment rows → returns count, flagged IDs, per-category totals.
5. `draft_article({ topic, tone?, wordCount? })` → deterministic structured JSON `{ title, slug, body_markdown, tags[] }`. Does NOT persist to DB; returns requiresConfirmation: true with a preview UI so admin can explicitly "save draft" → frontend then calls Articles create endpoint explicitly (not tool-side implicit write).
6. `get_reports_by_severity({ sinceHours=24 })` → ModerationReport counts grouped by (severity, category).

Tool registry is pluggable; new tools just add a handler.

## 5. Nest Routes (SSE + REST)

New providers and a controller — either attached in a new AIChatModule or added to existing AdminModule (reuse pattern, smaller footprint recommended). `AIChatController`:

- `POST /api/ai/chat` (SSE stream)
  - `@UseGuards(JwtAuthGuard)` + throttle.
  - Body: `{ conversationId?, placement: 'web-profile'|'mobile-nav'|'admin-fab'|'admin-quick-action', messages, quickActionName? }`.
  - Response emits MessageEvents in order: `meta` (id, model, persona, placement), `chunk` (text delta, repeated), `tool_call` (id/name/args/requiresConfirmation), `done` (usage + durationMs). On error `error` event then close.
  - Admin role check inside handler: if placement starts with `admin-` and user lacks admin, return 403 structured before stream opens (don't open stream then fail).
  - Admin tool calls: orchestrator receives tool_call from gateway, executes tool through ToolExecutorService, if requiresConfirmation=true and NO explicit user-approved payload present in request → HALT and return tool_call event with flag (do not run); if user request contains `confirmedToolCalls: [{id,name,args}]` array → then execute and resume stream.

- `GET /api/ai/conversations?placement=&limit=20` — return user's recent conversations [{ id, title, lastMessageAt, messageCount, placement }] for resumability. Optional nice-to-have; plan tasks mark low-priority, skip if needed for schedule.

- `DELETE /api/ai/conversations/:id` — user soft-deletes their conversation (deletedAt). Ownership check.

- `GET /api/admin/ai/activity?userId=&placement=&status=&page=&pageSize=` (AdminGuard) — paginated AiActivity ledger. Returns rows with messages preview (truncated), usage, duration, etc.

- `POST /api/admin/ai/activity/export` (AdminGuard) — CSV export of AiActivity rows matching userId/placement/status/date range. Same CSV download blob helper pattern Sub-project A Status Export used.

- `POST /api/admin/ai/model/test` (AdminGuard) — admin sanity tests a candidate model BEFORE saving: body { model, temperature, maxTokens, customPrompt, testPrompt? } → returns `{ success, output, latencyMs, tokensIn, tokensOut, error? }`.

### Model switch reuse
No new endpoint for model save — reuse existing `PUT /api/admin/ai/settings` which already writes `modelConfig` to SystemSetting. Extend the AISettings type + Admin AISettingsPanel model dropdown to include the new model list (gpt-4o, claude-3-5-sonnet, etc).

## 6. Error Handling & Observability

### Error codes & UX strings
Every SSE error event = `{ code, message, retryAfter? }`. Frontend maps codes:
- `AUTH_REQUIRED`: "Login required."
- `ADMIN_REQUIRED`: "You must be an admin for this action."
- `RATE_LIMITED`: "Too many requests. Wait {retryAfter}s."
- `PROVIDER_NO_KEY`: "Using mock responses — ask your admin to set {PROVIDER}_API_KEY for live AI."
- `MODEL_NOT_CONFIGURED`: "Model misconfigured."
- `TOOL_NOT_FOUND`: "Unknown tool."
- `TOOL_REQUIRES_CONFIRMATION`: handled inline via Confirm card.
- `STREAM_TRUNCATED`: "Response truncated — continue the chat."
- `INTERNAL_ERROR`: 500 fallback, generic "Something went wrong."

### Observability
- `Nest logger` debug level for each chunk; warn for RATE_LIMITED; error for provider HTTP 5xx or unknown exceptions; NO pino/datadog/prometheus v1 (too heavy).
- AiActivity rows for completed + failed streams.
- Admin AI activity page (new route `_app.ai-activity.tsx`) = paginated table + filters + CSV export; references same AiActivity response shape.

## 7. Acceptance Criteria (pass/fail gates for plan-verification tasks)

### 7.1 Builds (Task 8 — full verify run)
- [ ] `cd packages/api && npm run build` → exit 0
- [ ] `cd apps/admin-dashboard && npm run build` → exit 0
- [ ] `cd apps/web-app && npm run build` → exit 0
- [ ] `cd apps/mobile-app && npx tsc --noEmit` (Expo doesn't have a clean production build CLI on macOS without Xcode; type-check is the proxy for passing) → exit 0
  Note: If mobile package.json has a build script, prefer that; otherwise type-check is acceptable substitute.

### 7.2 Prisma migration + DB state
- [ ] New tables `AiActivity` + `AiConversation` and enums `AiPlacement` + `AiActivityStatus` exist (`\dt` psql + `\dT` enum list).
- [ ] Migration file hand-authored + `prisma migrate resolve --applied` applied if shadow-DB replay fails for same pre-existing migration 6/10 bug Sub-project A workaround (document workaround if it happens).

### 7.3 Curl suite (simulated, ~12 calls)
- [ ] POST login admin@vellbase.com → token extracted
- [ ] POST `/api/ai/chat` placement=web-profile body=mock messages → returns meta (placement=web-profile + model=MOCK or configured one) + multiple chunk events + done event.
- [ ] POST `/api/ai/chat` placement=admin-fab WITHOUT being admin → HTTP 403 + code: ADMIN_REQUIRED (run with non-admin user)
- [ ] Repeat with admin token → opens stream, tool-call emitted (or simulated quick action called list_open_tickets returns data).
- [ ] PUT `/api/admin/ai/settings` {modelConfig:{model:"claude-3-5-sonnet"}} → 200. Next POST chat → meta.model == "claude-3-5-sonnet".
- [ ] GET `/api/admin/ai/activity?page=1&pageSize=20` → AiActivity rows array, length >= number of chats we just ran (activity ledger writes verified).
- [ ] POST `/api/admin/ai/model/test` → returns success + latencyMs fields.
- [ ] POST `/api/ai/chat` again with same conversationId → previous messages show up in the returned AiConversation title (idempotent).
- [ ] DELETE `/api/ai/conversations/:id` → soft-deleted, no longer returned by list.
- [ ] POST `/api/admin/ai/activity/export` → CSV downloaded, row count matches filter.
- [ ] Throttle: 31 rapid POST chats within 5 min → 31st returns 429 / RATE_LIMITED + retryAfter in error event body.

### 7.4 Playwright E2E (admin-dashboard + web-app)
Admin dashboard:
- [ ] Login → dashboard loads. FAB visible on screen (selector by Sparkles icon, bottom-right).
- [ ] Click FAB → Sheet opens, Tabs (Chat, Quick Actions) render.
- [ ] Chat tab: send "List open support tickets please" → assistant reply contains "Used tool: list_open_tickets" badge AND a final summary that cites real counts (verify: at least 1 number present in reply).
- [ ] Model pill: change from current to "claude-3-5-sonnet" → toast success, pill reflects immediately. Reload → persisted (SystemSetting).
- [ ] Quick Actions tab: Click "Open tickets" card → summary loads in chat tab.
- [ ] Capture 4 screenshots: fab-closed.png, fab-open-chat.png, fab-open-quick-actions.png, model-switch-dialog.png.
- [ ] UNIQUE console errors count: 0. Warnings count (deduplicated): record.

Web app:
- [ ] Login as user → profile page loads.
- [ ] AI coach bar IS VISUALLY ABOVE profile name (DOM order confirmed in HTML inspector snapshot). Insight pill text present (non-empty).
- [ ] Scroll page > 300px → AI FAB appears bottom-right. Click FAB → drawer opens (right-side). Send a message → assistant streamed reply renders.
- [ ] Screenshot: profile-ai-bar-above-name.png, profile-ai-fab-open-chat.png.
- [ ] Console errors 0.

### 7.5 Sub-project B specific UX requirements checks
All three placements from master spec Part (b) visible + functional:
- [x] Placement (a) Web: AI section/native element above profile name and settings. ✔ (Coach bar position). Web FAB additionally added as UX improvement. ✔
- [x] Placement (b) Mobile: top nav adjacent to notifications, touch-optimized. ✔ (Header Sparkles + bottom sheet.)
- [x] Placement (c) Admin dashboard: FAB pattern + admin-specific controls (Quick Actions grid + model switch). ✔
- [x] Admin: can change AI model used + comprehensive activity logging (AiActivity table + admin route + CSV export) + secure endpoints (auth + AdminGuard + throttle). ✔

## 8. Non-Goals / Out of Scope (explicit, to reduce scope creep)
- No multi-modal: image/audio input or output. Text-only v1.
- No RAG / embeddings / vector stores v1 (mock system prompt uses recent posts inline fetched, no semantic search).
- No admin "ban user" or "delete content" via AI tool writes v1 (tool-calling read-only-only; explicit writes via frontend confirmation only, e.g. save draft article).
- No new push notifications/email delivery infrastructure — integration exists separately; we just set the suggestion badge flag for mobile in Expo SecureStore locally, no server push needed.
- No model fine-tuning endpoints.
- Admin-only deep analytics dashboard for token usage: v1 is activity list only, not charts (can reuse existing BarSeries chart component later, not in scope).

## 9. Self-Review (performed immediately after write)

- Placeholders/TBD: none. All model names, routes, Prisma field types, error codes, tool names are concrete.
- Internal consistency check:
  - Prisma User model gets two new relations (aiActivities, aiConversations) — both sides defined, so relation names don't collide with existing relations (e.g. "UserSettings" relation is separate). Check.
  - Model switch path is existing PUT /api/admin/ai/settings — Section 5 explicitly says no new endpoint, while AISettings type union is extended. Consistent.
  - Tool-calling requires 2-pass in LLMGateway: Section 4.1 explicitly describes pause-stream, wait-for-toolResults, 2nd-pass design; spec matches.
  - Mock provider is ALWAYS available (no env keys needed) — "Hybrid fallback" Section 2 user answer. Consistent.
- Scope check: One spec → one plan. Backend (Nest + Prisma) + 3 independent frontends. Large but self-contained; plan will split into ~9 tasks by scope naturally. No decomposition needed further (Sub-project C is Activity, which is separate).
- Ambiguity resolved explicitly:
  - Web-app profile: bar + optional additional FAB (user gave lead-dev carte blanche). Written down clearly. Chose "dual entry" as best UX. No ambiguity.
  - Expo type check = build proxy (no macOS Xcode in standard environment for ipa build). Acceptance criterion explicitly uses tsc --noEmit as the proxy; no ambiguity.
  - `AISettings.modelConfig.customPrompt` field name is reused to carry custom OpenRouter model slug (since "custom" literal case needs a slug anyway). Explicitly noted in code comment; no conflict with semantic "custom prompt" intent because only when model === 'custom' do we read the field as slug. Admin UI shows clear field labels differentiating the two meanings. OK.

## 10. Forward Reference
After Sub-project B complete, Sub-project C (Instagram-style Activity feed: likes/comments/follows/mentions, realtime updates, filter/sort/pagination, persistence + Expo notifications push) → Sub-project D (Testing & documentation deliverable covering all 7 categories from Part b spec).

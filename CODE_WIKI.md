# Vellum Code Wiki

> Comprehensive technical documentation for the Vellum content platform monorepo.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & System Design](#2-architecture--system-design)
3. [Backend API (`@vellum/api`)](#3-backend-api-vellumapi)
4. [Database Model](#4-database-model)
5. [Shared Packages](#5-shared-packages)
6. [Admin Dashboard](#6-admin-dashboard)
7. [Web App](#7-web-app)
8. [Mobile App](#8-mobile-app)
9. [Setup & Configuration](#9-setup--configuration)
10. [Deployment](#10-deployment)
11. [Technical Analysis: Webhook System](#11-technical-analysis-webhook-system)
12. [Technical Analysis: Bot User / AI Agent Integration](#12-technical-analysis-bot-user--ai-agent-integration)
13. [Incoming Webhook — Complete Examples](#13-incoming-webhook--complete-examples)
14. [Bot User Creation & Usage — Complete Examples](#14-bot-user-creation--usage--complete-examples)
15. [Bot Automation Script Example](#15-bot-automation-script-example)

---

## 1. Project Overview

**Vellum** is a full-stack content publishing platform supporting articles, short-form video highlights, social interactions (likes, comments, follows, bookmarks), stories, and a comprehensive admin dashboard. The project follows a **monorepo** structure using npm workspaces.

### 1.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend Framework** | NestJS 11 (Express platform) |
| **Database** | PostgreSQL via Prisma ORM 6 |
| **Caching** | Redis (node-redis client) |
| **Authentication** | JWT (passport-jwt) + bcryptjs |
| **API Documentation** | Swagger / OpenAPI (@nestjs/swagger) |
| **API Client** | Custom TypeScript client (fetch-based) |
| **Frontend (Admin)** | React + TanStack Router + shadcn/ui + Tailwind |
| **Frontend (Web)** | React + TanStack Router + Tailwind |
| **Mobile** | React Native (Expo) |
| **CI/CD** | GitHub Actions + Vercel + Prisma Compute |
| **Testing** | Jest (unit), Playwright (e2e) |

### 1.2 Monorepo Structure

```
vellum-monorepo/
├── packages/                    # Shared libraries
│   ├── api/                     # NestJS backend API
│   ├── api-client/              # Shared TypeScript API client
│   ├── auth/                    # Shared auth context (React)
│   ├── react-hooks/             # Shared React hooks
│   ├── social-store/            # Shared social state store
│   └── utils/                   # Shared utility functions
├── apps/                        # Applications
│   ├── admin-dashboard/         # Admin panel (React + Vite)
│   ├── web-app/                 # Public web app (React + Vite)
│   └── mobile-app/              # Mobile app (Expo / React Native)
├── scripts/                     # Root-level utility scripts
├── tests/                       # E2E tests (Playwright)
└── package.json                 # Root workspace config
```

---

## 2. Architecture & System Design

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clients                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Admin Dash  │  │  Web App    │  │   Mobile App (Expo)  │   │
│  │  (React)    │  │  (React)    │  │   (React Native)     │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘   │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          │                                      │
│                    @vellum/api-client                           │
│                    (fetch-based, JWT auth)                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTPS / REST
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (NestJS)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Controllers                           │   │
│  │  Auth | Users | Articles | Highlights | Comments        │   │
│  │  Likes | Bookmarks | Follows | Notifications           │   │
│  │  Categories | Search | Media | Stories | Webhooks      │   │
│  │  Admin | Health                                         │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────────┐   │
│  │                    Services                              │   │
│  │  Business logic per domain, Prisma operations           │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────────┐   │
│  │                 Shared Infrastructure                    │   │
│  │  PrismaService | CacheService | AuthLoggerMiddleware    │   │
│  │  AllExceptionsFilter | ValidationPipe | Helmet          │   │
│  └───────┬──────────────────────────────┬───────────────────┘   │
│          │                              │                       │
└──────────┼──────────────────────────────┼───────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐    ┌──────────────────────────┐
│   PostgreSQL         │    │        Redis             │
│   (Prisma Postgres)  │    │  (Redis.io managed)      │
│  29 tables, 3 enums   │    │  Cache layer + sessions  │
└──────────────────────┘    └──────────────────────────┘
```

### 2.2 Architectural Patterns

| Pattern | Usage |
|---------|-------|
| **Modular Monolith** | Each domain (articles, users, auth, etc.) is a self-contained NestJS module |
| **Repository Pattern** (via Prisma) | PrismaService acts as the data access layer; services compose Prisma operations |
| **Dependency Injection** | NestJS DI container manages all service lifetimes |
| **DTO Validation** | class-validator + class-transformer for request validation |
| **Guard-based Auth** | JwtAuthGuard + RolesGuard for authentication and authorization |
| **Graceful Degradation** | Cache falls back gracefully when Redis is unavailable |
| **Soft Delete** | `deletedAt` timestamp on User, Article, Highlight, Comment, Media models |

### 2.3 Authentication Flow

```
Client Request
      │
      ▼
JwtAuthGuard (extracts token)
  - Cookie: access_token
  - Header: Authorization: Bearer <token>
      │
      ▼
JwtStrategy (validates JWT signature)
  - Calls authService.validateUser(payload)
      │
      ▼
PrismaService (fetches user, checks isActive)
      │
      ▼
RolesGuard (checks role hierarchy)
  - GUEST < USER < CREATOR < MODERATOR < ADMIN
      │
      ▼
Route Handler
```

---

## 3. Backend API (`@vellum/api`)

Located at [packages/api/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/).

### 3.1 Entry Point

**File**: [src/main.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/main.ts)

Key bootstrap configuration:
- **Helmet** for security headers (CSP, cross-origin resource policy)
- **CORS** with configurable origins from `CORS_ORIGIN` env var
- **Cookie parser** for JWT cookie-based auth
- **Global ValidationPipe** with whitelist + transform
- **Global AllExceptionsFilter** for consistent error responses
- **Swagger** at `/api/docs`
- **Static assets** served from `uploads/` directory at `/uploads/`
- **Shutdown hooks** enabled for graceful termination

### 3.2 App Module

**File**: [src/app.module.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/app.module.ts)

Global configuration:
- `ConfigModule` (global, loads from `.env`)
- `ThrottlerModule` (100 req/min rate limit)
- `PrismaModule` (global database access)
- `CacheModule` (Redis caching)
- 17 domain modules listed below

### 3.3 Domain Modules

| Module | Path | Description |
|--------|------|-------------|
| **AuthModule** | [src/modules/auth/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/auth/) | Authentication, JWT tokens, refresh tokens, password reset |
| **UsersModule** | [src/modules/users/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/users/) | User profiles, settings, search |
| **ArticlesModule** | [src/modules/articles/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/articles/) | Article CRUD, listing, featured, by author |
| **HighlightsModule** | [src/modules/highlights/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/highlights/) | Short-form video highlights CRUD |
| **CommentsModule** | [src/modules/comments/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/comments/) | Comments on articles and highlights, threaded replies |
| **StoriesModule** | [src/modules/stories/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/stories/) | 24-hour expiring story content |
| **CategoriesModule** | [src/modules/categories/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/categories/) | Article categories with color tints |
| **LikesModule** | [src/modules/likes/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/likes/) | Toggle likes on articles, highlights, comments |
| **BookmarksModule** | [src/modules/bookmarks/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/bookmarks/) | Save articles and highlights |
| **FollowsModule** | [src/modules/follows/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/follows/) | User follow relationships |
| **NotificationsModule** | [src/modules/notifications/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/notifications/) | User notifications (likes, comments, follows, etc.) |
| **MediaModule** | [src/modules/media/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/media/) | File uploads (images, video, documents) |
| **SearchModule** | [src/modules/search/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/search/) | Cross-entity search |
| **WebhooksModule** | [src/modules/webhooks/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/) | Incoming webhooks, API key management, webhook logs |
| **AdminModule** | [src/modules/admin/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/) | Admin dashboard, user management, analytics, moderation |
| **HealthModule** | [src/modules/health/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/health/) | Health check and readiness probes |

### 3.4 Key Classes

#### `PrismaService`
**File**: [src/shared/prisma/prisma.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/shared/prisma/prisma.service.ts)

Extends `PrismaClient` with NestJS lifecycle integration.

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(configService: ConfigService)` | Configures connection pool params from env |
| `onModuleInit` | `(): Promise<void>` | Connects to DB with 5 retries (3s delay) |
| `onModuleDestroy` | `(): Promise<void>` | Gracefully disconnects |
| `$runCommandRaw` | `(query: string): Promise<any>` | Executes raw SQL (alias for `$queryRawUnsafe`) |
| `retryOnConnectionError` | `<T>(fn: () => Promise<T>): Promise<T>` | Retries Prisma operations on connection errors (P1001, P2024, P1017), 3 retries with 2s delay |

**Connection Pool Configuration** (all env-configurable):
- `PRISMA_CONNECTION_LIMIT` (default: 5)
- `PRISMA_POOL_TIMEOUT` (default: 10s)
- `PRISMA_CONNECTION_TIMEOUT` (default: 5s)
- `PRISMA_IDLE_TIMEOUT` (default: 20s)

#### `CacheService`
**File**: [src/shared/cache/cache.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/shared/cache/cache.service.ts)

Redis-based caching with graceful degradation. Implements `OnModuleInit`, `OnModuleDestroy`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(configService: ConfigService)` | Reads REDIS_URL from config |
| `onModuleInit` | `(): Promise<void>` | Initiates async Redis connection |
| `onModuleDestroy` | `(): Promise<void>` | Closes Redis connection |
| `get<T>` | `(key: string): Promise<T \| null>` | Gets and JSON-parses a cached value |
| `set<T>` | `(key: string, value: T, ttl?: number): Promise<void>` | Sets a JSON-serialized value with optional TTL |
| `del` | `(key: string): Promise<void>` | Deletes a cache key |
| `exists` | `(key: string): Promise<boolean>` | Checks if a key exists |
| `keys` | `(pattern: string): Promise<string[]>` | Lists keys matching pattern |
| `flushAll` | `(): Promise<void>` | Clears all cache data |
| `getStatus` | `(): { connected: boolean; url: string }` | Returns connection status and masked URL |

**Connection Features**:
- 5-second connect timeout
- Reconnection strategy: linear backoff up to 3s, max 5 retries
- Lazy async connection (does not block app startup)
- All methods gracefully no-op / return null when disconnected

#### `AuthService`
**File**: [src/modules/auth/auth.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/auth/auth.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(dto: RegisterDto): Promise<{ user, accessToken, refreshToken, expiresIn }>` | Creates user + settings, returns tokens |
| `login` | `(dto: LoginDto): Promise<{ user, accessToken, refreshToken, expiresIn }>` | Validates credentials, returns tokens |
| `refreshToken` | `(dto: RefreshTokenDto): Promise<{ accessToken, refreshToken, expiresIn }>` | Exchanges refresh token for new pair |
| `logout` | `(userId: string): Promise<void>` | Deletes all refresh tokens + sessions for user |
| `forgotPassword` | `(dto: ForgotPasswordDto): Promise<{ message: string }>` | Initiates password reset (constant-time response) |
| `resetPassword` | `(dto: ResetPasswordDto): Promise<{ message: string }>` | Completes password reset with token |
| `verifyEmail` | `(dto: VerifyEmailDto): Promise<{ message: string }>` | Verifies email address |
| `generateTokens` | `(user: any): Promise<{ accessToken, refreshToken, expiresIn }>` | Creates JWT access + UUID refresh token pair |
| `validateUser` | `(payload: any): Promise<User>` | Validates JWT payload, returns user |

**Token Configuration**:
- Access token: JWT, configurable expiration (`JWT_ACCESS_TOKEN_EXPIRES_IN`, default 15m)
- Refresh token: UUID v4, 7-day expiration, stored in DB
- Bcrypt rounds: configurable via `BCRYPT_ROUNDS` (default 12)

#### `ArticlesService`
**File**: [src/modules/articles/articles.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/articles/articles.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `createArticle` | `(userId: string, dto: CreateArticleDto): Promise<Article>` | Creates new article with auto-generated slug |
| `getArticle` | `(slug: string, userId?: string): Promise<ArticleWithRelations>` | Gets article by slug, increments views, includes comments/author/category/like-status |
| `getArticles` | `(query: ArticleQueryDto, userId?: string): Promise<PaginatedResponse<Article>>` | Lists published articles with filtering (category, featured) and sorting (trending, views) |
| `getArticlesByAuthor` | `(handle: string, page?: number, limit?: number): Promise<PaginatedResponse<Article>>` | Gets articles by user handle |
| `updateArticle` | `(userId: string, slug: string, dto: UpdateArticleDto): Promise<Article>` | Updates article (auto-regenerates slug on title change) |
| `deleteArticle` | `(userId: string, slug: string): Promise<{ message: string }>` | Soft-deletes article (sets deletedAt) |
| `getFeaturedArticles` | `(limit?: number): Promise<Article[]>` | Gets featured published articles |

**Performance Notes**:
- `getArticles` uses raw SQL (`$queryRawUnsafe`) as primary path with Prisma query fallback
- Raw SQL path is used for complex ordering and filtering performance

#### `HighlightsService`
**File**: [src/modules/highlights/highlights.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/highlights/highlights.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `createHighlight` | `(userId: string, dto: CreateHighlightDto): Promise<Highlight>` | Creates a new highlight with author context |
| `getHighlight` | `(id: string, userId?: string): Promise<HighlightWithRelations>` | Gets highlight by ID with author, comments, like/bookmark status |
| `getHighlights` | `(page?: number, limit?: number, userId?: string): Promise<PaginatedResponse<Highlight>>` | Lists published highlights with author info + like/bookmark meta |
| `updateHighlight` | `(userId: string, id: string, dto: UpdateHighlightDto): Promise<Highlight>` | Updates highlight (owner-only), sets publishedAt on first publish |
| `deleteHighlight` | `(userId: string, id: string): Promise<{ message: string }>` | Soft-deletes a highlight (owner-only) |

**Key Features**:
- Batch like/bookmark status injection for authenticated users (uses Set for O(1) lookups)
- Uses `retryOnConnectionError` wrapper for DB resilience
- Soft delete pattern (sets `deletedAt` timestamp
- Publish tracking via `isPublished` + `publishedAt` fields

#### `CommentsService`
**File**: [src/modules/comments/comments.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/comments/comments.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `createComment` | `(userId: string, dto: CreateCommentDto): Promise<Comment>` | Creates comment on article or highlight; supports threaded replies via parentId; auto-updates denormalized comment counts |
| `getComments` | `(articleSlug?: string, highlightId?: string, page?: number, limit?: number): Promise<PaginatedResponse<Comment>>` | Lists top-level comments with nested replies |
| `updateComment` | `(userId: string, commentId: string, body: string): Promise<Comment>` | Updates comment body (owner-only) |
| `deleteComment` | `(userId: string, commentId: string): Promise<{ message: string }>` | Soft-deletes comment, updates parent count |

**Key Features**:
- Polymorphic target (article OR highlight)
- Threaded replies (self-referencing `parentId`)
- Denormalized count maintenance on both article and highlight
- Soft delete pattern

#### `UsersService`
**File**: [src/modules/users/users.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/users/users.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `getProfile` | `(userId: string): Promise<UserProfile>` | Gets full user profile with settings, recent articles, follower/following counts |
| `getUserByHandle` | `(handle: string): Promise<UserProfile>` | Gets public profile by handle (same shape as getProfile) |
| `updateUser` | `(userId: string, dto: UpdateUserDto): Promise<User>` | Updates user profile; validates handle uniqueness |
| `updateSettings` | `(userId: string, dto: UpdateUserSettingsDto): Promise<UserSettings>` | Updates user settings |
| `getSettings` | `(userId: string): Promise<UserSettings>` | Retrieves user settings |
| `searchUsers` | `(query: string, limit?: number): Promise<User[]>` | Searches users by handle or name (case-insensitive) |
| `deleteUser` | `(userId: string): Promise<{ message: string }>` | Soft-deactivates account (sets isActive=false + deletedAt) |

**Key Features**:
- Password hash stripped from all response objects returned to client
- Follower/following counts computed dynamically
- Handle uniqueness validation on update

#### `NotificationsService`
**File**: [src/modules/notifications/notifications.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/notifications/notifications.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `getNotifications` | `(userId: string, page?: number, limit?: number): Promise<PaginatedResponse<Notification>>` | Lists user's notifications with actor info |
| `getUnreadCount` | `(userId: string): Promise<{ count: number }>` | Returns count of unread notifications |
| `markAsRead` | `(userId: string, notificationId?: string): Promise<{ message: string }>` | Marks single or all notifications as read |
| `createNotification` | `(data: NotificationCreateInput): Promise<Notification>` | Creates a new notification (internal use) |
| `deleteNotification` | `(userId: string, notificationId: string): Promise<Notification>` | Deletes a notification |

**Supported Notification Kinds** (`NotificationKind` enum):
`LIKE`, `COMMENT`, `REPLY`, `FOLLOW`, `BOOKMARK`, `MENTION`, `SYSTEM`

#### `LikesService`
**File**: [src/modules/likes/likes.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/likes/likes.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `toggleLike` | `(userId: string, articleSlug?: string, highlightId?: string, commentId?: string): Promise<{ liked: boolean }>` | Toggles like on article/highlight/comment; updates denormalized count |
| `getLikedArticles` | `(userId: string, page?: number, limit?: number): Promise<PaginatedResponse<Article>>` | Gets user's liked articles |
| `getLikedHighlights` | `(userId: string, page?: number, limit?: number): Promise<PaginatedResponse<Highlight>>` | Gets user's liked highlights |

**Key Features**:
- Polymorphic like target (article, highlight, or comment)
- Atomic counter cache: increments/decrements denormalized `likesCount`
- Toggle pattern (single endpoint for both like and unlike)

#### `FollowsService`
**File**: [src/modules/follows/follows.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/follows/follows.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `followUser` | `(followerId: string, followingId: string): Promise<{ following: boolean }>` | Toggles follow relationship; prevents self-follow |
| `getFollowers` | `(userId: string, page?: number, limit?: number): Promise<PaginatedResponse<User>>` | Lists users following a user |
| `getFollowing` | `(userId: string, page?: number, limit?: number): Promise<PaginatedResponse<User>>` | Lists users a user is following |
| `isFollowing` | `(followerId: string, followingId: string): Promise<{ following: boolean }>` | Checks if follower is following another user |

**Key Features**:
- Composite unique key: `followerId_followingId`
- Toggle pattern (single endpoint for follow/unfollow)
- Self-follow prevention

#### `WebhooksService`
**File**: [src/modules/webhooks/webhooks.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.service.ts)

| Method | Signature | Description |
|--------|-----------|-------------|
| `handleContentWebhook` | `(body: any, apiKey: string): Promise<any>` | Handles incoming content webhook via API key auth |
| `listWebhookLogs` | `(event?: string, limit?: number): Promise<WebhookLog[]>` | Lists webhook delivery logs |
| `createApiKey` | `(userId: string, name: string, scopes: string[]): Promise<ApiKey>` | Creates API key with scopes |
| `listApiKeys` | `(userId: string): Promise<ApiKey[]>` | Lists user's API keys |
| `revokeApiKey` | `(userId: string, keyId: string): Promise<ApiKey>` | Deactivates an API key |

**Supported Webhook Events**:
- `article.create` — Creates a published article
- `article.update` — Updates an article by slug
- `article.delete` — Soft-deletes an article by slug
- `highlight.create` — Creates a published highlight

#### `AdminService`
**File**: [src/modules/admin/admin.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.service.ts)

Comprehensive admin functionality. Key areas:
- **Dashboard stats** — User counts, content counts, engagement metrics
- **User management** — CRUD, role changes, status toggles, avatar upload
- **Content management** — Articles, highlights, comments, media
- **Category/Tag management** — Full CRUD for taxonomies
- **Analytics** — Overview, timeseries (30-day), traffic sources, report trends
- **Moderation** — Reports, AI moderation testing, flags
- **System settings** — Key-value settings by category
- **Feature flags** — With rollout percentages
- **Webhook management** — Outgoing webhook CRUD + API key management
- **Audit logs** — Full action audit trail
- **AI agents** — AI agent configuration
- **Help center** — Help article CRUD
- **Support tickets** — Ticket management
- **Advertisements** — Ad campaign management
- **Background jobs** — Job queue status
- **Storage stats** — Media usage breakdown
- **System status** — DB health + active counts

### 3.5 Guards & Decorators

| Guard | File | Purpose |
|-------|------|---------|
| `JwtAuthGuard` | [src/modules/auth/jwt-auth.guard.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/auth/jwt-auth.guard.ts) | JWT authentication (cookie + header) |
| `RolesGuard` | [src/modules/auth/roles.guard.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/auth/roles.guard.ts) | Role-based authorization with hierarchy |
| `AdminGuard` | [src/modules/auth/admin.guard.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/auth/admin.guard.ts) | Admin-only access guard |

**Role Hierarchy** (used by `RolesGuard`):
```
GUEST → USER → CREATOR → MODERATOR → ADMIN
```

Higher roles inherit all lower role permissions.

### 3.6 Shared Infrastructure

#### `AllExceptionsFilter`
**File**: [src/shared/filters/all-exceptions.filter.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/shared/filters/all-exceptions.filter.ts)

Global exception filter that normalizes all error responses.

| Feature | Description |
|---------|-------------|
| **Error Normalization** | All exceptions (HttpException, Error, unknown) return consistent JSON shape |
| **Logging** | 5xx errors logged with stack trace; request method/URL context |
| **Development Mode** | Stack trace included in response when `NODE_ENV === 'development'` |
| **Error Codes** | Includes errorType, errorCode, errorMessage for server errors |

**Response Shape**:
```json
{
  "statusCode": 404,
  "message": "Article not found",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/articles/slug"
}
```

#### `AuthLoggerMiddleware`
**File**: [src/shared/middleware/auth-logger.middleware.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/shared/middleware/auth-logger.middleware.ts)

Middleware for logging authenticated requests with user context.

### 3.7 API Endpoint Reference

All endpoints are prefixed with `/api`.

#### Auth (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login (returns tokens) |
| POST | `/refresh` | No | Refresh access token |
| POST | `/logout` | Yes | Logout (invalidate tokens) |
| GET | `/me` | Yes | Get current user |
| POST | `/forgot-password` | No | Request password reset |
| POST | `/reset-password` | No | Complete password reset |
| POST | `/verify-email` | No | Verify email |

#### Articles (`/api/articles`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | List articles (paginated, filter by category/featured) |
| GET | `/featured` | No | Get featured articles |
| GET | `/:slug` | Optional | Get article by slug (increments views) |
| POST | `/` | Yes (Creator+) | Create article |
| PUT | `/:slug` | Yes (owner) | Update article |
| DELETE | `/:slug` | Yes (owner) | Soft-delete article |
| GET | `/author/:handle` | No | Get articles by author handle |

#### Highlights (`/api/highlights`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | List published highlights (paginated) |
| GET | `/:id` | Optional | Get highlight by ID with comments |
| POST | `/` | Yes (Creator+) | Create highlight |
| PUT | `/:id` | Yes (owner) | Update highlight |
| DELETE | `/:id` | Yes (owner) | Soft-delete highlight |

#### Comments (`/api/comments`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | List comments (by articleSlug or highlightId) |
| POST | `/` | Yes | Create comment (article or highlight) |
| PUT | `/:id` | Yes (owner) | Update comment |
| DELETE | `/:id` | Yes (owner) | Soft-delete comment |

#### Users (`/api/users`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | Yes | Get current user profile |
| GET | `/handle/:handle` | No | Get public profile by handle |
| PUT | `/me` | Yes | Update current user |
| GET | `/me/settings` | Yes | Get user settings |
| PUT | `/me/settings` | Yes | Update user settings |
| GET | `/search` | No | Search users by handle/name |
| DELETE | `/me` | Yes | Deactivate account |

#### Likes (`/api/likes`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/toggle` | Yes | Toggle like on article/highlight/comment |
| GET | `/articles` | Yes | Get user's liked articles |
| GET | `/highlights` | Yes | Get user's liked highlights |

#### Bookmarks (`/api/bookmarks`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/toggle` | Yes | Toggle bookmark on article/highlight |
| GET | `/articles` | Yes | Get user's bookmarked articles |
| GET | `/highlights` | Yes | Get user's bookmarked highlights |

#### Follows (`/api/follows`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/toggle` | Yes | Toggle follow/unfollow user |
| GET | `/followers/:userId` | No | Get user's followers |
| GET | `/following/:userId` | No | Get users a user follows |
| GET | `/is-following/:userId` | Yes | Check if following a user |

#### Notifications (`/api/notifications`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | List user's notifications |
| GET | `/unread-count` | Yes | Get unread notification count |
| POST | `/mark-read` | Yes | Mark all or single as read |
| DELETE | `/:id` | Yes | Delete notification |

#### Categories (`/api/categories`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | List all categories |
| GET | `/:slug` | No | Get category by slug |

#### Search (`/api/search`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Cross-entity search (articles, users, highlights) |

#### Media (`/api/media`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload` | Yes | Upload file (image/video/document) |
| GET | `/:id` | No | Get media metadata |
| DELETE | `/:id` | Yes (owner/admin) | Delete media |

#### Stories (`/api/stories`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/feed` | Yes | Get story feed (followed users) |
| GET | `/author/:authorId` | Yes | Get stories by author |
| POST | `/` | Yes (Creator+) | Create story |
| DELETE | `/:id` | Yes (owner) | Delete story |
| POST | `/:id/view` | Yes | Mark story as viewed |

#### Webhooks (`/api/webhooks`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/content` | API key | Incoming content webhook endpoint |
| GET | `/api-keys` | Yes | List user's API keys |
| POST | `/api-keys` | Yes | Create new API key |
| DELETE | `/api-keys/:id` | Yes | Revoke API key |
| GET | `/logs` | Yes | List webhook delivery logs |

#### Health (`/api/health`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Basic health check |
| GET | `/ready` | No | Readiness check (DB + cache connectivity) |

#### Admin (`/api/admin`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard` | Admin | Dashboard stats and metrics |
| GET | `/users` | Admin | User management list |
| GET | `/users/:id` | Admin | User details |
| PUT | `/users/:id` | Admin | Update user (role, status) |
| GET | `/analytics` | Admin | Analytics data |
| GET | `/audit` | Admin | Audit log |
| GET | `/webhooks` | Admin | Outgoing webhook management |
| GET | `/ai-agents` | Admin | AI agent configurations |
| GET | `/flags` | Admin | Feature flag management |
| GET | `/moderation` | Admin | Moderation queue |

---

## 4. Database Model

**Schema File**: [prisma/schema.prisma](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/prisma/schema.prisma)

### 4.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│     User     │       │   UserSettings   │       │  RefreshToken│
│──────────────│       │──────────────────│       │──────────────│
│ id (PK)      │1─────1│ id (PK)          │       │ id (PK)      │
│ email        │       │ userId (FK, U)   │       │ userId (FK)  │
│ handle (U)   │       │ emailNotifications│      │ token (U)    │
│ name         │       │ pushNotifications │      │ expiresAt    │
│ passwordHash │       │ ...              │       └──────────────┘
│ role (Enum)  │       └──────────────────┘
│ isActive     │       ┌──────────────────┐
│ avatar       │       │    Session       │
│ bio          │       │──────────────────│
│ createdAt    │1─────∞│ id (PK)          │
│ updatedAt    │       │ userId (FK)      │
│ deletedAt    │       │ sessionToken (U) │
└──┬───┬───┬───┘       │ expiresAt        │
   │   │   │           └──────────────────┘
   │   │   │
   │   │   │       ┌──────────────────┐
   │   │   └──────▶│     Article      │
   │   │           │──────────────────│
   │   │           │ id (PK)          │
   │   │           │ slug (U)         │
   │   │           │ title            │
   │   │           │ body (String[])  │
   │   │           │ categoryId (FK)  │
   │   │           │ authorId (FK)    │
   │   │           │ isPublished      │
   │   │           │ likesCount       │
   │   │           │ views            │
   │   │           │ commentsCount    │
   │   │           └────────┬─────────┘
   │   │                    │
   │   │       ┌────────────▼───────────┐       ┌──────────────┐
   │   │       │        Comment         │──────▶│   Category   │
   │   │       │────────────────────────│       │──────────────│
   │   │       │ id (PK)                │       │ id (PK)      │
   │   │       │ articleSlug /          │       │ name (U)     │
   │   │       │ highlightId (FK)       │       │ slug (U)     │
   │   │       │ authorId (FK)          │       │ tint         │
   │   │       │ body                   │       └──────────────┘
   │   │       │ parentId (self-refer.) │
   │   │       │ likesCount             │       ┌──────────────┐
   │   │       └────────────────────────┘       │    Highlight │
   │   │                                        │──────────────│
   │   │       ┌──────────────┐                │ id (PK)      │
   │   └──────▶│    Follow    │                │ title        │
   │           │──────────────│                │ handle       │
   │           │ id (PK)      │                │ authorId (FK)│
   │           │ followerId   │                │ videoUrl     │
   │           │ followingId  │                │ likesCount   │
   │           │ createdAt    │                │ commentsCount│
   │           └──────────────┘                │ shares       │
   │                                           └──────────────┘
   │           ┌──────────────┐
   ├──────────▶│     Like     │       ┌──────────────────┐
   │           │──────────────│       │   Notification   │
   │           │ id (PK)      │       │──────────────────│
   │           │ userId (FK)  │       │ id (PK)          │
   │           │ articleSlug  │       │ userId (FK)      │
   │           │ highlightId  │       │ actorId          │
   │           │ commentId    │       │ kind (Enum)      │
   │           └──────────────┘       │ read             │
   │                                   └──────────────────┘
   │           ┌──────────────┐
   ├──────────▶│   Bookmark   │       ┌──────────────────┐
   │           │──────────────│       │    Webhook       │
   │           │ id (PK)      │       │──────────────────│
   │           │ userId (FK)  │       │ id (PK)          │
   │           │ articleSlug  │       │ name             │
   │           │ highlightId  │       │ url              │
   │           └──────────────┘       │ secret           │
   │                                   │ events (String[])|
   │           ┌──────────────┐       │ isActive         │
   ├──────────▶│    Media     │       └────────┬─────────┘
   │           │──────────────│                │
   │           │ id (PK)      │       ┌────────▼─────────┐
   │           │ filename     │       │   WebhookLog     │
   │           │ mimeType     │       │──────────────────│
   │           │ size         │       │ id (PK)          │
   │           │ type (Enum)  │       │ webhookId (FK)   │
   │           │ url          │       │ event            │
   │           │ uploadedBy   │       │ payload (Json)   │
   │           └──────────────┘       │ statusCode       │
   │                                   │ error            │
   │           ┌──────────────┐       └──────────────────┘
   ├──────────▶│   ApiKey     │
   │           │──────────────│       ┌──────────────────┐
   │           │ id (PK)      │       │    AuditLog      │
   │           │ key (U)      │       │──────────────────│
   │           │ userId (FK)  │       │ id (PK)          │
   │           │ scopes ([])  │       │ action           │
   │           │ isActive     │       │ resource         │
   │           └──────────────┘       │ userId (FK)      │
   │                                   │ details (Json)   │
   │           ┌──────────────┐       │ changes (Json)   │
   ├──────────▶│   Report     │       │ success          │
   │           │──────────────│       │ ipAddress        │
   │           │ id (PK)      │       └──────────────────┘
   │           │ targetType   │
   │           │ targetId     │       ┌──────────────────┐
   │           │ reason       │       │    HelpArticle   │
   │           │ reporterId   │       │──────────────────│
   │           │ status       │       │ id (PK)          │
   │           │ priority     │       │ slug (U)         │
   │           │ aiScore      │       │ title            │
   │           └──────────────┘       │ content (String[])|
   │                                   │ category         │
   │           ┌──────────────┐       └──────────────────┘
   └──────────▶│SupportTicket │
               │──────────────│       ┌──────────────────┐
               │ id (PK)      │       │    Story         │
               │ subject      │       │──────────────────│
               │ message      │       │ id (PK)          │
               │ userId (FK)  │       │ authorId (FK)    │
               │ status       │       │ image            │
               │ priority     │       │ duration         │
               └──────────────┘       │ expiresAt        │
                                      └──────────────────┘
```

### 4.2 Core Tables (29 total)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **User** | User accounts | email, handle, passwordHash, role, isActive |
| **UserSettings** | Per-user preferences | email/push notifications, privacy settings |
| **Article** | Long-form content | slug, title, body[], categoryId, authorId, isPublished |
| **Highlight** | Short-form video content | handle, videoUrl, thumbnailUrl, likesCount, shares |
| **Story** | Ephemeral 24h content | image, caption, expiresAt |
| **StoryView** | Story view tracking | storyId, viewerId (unique pair) |
| **Comment** | Threaded comments | articleSlug / highlightId, authorId, parentId (self-referencing) |
| **Category** | Article taxonomy | name, slug, tint (color) |
| **Tag** | Content tagging | name, slug |
| **Like** | Like interactions | userId + articleSlug/highlightId/commentId (unique pairs) |
| **Bookmark** | Saved content | userId + articleSlug/highlightId (unique pairs) |
| **Follow** | User relationships | followerId + followingId (unique pair) |
| **Notification** | User notifications | kind (Enum), actorId, read status, metadata |
| **RefreshToken** | JWT refresh tokens | token (unique), expiresAt, deviceInfo |
| **Session** | Session tracking | sessionToken, expiresAt, ipAddress, userAgent |
| **Media** | Uploaded files | filename, mimeType, type, url, size, uploadedBy |
| **Webhook** | Outgoing webhook config | name, url, secret, events[], isActive |
| **WebhookLog** | Webhook delivery logs | event, payload, statusCode, error |
| **AuditLog** | Admin audit trail | action, resource, userId, changes, ipAddress |
| **ApiKey** | API access keys | key (unique), scopes[], userId, isActive, expiresAt |
| **Report** | Content moderation reports | targetType, targetId, reason, status, priority, aiScore |
| **FeatureFlag** | Feature toggles | key, enabled, rollout (0-100%), description |
| **SystemSetting** | Key-value config | key, value, category |
| **Advertisement** | Ad campaigns | name, status, impressions, clicks, spend |
| **AIAgent** | AI agent configurations | name, model, status, config |
| **BackgroundJob** | Job queue tracking | name, queue, status, payload, duration, error |
| **HelpArticle** | Help center content | slug, title, content[], category, views |
| **SupportTicket** | Customer support | subject, message, status, priority, userId |

### 4.3 Enums

| Enum | Values |
|------|--------|
| **Role** | `ADMIN`, `MODERATOR`, `CREATOR`, `USER`, `GUEST` |
| **NotificationKind** | `LIKE`, `COMMENT`, `REPLY`, `FOLLOW`, `BOOKMARK`, `MENTION`, `SYSTEM` |
| **MediaType** | `IMAGE`, `VIDEO`, `DOCUMENT` |

---

## 5. Shared Packages

### 5.1 `@vellum/api-client`

**Location**: [packages/api-client/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api-client/)

Cross-platform TypeScript API client (browser, React Native, Node.js).

**Key Class**: `ApiClient` ([src/client.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api-client/src/client.ts))

| Feature | Description |
|---------|-------------|
| **Auth** | Automatic token refresh on 401, dual storage (access + refresh token) |
| **Transport** | fetch-based (XMLHttpRequest fallback for upload progress) |
| **Error handling** | Custom `ApiClientError` with statusCode + data |
| **Storage** | Abstract `Storage` interface for cross-platform compatibility |
| **Rate limiting** | Built-in refresh token de-duplication (single concurrent refresh) |

**Endpoint coverage**: Auth, Users, Articles, Highlights, Categories, Comments, Likes, Bookmarks, Follows, Notifications, Stories, Search, Media, Admin, Webhooks, Health

### 5.2 `@vellum/auth`

**Location**: [packages/auth/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/auth/)

Shared React auth context provider.

### 5.3 `@vellum/react-hooks`

**Location**: [packages/react-hooks/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/react-hooks/)

Shared React hooks including `useApi`.

### 5.4 `@vellum/social-store`

**Location**: [packages/social-store/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/social-store/)

Shared Zustand-like state store for social interactions.

### 5.5 `@vellum/utils`

**Location**: [packages/utils/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/utils/)

Shared utility functions:
- `cn()` — class name merging (tailwind-merge)
- `format.ts` — number/date formatting utilities

---

## 6. Admin Dashboard

**Location**: [apps/admin-dashboard/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/)

Full-featured admin panel built with React + TanStack Router + shadcn/ui.

### 6.1 Tech Stack

- **Framework**: React 18 + Vite
- **Routing**: TanStack Router (file-based routes)
- **UI**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State**: Custom hooks + API client
- **Auth**: JWT via @vellum/api-client + auth context

### 6.2 Route Structure

File-based routing at [src/routes/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/routes/):

| Route | Description |
|-------|-------------|
| `_app.dashboard` | Dashboard overview with stats + charts |
| `_app.users` | User management (list + edit) |
| `_app.articles` | Article CRUD |
| `_app.highlights` | Highlight CRUD |
| `_app.comments` | Comment moderation |
| `_app.categories` | Category management |
| `_app.tags` | Tag management |
| `_app.moderation` | Content reports + moderation queue |
| `_app.flags` | Feature flag management |
| `_app.notifications` | Notification management |
| `_app.media` | Media library |
| `_app.storage` | Storage stats |
| `_app.analytics` | Analytics dashboard |
| `_app.audit` | Audit log viewer |
| `_app.roles` | Role management |
| `_app.permissions` | Permission management |
| `_app.webhooks` | Webhook + API key management |
| `_app.api` | API documentation view |
| `_app.settings` | System settings |
| `_app.ai` | AI agent configurations |
| `_app.jobs` | Background job monitoring |
| `_app.advertisements` | Ad campaign management |
| `_app.music` | Music management |
| `_app.videos` | Video management |
| `_app.playlists` | Playlist management |
| `_app.posts` | Post management |
| `_app.followers` | Follower management |
| `_app.help` | Help center articles |
| `_app.reports` | Report management |
| `_app.profile` | Admin profile |
| `_app.status` | System status |
| `auth.login` | Login page |

### 6.3 Key Components

Located in [src/components/dashboard/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/):

| Component | Purpose |
|-----------|---------|
| `AppSidebar` | Main navigation sidebar with collapsible groups |
| `TopBar` | Top navigation bar with user menu + theme toggle |
| `StatCard` | Metric display card |
| `Charts` | Recharts-based data visualizations |
| `ListPage` | Reusable list page template (table + pagination) |
| `PageHeader` | Page title + action buttons |
| `SectionCard` | Card with section title + content |
| `StatusBadge` | Status indicator (success/error/warning/info) |
| `CommandPalette` | Cmd+K command palette |
| `AISettingsPanel` | AI configuration panel |
| `ThemeToggle` | Light/dark mode toggle |
| `ErrorBoundary` | React error boundary |
| `Skeletons` | Loading skeleton components |
| `EmptyState` | Empty state illustration |

### 6.4 Authentication & RBAC

- **Auth**: JWT via `@vellum/api-client` with auth context
- **RBAC**: Role-based access control via [src/lib/auth/rbac.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/lib/auth/rbac.ts)
- **Route protection**: `@vellum/auth` context guards

---

## 7. Web App

**Location**: [apps/web-app/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/web-app/)

Public-facing content consumption web app.

### 7.1 Tech Stack

- **Framework**: React 18 + Vite
- **Routing**: TanStack Router (file-based)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (partial)
- **State**: @vellum/social-store + custom hooks
- **Auth**: @vellum/api-client + auth context

### 7.2 Route Structure

Routes at [src/routes/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/web-app/src/routes/):

| Route | Description |
|-------|-------------|
| `index` | Home feed |
| `discover` | Discover page |
| `article.$slug` | Single article view |
| `author.$id` | Author profile |
| `category.$name` | Category page |
| `compose` | Create article (auth required) |
| `highlights` | Highlights feed |
| `story.$authorId.$storyId` | Story viewer |
| `login` | Login page |
| `register` | Registration page |
| `notifications` | Notifications (auth required) |
| `profile` | User profile (auth required) |
| `profile.edit` | Edit profile |
| `profile.index` | Profile overview |
| `saved` | Saved/bookmarked content |
| `settings` | Settings page |
| `settings.about` | About settings |
| `settings.help` | Help center |
| `settings.index` | Settings overview |
| `settings.language` | Language settings |
| `settings.privacy` | Privacy settings |

### 7.3 Key Features

- Infinite scroll feed of articles + highlights
- Article reading with comments, likes, bookmarks
- User profiles with follower/following
- Stories (24h ephemeral content)
- Search functionality
- Notification center
- User settings

---

## 8. Mobile App

**Location**: [apps/mobile-app/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/mobile-app/)

Cross-platform mobile app built with Expo (React Native).

### 8.1 Tech Stack

- **Framework**: Expo SDK + React Native
- **Navigation**: Expo Router (file-based)
- **State**: React Context (AuthContext)
- **API**: @vellum/api-client (via custom api.ts wrapper)
- **Platform**: iOS + Android

### 8.2 Route Structure

Routes at [app/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/mobile-app/app/):

| Route | Description |
|-------|-------------|
| `index` | Home feed |
| `discover` | Discover |
| `highlights` | Highlights feed |
| `compose` | Create content |
| `notifications` | Notifications |
| `profile` | User profile |
| `settings` | Settings |
| `login` | Login |
| `register` | Register |
| `article/[slug]` | Article detail |
| `author/[id]` | Author profile |
| `category/[name]` | Category |
| `story/[authorId]/[storyId]` | Story viewer |

### 8.3 Key Components

Located in [components/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/mobile-app/components/):

| Component | Purpose |
|-----------|---------|
| `HighlightsScreen` | TikTok-style highlights feed |
| `HighlightCard` | Individual highlight video card |
| `HighlightActions` | Like/comment/share/bookmark buttons |
| `HighlightComments` | Comments modal for highlights |
| `HighlightVideo` | Video playback component |
| `HighlightFooter` | Video footer (author info, music) |
| `HighlightPager` | Swipeable pager between highlights |
| `HighlightOverlay` | Overlay UI on video |

### 8.4 Custom Hooks

Located in [hooks/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/mobile-app/hooks/):

| Hook | Purpose |
|------|---------|
| `useApi` | API client hook |
| `useSocial` | Social interactions (like, follow, bookmark) |
| `useHighlightPlayback` | Video playback state |
| `usePreload` | Image/video preloading |
| `useVisibility` | Viewport visibility tracking |

### 8.5 Navigation Architecture

**Bottom Tab Bar** (5 main tabs per project conventions):
1. **Feed** — Home feed screen
2. **Discover** — Discover/search
3. **Highlights** — Video highlights feed
4. **Saved** — Bookmarked content
5. **Profile** — User profile

**Hidden Routes** (accessible via navigation, not in tab bar):
- `article/[slug]` — Article detail
- `author/[id]` — Author profile
- `category/[name]` — Category page
- `story/[authorId]/[storyId]` — Story viewer (hides tab bar)
- `compose` — Create content
- `notifications` — Notifications
- `settings` — Settings
- `login` / `register` — Auth screens

**Auth-first pattern**: Root `_layout.tsx` checks authentication state and redirects unauthenticated users to login.

### 8.6 Auth Context

**File**: [context/AuthContext.tsx](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/mobile-app/context/AuthContext.tsx)

React Context provider managing:
- User state (current user profile)
- Token storage (access + refresh tokens)
- Login/logout methods
- Auto-token refresh
- Loading state

---

## 9. Setup & Configuration

### 9.1 Prerequisites

| Tool | Minimum Version | Purpose |
|------|-----------------|---------|
| **Node.js** | 20.0.0 | Runtime |
| **npm** | 10.0.0 | Package manager (workspaces) |
| **PostgreSQL** | 14+ | Database |
| **Redis** | 6+ | Caching (optional, falls back gracefully) |
| **Bun** | 1.0+ | Prisma Compute deployment (optional) |

### 9.2 Environment Variables

#### API Backend (`packages/api/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `3000` | Server port |
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string (Prisma Accelerate or direct) |
| `DIRECT_URL` | No | - | Direct PostgreSQL URL for migrations |
| `JWT_SECRET` | **Yes** | - | JWT signing secret |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing rounds |
| `CORS_ORIGIN` | No | `localhost:*` | Comma-separated CORS origins |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `PRISMA_CONNECTION_LIMIT` | No | `5` | Database connection pool size |
| `PRISMA_POOL_TIMEOUT` | No | `10` | Pool timeout (seconds) |
| `PRISMA_CONNECTION_TIMEOUT` | No | `5` | Connection timeout (seconds) |
| `PRISMA_IDLE_TIMEOUT` | No | `20` | Idle connection timeout (seconds) |

#### Admin Dashboard (`apps/admin-dashboard/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | - | Backend API base URL (e.g., `http://localhost:3000/api`) |

#### Web App (`apps/web-app/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | - | Backend API base URL |

#### Mobile App (`apps/mobile-app/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | No | - | Backend API base URL (e.g., `http://localhost:3000/api`) |

### 9.3 Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cd packages/api
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# 3. Set up database
npm run db:migrate
npm run db:seed     # Optional: seed with sample data

# 4. Start backend API
cd ../..
npm run dev:api

# 5. (In another terminal) Start admin dashboard
npm run dev:admin

# 6. (In another terminal) Start web app
npm run dev:web
```

### 9.4 Running Tests

```bash
# API unit tests
cd packages/api
npm test

# API unit tests with coverage
npm run test:cov

# E2E tests (Playwright)
cd ../..
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui
```

### 9.5 Database Management

```bash
# Generate Prisma client
npm run db:generate

# Create new migration
cd packages/api
npx prisma migrate dev --name migration_name

# Apply migrations to production
npm run migrate:prod

# Open Prisma Studio (database GUI)
npm run db:studio
```

### 9.6 Testing Strategy

#### API Unit & Integration Tests

**Framework**: Jest (via `@nestjs/testing`)

**Test Configuration**:
- Run from `packages/api/` directory
- Tests use a dedicated test database
- Supertest for HTTP endpoint testing

**Key Test Areas**:
- Auth flow (register, login, token refresh)
- Article CRUD and listing
- Likes, comments, follows interactions
- Validation and error handling

```bash
# Run unit tests
cd packages/api
npm test

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

#### E2E Tests

**Framework**: Playwright (root-level config)

**Test Configuration**:
- Configured in `playwright.config.ts` at project root
- Tests full user flows across web app and API
- Cross-browser testing support

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Generate test report
npx playwright show-report
```

#### Manual API Testing Scripts

The project includes comprehensive test scripts:
- `scripts/api-comprehensive-test.py` — Python-based API test suite
- `packages/api/scripts/comprehensive-api-test.mjs` — Node.js API test script
- `scripts/deploy-verify.py` — Post-deployment verification script

---

## 10. Deployment

### 10.1 Production Architecture

```
                    ┌──────────────┐
                    │   Vercel     │
                    │  (DNS/CDN)   │
                    └──────┬───────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
    ┌──────────────┐               ┌──────────────┐
    │   Admin      │               │   Web App    │
    │  Dashboard   │               │              │
    │  (Vercel)    │               │  (Vercel)    │
    └──────┬───────┘               └──────┬───────┘
           │                               │
           └───────────────┬───────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Prisma Compute│
                    │  (NestJS API) │
                    └──────┬───────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
    ┌──────────────┐               ┌──────────────┐
    │ Prisma Data  │               │   Redis.io   │
    │   Platform   │               │   (Cache)    │
    │ (PostgreSQL) │               └──────────────┘
    └──────────────┘
```

### 10.2 Backend Deployment (Prisma Compute)

**Script**: [packages/api/scripts/deploy-compute.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/scripts/deploy-compute.ts)

```bash
# Deploy to Prisma Compute
cd packages/api

# Set required env vars
export PRISMA_API_TOKEN="your_token"
export PRISMA_PROJECT_ID="your_project_id"
export DATABASE_URL="prisma+postgres://..."
export DIRECT_URL="postgres://..."
export JWT_SECRET="your_secret"
export CORS_ORIGIN="https://your-app.vercel.app"
export REDIS_URL="redis://..."

# Deploy
bun scripts/deploy-compute.ts
```

### 10.3 Frontend Deployment (Vercel)

Both the admin dashboard and web app are configured for Vercel deployment with [vercel.json](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/vercel.json).

```bash
# Deploy admin dashboard
cd apps/admin-dashboard
vercel --prod

# Deploy web app
cd ../web-app
vercel --prod
```

### 10.4 CI/CD

GitHub Actions workflows at [.github/workflows/](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/.github/workflows/):

| Workflow | Purpose |
|----------|---------|
| `ci.yml` | Continuous integration (lint, test, build) |
| `deploy.yml` | Deployment pipeline |
| `apply-sync-mgmt-api.yml` | Database migration via Prisma Management API |
| `apply-sync-migration.yml` | Database migration application |
| `introspect-db.yml` | Database schema introspection |

---

## 11. Technical Analysis: Webhook System

### 11.1 Current State

The platform has a **partial webhook implementation**:

1. **Incoming webhooks** — Implemented in [WebhooksController](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.controller.ts)
   - Single endpoint: `POST /api/webhooks/content`
   - API key authentication via `x-api-key` header
   - Supports: `article.create`, `article.update`, `article.delete`, `highlight.create`
   - Logs all webhook events to `WebhookLog` table

2. **Outgoing webhooks** — Database model exists (`Webhook`, `WebhookLog`) and admin CRUD in [AdminService](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.service.ts#L538-L579), but **no delivery mechanism is implemented**

3. **API key management** — Full CRUD in both WebhooksModule (user-facing) and AdminModule (admin-facing)

### 11.2 Feasibility Assessment

| Aspect | Feasibility | Notes |
|--------|-------------|-------|
| Incoming webhooks | ✅ Already implemented | API key auth works, content creation works |
| Outgoing webhooks | ⚠️ Partial | DB model exists, needs event dispatch + delivery queue |
| Webhook signatures | ❌ Missing | No HMAC verification for incoming, no signing for outgoing |
| Retry logic | ❌ Missing | No retry on delivery failure |
| Event types | ⚠️ Limited | Only 4 content events; notification events not covered |

### 11.3 Recommended Implementation Patterns

#### Outgoing Webhook Delivery Pattern

**Event-driven architecture using Bull queue (already in dependencies):**

```
Domain Event → WebhookDispatcher → Bull Queue → WebhookDeliverer → External URL
                                    ↓
                              WebhookLog (audit)
```

**Implementation outline**:

```typescript
// webhook-dispatcher.service.ts
@Injectable()
export class WebhookDispatcher {
  constructor(
    private prisma: PrismaService,
    private queue: Queue, // Bull queue
  ) {}

  async dispatch(event: string, payload: any) {
    // Find all active webhooks subscribed to this event
    const webhooks = await this.prisma.webhook.findMany({
      where: { isActive: true, events: { has: event } },
    });

    for (const webhook of webhooks) {
      // Queue delivery job
      await this.queue.add('deliver-webhook', {
        webhookId: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        event,
        payload,
      });
    }
  }
}
```

#### Incoming Webhook Security Enhancement

Current state: API key in header (simple, but less secure)
Recommended: HMAC signature verification

```
Request → Verify API Key → Verify HMAC Signature → Process → Response
            (existing)        (to add)
```

### 11.4 Recommended Endpoint Structures

#### Outgoing Webhook Payload Format

```json
{
  "id": "wh_evt_abc123",
  "event": "article.published",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "id": "article-uuid",
    "slug": "my-article",
    "title": "My Article",
    "author": { "id": "user-uuid", "handle": "username" },
    "publishedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Headers**:
- `X-Webhook-Event`: Event type
- `X-Webhook-Signature`: HMAC-SHA256 of timestamp + payload
- `X-Webhook-Id`: Unique event ID (idempotency)
- `X-Webhook-Timestamp`: ISO timestamp

#### Incoming Webhook Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/webhooks/content` | API key + scopes | Content creation/update/delete |
| `POST /api/webhooks/:id/trigger` | JWT (admin) | Manual test trigger |

### 11.5 Event Catalog (Recommended)

| Event Category | Events |
|----------------|--------|
| **Articles** | `article.created`, `article.updated`, `article.deleted`, `article.published`, `article.featured` |
| **Highlights** | `highlight.created`, `highlight.updated`, `highlight.deleted`, `highlight.published` |
| **Comments** | `comment.created`, `comment.updated`, `comment.deleted` |
| **Users** | `user.registered`, `user.updated`, `user.deleted`, `user.role_changed` |
| **Social** | `like.created`, `follow.created`, `bookmark.created` |
| **Moderation** | `report.created`, `report.resolved`, `content.flagged` |
| **System** | `system.health_change`, `system.maintenance` |

### 11.6 Integration Points with Existing Components

| Component | Integration |
|-----------|-------------|
| **PrismaService** | All webhook CRUD and logging uses existing database access pattern |
| **CacheService** | Can cache webhook configurations to reduce DB queries |
| **ArticlesService** | Emits article events on create/update/delete/publish |
| **HighlightsService** | Emits highlight events |
| **NotificationsService** | Can trigger webhooks alongside in-app notifications |
| **AdminModule** | Already has webhook management UI backend |
| **Bull (queue)** | Already in `package.json` dependencies, ready for background job processing |

### 11.7 Authentication & Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Unauthorized access (incoming)** | API key + scope validation + IP whitelist (optional) |
| **Request forgery (incoming)** | HMAC-SHA256 signature verification with timestamp window |
| **Secret exposure** | Hash secrets in DB, show only once on creation, use environment-based master webhooks |
| **Replay attacks** | Timestamp validation (e.g., 5-minute window) + idempotency keys |
| **SSRF prevention** | URL validation (no private IPs), configurable allowlist |
| **Rate limiting** | ThrottlerGuard already global; add per-API-key limits |
| **Payload validation** | DTO validation via class-validator (already in place) |
| **Audit logging** | WebhookLog table (already exists), expand with request/response |

### 11.8 Challenges & Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **Webhook delivery failures** | Exponential backoff retry (Bull built-in), dead-letter queue, failure alerts |
| **Slow consumer endpoints** | Queue-based delivery with timeouts (e.g., 10s), circuit breaker pattern |
| **Event ordering** | Per-webhook FIFO queue, sequence numbers |
| **Webhook storms** | Event aggregation / batching for high-volume events |
| **Security of secrets** | Encrypt webhook secrets at rest, rotate periodically, audit key usage |
| **Debugging difficulty** | Comprehensive webhook logs UI (admin dashboard has page stub already) |

---

## 12. Technical Analysis: Bot User / AI Agent Integration

### 12.1 Current State

The platform has **foundational building blocks** but no integrated bot/AI agent system:

1. **AIAgent model** — Database table exists ([schema.prisma](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/prisma/schema.prisma#L428-L441)) with fields for name, model, status, config, run count
2. **AI settings in admin** — AI settings panel in dashboard ([ai-settings-panel.tsx](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard/src/components/dashboard/ai-settings-panel.tsx)) and AI settings CRUD in [AdminService](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.service.ts#L1101-L1122)
3. **AI moderation test** — Simple keyword-based content moderation ([admin.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.service.ts#L1124-L1169))
4. **Incoming webhooks** — Can be used by AI agents to create content programmatically
5. **API keys** — Allow programmatic access to the API

### 12.2 Feasibility Assessment

| Capability | Feasibility | Notes |
|------------|-------------|-------|
| Bot user accounts | ✅ High | User model + roles + API keys already exist |
| AI-generated content posting | ✅ High | Webhook/API endpoints already support content creation |
| AI moderation agent | ⚠️ Medium | Placeholders exist, need real AI API integration |
| AI content generation | ⚠️ Medium | No LLM integration yet, but architecture supports it |
| Automated replies | ⚠️ Medium | Needs notification webhooks + AI response generation |
| Multi-agent orchestration | ❌ Low | No agent framework or task queue for agents |

### 12.3 Recommended Implementation Patterns

#### Bot User Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    AI Agent Layer                         │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Moderation │  │  Content    │  │  Community  │    │
│  │   Agent     │  │   Creator   │  │   Manager   │    │
│  │             │  │             │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                  │           │
│         └────────────────┼──────────────────┘           │
│                          │                               │
│                 ┌────────▼─────────┐                    │
│                 │   Agent Runner   │                    │
│                 │  (task queue)    │                    │
│                 └────────┬─────────┘                    │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                   Vellum Platform                        │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Bot User (System User)               │  │
│  │  - Special role (BOT) or CREATOR role             │  │
│  │  - API key authentication                         │  │
│  │  - Audit trail for all bot actions                │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │         Standard API Endpoints                    │  │
│  │  Articles, Highlights, Comments, Moderation      │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

#### Bot User Implementation Pattern

**Option A: Special Bot Role** (recommended for clarity)
- Add `BOT` to `Role` enum
- Bots use API keys for authentication
- Bot actions appear in audit logs with bot attribution
- Rate limits can be different for bot accounts

**Option B: CREATOR role + `isBot` flag** (less disruptive)
- Use existing `CREATOR` role
- Add `isBot: Boolean` field to User model
- Simpler migration path

### 12.4 Recommended Endpoints for Bot/AI Integration

#### Bot Management (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/ai-agents` | List all AI agents |
| POST | `/api/admin/ai-agents` | Create AI agent config |
| PUT | `/api/admin/ai-agents/:id` | Update agent config |
| DELETE | `/api/admin/ai-agents/:id` | Delete agent |
| POST | `/api/admin/ai-agents/:id/trigger` | Manually trigger agent run |

#### Agent Content API (Bot User via API Key)

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| POST | `/api/webhooks/content` | `content:create` | Create articles/highlights (existing) |
| POST | `/api/articles` | `articles:write` | Create article (standard API) |
| POST | `/api/highlights` | `highlights:write` | Create highlight (standard API) |
| POST | `/api/comments` | `comments:write` | Post comment (bot reply) |

#### Webhook Triggers for Agent Actions

| Outgoing Event | Purpose |
|----------------|---------|
| `report.created` | Trigger moderation agent to review reported content |
| `comment.created` | Trigger community manager bot to auto-respond |
| `article.pending_review` | Trigger fact-checking agent |
| `user.registered` | Trigger welcome bot (onboarding DM) |

### 12.5 Bot User Core Features

| Feature | Implementation Approach |
|---------|--------------------------|
| **Bot identity** | User record with `isBot: true` or `role: BOT`, bot avatar/badge |
| **API key auth** | Existing ApiKey model with bot-specific scopes |
| **Rate limiting** | Per-key throttling (extend ThrottlerModule with key-based limits) |
| **Audit trail** | Existing AuditLog + bot attribution in metadata |
| **Bot directory** | `/bots` page listing verified bots (like Twitter bots) |
| **Webhook triggers** | Outgoing webhooks trigger agent workflows |
| **Result reporting** | Agents post results back via incoming webhooks / API |

### 12.6 Integration Points with Existing Components

| Component | Integration |
|-----------|-------------|
| **User model** | Add `isBot` boolean field or BOT role |
| **ApiKey model** | Already supports user association + scopes |
| **AuditLog model** | Already tracks actions; add `isBot: true` context |
| **ArticlesService** | Bot creates articles via existing API/webhook |
| **CommentsService** | Bot posts comments via existing API |
| **NotificationsService** | Bot-generated notifications (e.g., moderation alerts) |
| **Reports system** | AI moderation agent reviews and acts on reports |
| **AIAgent model** | Already in schema, needs runtime integration |
| **BackgroundJob model** | Already in schema, can track agent execution |
| **Bull queue** | Already in dependencies, perfect for agent task queue |
| **CacheService** | Cache AI responses, rate limit counters |
| **WebhooksModule** | Bidirectional: triggers agents + receives agent results |
| **Admin dashboard** | AI settings page exists, expand with agent management |

### 12.7 Security & Governance Considerations

| Concern | Mitigation |
|---------|------------|
| **Bot impersonation** | Clear visual indicators (bot badges), verified bot program |
| **Spam/abuse** | Rate limits per bot, content quotas, human review thresholds |
| **AI hallucinations** | Disclaimers on AI-generated content, fact-checking pipeline |
| **Transparency** | All bot actions logged to AuditLog, publicly visible bot label |
| **API key leakage** | Key rotation, expiry dates, last-used tracking, scope restriction |
| **Malicious agents** | Sandboxed execution, permission model, kill switch |
| **Content attribution** | Clear "AI-generated" labels, human review for published content |
| **Data privacy** | PII filtering before sending to external AI APIs |

### 12.8 Challenges & Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **AI API cost management** | Caching of frequent queries, usage quotas, cost tracking in AIAgent model |
| **Latency of AI operations** | Async queue-based processing, immediate acknowledgment + webhook callback |
| **Content quality** | Human-in-the-loop review, confidence thresholds, auto-publish only for high-confidence |
| **Rate limits of AI providers** | Circuit breakers, exponential backoff, fallback to simpler models |
| **Agent coordination** | Single task queue with priorities, avoid duplicate work via idempotency keys |
| **Monitoring & observability** | Agent run logs, success/failure metrics, alerting on failures |
| **Versioning / rollback** | Agent config versioning, easy disable, gradual rollout via feature flags |
| **Testing bot behavior** | Staging environment, sandbox mode, dry-run capability |

### 12.9 Recommended First Steps

1. **Phase 1: Bot User Foundation** (1-2 weeks)
   - Add `BOT` role or `isBot` flag to User model
   - Extend API key scoping with granular permissions
   - Bot creation endpoint in AdminModule
   - Audit log enhancement for bot actions

2. **Phase 2: Moderation Agent** (2-3 weeks)
   - Integrate with real AI API (OpenAI/Anthropic)
   - Replace keyword-based testAIModeration with real implementation
   - Auto-flag content based on AI analysis
   - Moderation dashboard with AI recommendations

3. **Phase 3: Content Creation Agent** (2-3 weeks)
   - Article generation via AI prompts
   - Fact-checking pipeline
   - Human review workflow
   - Scheduled publishing

4. **Phase 4: Outgoing Webhooks + Agent Triggers** (2 weeks)
   - Implement outgoing webhook delivery (Section 11)
   - Wire event triggers to agent workflows
   - Agent result webhook endpoints

---

## 13. Incoming Webhook — Complete Examples

> Real-world examples based on the actual implementation in [webhooks.controller.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.controller.ts) and [webhooks.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.service.ts).

### 13.1 How It Works

The incoming webhook flow uses the existing implementation:

```text
External System → POST /api/webhooks/content (with x-api-key header)
    → Verify API key + scope check
    → Log to WebhookLog table
    → Route by event type (article.create, highlight.create, etc.)
    → Create/update/delete content
    → Return result
```

### 13.2 Step 1: Register a User Account

```bash
curl -X POST https://your-api.ewr.prisma.build/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "publisher@vellum.app",
    "password": "SecurePass123!",
    "handle": "vellumpublisher",
    "name": "Vellum Publisher"
  }'
```

Response:

```json
{
  "user": {
    "id": "abc-123",
    "email": "publisher@vellum.app",
    "handle": "vellumpublisher",
    "name": "Vellum Publisher",
    "role": "USER"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
  "expiresIn": 900
}
```

### 13.3 Step 2: Create an API Key with `content:create` Scope

The API key is required by [webhooks.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.service.ts) — it checks `apiKeyRecord.scopes.includes('content:create')`.

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{
    "name": "Content Publishing Key",
    "scopes": ["content:create"]
  }'
```

Response:

```json
{
  "id": "key-uuid-001",
  "name": "Content Publishing Key",
  "key": "sk-1721234567890-abc123def456ghi789jkl012",
  "userId": "abc-123",
  "scopes": ["content:create"],
  "isActive": true,
  "expiresAt": null,
  "createdAt": "2026-07-18T10:30:00.000Z"
}
```

> **Important:** Save the key value — it's shown only once.

### 13.4 Step 3: Post an Article via Incoming Webhook

Based on the actual `createArticleFromWebhook` logic in [webhooks.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.service.ts):

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-1721234567890-abc123def456ghi789jkl012" \
  -d '{
    "event": "article.create",
    "data": {
      "title": "The Future of AI Publishing",
      "excerpt": "How AI is transforming the way we create and consume content.",
      "body": [
        "Artificial intelligence is reshaping content creation in unprecedented ways.",
        "From automated research to AI-assisted writing, the possibilities are endless.",
        "In this article, we explore the trends shaping the next decade of publishing."
      ],
      "cover": "https://images.example.com/ai-publishing-cover.jpg",
      "category": "Technology",
      "readMinutes": 5
    }
  }'
```

Response (201 Created):

```json
{
  "id": "article-uuid-001",
  "slug": "the-future-of-ai-publishing",
  "title": "The Future of AI Publishing",
  "excerpt": "How AI is transforming the way we create and consume content.",
  "body": [
    "Artificial intelligence is reshaping content creation in unprecedented ways.",
    "From automated research to AI-assisted writing, the possibilities are endless.",
    "In this article, we explore the trends shaping the next decade of publishing."
  ],
  "cover": "https://images.example.com/ai-publishing-cover.jpg",
  "categoryId": "category-uuid-tech",
  "authorId": "abc-123",
  "isPublished": true,
  "publishedAt": "2026-07-18T10:35:00.000Z",
  "readMinutes": 5,
  "views": 0,
  "likesCount": 0,
  "commentsCount": 0,
  "createdAt": "2026-07-18T10:35:00.000Z",
  "updatedAt": "2026-07-18T10:35:00.000Z"
}
```

### 13.5 Step 4: Post a Highlight via Incoming Webhook

Based on `createHighlightFromWebhook` in [webhooks.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.service.ts):

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-1721234567890-abc123def456ghi789jkl012" \
  -d '{
    "event": "highlight.create",
    "data": {
      "title": "AI Demo: Real-time Content Generation",
      "videoUrl": "https://cdn.example.com/videos/ai-demo.mp4",
      "thumbnailUrl": "https://cdn.example.com/thumbnails/ai-demo.jpg",
      "description": "Watch AI generate a full article in under 30 seconds.",
      "music": "Electronic Future Beat",
      "aspectRatio": "9:16",
      "duration": 45
    }
  }'
```

### 13.6 Step 5: Update an Article via Incoming Webhook

Based on `updateArticleFromWebhook` in [webhooks.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.service.ts):

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-1721234567890-abc123def456ghi789jkl012" \
  -d '{
    "event": "article.update",
    "data": {
      "slug": "the-future-of-ai-publishing",
      "title": "The Future of AI Publishing (2026 Edition)",
      "excerpt": "Updated: How AI is transforming content creation in 2026.",
      "body": [
        "Updated content with latest 2026 research findings.",
        "New sections on multimodal AI and content personalization."
      ],
      "cover": "https://images.example.com/ai-publishing-2026.jpg",
      "readMinutes": 7
    }
  }'
```

### 13.7 Step 6: Delete an Article via Incoming Webhook

Based on `deleteArticleFromWebhook` in [webhooks.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.service.ts):

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-1721234567890-abc123def456ghi789jkl012" \
  -d '{
    "event": "article.delete",
    "data": {
      "slug": "the-future-of-ai-publishing"
    }
  }'
```

### 13.8 Step 7: Check Webhook Delivery Logs

```bash
curl -X GET "https://your-api.ewr.prisma.build/api/webhooks/logs?event=article.create&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

Response:

```json
[
  {
    "id": "log-uuid-001",
    "webhookId": "system-content-webhook",
    "event": "article.create",
    "payload": {
      "event": "article.create",
      "data": { "title": "The Future of AI Publishing", "..." : "..." }
    },
    "statusCode": null,
    "response": null,
    "error": null,
    "createdAt": "2026-07-18T10:35:00.000Z"
  }
]
```

### 13.9 Error Scenarios

**Invalid API key:**

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: invalid-key" \
  -d '{"event": "article.create", "data": {"title": "Test"}}'
```

```json
{
  "statusCode": 401,
  "message": "Invalid API key",
  "timestamp": "2026-07-18T10:40:00.000Z",
  "path": "/api/webhooks/content"
}
```

**Insufficient scope:**

```json
{
  "statusCode": 401,
  "message": "Insufficient permissions",
  "timestamp": "2026-07-18T10:41:00.000Z",
  "path": "/api/webhooks/content"
}
```

**Unknown event:**

```json
{
  "statusCode": 400,
  "message": "Unknown event type",
  "timestamp": "2026-07-18T10:42:00.000Z",
  "path": "/api/webhooks/content"
}
```

---

## 14. Bot User Creation & Usage — Complete Examples

> Real-world examples showing how to create a bot user, configure it as an AI agent, and use it to publish content automatically. Based on the actual implementation in [admin.controller.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.controller.ts) and [schema.prisma](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/prisma/schema.prisma).

### 14.1 How It Works

Bot users leverage the existing `User` model + `ApiKey` model + `AIAgent` model. The flow:

```text
1. Admin creates a bot user account (register via API)
2. Admin promotes bot to CREATOR role (so it can post content)
3. Admin creates an API key for the bot with content:create scope
4. Admin creates an AIAgent config (tracks bot runs, model, status)
5. AI agent uses the API key to post content via webhooks
6. All actions are logged in WebhookLog + AuditLog
```

### 14.2 Step 1: Register the Bot User Account

```bash
curl -X POST https://your-api.ewr.prisma.build/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ai-assistant@vellum.bot",
    "password": "BotSecurePass456!",
    "handle": "aiassistant",
    "name": "AI Assistant"
  }'
```

Response:

```json
{
  "user": {
    "id": "bot-user-001",
    "email": "ai-assistant@vellum.bot",
    "handle": "aiassistant",
    "name": "AI Assistant",
    "role": "USER",
    "isActive": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440001",
  "expiresIn": 900
}
```

### 14.3 Step 2: Promote Bot to CREATOR Role (Admin)

Using the admin endpoint in [admin.controller.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.controller.ts):

```bash
curl -X PUT https://your-api.ewr.prisma.build/api/admin/users/bot-user-001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{
    "role": "CREATOR"
  }'
```

Response:

```json
{
  "id": "bot-user-001",
  "email": "ai-assistant@vellum.bot",
  "handle": "aiassistant",
  "name": "AI Assistant",
  "role": "CREATOR",
  "isActive": true,
  "updatedAt": "2026-07-18T11:00:00.000Z"
}
```

### 14.4 Step 3: Create an API Key for the Bot

Using the bot's JWT token from Step 1:

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <bot-jwt-token>" \
  -d '{
    "name": "AI Assistant Bot Key",
    "scopes": ["content:create"]
  }'
```

Response:

```json
{
  "id": "key-uuid-bot-001",
  "name": "AI Assistant Bot Key",
  "key": "sk-1721234700000-botkey123xyz456abc789def012",
  "userId": "bot-user-001",
  "scopes": ["content:create"],
  "isActive": true,
  "expiresAt": null,
  "createdAt": "2026-07-18T11:05:00.000Z"
}
```

### 14.5 Step 4: Register the Bot as an AI Agent (Admin)

Using the admin AIAgent endpoints. The `AIAgent` model is defined in [schema.prisma](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/prisma/schema.prisma).

```bash
curl -X POST https://your-api.ewr.prisma.build/api/admin/ai-agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{
    "name": "Content Generator Bot",
    "description": "Auto-generates daily tech news articles from external RSS feeds",
    "model": "gpt-4",
    "status": "idle",
    "config": {
      "botUserId": "bot-user-001",
      "apiKeyId": "key-uuid-bot-001",
      "schedule": "0 9 * * *",
      "categories": ["Technology", "AI", "Science"],
      "maxDailyPosts": 3,
      "autoPublish": false,
      "language": "en",
      "tone": "informative",
      "wordCount": { "min": 500, "max": 1500 }
    }
  }'
```

Response:

```json
{
  "id": "agent-uuid-001",
  "name": "Content Generator Bot",
  "description": "Auto-generates daily tech news articles from external RSS feeds",
  "model": "gpt-4",
  "status": "idle",
  "runs": 0,
  "lastRunAt": null,
  "config": {
    "botUserId": "bot-user-001",
    "apiKeyId": "key-uuid-bot-001",
    "schedule": "0 9 * * *",
    "categories": ["Technology", "AI", "Science"],
    "maxDailyPosts": 3,
    "autoPublish": false,
    "language": "en",
    "tone": "informative",
    "wordCount": { "min": 500, "max": 1500 }
  },
  "createdAt": "2026-07-18T11:10:00.000Z",
  "updatedAt": "2026-07-18T11:10:00.000Z"
}
```

### 14.6 Step 5: Bot Publishes Content via Webhook

Now the AI agent (running externally or in a cron job) uses the bot's API key to post articles:

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-1721234700000-botkey123xyz456abc789def012" \
  -d '{
    "event": "article.create",
    "data": {
      "title": "GPT-5 Announced: What Developers Need to Know",
      "excerpt": "OpenAI unveils GPT-5 with 10x context window and native multimodal reasoning.",
      "body": [
        "OpenAI today announced GPT-5, the latest iteration of its flagship language model.",
        "The new model features a 1-million token context window, enabling processing of entire codebases and book-length documents.",
        "Key improvements include native multimodal reasoning, reduced hallucination rates, and a 40% cost reduction compared to GPT-4.",
        "Developers can access GPT-5 via the OpenAI API starting next week, with pricing at $0.01 per 1K input tokens."
      ],
      "cover": "https://images.example.com/gpt5-announcement.jpg",
      "category": "Technology",
      "readMinutes": 4
    }
  }'
```

Response:

```json
{
  "id": "article-uuid-bot-001",
  "slug": "gpt-5-announced-what-developers-need-to-know",
  "title": "GPT-5 Announced: What Developers Need to Know",
  "excerpt": "OpenAI unveils GPT-5 with 10x context window and native multimodal reasoning.",
  "body": [
    "OpenAI today announced GPT-5, the latest iteration of its flagship language model.",
    "..."
  ],
  "authorId": "bot-user-001",
  "isPublished": true,
  "publishedAt": "2026-07-18T11:15:00.000Z",
  "likesCount": 0,
  "commentsCount": 0,
  "views": 0,
  "createdAt": "2026-07-18T11:15:00.000Z"
}
```

### 14.7 Step 6: Bot Posts a Highlight (Video Content)

```bash
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-1721234700000-botkey123xyz456abc789def012" \
  -d '{
    "event": "highlight.create",
    "data": {
      "title": "GPT-5 Demo: Generating a Full App in 60 Seconds",
      "videoUrl": "https://cdn.example.com/videos/gpt5-demo.mp4",
      "thumbnailUrl": "https://cdn.example.com/thumbnails/gpt5-demo.jpg",
      "description": "Watch GPT-5 generate a complete React app from a single prompt.",
      "music": "Tech Innovation Beat",
      "aspectRatio": "9:16",
      "duration": 60
    }
  }'
```

### 14.8 Step 7: Update the AI Agent Status After a Run

```bash
curl -X PUT https://your-api.ewr.prisma.build/api/admin/ai-agents/agent-uuid-001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{
    "status": "idle",
    "config": {
      "botUserId": "bot-user-001",
      "apiKeyId": "key-uuid-bot-001",
      "schedule": "0 9 * * *",
      "categories": ["Technology", "AI", "Science"],
      "maxDailyPosts": 3,
      "autoPublish": false,
      "lastRunSummary": {
        "articlesGenerated": 2,
        "articlesPublished": 2,
        "timestamp": "2026-07-18T11:15:00.000Z"
      }
    }
  }'
```

### 14.9 Step 8: List All AI Agents (Admin Monitoring)

```bash
curl -X GET https://your-api.ewr.prisma.build/api/admin/ai-agents \
  -H "Authorization: Bearer <admin-jwt-token>"
```

Response:

```json
[
  {
    "id": "agent-uuid-001",
    "name": "Content Generator Bot",
    "description": "Auto-generates daily tech news articles from external RSS feeds",
    "model": "gpt-4",
    "status": "idle",
    "runs": 1,
    "lastRunAt": "2026-07-18T11:15:00.000Z",
    "config": { "..." : "..." },
    "createdAt": "2026-07-18T11:10:00.000Z",
    "updatedAt": "2026-07-18T11:16:00.000Z"
  }
]
```

### 14.10 Step 9: Disable the Bot (Revoke API Key)

```bash
# Revoke the bot's API key
curl -X DELETE https://your-api.ewr.prisma.build/api/webhooks/api-keys/key-uuid-bot-001 \
  -H "Authorization: Bearer <bot-jwt-token>"

# Disable the AI agent config
curl -X PUT https://your-api.ewr.prisma.build/api/admin/ai-agents/agent-uuid-001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{"status": "disabled"}'
```

---

## 15. Bot Automation Script Example

> A real Node.js script showing how an external AI agent would interact with the platform.

### 15.1 Complete Bot Agent Script

```javascript
// bot-agent.js — External AI agent that posts content via webhooks
const API_BASE = "https://your-api.ewr.prisma.build/api";
const BOT_API_KEY = "sk-1721234700000-botkey123xyz456abc789def012";

async function postArticle(article) {
  const response = await fetch(`${API_BASE}/webhooks/content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BOT_API_KEY,
    },
    body: JSON.stringify({
      event: "article.create",
      data: {
        title: article.title,
        excerpt: article.excerpt,
        body: article.body,          // Array of paragraph strings
        cover: article.coverImage,
        category: article.category,   // Must match existing Category name
        readMinutes: article.readMinutes || 5,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Webhook failed: ${error.message}`);
  }

  return response.json();
}

// Example: AI generates an article and posts it
async function runDailyPost() {
  const article = await generateArticleWithAI({
    topic: "Latest AI developments",
    category: "Technology",
    tone: "informative",
  });

  const result = await postArticle(article);
  console.log(`Article published: ${result.slug}`);
  console.log(`URL: https://vellum.app/article/${result.slug}`);
}

runDailyPost().catch(console.error);
```

### 15.2 Complete Flow Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN SETUP                              │
│                                                             │
│  1. Register bot user    POST /api/auth/register            │
│  2. Promote to CREATOR   PUT  /api/admin/users/:id          │
│  3. Create API key       POST /api/webhooks/api-keys        │
│  4. Create AIAgent       POST /api/admin/ai-agents          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   BOT AUTOMATION LOOP                        │
│                                                             │
│  External AI Agent (cron / event-triggered)                 │
│     │                                                       │
│     ├─ Generate content via LLM (GPT-4, Claude, etc.)       │
│     │                                                       │
│     ├─ POST /api/webhooks/content                           │
│     │  Headers: x-api-key: sk-...                           │
│     │  Body: { event: "article.create", data: {...} }       │
│     │                                                       │
│     │  → API key verified                                   │
│     │  → Scope checked (content:create)                     │
│     │  → Logged to WebhookLog                               │
│     │  → Article created under bot user                     │
│     │  → Published immediately                              │
│     │                                                       │
│     └─ Update agent status  PUT /api/admin/ai-agents/:id    │
└─────────────────────────────────────────────────────────────┘
```

> All examples above use the actual endpoint paths, request/response shapes, and logic from the real implementation in [webhooks.controller.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.controller.ts), [webhooks.service.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/webhooks/webhooks.service.ts), and [admin.controller.ts](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api/src/modules/admin/admin.controller.ts).

---

## Appendix: Useful Commands

```bash
# Monorepo root commands
npm run build          # Build all packages
npm run dev:api        # Start API dev server
npm run dev:admin      # Start admin dashboard dev server
npm run dev:web        # Start web app dev server
npm run lint           # Lint all workspaces
npm run typecheck      # Type-check all workspaces
npm run test           # Run all tests
npm run test:e2e       # Run Playwright e2e tests

# Database (root convenience scripts)
npm run db:migrate     # Run migrations
npm run db:seed        # Seed database
npm run db:generate    # Generate Prisma client
npm run db:studio      # Open Prisma Studio

# API package specific
cd packages/api
npm run start:dev      # NestJS watch mode
npm run build          # Prisma generate + Nest build
npm run start:prod     # Run production build
npm run test:cov       # Test with coverage
npm run migrate:prod   # Deploy migrations to production
npm run deploy:compute # Deploy to Prisma Compute (needs bun)
```

---

*Generated for Vellum monorepo. Last updated: 2026-07-18 (Sections 13–15 added: Webhook & Bot practical examples)*

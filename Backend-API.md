# Backend API

**Location:** `packages/api/`

NestJS provides the API layer for identity, publishing, social interactions, administration, media, notifications, webhooks and AI-agent configuration.

## Bootstrap

`src/main.ts` configures documented concerns including Helmet, configurable CORS, cookies, global validation, global exception handling, Swagger at `/api/docs`, static uploads at `/uploads/`, and graceful shutdown hooks.

## Authentication pipeline

```text
Request
  ↓
JwtAuthGuard
  ↓
JwtStrategy
  ↓
AuthService.validateUser()
  ↓
PrismaService
  ↓
RolesGuard
  ↓
Controller
```

## Key API domains

- Auth
- Users
- Articles
- Highlights
- Comments
- Likes
- Bookmarks
- Follows
- Notifications
- Search
- Admin
- Webhooks
- AI agents
- Media

## Users

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/users/me` | Yes | Current user |
| GET | `/api/users/handle/:handle` | No | Public profile |
| PUT | `/api/users/me` | Yes | Update profile |
| GET | `/api/users/me/settings` | Yes | Settings |
| PUT | `/api/users/me/settings` | Yes | Update settings |
| GET | `/api/users/search` | No | Search users |
| DELETE | `/api/users/me` | Yes | Deactivate account |

## Social interactions

Likes use a polymorphic target for articles, highlights, or comments and maintain denormalized counters. Follows provide toggle, follower/following, and status operations.

## Search

The search module (`packages/api/src/modules/search`) provides unified content search across users, articles and highlights with Redis-backed caching and trend tracking.

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/search` | No (records recent if auth) | Search across users/articles/highlights |
| GET | `/api/search/recent` | Yes | Recent searches for the authenticated user |
| GET | `/api/search/trending` | No | Trending search terms (global) |
| GET | `/api/search/recent/clear` | Yes | Clear the user's recent searches |

Query parameters: `query`, `page`, `limit`, `type` (`users` \| `articles` \| `highlights`), `sort` (`relevance` \| `newest` \| `oldest` \| `most_liked` \| `most_commented`).

### Redis integration

- **Result cache:** search results cached per `(query, type, page, limit, sort)` with a 120-second TTL.
- **Recent searches (per user):** Redis list — `LPUSH` + `LTRIM` (max 10) + `EXPIRE` (30 days).
- **Trending searches (global):** Redis sorted set — `ZINCRBY` on each search, `ZREVRANGE` for the top terms.

A dedicated subscriber Redis client is used for pub/sub so the command client never enters subscribe mode (which would block `SET`/`LPUSH`/`ZINCRBY`).

## Admin endpoints

The documented administration API covers dashboard metrics, users, analytics, audit logs, webhooks, AI agents, feature flags, and moderation.

## Error handling

The application uses a global exception filter for consistent API errors. Webhook-specific documented failures include invalid API keys, insufficient permissions, and unknown event types.

## Swagger

OpenAPI documentation is exposed at `/api/docs` in the configured backend.

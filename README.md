# Vellum Monorepo

A premium content platform with web, mobile, and backend applications.

## Architecture

```
vellum-monorepo/
├── apps/
│   ├── web-app/          # Vite + React + TanStack Router (Web)
│   └── mobile-app/       # Expo + React Native (iOS, Android, Web)
│
├── packages/
│   ├── api/              # NestJS backend API
│   ├── api-client/       # Shared API client & TypeScript types
│   ├── auth/             # Shared auth context
│   ├── react-hooks/      # Shared React hooks
│   ├── social-store/     # Shared social store
│   └── utils/            # Shared utility functions
│
├── .github/
│   ├── workflows/        # CI/CD pipelines
│   ├── CODEOWNERS        # Code ownership
│   ├── dependabot.yml    # Dependency automation
│   └── pull_request_template.md
│
├── package.json          # Root workspace configuration
├── .nvmrc                # Node version
├── tsconfig.base.json    # Base TypeScript configuration
└── .editorconfig         # Editor settings
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | Vite, React 19, TanStack Router, Tailwind CSS v4 |
| Mobile | Expo SDK 54, React Native, React Navigation |
| Backend | NestJS, Prisma, PostgreSQL, Redis |
| Shared | TypeScript, REST API |

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 10+
- PostgreSQL 16+
- Redis 7+

## Quick Start

### 1. Install Dependencies

```bash
# From root
npm install

# Or individually
cd apps/web-app && npm install
cd packages/api && npm install
cd apps/mobile-app && npm install
```

### 2. Environment Setup

```bash
# Backend
cp packages/api/.env.example packages/api/.env
# Edit packages/api/.env with your credentials
```

### 3. Database

```bash
cd packages/api
npx prisma migrate dev
npx prisma db seed
```

### 4. Start Development

```bash
# Terminal 1: Backend API
npm run dev:api

# Terminal 2: Web Application
npm run dev:web

# Terminal 3: Mobile Application
npm run dev:mobile
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Start backend API in development mode |
| `npm run dev:web` | Start web application |
| `npm run dev:mobile` | Start mobile application |
| `npm run build:api` | Build backend for production |
| `npm run build:web` | Build web application |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |

## CI/CD

- **CI**: Runs on every PR — lint, type check, tests, security audit
- **CD Web**: Deploys to Vercel on `main` branch pushes
- **CD API**: Builds Docker image and pushes to registry on `main` branch pushes

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `develop` | Integration branch |
| `feature/*` | New features |
| `bugfix/*` | Bug fixes |
| `hotfix/*` | Production hotfixes |

## Security

- No secrets committed to the repository
- Environment variables managed via `.env` files (ignored by git)
- See `packages/api/.env.example` for required variables
- Security audits run automatically in CI

## Webhooks & Bot Integration

The platform supports incoming webhooks for content creation and bot user / AI agent integration. See [CODE_WIKI.md](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/CODE_WIKI.md) for full technical documentation (Sections 11–15).

### Incoming Webhooks

External systems can create, update, and delete articles and highlights via `POST /api/webhooks/content` with API key authentication.

**Flow:**

```text
External System → POST /api/webhooks/content (x-api-key header)
  → Verify API key + scope check
  → Log to WebhookLog table
  → Route by event type (article.create, highlight.create, etc.)
  → Create/update/delete content
```

**Quick start — Post an article:**

```bash
# 1. Register a user account
curl -X POST https://your-api.ewr.prisma.build/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "publisher@vellum.app",
    "password": "SecurePass123!",
    "handle": "vellumpublisher",
    "name": "Vellum Publisher"
  }'

# 2. Create an API key with content:create scope
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{"name": "Content Publishing Key", "scopes": ["content:create"]}'

# 3. Post an article via webhook
curl -X POST https://your-api.ewr.prisma.build/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-..." \
  -d '{
    "event": "article.create",
    "data": {
      "title": "The Future of AI Publishing",
      "excerpt": "How AI is transforming content creation.",
      "body": ["Paragraph 1...", "Paragraph 2..."],
      "cover": "https://images.example.com/cover.jpg",
      "category": "Technology",
      "readMinutes": 5
    }
  }'
```

**Supported events:**

| Event | Description |
|-------|-------------|
| `article.create` | Create a new article |
| `article.update` | Update an existing article by slug |
| `article.delete` | Delete an article by slug |
| `highlight.create` | Create a new video highlight |

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 401 | `Invalid API key` | Missing or invalid `x-api-key` header |
| 401 | `Insufficient permissions` | API key lacks `content:create` scope |
| 400 | `Unknown event type` | Unsupported event in payload |

### Bot User / AI Agent Integration

Bot users can be created to automate content publishing via webhooks. The flow uses the existing `User` + `ApiKey` + `AIAgent` models.

**Setup flow:**

```text
1. Register bot user account        POST /api/auth/register
2. Promote bot to CREATOR role      PUT  /api/admin/users/:id
3. Create API key for bot           POST /api/webhooks/api-keys
4. Create AIAgent config            POST /api/admin/ai-agents
5. Bot posts content via webhook    POST /api/webhooks/content
6. Update agent status after run    PUT  /api/admin/ai-agents/:id
```

**Bot automation script (Node.js):**

```javascript
const API_BASE = "https://your-api.ewr.prisma.build/api";
const BOT_API_KEY = "sk-...";

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
        body: article.body,
        cover: article.coverImage,
        category: article.category,
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
```

**Complete flow diagram:**

```text
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN SETUP                              │
│  1. Register bot user    POST /api/auth/register            │
│  2. Promote to CREATOR   PUT  /api/admin/users/:id          │
│  3. Create API key       POST /api/webhooks/api-keys        │
│  4. Create AIAgent       POST /api/admin/ai-agents          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   BOT AUTOMATION LOOP                        │
│  External AI Agent (cron / event-triggered)                 │
│     ├─ Generate content via LLM (GPT-4, Claude, etc.)       │
│     ├─ POST /api/webhooks/content                           │
│     │  → API key verified → Scope checked                   │
│     │  → Logged to WebhookLog → Article created             │
│     └─ Update agent status  PUT /api/admin/ai-agents/:id    │
└─────────────────────────────────────────────────────────────┘
```

> **Note:** Replace `https://your-api.ewr.prisma.build` with the actual API URL. For complete step-by-step examples with request/response payloads, see [CODE_WIKI.md Sections 13–15](file:///Users/mcdarsenemwale/projects/dev/ai_article_worskspace/CODE_WIKI.md#13-incoming-webhook--complete-examples).

## License

MIT

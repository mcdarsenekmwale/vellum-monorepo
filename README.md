# Vellum Monorepo

A premium content platform with web, mobile, and backend applications.

## Architecture

```
vellum-monorepo/
├── apps/
│   ├── webapp/           # Vite + React + TanStack Router (Web)
│   └── mobile-app/       # Expo + React Native (iOS, Android, Web)
│
├── packages/
│   ├── api/              # NestJS backend API
│   └── api-client/       # Shared API client & TypeScript types
│
├── .github/
│   ├── workflows/        # CI/CD pipelines
│   ├── CODEOWNERS        # Code ownership
│   ├── dependabot.yml    # Dependency automation
│   └── pull_request_template.md
│
├── package.json          # Root workspace configuration
├── .nvmrc                # Node version
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
# Webapp
cd webapp && npm install

# Backend
cd packages/api && npm install

# Mobile
cd mobile-app && npm install
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

## License

MIT

---
title: Setup
layout: default
---

# Setup

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 16+
- Redis 7+

## Install

```bash
npm install
```

## Backend environment

```bash
cd packages/api
cp .env.example .env
```

Set the variables required by the current backend configuration. Never commit secrets.

## Database

```bash
cd packages/api
npx prisma migrate dev
npx prisma db seed
```

## Start services

```bash
npm run dev:api
npm run dev:web
npm run dev:admin
npm run dev:mobile
```

Run them in separate terminals as needed.

## Tests

```bash
cd packages/api
npm test
npm run test:cov

cd ../..
npm run test:e2e
npm run test:e2e:ui
npx playwright show-report
```

## Environment checklist

```text
[ ] Node/npm correct
[ ] PostgreSQL available
[ ] Redis available
[ ] packages/api/.env configured
[ ] Prisma generated
[ ] migrations applied
[ ] seed data added if needed
[ ] API starts
[ ] web/admin/mobile start as expected
```

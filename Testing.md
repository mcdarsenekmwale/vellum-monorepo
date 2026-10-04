---
title: Testing
layout: default
---

# Testing

## Current documented baseline

The repository includes `TESTING_REPORT.md`, dated 2026-07-11, covering the production web app, production API, mobile static validation, local development and TypeScript checks. The report marks production web/API as passing and TypeScript as passing, while documenting a development-only React duplication issue.

## API tests

Frameworks/tools:
- Jest
- `@nestjs/testing`
- Supertest

Coverage areas include authentication, article CRUD/listing, likes, comments, follows, validation and error handling.

```bash
cd packages/api
npm test
npm run test:cov
npm run test:watch
```

## E2E

Playwright is used from the repository root.

```bash
npm run test:e2e
npm run test:e2e:ui
npx playwright show-report
```

## Regression discipline

```text
unit/integration tests → E2E → application build → production smoke test
```

## Documented improvement areas

The testing report identifies development-mode React resolution, mobile authentication duplication, broader E2E/unit coverage, bundle monitoring and Web Vitals/performance monitoring as areas for continued hardening. Verify current status before changing this page.

---
title: Deployment
layout: default
---

# Deployment

## Web and admin

The documented frontend deployment path uses Vercel.

```bash
cd apps/web-app
vercel --prod

cd ../admin-dashboard
vercel --prod
```

## API

The backend has Docker-oriented production support plus repository deployment scripts.

## CI/CD

Documented workflows include:

| Workflow | Purpose |
| --- | --- |
| `ci.yml` | lint, test, build |
| `test.yml` | test matrix (api-unit, api-integ, api-integrity, frontend-vitest) |
| `deploy.yml` | deployment pipeline |
| `apply-sync-mgmt-api.yml` | Prisma Management API migration |
| `apply-sync-migration.yml` | migration application |
| `introspect-db.yml` | schema introspection |

## Production checklist

- Build passes
- Environment values configured
- API URLs verified
- CORS verified
- Auth secrets configured
- Database migration reviewed
- Media storage configured
- Webhook/API keys protected
- Smoke tests completed

## Rollback

Application rollback must be considered together with database migration compatibility. Do not assume reverting Git history is safe after an irreversible schema change.

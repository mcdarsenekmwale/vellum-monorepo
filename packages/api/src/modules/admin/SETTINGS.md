# System Settings — Maintenance Guide

This document describes how the admin dashboard settings system is structured,
how to seed and load settings, and the procedures for adding, modifying, or
removing settings in future releases.

## 1. Architecture Overview

```
┌─────────────────────┐      ┌──────────────────────┐      ┌────────────────┐
│  admin-dashboard    │      │  packages/api         │      │  PostgreSQL    │
│  (React + TanStack) │◄────►│  AdminController      │◄────►│  SystemSetting │
│                     │ HTTP │  AdminService         │      │  (Prisma)      │
│  useSystemSettings  │      │  settings-definitions │      │                │
│  useUpdateSetting   │      │  (single source of    │      │  key (unique)  │
│  useSeedSettings    │      │   truth for defaults) │      │  value         │
│  useResetSettings   │      │                       │      │  category      │
└─────────────────────┘      └──────────────────────┘      │  description   │
                                                            │  version       │
                                                            └────────────────┘
```

### Key files

| File | Purpose |
|------|---------|
| `packages/api/src/modules/admin/settings-definitions.ts` | Single source of truth: all setting definitions, default values, validation rules, and `SETTINGS_VERSION` |
| `packages/api/src/modules/admin/admin.service.ts` | CRUD + caching + seeding logic (`listSystemSettings`, `updateSystemSetting`, `seedSettings`, `resetSettings`) |
| `packages/api/src/modules/admin/admin.controller.ts` | HTTP endpoints: `GET/PUT /api/admin/settings`, `POST /api/admin/settings/seed`, `POST /api/admin/settings/reset` |
| `packages/api/prisma/schema.prisma` | `SystemSetting` model (key, value, category, description, version) |
| `packages/api/prisma/seed.ts` | Standalone seed script (run via `npm run seed`) that includes settings seeding |
| `apps/admin-dashboard/src/lib/api/services.ts` | Frontend API client functions |
| `apps/admin-dashboard/src/lib/api/hooks.ts` | React Query hooks (`useSystemSettings`, `useUpdateSystemSetting`, `useSeedSettings`, `useResetSettings`) |
| `apps/admin-dashboard/src/routes/_app.settings.tsx` | Settings UI page with tabbed categories and danger zone |

## 2. Setting Categories

There are 13 categories, each rendered as a tab in the admin dashboard:

| Category | Tab Label | Example Settings |
|----------|-----------|-----------------|
| `general` | General | `workspace.name`, `workspace.url`, `maintenance.mode` |
| `branding` | Branding | `branding.logo_url`, `branding.primary_color`, `branding.custom_css` |
| `appearance` | Appearance | `appearance.default_theme`, `appearance.density`, `appearance.font_family` |
| `auth` | Authentication | `auth.allow_signups`, `auth.require_email_verification`, `auth.session_timeout` |
| `security` | Security | `security.require_2fa`, `security.min_password_length`, `security.max_login_attempts` |
| `uploads` | Uploads | `uploads.max_file_size`, `uploads.allowed_types`, `uploads.storage_provider` |
| `notifications` | Notifications | `notifications.push_enabled`, `notifications.digest_frequency` |
| `email` | Email | `email.smtp_host`, `email.smtp_port`, `email.from_address` |
| `api` | API | `api.rate_limit`, `api.cors_origins`, `api.webhook_timeout` |
| `integrations` | Integrations | `integrations.sentry_dsn`, `integrations.stripe_key`, `integrations.slack_webhook` |
| `localization` | Localization | `localization.default_language`, `localization.currency`, `localization.date_format` |
| `backups` | Backups | `backups.enabled`, `backups.frequency`, `backups.retention_days` |
| `ai` | AI | `ai.enabled`, `ai.auto_flag`, `ai.risk_threshold_high`, `ai.model` |

## 3. Data Structure

Each setting is defined in `settings-definitions.ts` with this interface:

```ts
interface SettingDefaultValue {
  key: string;          // Unique dotted identifier, e.g. "workspace.name"
  value: string;        // Default value as a string (booleans as "true"/"false")
  category: SettingCategory;
  description: string;  // Human-readable hint shown in the UI
  type: 'text' | 'number' | 'boolean' | 'textarea' | 'url' | 'email' | 'json';
  validation?: {
    min?: number;       // Minimum (chars for strings, value for numbers)
    max?: number;       // Maximum (chars for strings, value for numbers)
    pattern?: string;   // Regex pattern the value must match
    required?: boolean; // Whether the value must be non-empty
  };
}
```

The database model (`SystemSetting` in `schema.prisma`) stores all values as
strings with indexes on `key`, `category`, and `version`.

## 4. Seeding Mechanism

Settings are seeded in two ways:

### 4.1 Standalone seed script

```bash
cd packages/api
npm run seed
```

This runs `prisma/seed.ts`, which creates users, articles, and all system
settings using an **upsert** pattern (idempotent — safe to re-run). Existing
setting values are overwritten with defaults only if the script is re-run; in
normal operation the upsert preserves user-modified values on the `update`
branch only for category and description, not value.

> **Note:** The seed script's upsert `update` branch updates `value`,
> `category`, and `description`. If you want to preserve user-modified values
> during re-seeding, use the `POST /api/admin/settings/seed` endpoint instead
> (see below), which is a no-op when settings already exist.

### 4.2 Runtime seed endpoint

```
POST /api/admin/settings/seed
```

This endpoint (exposed in the admin dashboard's Danger Zone) is **idempotent**:
if any settings already exist, it returns immediately without modifying them.
It only seeds when the table is empty. This is the safe way to populate
defaults on a fresh database without overwriting existing configuration.

### 4.3 Reset to defaults

```
POST /api/admin/settings/reset
```

Deletes all settings and re-creates them from `SETTINGS_DEFINITIONS`. Use this
when you want to discard all customisations and return to platform defaults.

## 5. Loading Process (Caching)

`AdminService.listSystemSettings()` implements a TTL-based in-memory cache:

- **Cache TTL:** 60 seconds (`SETTINGS_CACHE_TTL`)
- **Cache key:** single in-memory object (`settingsCache`)
- **Invalidation:** The cache is set to `null` (invalidated) on every
  `updateSystemSetting()`, `resetSettings()`, `seedSettings()`, and
  `updateAISettings()` call.
- **Fallback:** If the cache is expired or null, the service re-fetches from
  the database and regroups by category.

The frontend uses TanStack Query with the `["system-settings"]` query key.
All mutations (`useUpdateSystemSetting`, `useSeedSettings`, `useResetSettings`)
invalidate this key on success, triggering a refetch.

## 6. Validation & Data Integrity

Runtime validation is enforced by `validateSettingValue()` in
`settings-definitions.ts`, called by `AdminService.updateSystemSetting()`:

- **Unknown keys** are rejected.
- **Required** fields reject empty/whitespace values.
- **Boolean** type accepts only `true`/`false` (case-insensitive).
- **Number** type checks `Number.isFinite` and enforces `min`/`max` bounds.
- **JSON** type must be parseable by `JSON.parse`.
- **String** types enforce `min`/`max` length and `pattern` regex.
- **Default values** are pre-validated by the unit test suite — every
  definition's own default must pass its own validation rules.

## 7. Versioning & Migrations

### SETTINGS_VERSION

The constant `SETTINGS_VERSION` (currently `1`) is stamped on every seeded
setting's `version` field. The `SystemSetting` table has an index on `version`
to support future migration queries.

### Adding a new setting (backward compatible)

1. Add a new entry to `SETTINGS_DEFINITIONS` in `settings-definitions.ts`.
2. Bump `SETTINGS_VERSION` if the change is part of a named release.
3. Add the setting to the appropriate category tab in
   `_app.settings.tsx` if a new tab is needed.
4. Run `POST /api/admin/settings/seed` — the seed endpoint will detect the
   table is non-empty and skip. Instead, run `npm run seed` (upsert) or add
   an upsert call in a migration script to insert the new setting.
5. Add unit tests for the new setting's validation in
   `settings-definitions.spec.ts`.

### Removing a setting

1. Remove the entry from `SETTINGS_DEFINITIONS`.
2. Add a cleanup migration (e.g., a Prisma migration or a script) to delete
   the orphaned row: `prisma.systemSetting.delete({ where: { key } })`.
3. Bump `SETTINGS_VERSION`.
4. Update tests.

### Changing a default value

1. Update the `value` field in `SETTINGS_DEFINITIONS`.
2. Bump `SETTINGS_VERSION`.
3. To apply the new default to existing installations, either:
   - Ask admins to use "Reset all settings" in the Danger Zone, or
   - Write a migration script that upserts the changed setting:
     ```ts
     await prisma.systemSetting.upsert({
       where: { key: 'the.key' },
       update: { value: 'new default', version: 2 },
       create: { key: 'the.key', value: 'new default', category: 'general', version: 2 },
     });
     ```

### Migration path pattern

For versioned migrations, write a standalone script in
`packages/api/prisma/` (e.g., `migrate-settings-v2.ts`) that:

1. Reads all settings with `version < 2`.
2. Applies necessary transformations.
3. Updates `version` to `2`.

## 8. Testing

The test suite lives in `packages/api/src/modules/admin/`:

| Test file | Type | What it covers |
|-----------|------|----------------|
| `settings-definitions.spec.ts` | Unit | Structure invariants, `getSettingByKey`, `getSettingsForCategory`, `validateSettingValue` (all rules) |
| `admin.service.settings.spec.ts` | Integration | `AdminService` settings methods with mocked Prisma: seeding, caching, validation delegation, idempotency, reset |
| `admin.controller.settings.spec.ts` | E2E | HTTP endpoints via supertest: `GET/PUT /settings`, `POST /settings/seed`, `POST /settings/reset` |

### Running tests

```bash
cd packages/api

# All tests
npm test

# Only settings tests
npx jest src/modules/admin/settings-definitions.spec.ts
npx jest src/modules/admin/admin.service.settings.spec.ts
npx jest src/modules/admin/admin.controller.settings.spec.ts

# With coverage
npm run test:cov
```

### Test configuration

- `tsconfig.spec.json` — extends the base tsconfig with `jest` and `supertest`
  types. Used by ts-jest via the `jest` config in `package.json`.
- `tsconfig.json` — production build config; excludes `*.spec.ts` files so the
  build does not require test type definitions.

## 9. Frontend Usage

### Hooks (`apps/admin-dashboard/src/lib/api/hooks.ts`)

```ts
// Read all settings grouped by category
const { data, isLoading } = useSystemSettings();

// Update a single setting (validates server-side)
const update = useUpdateSystemSetting();
update.mutate({ key: 'workspace.name', value: 'New Name', category: 'general' });

// Seed defaults (no-op if settings exist)
const seed = useSeedSettings();
seed.mutate();

// Reset all settings to defaults
const reset = useResetSettings();
reset.mutate();
```

All mutations automatically invalidate the `["system-settings"]` query cache.

### Settings page

The settings page (`_app.settings.tsx`) renders 12 category tabs (AI settings
are managed separately in the AI section). The Danger Zone provides:
- **Delete workspace** — destructive, requires typing "DELETE"
- **Reset all settings** — restores all defaults
- **Seed default settings** — idempotent seed for fresh installs

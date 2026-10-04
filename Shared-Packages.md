# Shared Packages

Shared packages prevent duplicate client implementations across web, mobile and admin surfaces.

## `@vellbase/api-client`

Shared HTTP/API layer with documented authentication, token refresh, upload and typed interaction support.

## `@vellbase/auth`

Shared React authentication context.

## `@vellbase/react-hooks`

Reusable React hooks for common application/API behavior.

## `@vellbase/social-store`

Reusable social interaction state for likes, bookmarks, follows and related UI behavior.

## `@vellbase/shared-i18n`

Shared internationalization infrastructure — locales, dictionaries, types and provider factory reused across web, mobile and admin surfaces.

## `@vellbase/utils`

Shared utility functions.

## Dependency direction

```text
Web ─────┐
Mobile ──┼──> Shared Client / Auth / Hooks / Social Store ──> NestJS API
Admin ───┘
```

## Maintenance rule

When the same behavior is needed across applications, prefer a shared package before creating separate implementations. Keep platform-specific concerns inside their applications.

# State Management & Permission Implementation

This document describes the state management architecture and permission model used across the Vellum platform's web application and admin dashboard.

## Table of Contents

- [Overview](#overview)
- [State Management](#state-management)
  - [Web App: `useSmartState` / `SmartState`](#web-app-usesmartstate--smartstate)
  - [Admin Dashboard: `usePageState` / `PageState`](#admin-dashboard-usepagestate--pagestate)
  - [State Determination Logic](#state-determination-logic)
  - [State Components](#state-components)
- [Permission System](#permission-system)
  - [Web App: Guest vs Authenticated](#web-app-guest-vs-authenticated)
  - [Admin Dashboard: RBAC](#admin-dashboard-rbac)
  - [Permission Guards](#permission-guards)
- [Error Boundaries](#error-boundaries)
- [Testing](#testing)
- [Usage Examples](#usage-examples)

---

## Overview

The platform implements a unified approach to UI state management and access control:

- **Smart state determination** automatically selects the correct UI state (loading, shimmer, empty, error, success) based on data-fetching conditions.
- **Role-based access control (RBAC)** enforces read-only access for guests and granular permissions for authenticated users.
- **Component guards** conditionally render UI elements based on authentication state and role permissions.
- **Error boundaries** catch unexpected rendering errors and display user-friendly fallback UIs.

---

## State Management

### Web App: `useSmartState` / `SmartState`

**Files:**
- `apps/web-app/src/hooks/useSmartState.ts`
- `apps/web-app/src/components/SmartState.tsx`

The `useSmartState` hook determines the appropriate UI state from data-fetching conditions. It accepts `isLoading`, `isError`, `error`, `data`, and optional configuration (`useShimmer`, `isEmpty`, `minLoadingDelay`).

**State priority (highest to lowest):**
1. `error` → **error** state
2. `isLoading` → **loading** or **shimmer** state
3. Empty data → **empty** state
4. Otherwise → **success** state

The `SmartState` component renders the corresponding UI for each state:
- **loading**: Centered spinner with "Loading..." text
- **shimmer**: Custom skeleton placeholder (or falls back to loading spinner)
- **empty**: Icon with title and description
- **error**: Alert icon with error message and optional retry button
- **success**: Renders children

### Admin Dashboard: `usePageState` / `PageState`

**Files:**
- `apps/admin-dashboard/src/components/dashboard/page-state.tsx`

Mirrors the web-app pattern with admin-themed styling. Adds additional props:
- `emptyTitle` / `emptyDescription`: Customizable empty state messaging
- `errorTitle`: Customizable error title
- `minHeight`: Configurable minimum height for state containers
- `onRetry`: Callback for retry actions

### State Determination Logic

Both hooks follow identical priority logic:

```ts
function determineState(options) {
  if (isError || error) return "error";
  if (isLoading) return useShimmer ? "shimmer" : "loading";
  if (isEmpty(data)) return "empty";
  return "success";
}
```

**Default empty checks:**
- `null` / `undefined` → empty
- Empty array `[]` → empty
- Empty object `{}` → empty
- Non-empty values → not empty

Custom `isEmpty` predicates can be provided for complex data structures.

### State Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SmartState` | `web-app/src/components/SmartState.tsx` | Web app state wrapper |
| `PageState` | `admin-dashboard/src/components/dashboard/page-state.tsx` | Admin dashboard state wrapper |
| `ChartSkeleton` | `admin-dashboard/src/components/dashboard/skeletons.tsx` | Shimmer placeholder for charts |

---

## Permission System

### Web App: Guest vs Authenticated

**Files:**
- `apps/web-app/src/hooks/usePermission.ts`
- `apps/web-app/src/components/GuestGuard.tsx`

The web app supports two modes: **Guest Mode** (read-only) and **Authenticated Mode** (full access).

**Permission matrix:**

| Permission | Guest | Authenticated |
|------------|-------|---------------|
| `read:articles` | Yes | Yes |
| `read:comments` | Yes | Yes |
| `share:content` | Yes | Yes |
| `read:discover` | Yes | Yes |
| `read:author` | Yes | Yes |
| `write:articles` | No | Yes |
| `write:comments` | No | Yes |
| `like:content` | No | Yes |
| `save:content` | No | Yes |
| `follow:users` | No | Yes |
| `compose:content` | No | Yes |
| `read:settings` | No | Yes |

**`GuestGuard` modes:**
- `hide` (default): Renders nothing for guests
- `disable`: Renders children with `pointer-events-none` and `opacity-50`
- `prompt`: Shows a login prompt with a link to the login page

### Admin Dashboard: RBAC

**Files:**
- `apps/admin-dashboard/src/lib/auth/rbac.ts`
- `apps/admin-dashboard/src/components/dashboard/permission-guard.tsx`
- `apps/admin-dashboard/src/components/dashboard/read-only-banner.tsx`

A 7-role hierarchy controls access:

| Role | Rank | Description |
|------|------|-------------|
| Guest | 0 | Read-only public content |
| User | 1 | Basic authenticated user |
| Creator | 2 | Can create articles, posts, etc. |
| Moderator | 3 | Can moderate content and view reports |
| Editor | 4 | Can edit/delete most content |
| Admin | 5 | Full management except SuperAdmin-only |
| SuperAdmin | 6 | Unrestricted access |

**Permission matrix (excerpt):**

| Resource | Read | Write | Delete | Admin |
|----------|------|-------|--------|-------|
| articles | Guest | Creator | Editor | Admin |
| users | Moderator | Admin | Admin | SuperAdmin |
| moderation | Moderator | Moderator | Admin | Admin |
| settings | Admin | Admin | SuperAdmin | SuperAdmin |

### Permission Guards

**Web app:**
- `usePermission(user)`: Hook returning `can(permission)`, `isGuest`, `isAuthenticated`
- `GuestGuard`: Component-level control with hide/disable/prompt modes

**Admin dashboard:**
- `PermissionGuard`: Wraps content with optional read-only banner
- `PermissionGate`: Simple conditional render without wrapper elements
- `ReadOnlyBanner`: Visual indicator for view-only access

**Usage example:**

```tsx
// Admin dashboard
<PermissionGuard resource="articles" action="read" showReadOnlyBanner>
  <ArticleList />
</PermissionGuard>

<PermissionGate resource="articles" action="write">
  <Button>Create Article</Button>
</PermissionGate>

// Web app
<GuestGuard user={user} mode="hide">
  <DeleteButton />
</GuestGuard>

<GuestGuard user={user} mode="prompt" promptMessage="Sign in to comment">
  <CommentForm />
</GuestGuard>
```

---

## Error Boundaries

**Files:**
- `apps/web-app/src/components/EnhancedErrorBoundary.tsx`

Catches React rendering errors and displays a user-friendly fallback with:
- Error message display
- Retry button to recover
- Link to navigate home

**Usage:**

```tsx
<EnhancedErrorBoundary onError={(error, info) => logError(error)}>
  <MyComponent />
</EnhancedErrorBoundary>
```

---

## Testing

### Test Infrastructure

- **Framework:** Vitest
- **Environment:** jsdom
- **Utilities:** `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`

### Running Tests

```bash
# Web app
cd apps/web-app
npm test

# Admin dashboard
cd apps/admin-dashboard
npm test
```

### Test Coverage

**Web app (`apps/web-app/src/**/*.test.{ts,tsx}`):**

| File | Tests | Coverage |
|------|-------|----------|
| `useSmartState.test.ts` | 11 | State determination logic |
| `usePermission.test.ts` | 10 | Guest/authenticated permissions |
| `SmartState.test.tsx` | 12 | Component rendering states |
| `GuestGuard.test.tsx` | 8 | Hide/disable/prompt modes |
| `EnhancedErrorBoundary.test.tsx` | 5 | Error catching and recovery |

**Admin dashboard (`apps/admin-dashboard/src/**/*.test.{ts,tsx}`):**

| File | Tests | Coverage |
|------|-------|----------|
| `rbac.test.ts` | 23 | Role ranks, permissions, route access |
| `page-state.test.tsx` | 15 | Hook and component states |
| `permission-guard.test.tsx` | 10 | Permission checks, read-only banner |
| `read-only-banner.test.tsx` | 5 | Banner and inline variants |

---

## Usage Examples

### Data Table with States

```tsx
function UserTable() {
  const { data, isLoading, isError, error, refetch } = useQuery({...});

  return (
    <PageState
      isLoading={isLoading}
      isError={isError}
      error={error}
      data={data}
      useShimmer
      onRetry={refetch}
      emptyTitle="No users found"
      emptyDescription="Try adjusting your filters."
    >
      <Table>{/* ... */}</Table>
    </PageState>
  );
}
```

### Protected Action Button

```tsx
function DeleteArticleButton({ articleId }) {
  const { user } = useAuth();

  return (
    <PermissionGate resource="articles" action="delete">
      <Button onClick={() => deleteArticle(articleId)}>Delete</Button>
    </PermissionGate>
  );
}
```

### Guest-Aware Like Button

```tsx
function LikeButton({ articleId }) {
  const { user } = useAuth();

  return (
    <GuestGuard user={user} mode="prompt" promptMessage="Sign in to like this article">
      <Button onClick={() => likeArticle(articleId)}>
        <Heart /> Like
      </Button>
    </GuestGuard>
  );
}
```

---

## Best Practices

1. **Always wrap data-driven sections** with `SmartState` or `PageState` to ensure consistent loading/error/empty UX.
2. **Use `useShimmer`** for content-heavy components (tables, cards, dashboards) instead of spinners.
3. **Check permissions at the component level** using `PermissionGate` or `GuestGuard` rather than only at route level.
4. **Show read-only banners** in admin dashboards when users can view but not modify content.
5. **Provide `onRetry` handlers** for error states to allow users to recover without refreshing the page.
6. **Use error boundaries** around complex component trees to prevent total UI crashes.

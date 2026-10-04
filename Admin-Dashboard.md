---
title: Admin Dashboard
layout: default
---

# Admin Dashboard

**Location:** `apps/admin-dashboard/`

The admin dashboard is the platform control plane.

## Documented stack

React, Vite, TanStack Router, Tailwind CSS, shadcn/ui, Recharts, shared API client and shared authentication infrastructure.

## Main areas

- Dashboard
- Users
- Articles
- Highlights
- Comments
- Categories
- Tags
- Moderation
- Feature flags
- Notifications
- Media
- Storage
- Analytics
- Audit
- Roles
- Permissions
- Webhooks
- API docs
- Settings
- AI agents
- Background jobs
- Advertisements
- Music
- Videos

## Reusable UI

Documented reusable components include `AppSidebar`, `TopBar`, `StatCard`, `Charts`, `ListPage`, `PageHeader`, `SectionCard`, `StatusBadge`, `CommandPalette`, `AISettingsPanel`, `ThemeToggle`, `ErrorBoundary`, `Skeletons`, and `EmptyState`.

## RBAC

Admin routes should remain behind authenticated role checks. Treat role changes and permissions as high-impact operational actions and keep them auditable.

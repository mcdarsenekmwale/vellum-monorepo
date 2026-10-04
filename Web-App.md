---
title: Web App
layout: default
---

# Web App

**Location:** `apps/web-app/`

The public web application is the content consumption and engagement surface.

## Documented architecture

- React + Vite
- TanStack Router
- Tailwind CSS
- Partial shadcn/ui usage
- Shared social state
- Custom hooks
- Shared API client
- Shared authentication context

## Main experiences

- Home/feed
- Discover
- Articles
- Highlights
- Stories
- Search
- Profiles/authors
- Saved content
- Notifications
- Settings
- Content creation

## Client data flow

```text
Route → feature/page → shared hook/store → @vellbase/api-client → API
```

## UX expectations

Maintain responsive layouts, semantic headings, keyboard navigation, visible focus states, loading states, empty states, accessible controls, meaningful errors and correct image alternatives.

## Version note

The repository prose contains a React-version discrepancy between `README.md` and `CODE_WIKI.md`. Use the current package manifest as the authoritative version source.

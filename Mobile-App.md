# Mobile App

**Location:** `apps/mobile-app/`

The mobile application provides the platform experience through Expo and React Native.

## Main screens

- Home
- Discover
- Highlights
- Compose
- Notifications
- Profile
- Settings
- Login
- Registration
- Article detail
- Author profile
- Category pages
- Story viewer

## Highlights

The technical documentation identifies components for video playback, paging, actions, comments and overlays, forming the short-form video consumption path.

## Shared integration

Use the shared API client for network/auth behavior when appropriate and the shared social store for cross-client social state.

## Mobile engineering

- Keep navigation concerns inside mobile screens/routes.
- Prefer shared network behavior.
- Account for mobile connectivity and lifecycle.
- Validate platform-specific native behavior.
- Check current mobile authentication source before making consolidation changes.

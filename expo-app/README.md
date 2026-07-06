# Vellum — Expo / React Native

React Native port of the Vellum "Kinetic Journal" mobile app. Uses **Expo Router**
(file-based navigation), **AsyncStorage** for local persistence of likes /
bookmarks / comments, and static covers for the Reels tab (swap for `expo-video`
if you want real playback).

## Run

```sh
cd expo-app
npm install
npx expo start
```

Then press `i` (iOS sim), `a` (Android), or `w` (web).

## Structure

- `app/` — Expo Router routes (file-based, mirrors the web version)
  - `(tabs)/` — bottom tab bar: Feed, Discover, Reels, Saved, Profile
  - `article/[slug].tsx`, `author/[id].tsx`, `category/[name].tsx`
  - `notifications.tsx`, `compose.tsx`
- `src/data/content.ts` — seed articles, reels, authors, comments
- `src/lib/social-store.tsx` — likes / bookmarks / comments (AsyncStorage)
- `src/theme.ts` — colors + typography tokens

## Notes

- No auth. Everything is local to the device.
- Reels are static covers with a like button — swap `<Image>` for
  `<VideoView>` from `expo-video` and add MP4 URLs when you want real playback.
- Images come from `picsum.photos` so nothing needs to be bundled.

# Comprehensive I18n Implementation Design

**Date:** 2026-08-20
**Status:** Approved
**Approach:** A — Unified Shared Dictionary + Module-level t() Penetration + On-demand AI Translation CLI Tool

---

## 1. Problem Statement

The application suite (web-app + mobile-app) has an existing i18n architecture that only covers the settings-area pages. All other main sections — login, home feed, discover, profile, saved, compose, notifications, navigation, errors, empty states — still render hardcoded English strings. Additionally, the mobile app only supports EN/FR while the web app has 7 fully-populated language dictionaries (EN/FR/ES/DE/IT/PT/NL). The task is to achieve comprehensive translation coverage across both apps for all main user-facing sections, evaluate and integrate an AI-powered translation tool, and establish QA processes — all while using tokens/credits optimally.

## 2. Current State

### Web-app (`apps/web-app`)
- **Provider:** `I18nProvider.tsx` — `t(key: "ns.key")` with current-locale → EN fallback → raw `"{ns}.{key}"` fallback. No placeholder interpolation in caller yet.
- **Dictionaries:** `dictionaries.ts` — 7 languages fully populated (EN/FR/ES/DE/IT/PT/NL) for 6 namespaces: `common`, `settings`, `auth`, `errors`, `notifications`, `time`. `SUPPORTED_LOCALES` lists 31 tags but only 7 have dicts.
- **t() penetration:** Only settings-area pages (settings.*.tsx, AppearanceSheet, NotificationsSheet). Main routes (index, compose, discover, profile, notifications, saved, register, login, errors, empty states) have hardcoded English.

### Mobile-app (`apps/mobile-app`)
- **Provider:** `I18nProvider.tsx` — only 2 languages (EN/FR), 5 namespaces (common/settings/auth/profile/errors). Supports `{var}` interpolation.
- **t() penetration:** Only settings routes + help/* + settings-privacy/subscription/about. Core screens (index, discover, profile, saved, notifications, login, compose, nav tabs) have hardcoded English.

## 3. Design

### 3.1 Shared Dictionary Architecture

Create a shared dictionary package consumed by both apps:

```
packages/shared-i18n/
  ├── dictionaries/
  │   ├── base.en.ts          ← EN base = all shared namespaces (union of web + mobile keys)
  │   ├── base.fr.ts          ← FR (merge of existing web FR + mobile FR, dedup)
  │   ├── base.es.ts          ← ES (copied from existing web ES)
  │   ├── base.de.ts          ← DE (copied from existing web DE)
  │   ├── base.it.ts          ← IT (copied from existing web IT)
  │   ├── base.pt.ts          ← PT (copied from existing web PT)
  │   └── base.nl.ts          ← NL (copied from existing web NL)
  ├── namespaces.ts            ← Namespace union type
  ├── locales.ts               ← LocaleTag = 'en'|'fr'|'es'|'de'|'it'|'pt'|'nl' + LOCALE_NAMES
  └── types.ts                 ← NamespaceDict, LocaleTag types
```

Each app retains an app-specific overlay namespace (`app`) for keys that only exist in that app:

```
apps/web-app/src/lib/i18n/dictionaries.ts    ← import shared base + add web-only keys under 'app' namespace
apps/mobile-app/context/dictionaries.ts       ← NEW: import shared base + add mobile-only keys under 'app' namespace
```

Both providers continue their existing storage and fallback logic unchanged.

### 3.2 Key Naming Convention

- Format: `"namespace.camelCaseKey"` — `t("nav.home")`, `t("auth.signIn")`
- Placeholders: `"{{var}}"` pattern — e.g. `"articlesFound": "{{count}} articles found"`
- Both providers updated to substitute `{{var}}` during `t()` call
- New namespaces for main sections: `navigation`, `home`, `discover`, `compose`, `help`, `emptyStates`
- Existing shared namespaces carried over: `common`, `settings`, `auth`, `errors`, `notifications`, `time`, `profile`

### 3.3 Namespace → Key Inventory (Main Sections)

| Namespace | Example Keys | Files Penetrated (Web) | Files Penetrated (Mobile) |
|---|---|---|---|
| `navigation` | `home`, `discover`, `compose`, `notifications`, `profile`, `settings`, `back` | `__root.tsx`, sidebar, topnav | `_layout.tsx`, bottom tabs |
| `home` | `feedTitle`, `forYou`, `trending`, `latest`, `articlesFound`, `readMore` | `routes/index.tsx` | `app/index.tsx` |
| `discover` | `title`, `searchPlaceholder`, `categories`, `popular`, `newAuthors` | `routes/discover.tsx` | `app/discover.tsx` |
| `compose` | `title`, `newArticle`, `bodyPlaceholder`, `publish`, `saveDraft`, `preview` | `routes/compose.tsx` | `app/compose.tsx` |
| `profile` (extend) | `followers`, `following`, `articles`, `likes`, `editProfile`, `follow`, `unfollow` | `routes/profile.tsx` | `app/profile.tsx` |
| `auth` (extend) | `signIn`, `signOut`, `signUp`, `email`, `password`, `forgotPassword`, `createAccount` | `routes/login.tsx`, `routes/register.tsx` | `app/login.tsx` |
| `emptyStates` | `noArticles`, `noNotifications`, `noResults`, `nothingHere`, `startWriting` | `SmartState.tsx`, `EnhancedErrorBoundary.tsx`, GuestGuard | shimmer fallbacks, 404 screens |
| `notifications` (extend) | `title`, `empty`, `markAllRead`, `viewAll` | `routes/notifications.tsx` | `app/notifications.tsx` |

### 3.4 Deliberately Skipped

- Test files (`.test.tsx`, `.test.ts`) — test labels intentionally hardcoded
- Type definitions, interfaces
- API layer, hooks (not UI)
- User-generated content (article bodies, post content)
- CSS decorative content

### 3.5 Provider Touch-ups

**Web-app `t()`:**
- Add optional `args` parameter: `t(key: string, args?: Record<string, string | number>)`
- Add placeholder substitution: `rendered.replace(/\{\{(\w+)\}\}/g, (_, k) => args?.[k] ?? '{{${k}}}')`
- No breaking change — existing callers without `args` still work

**Mobile `t()`:**
- Align placeholder pattern from `{var}` to `{{var}}`
- Update regex from `/\{(\w+)\}/g` to `/\{\{(\w+)\}\}/g`
- Update any existing FR dict entries that use `{var}` to `{{var}}` (zero entries found in audit)

### 3.6 AI Translation CLI Tool

**Script:** `scripts/i18n-missing-translate.ts`

**Usage:**
```
npx ts-node scripts/i18n-missing-translate.ts [--apply] [--lang es,de,it,pt,nl] [--provider deepseek|openai|mock]
```

**Workflow:**
1. Load all 7 base dictionaries + app overlays into memory.
2. Walk EN base namespace tree. For every key, if target language dict has no such key OR value starts with `"__TODO_"`, add to `missing[]` list.
3. Batch missing keys by namespace × language (≤ 20 keys per batch for context preservation).
4. Build prompt per batch with: app context ("Vellum article-reading social app"), target language code, 3 sibling EN:existing_translation pairs for tone matching, instructions to preserve `{{var}}` placeholders literally.
5. Call AI provider API. Parse JSON response.
6. **Default `--dry-run`:** Print `git diff`-style before/after to stdout. Exit 0.
7. **`--apply` flag:** Write keys into the target dict TS file's namespace object. Generate summary report.

**Provider configuration (env vars):**
- `TRANSLATE_PROVIDER=deepseek` → `https://api.deepseek.com/v1/chat/completions` with `DEEPSEEK_API_KEY`
- `TRANSLATE_PROVIDER=openai` → standard OpenAI chat/completions with `OPENAI_API_KEY`
- `TRANSLATE_PROVIDER=mock` (default) → writes `"__TODO_<LANG>_<key>"` markers, no API call, no cost

**Fallback mechanisms:**
- API key missing / HTTP error / bad JSON / empty response → write `"__TODO_<LANG>_<key>"` marker into dict (runtime shows EN fallback, no broken UI) + log to `missing-translations-report.json`
- Compile-time `DictKeysEqual` type check still passes because the key exists (just has a TODO value)
- Engineer re-runs with `--apply` after fixing API issues to fill in TODO markers

**Review process:**
- `--dry-run` is default — engineer reviews output before applying
- `--apply` is opt-in — requires explicit flag
- Generated report serves as audit trail

### 3.7 Compile-time Key Completeness Guard

```ts
// packages/shared-i18n/type-check.ts
type AllKeys<T> = keyof T extends infer NS
  ? NS extends string
    ? keyof T[NS] extends infer K
      ? K extends string ? `${NS}.${K}` : never
      : never
    : never
  : never;

type ENKeys = AllKeys<typeof EN_DICT>;
type FRKeys = AllKeys<typeof FR_DICT>;
// ... ES, DE, IT, PT, NL

// Bidirectional check — fails build if any language is missing EN keys or has extra junk keys
type AssertFRComplete = ENKeys extends FRKeys ? true : never;
type AssertFRNoExtra = FRKeys extends ENKeys ? true : never;
```

### 3.8 QA Process

| Script | Purpose | Type |
|---|---|---|
| `scripts/i18n-audit.py` | Grep source files for hardcoded strings. Per-file counts, candidate list, coverage estimate. Re-runnable. | Static analysis |
| `scripts/i18n-compile-check.ts` | Run `DictKeysEqual` type checks standalone. Reports missing/TODO-marked triplets. | Compile-time |
| `apps/web-app/tests/i18n_smoke.spec.ts` (NEW, ~30 lines) | Playwright: open `/settings/language` → click Français → assert FR header → click Deutsch → assert DE header → click EN → done. | Runtime smoke |
| `mobile_settings_qa.py` i18n section (extend) | Add 1 spot-check each for ES and DE: open language sheet → select Español → verify "Ajustes" → select Deutsch → verify "Einstellungen" → back to EN. | Runtime smoke |

**Translation quality verification criteria:**
- Accuracy: AI-generated translations reviewed in `--dry-run` output before `--apply`
- Cultural appropriateness: prompt includes app context + sibling pairs for tone matching
- Formatting: `{{var}}` placeholders preserved literally by prompt instruction
- Layout: visual screenshot pass at FR/DE (longest typical strings) to spot overflow
- Switching: Playwright smoke tests verify language switch renders correct DOM markers

## 4. Data Flow

```
User selects language in settings
    ↓
Provider setLocale() called
    ↓
localStorage persists locale (web) / AsyncStorage (mobile)
    ↓
Provider re-renders with new locale
    ↓
t("ns.key") looks up: current locale dict → EN fallback → "{ns.key}" raw fallback
    ↓
{{var}} placeholders substituted with args parameter
    ↓
Rendered string displayed in component
```

No runtime network calls. No runtime AI translation. All dictionaries are TS imports bundled at build time.

## 5. Performance

- Dictionary is a TS object import — no runtime fetch, no network call
- `t()` is O(1) object lookup + tiny placeholder regex
- Bundle size: 7 languages × ~6 namespaces × ~80 keys × ~30 chars avg = ~100KB total across all dicts. Acceptable for both web and mobile.
- No hydration mismatch — web I18nProvider gates render on `isLoaded` flag

## 6. Layout & Accessibility

- German/French strings up to 30% longer than English — existing React Native `<Text>` and web `<span>` wrap text. No hardcoded pixel widths in settings screens.
- QA step includes visual screenshot pass at FR/DE to spot overflow.
- RTL: Provider exposes `isRTL` flag for ar/he/fa. Those locales stay in `SUPPORTED_LOCALES` list (web-app) but render EN fallback until populated. Direction flip is correct via existing `isRTL` flag.
- Accessibility: all translated strings rendered as text content (not aria-label-only), screen readers read translated text.

## 7. Maintenance & Future Updates

**Adding a new UI string:**
1. Add key + EN text to `packages/shared-i18n/dictionaries/base.en.ts` under appropriate namespace
2. Run `npx ts-node scripts/i18n-missing-translate.ts --dry-run` to see which languages are missing the key
3. Run `--apply --provider deepseek` to auto-translate (or manually add to each language dict)
4. Run `scripts/i18n-compile-check.ts` to verify all 7 dicts have the key
5. Commit

**Adding a new language:**
1. Add tag to `LocaleTag` in `locales.ts`
2. Add to `SUPPORTED_LOCALES` + `LOCALE_NAMES`
3. Create `base.<lang>.ts` — start with empty namespace objects or copy EN as placeholder
4. Run `i18n-missing-translate.ts --apply --lang <lang> --provider deepseek` to bulk-translate
5. Run compile-check to verify completeness

**Key management strategy:**
- EN is the single source of truth for key names
- All other languages must have every EN key (enforced by compile-time type check)
- App-specific overlay keys go under `app` namespace in the app's own dict file, not in shared base

## 8. File Inventory

### New files
- `packages/shared-i18n/dictionaries/base.en.ts`
- `packages/shared-i18n/dictionaries/base.fr.ts`
- `packages/shared-i18n/dictionaries/base.es.ts`
- `packages/shared-i18n/dictionaries/base.de.ts`
- `packages/shared-i18n/dictionaries/base.it.ts`
- `packages/shared-i18n/dictionaries/base.pt.ts`
- `packages/shared-i18n/dictionaries/base.nl.ts`
- `packages/shared-i18n/namespaces.ts`
- `packages/shared-i18n/locales.ts`
- `packages/shared-i18n/types.ts`
- `packages/shared-i18n/type-check.ts`
- `apps/mobile-app/context/dictionaries.ts` (mobile overlay)
- `scripts/i18n-audit.py`
- `scripts/i18n-missing-translate.ts`
- `scripts/i18n-compile-check.ts`
- `apps/web-app/tests/i18n_smoke.spec.ts`

### Modified files
- `apps/web-app/src/lib/i18n/dictionaries.ts` — re-export shared base + web-only overlay
- `apps/web-app/src/lib/i18n/index.ts` — update LocaleTag to match shared, update SUPPORTED_LOCALES to 7 populated
- `apps/web-app/src/components/providers/I18nProvider.tsx` — add `args` param + `{{var}}` substitution
- `apps/mobile-app/context/I18nProvider.tsx` — import shared dicts + mobile overlay, update `{{var}}` regex
- `apps/mobile-app/context/SettingsStore.tsx` — update LocaleTag type import
- Main-section route files (web): `routes/index.tsx`, `routes/discover.tsx`, `routes/compose.tsx`, `routes/profile.tsx`, `routes/notifications.tsx`, `routes/login.tsx`, `routes/register.tsx`, `routes/__root.tsx`
- Main-section route files (mobile): `app/index.tsx`, `app/discover.tsx`, `app/compose.tsx`, `app/profile.tsx`, `app/notifications.tsx`, `app/saved.tsx`, `app/login.tsx`, `app/_layout.tsx`
- `apps/mobile-app/tests/mobile_settings_qa.py` — add ES/DE spot-checks
- `apps/web-app/tsconfig.json` — add `packages/shared-i18n` path alias
- `apps/mobile-app/tsconfig.json` — add `packages/shared-i18n` path alias

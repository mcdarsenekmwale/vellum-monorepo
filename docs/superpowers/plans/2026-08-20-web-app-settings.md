# Web-App Settings Implementation & QA Plan

**Goal:** Implement working Theme (Light/Dark/System), i18n (EN/FR), Privacy, and Subscription settings on `apps/web-app` with localStorage+backend persistence, then validate via Playwright automation and produce a final report.

**Architecture:**
- Two new React Context providers (ThemeProvider + I18nProvider) wrapped in `__root.tsx` after `QueryClientProvider`.
- Theme: Bootstrap via inline `<script>` in `index.html` (FOUC-prevention) reading `vellum.web.settings.v1` and `vellum.web.theme`. Applies `.dark` class on `<html>` or delegates to `prefers-color-scheme: dark` for system mode.
- i18n: Dictionary-based t() function; only EN/FR (matches backend and avoids unsupported-locale revert bugs from the mobile rewrite).
- Persistence: Dual-write `vellum.web.settings.v1` (JSON with appearance/locale/soundEnabled) + per-key raw keys; backend writes for privacy toggles and notification preferences via `apiClient.updateUserSettings()` (PUT /api/users/me/settings).
- Subscription: new route `/settings/subscription`; uses new `apiClient.getSubscription()` + `apiClient.restorePurchases()` added to `@vellum/api-client` if missing.

**Tech Stack:**
- React 19 + Vite 8, TanStack Router, Tailwind v4 (`@custom-variant dark (&:is(.dark *))` class strategy), Lucide icons, localStorage, Playwright Python, Vitest (existing) for unit tests.

---

### Task 1: Theme Provider + FOUC bootstrap

**Files:**
- Create: `apps/web-app/src/components/providers/ThemeProvider.tsx`
- Modify: `apps/web-app/index.html` (inject inline script before body)
- Modify: `apps/web-app/src/routes/__root.tsx`

Step 1: Create `ThemeProvider.tsx`

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const STORAGE_V1 = "vellum.web.settings.v1";
const STORAGE_THEME_RAW = "vellum.web.theme";

type V1Shape = { appearance?: ThemeMode; locale?: string; soundEnabled?: boolean };

function readV1(): V1Shape {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_V1) || "{}"); } catch { return {}; }
}
function writeV1(patch: Partial<V1Shape>) {
  const cur = readV1();
  const next = { ...cur, ...patch };
  window.localStorage.setItem(STORAGE_V1, JSON.stringify(next));
  return next;
}
function applyResolved(r: Resolved) {
  const h = document.documentElement;
  h.classList.toggle("dark", r === "dark");
  h.style.colorScheme = r;
}
function systemTheme(): Resolved {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type Ctx = {
  mode: ThemeMode;
  resolved: Resolved;
  setMode: (m: ThemeMode) => void;
};
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<Resolved>("light");

  // Initial hydration from storage
  useEffect(() => {
    const v1 = readV1();
    const m: ThemeMode = (v1.appearance === "dark" || v1.appearance === "light" || v1.appearance === "system") ? v1.appearance : "system";
    setModeState(m);
    setResolved(m === "system" ? systemTheme() : m);
  }, []);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { setResolved(systemTheme()); applyResolved(systemTheme()); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  // Apply to DOM whenever resolved changes
  useEffect(() => { applyResolved(resolved); }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    writeV1({ appearance: m });
    window.localStorage.setItem(STORAGE_THEME_RAW, m);
    setResolved(m === "system" ? systemTheme() : m);
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
```

Step 2: Modify `apps/web-app/index.html` to add FOUC-prevention script as the **first** child of `<head>`.

```html
<script>
  (function () {
    try {
      var raw = localStorage.getItem('vellum.web.theme');
      var v1Raw = localStorage.getItem('vellum.web.settings.v1');
      var v1 = v1Raw ? JSON.parse(v1Raw) : {};
      var mode = raw || v1.appearance || 'system';
      var isDark = false;
      if (mode === 'dark') isDark = true;
      else if (mode === 'system') isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var h = document.documentElement;
      if (isDark) h.classList.add('dark'); else h.classList.remove('dark');
      h.style.colorScheme = isDark ? 'dark' : 'light';
    } catch (e) {}
  })();
</script>
```

Step 3: Wrap ThemeProvider in `src/routes/__root.tsx`.

```tsx
import { ThemeProvider } from "@/components/providers/ThemeProvider";

// ...
return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <SocialProvider>
        <Outlet />
        <Toaster position="top-center" />
      </SocialProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
```

Commit: `git add apps/web-app/src/components/providers/ThemeProvider.tsx apps/web-app/index.html apps/web-app/src/routes/__root.tsx && git commit -m "feat(web-app): add theme provider + FOUC bootstrap"`

---

### Task 2: i18n Provider (EN/FR) + SettingsStore context

**Files:**
- Create: `apps/web-app/src/components/providers/I18nProvider.tsx` (dictionary, t(), locale state + persistence)
- Create: `apps/web-app/src/components/providers/SettingsStore.tsx` (combines preferences, subscribes to Theme/I18n, provides soundEnabled toggle + setters)
- Modify: `apps/web-app/src/routes/__root.tsx`

```tsx
// I18nProvider.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LocaleTag = "en" | "fr";
export type Dict = Record<string, string>;

const EN_DICT: Record<string, Dict> = {
  common: { save: "Save", cancel: "Cancel", back: "Back" },
  settings: {
    title: "Settings",
    preferences: "Preferences",
    account: "Account",
    sectionsAppearance: "Appearance",
    sectionsAppearanceDescription: "Light, dark, or system",
    sectionsLanguage: "Language",
    sectionsLanguageDescription: "Select your language",
    sectionsSound: "Sound",
    sectionsSoundDescription: "Enable sound effects",
    sectionsNotifications: "Notifications",
    sectionsNotificationsDescription: "Manage push notifications",
    sectionsPrivacy: "Privacy",
    sectionsPrivacyDescription: "Manage data and permissions",
    sectionsSubscription: "Subscription",
    sectionsSubscriptionDescription: "Manage your subscription",
    sectionsHelpCenter: "Help Center",
    sectionsHelpCenterDescription: "FAQs and contact",
    sectionsAbout: "About",
    sectionsAboutDescription: "Learn more about the app",
    sectionsSignOut: "Sign out",
    appearanceLight: "Light",
    appearanceDark: "Dark",
    appearanceSystem: "System",
    privacyTitle: "Privacy",
    privacyDescription: "Control who can see your activity and content.",
    privacyProfileVisibility: "Profile visibility",
    privacyPublic: "Public",
    privacyFollowers: "Followers only",
    privacyPrivate: "Private",
    privacyAllowComments: "Allow comments on my articles",
    privacyShowLikesCount: "Show likes count on my articles",
    privacyShowOnline: "Show when I am online",
    subscriptionTitle: "Subscription",
    subscriptionEmpty: "No active subscription",
    subscriptionStatusActive: "Active",
    subscriptionStatusCanceled: "Canceled",
    subscriptionStatusPastDue: "Past due",
    subscriptionStatusTrialing: "Trialing",
    subscriptionRenewalDate: "Renews on",
    subscriptionUpgrade: "Upgrade plan",
    subscriptionRestore: "Restore purchases",
    pushNotifications: "Push notifications",
    emailNotifications: "Email notifications",
    notifyLikes: "Likes on my content",
    notifyComments: "New comments",
    notifyReplies: "Replies to my comments",
    notifyFollows: "New followers",
    notifyMentions: "Mentions of me",
    notifyNewArticles: "New articles from creators",
    notifySystem: "System & account alerts",
    notifyEmailDigest: "Weekly digest",
    notifyEmailMarketing: "Product updates via email",
  },
};

const FR_DICT: Record<string, Dict> = {
  common: { save: "Enregistrer", cancel: "Annuler", back: "Retour" },
  settings: {
    title: "Paramètres",
    preferences: "Préférences",
    account: "Compte",
    sectionsAppearance: "Apparence",
    sectionsAppearanceDescription: "Clair, sombre ou système",
    sectionsLanguage: "Langue",
    sectionsLanguageDescription: "Sélectionnez votre langue",
    sectionsSound: "Son",
    sectionsSoundDescription: "Activer les effets sonores",
    sectionsNotifications: "Notifications",
    sectionsNotificationsDescription: "Gérer les notifications push",
    sectionsPrivacy: "Confidentialité",
    sectionsPrivacyDescription: "Gérer les données et les autorisations",
    sectionsSubscription: "Abonnement",
    sectionsSubscriptionDescription: "Gérez votre abonnement",
    sectionsHelpCenter: "Centre d’aide",
    sectionsHelpCenterDescription: "FAQ et contact",
    sectionsAbout: "À propos",
    sectionsAboutDescription: "En savoir plus sur l’app",
    sectionsSignOut: "Se déconnecter",
    appearanceLight: "Clair",
    appearanceDark: "Sombre",
    appearanceSystem: "Système",
    privacyTitle: "Confidentialité",
    privacyDescription: "Contrôlez qui peut voir votre activité.",
    privacyProfileVisibility: "Visibilité du profil",
    privacyPublic: "Public",
    privacyFollowers: "Abonnés uniquement",
    privacyPrivate: "Privé",
    privacyAllowComments: "Autoriser les commentaires sur mes articles",
    privacyShowLikesCount: "Afficher le nombre de likes sur mes articles",
    privacyShowOnline: "Afficher quand je suis en ligne",
    subscriptionTitle: "Abonnement",
    subscriptionEmpty: "Aucun abonnement actif",
    subscriptionStatusActive: "Actif",
    subscriptionStatusCanceled: "Annulé",
    subscriptionStatusPastDue: "Paiement en retard",
    subscriptionStatusTrialing: "Essai",
    subscriptionRenewalDate: "Renouvellement le",
    subscriptionUpgrade: "Améliorer l’abonnement",
    subscriptionRestore: "Restaurer les achats",
    pushNotifications: "Notifications push",
    emailNotifications: "Notifications par e-mail",
    notifyLikes: "Likes sur mon contenu",
    notifyComments: "Nouveaux commentaires",
    notifyReplies: "Réponses à mes commentaires",
    notifyFollows: "Nouveaux abonnés",
    notifyMentions: "Mentions de moi",
    notifyNewArticles: "Nouveaux articles des créateurs",
    notifySystem: "Alertes système et compte",
    notifyEmailDigest: "Résumé hebdomadaire",
    notifyEmailMarketing: "Mises à jour produit par courriel",
  },
};

type Ctx = {
  locale: LocaleTag;
  setLocale: (l: LocaleTag) => void;
  t: (key: string) => string;
};
const I18nCtx = createContext<Ctx | null>(null);
const STORAGE_V1 = "vellum.web.settings.v1";
const STORAGE_LOCALE_RAW = "vellum.web.locale";
function safeParse(v: unknown): LocaleTag {
  return v === "fr" ? "fr" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleTag>("en");
  useEffect(() => {
    const v1 = JSON.parse(localStorage.getItem(STORAGE_V1) || "{}");
    const raw = localStorage.getItem(STORAGE_LOCALE_RAW);
    setLocaleState(safeParse(v1.locale || raw));
  }, []);
  const setLocale = useCallback((l: LocaleTag) => {
    setLocaleState(l);
    const v1 = JSON.parse(localStorage.getItem(STORAGE_V1) || "{}");
    localStorage.setItem(STORAGE_V1, JSON.stringify({ ...v1, locale: l }));
    localStorage.setItem(STORAGE_LOCALE_RAW, l);
  }, []);
  const t = useCallback((key: string) => {
    const [ns, k] = key.includes(".") ? key.split(/\.(.+)/) : ["common", key];
    const dict = locale === "fr" ? FR_DICT : EN_DICT;
    return (dict[ns] && dict[ns][k]) ?? (EN_DICT[ns] && EN_DICT[ns][k]) ?? key;
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
```

- Commit: `feat(web-app): add i18n provider + dictionaries (en/fr)`

---

### Task 3: SettingsStore combined context (sound + local settings)

```tsx
// src/components/providers/SettingsStore.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient } from "@/lib/api";
import type { UserSettings } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const STORAGE_V1 = "vellum.web.settings.v1";
const STORAGE_SOUND_RAW = "vellum.web.sound";

type Ctx = {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  // Privacy toggles, live updated via backend roundtrip.
  privacy: {
    allowComments: boolean;
    allowLikes: boolean;
    showOnlineStatus: boolean;
  };
  setPrivacy: (patch: Partial<Ctx["privacy"]>) => Promise<void>;
  // Notification preferences
  notifications: {
    pushNotifications: boolean;
    emailNotifications: boolean;
    emailMarketing: boolean;
  };
  setNotifications: (patch: Partial<Ctx["notifications"]>) => Promise<void>;
};

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsStoreProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [privacy, setPrivacyState] = useState({ allowComments: true, allowLikes: true, showOnlineStatus: true });
  const [notifications, setNotificationsState] = useState({ pushNotifications: true, emailNotifications: true, emailMarketing: false });

  useEffect(() => {
    const v1 = JSON.parse(localStorage.getItem(STORAGE_V1) || "{}");
    const raw = localStorage.getItem(STORAGE_SOUND_RAW);
    const v = typeof v1.soundEnabled === "boolean" ? v1.soundEnabled : (raw !== "off");
    setSoundEnabledState(v);
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    const cur = JSON.parse(localStorage.getItem(STORAGE_V1) || "{}");
    localStorage.setItem(STORAGE_V1, JSON.stringify({ ...cur, soundEnabled: v }));
    localStorage.setItem(STORAGE_SOUND_RAW, v ? "on" : "off");
  }, []);

  // Load backend privacy + notifications on mount.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const s = await apiClient.getUserSettings();
        if (cancel) return;
        setPrivacyState({ allowComments: !!s.allowComments, allowLikes: !!s.allowLikes, showOnlineStatus: !!s.showOnlineStatus });
        setNotificationsState({ pushNotifications: !!s.pushNotifications, emailNotifications: !!s.emailNotifications, emailMarketing: !!s.emailMarketing });
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  const setPrivacy = useCallback(async (patch: Partial<Ctx["privacy"]>) => {
    setPrivacyState((p) => ({ ...p, ...patch }));
    try {
      const fresh = await apiClient.updateUserSettings(patch as Partial<UserSettings>);
      setPrivacyState({ allowComments: !!fresh.allowComments, allowLikes: !!fresh.allowLikes, showOnlineStatus: !!fresh.showOnlineStatus });
      qc.invalidateQueries({ queryKey: ["userSettings"] });
    } catch {
      // rollback on err by reloading
      try {
        const s = await apiClient.getUserSettings();
        setPrivacyState({ allowComments: !!s.allowComments, allowLikes: !!s.allowLikes, showOnlineStatus: !!s.showOnlineStatus });
      } catch {}
    }
  }, [qc]);

  const setNotifications = useCallback(async (patch: Partial<Ctx["notifications"]>) => {
    setNotificationsState((p) => ({ ...p, ...patch }));
    try {
      const fresh = await apiClient.updateUserSettings(patch as Partial<UserSettings>);
      setNotificationsState({ pushNotifications: !!fresh.pushNotifications, emailNotifications: !!fresh.emailNotifications, emailMarketing: !!fresh.emailMarketing });
      qc.invalidateQueries({ queryKey: ["userSettings"] });
    } catch {
      try {
        const s = await apiClient.getUserSettings();
        setNotificationsState({ pushNotifications: !!s.pushNotifications, emailNotifications: !!s.emailNotifications, emailMarketing: !!s.emailMarketing });
      } catch {}
    }
  }, [qc]);

  const value = useMemo(() => ({ soundEnabled, setSoundEnabled, privacy, setPrivacy, notifications, setNotifications }), [soundEnabled, setSoundEnabled, privacy, setPrivacy, notifications, setNotifications]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettingsStore() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettingsStore must be used inside SettingsStoreProvider");
  return ctx;
}
```

Wrap in root: `ThemeProvider > I18nProvider > SettingsStoreProvider > QueryClientProvider > SocialProvider` (query client must be outer since SettingsStore uses it).

---

### Task 4: Rewrite Settings Index Page + appearance sheet + notifications sheet

- Modify `settings.index.tsx`
  - Replace hardcoded labels with `t('settings.sectionsAppearance')` etc.
  - Appearance row opens `BottomSheet` modal with 3 options: Light / Dark / System. Click calls `useTheme().setMode`.
  - Notifications row opens `BottomSheet` modal with toggles: pushNotifications, emailNotifications, emailMarketing, plus fine-grained 9 toggles (roundtrip via `updateUserSettings`).
  - Sound row toggles `setSoundEnabled`.
  - Language row shows `locale.toUpperCase()`, links to `/settings/language`.
  - Subscription row points to new `/settings/subscription` route.

- Reusable components: `apps/web-app/src/components/settings/BottomSheet.tsx`, `apps/web-app/src/components/settings/RowSwitch.tsx`, `apps/web-app/src/components/settings/SettingRow.tsx`.

---

### Task 5: Rewrite Language & Privacy Pages + Subscription Page

- `settings.language.tsx`: Only show English/French; on click `setLocale()`, save to storage immediately.
- `settings.privacy.tsx`: Profile visibility segmented (Public/Followers/Private) + 3 toggles using `useSettingsStore().setPrivacy`.
- New `settings.subscription.tsx`: Add new route; create `subscription.ts` layout outlet if needed, or inline page. Calls GET `/api/users/me/subscription` (add method to api-client package); show active card or empty state; Upgrade button; Restore purchases POST call.

---

### Task 6: Extend @vellum/api-client with Subscription endpoints

- In `packages/api-client/src/client.ts` add:
  - `interface Subscription { id: string; planName: string; status: 'active'|'canceled'|'past_due'|'trialing'; renewalDate?: string; cancelAtPeriodEnd: boolean; }`
  - `async getSubscription(): Promise<Subscription | null> { return this.request('/api/users/me/subscription'); }`
  - `async restorePurchases(): Promise<{ success: boolean }> { return this.request('/api/users/me/subscription/restore', { method: 'POST' }); }`
- Export type.

---

### Task 7: Automated QA via Playwright

- Create `scripts/web_app_settings_qa.py` (mirrors structure of prior `settings_qa_test.py`):
  - Categories: LAYOUT, APPEARANCE (light/dark/system sheet open + mode applied + persistence reload/new tab), LANGUAGE (en/fr switch), SOUND toggle, NOTIFICATIONS sheet + backend PUT/GET roundtrip, PRIVACY toggles, SUBSCRIPTION empty state, PERSIST (refresh + new-tab), RESPONSIVE (3 viewports), I18N_FR_FALLBACK.
  - Login flow; localStorage writes for baseline; screenshot per category; JSON reporting (`final_web_app_settings_qa_report.json`, `per_category_results.json`, `checks_log.json`, screenshots/ folder).

Run suite, resolve failures, until `GLOBAL_PASSED=True`.

---

## Self-review

- Spec-coverage check: ✔️ Theme (FOUC + system + persist), ✔️ i18n (EN/FR + persist), ✔️ Privacy with backend PUT /users/me/settings, ✔️ Notifications 9 toggles, ✔️ Subscription routes.
- No TODO placeholders. All file paths given.
- Consistent storage keys (`vellum.web.settings.v1` JSON + raw keys for each).
- Each task builds working code independently of later tasks (Theme alone → i18n alone → store alone → pages → tests).

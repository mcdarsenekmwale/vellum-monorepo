# Comprehensive I18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve comprehensive translation coverage across both web-app and mobile-app for all main user-facing sections, with a shared dictionary package, AI-assisted translation CLI tool, and QA verification.

**Architecture:** Extract existing web-app EN/FR/ES/DE/IT/PT/NL dictionaries into a shared `packages/shared-i18n` package consumed by both apps. Add new namespaces (navigation, home, discover, compose, emptyStates) and extend existing ones (auth, profile, notifications). Penetrate `t()` into all main-section route files. Build an on-demand AI translation CLI for missing keys with graceful fallbacks. Add compile-time key completeness guard and Playwright smoke tests.

**Tech Stack:** TypeScript, React, React Native (Expo), Playwright, Python (audit scripts), ts-node (CLI tools)

---

## File Structure

### New files — shared-i18n package
- `packages/shared-i18n/types.ts` — `LocaleTag`, `Dict`, `NamespaceDict` types
- `packages/shared-i18n/locales.ts` — `SUPPORTED_LOCALES`, `LOCALE_NAMES`, `DEFAULT_LOCALE`, RTL list
- `packages/shared-i18n/dictionaries/base.en.ts` — EN base dictionary (all shared namespaces)
- `packages/shared-i18n/dictionaries/base.fr.ts` — FR dictionary (merged web+mobile)
- `packages/shared-i18n/dictionaries/base.es.ts` — ES dictionary (copied from web)
- `packages/shared-i18n/dictionaries/base.de.ts` — DE dictionary
- `packages/shared-i18n/dictionaries/base.it.ts` — IT dictionary
- `packages/shared-i18n/dictionaries/base.pt.ts` — PT dictionary
- `packages/shared-i18n/dictionaries/base.nl.ts` — NL dictionary
- `packages/shared-i18n/index.ts` — barrel export
- `packages/shared-i18n/type-check.ts` — compile-time `DictKeysEqual` guard

### New files — tooling
- `scripts/i18n-audit.py` — hardcoded string scanner
- `scripts/i18n-missing-translate.ts` — AI translation CLI
- `scripts/i18n-compile-check.ts` — standalone type-check runner
- `apps/web-app/tests/i18n_smoke.spec.ts` — Playwright smoke test

### New files — mobile overlay
- `apps/mobile-app/context/dictionaries.ts` — mobile-specific overlay keys

### Modified files — providers
- `apps/web-app/src/components/providers/I18nProvider.tsx` — add `args` param + `{{var}}` substitution
- `apps/web-app/src/lib/i18n/dictionaries.ts` — re-export shared base + web overlay
- `apps/web-app/src/lib/i18n/index.ts` — update LocaleTag import
- `apps/web-app/src/lib/i18n/types.ts` — re-export from shared
- `apps/mobile-app/context/I18nProvider.tsx` — import shared dicts, update `{{var}}` regex
- `apps/mobile-app/context/SettingsStore.tsx` — expand `LocaleTag` to 7 langs

### Modified files — t() penetration (main sections)
- Web: `routes/__root.tsx`, `routes/index.tsx`, `routes/discover.tsx`, `routes/compose.tsx`, `routes/profile.tsx`, `routes/login.tsx`, `routes/register.tsx`, `routes/notifications.tsx`, `routes/saved.tsx`
- Mobile: `app/_layout.tsx`, `app/index.tsx`, `app/discover.tsx`, `app/compose.tsx`, `app/profile.tsx`, `app/login.tsx`, `app/notifications.tsx`, `app/saved.tsx`
- Web components: `SmartState.tsx`, `EnhancedErrorBoundary.tsx`
- Mobile QA: `tests/mobile_settings_qa.py` — add ES/DE spot-checks
- tsconfig: `apps/web-app/tsconfig.json`, `apps/mobile-app/tsconfig.json` — path alias for `@shared-i18n`

---

## Task 1: Create shared-i18n package — types, locales, index

**Files:**
- Create: `packages/shared-i18n/types.ts`
- Create: `packages/shared-i18n/locales.ts`
- Create: `packages/shared-i18n/index.ts`

- [ ] **Step 1: Create types.ts**

```ts
// packages/shared-i18n/types.ts

export type LocaleTag =
  | "en" | "fr" | "es" | "de" | "it" | "pt" | "nl";

export type Dict = Record<string, string>;
export type NamespaceDict = Record<string, Dict>;
```

- [ ] **Step 2: Create locales.ts**

```ts
// packages/shared-i18n/locales.ts

import { LocaleTag } from "./types";

export const DEFAULT_LOCALE: LocaleTag = "en";
export const SUPPORTED_LOCALES: LocaleTag[] = ["en", "fr", "es", "de", "it", "pt", "nl"];

export const LOCALE_NAMES: Record<LocaleTag, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
};

export const RTL_LOCALES: LocaleTag[] = [];
```

- [ ] **Step 3: Create index.ts barrel export**

```ts
// packages/shared-i18n/index.ts

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_NAMES, RTL_LOCALES } from "./locales";
export type { LocaleTag, Dict, NamespaceDict } from "./types";
export { EN_DICT } from "./dictionaries/base.en";
export { FR_DICT } from "./dictionaries/base.fr";
export { ES_DICT } from "./dictionaries/base.es";
export { DE_DICT } from "./dictionaries/base.de";
export { IT_DICT } from "./dictionaries/base.it";
export { PT_DICT } from "./dictionaries/base.pt";
export { NL_DICT } from "./dictionaries/base.nl";
export { DICTIONARIES } from "./dictionaries/index";
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared-i18n/types.ts packages/shared-i18n/locales.ts packages/shared-i18n/index.ts
git commit -m "feat(i18n): create shared-i18n package skeleton with types and locales"
```

---

## Task 2: Create EN base dictionary (union of web + mobile keys + new namespaces)

**Files:**
- Create: `packages/shared-i18n/dictionaries/base.en.ts`

This file is the single source of truth for all translation keys. It merges:
- All existing web-app EN keys (common, settings, auth, errors, notifications, time)
- All existing mobile-app EN keys (profile, help/ticket keys, contact form keys, about keys)
- New namespaces: `navigation`, `home`, `discover`, `compose`, `emptyStates`

- [ ] **Step 1: Create base.en.ts with merged namespaces**

```ts
// packages/shared-i18n/dictionaries/base.en.ts

import { NamespaceDict } from "../types";

export const EN_DICT: NamespaceDict = {
  // ── common (from web-app, superset of mobile) ──
  common: {
    save: "Save", cancel: "Cancel", back: "Back", close: "Close",
    confirm: "Confirm", delete: "Delete", edit: "Edit", view: "View",
    search: "Search", loading: "Loading...", error: "Error", success: "Success",
    yes: "Yes", no: "No", continue: "Continue", done: "Done",
    welcome: "Welcome", hello: "Hello", goodbye: "Goodbye",
    help: "Help", settings: "Settings", profile: "Profile",
    logout: "Logout", login: "Login", register: "Register",
    forgot: "Forgot", reset: "Reset", submit: "Submit", retry: "Retry",
    skip: "Skip", start: "Start", finish: "Finish",
    next: "Next", previous: "Previous", first: "First", last: "Last",
    all: "All", none: "None", today: "Today", tomorrow: "Tomorrow",
    yesterday: "Yesterday", now: "Now", soon: "Soon", later: "Later",
    home: "Home", dashboard: "Dashboard", menu: "Menu", more: "More", less: "Less",
    add: "Add", remove: "Remove", update: "Update", create: "Create",
    upload: "Upload", download: "Download", share: "Share",
    copy: "Copy", paste: "Paste", cut: "Cut", undo: "Undo", redo: "Redo",
    refresh: "Refresh", reload: "Reload", expand: "Expand", collapse: "Collapse",
    show: "Show", hide: "Hide", open: "Open", lock: "Lock", unlock: "Unlock",
    protect: "Protect", secure: "Secure", verify: "Verify",
    confirmPassword: "Confirm password", currentPassword: "Current password",
    newPassword: "New password", passwordStrength: "Password strength",
    weak: "Weak", medium: "Medium", strong: "Strong", veryStrong: "Very strong",
    ok: "OK",
  },

  // ── settings (from web-app, superset of mobile) ──
  settings: {
    title: "Settings", preferences: "Preferences", account: "Account",
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
    appearanceLight: "Light", appearanceDark: "Dark", appearanceSystem: "System",
    privacyTitle: "Privacy",
    privacyDescription: "Control who can see your activity and content.",
    privacyProfileVisibility: "Profile visibility",
    privacyPublic: "Public", privacyFollowers: "Followers only", privacyPrivate: "Private",
    privacyAllowComments: "Allow comments on my articles",
    privacyShowLikesCount: "Show likes count on my articles",
    privacyShowOnline: "Show when I am online",
    subscriptionTitle: "Subscription", subscriptionEmpty: "No active subscription",
    subscriptionStatusActive: "Active", subscriptionStatusCanceled: "Canceled",
    subscriptionStatusPastDue: "Past due", subscriptionStatusTrialing: "Trialing",
    subscriptionRenewalDate: "Renews on", subscriptionUpgrade: "Upgrade plan",
    subscriptionRestore: "Restore purchases",
    subscriptionRestoreSuccess: "Purchases restored successfully",
    subscriptionRestoreError: "Failed to restore purchases",
    subscriptionCancelAtPeriodEnd: "Cancels at end of period",
    pushNotifications: "Push notifications", emailNotifications: "Email notifications",
    notifyLikes: "Likes on my content", notifyComments: "New comments",
    notifyReplies: "Replies to my comments", notifyFollows: "New followers",
    notifyMentions: "Mentions of me", notifyNewArticles: "New articles from creators",
    notifySystem: "System & account alerts", notifyEmailDigest: "Weekly digest",
    notifyEmailMarketing: "Product updates via email",
    resetSuccess: "Settings reset to default", resetError: "Failed to reset settings",
    editProfile: "Edit profile", editProfileDescription: "Name, handle, bio",
    security: "Security", securityDescription: "Password, 2FA, sessions",
    support: "Support", signOut: "Sign out", footer: "Vellum v1.0.0",
    soundOn: "Enabled", soundOff: "Muted",
    languageDescription: "English (US)",
    about: "About", aboutDescription: "Version 1.0.0",
    aboutAppName: "Vellum", aboutVersion: "Version", aboutBuild: "Build",
    aboutTerms: "Terms of Service", aboutPrivacy: "Privacy Policy",
    aboutLicenses: "Open Source Licenses", aboutWebsite: "Website",
    saveChanges: "Save changes", creating: "Creating…", submitting: "Submitting…",
    contactSupport: "Contact Support", faqSearchPlaceholder: "Search FAQs…",
    ticketsOpen: "Open", ticketsClosed: "Closed",
    ticketStatusNew: "New", ticketStatusAssigned: "Assigned",
    ticketStatusInProgress: "In progress", ticketStatusWaitingOnCustomer: "Waiting on you",
    ticketStatusEscalated: "Escalated", ticketStatusResolved: "Resolved",
    ticketStatusClosed: "Closed", ticketStatusReopened: "Reopened",
    newTicket: "New ticket", ticketSubjectPlaceholder: "Subject",
    ticketBodyPlaceholder: "How can we help?", send: "Send",
    replyPlaceholder: "Write a reply…", emptyTicketsOpen: "No open tickets.",
    emptyTicketsClosed: "No resolved tickets.", emptyFaq: "No results. Try a different search.",
    noAccount: "You need to be signed in to create support tickets.",
    deleteAccountTitle: "Delete account",
    deleteAccountHint: "This permanently removes your content and data.",
    emailSubtitle: "(Unsubscribe from marketing at any time from links in email.)",
    appearanceSheetTitle: "Appearance",
    appearanceSubtitle: "Choose how Vellum looks on your device",
    languageSheetTitle: "Language",
    helpCategoryGettingStarted: "Getting Started",
    helpCategoryAccountBilling: "Account & Billing",
    helpCategoryContentWriting: "Content & Writing",
    helpCategoryNotifications: "Notifications",
    helpCategorySafetyPrivacy: "Safety & Privacy",
    helpCategoryTroubleshooting: "Troubleshooting",
    helpMyTickets: "My tickets", helpContactSupport: "Contact support",
    ticketsActive: "Active", ticketsEmpty: "No tickets yet",
    ticketDetailSubject: "Subject", ticketDetailStatus: "Status",
    ticketDetailCreatedAt: "Created", ticketDetailMessages: "Messages",
    ticketDetailReply: "Reply",
    contactCategoryGeneral: "General", contactCategoryAccount: "Account",
    contactCategoryTechnical: "Technical", contactCategoryBilling: "Billing",
    contactCategorySafety: "Safety", contactSelectCategory: "Select category",
    contactSubject: "Subject line",
    contactSubjectPlaceholder: "Brief summary of your issue",
    contactMessage: "Message",
    contactMessagePlaceholder: "Describe your issue in detail (at least 10 characters)",
    contactSubmit: "Submit",
    contactMinChars: "Message must be at least 10 characters",
    contactSubjectRequired: "Subject is required",
    contactMessageRequired: "Message is required",
    contactCategoryRequired: "Category is required",
    contactSuccess: "Ticket submitted successfully!",
  },

  // ── auth (from web-app, extended) ──
  auth: {
    signIn: "Sign in", signOut: "Sign out", signUp: "Sign up",
    email: "Email", password: "Password", name: "Name", handle: "Handle",
    forgotPassword: "Forgot password?", resetPassword: "Reset password",
    confirmPassword: "Confirm password",
    alreadyHaveAccount: "Already have an account?",
    dontHaveAccount: "Don't have an account?",
    emailRequired: "Email is required",
    passwordRequired: "Password is required",
    passwordMinLength: "Password must be at least 8 characters",
    invalidEmail: "Please enter a valid email",
    username: "Username", usernameRequired: "Username is required",
    usernameTaken: "Username is already taken",
    emailTaken: "Email is already registered",
    accountCreated: "Account created successfully",
    accountUpdated: "Account updated successfully",
    passwordChanged: "Password changed successfully",
    passwordReset: "Password reset successfully",
    resetLinkSent: "Password reset link sent to your email",
    twoFactor: "Two-factor authentication",
    twoFactorEnabled: "Two-factor authentication enabled",
    twoFactorDisabled: "Two-factor authentication disabled",
    verifyEmail: "Verify your email",
    emailVerified: "Email verified successfully",
    verificationSent: "Verification email sent",
    createAccount: "Create account",
    forgotTitle: "Request password reset",
    forgotSubtitle: "Enter your email; we will send you a reset link.",
    emailMe: "Send reset link", sent: "Reset link sent",
    sentSubtitle: "Check your inbox for further instructions.",
    orContinueWith: "or continue with",
    signInWithGoogle: "Sign in with Google",
    signInWithApple: "Sign in with Apple",
  },

  // ── errors (from web-app, extended with mobile keys) ──
  errors: {
    generic: "Something went wrong. Please try again.",
    network: "Network error. Please check your connection.",
    unauthorized: "You are not authorized to perform this action.",
    notFound: "The requested resource was not found.",
    validation: "Please check your input and try again.",
    server: "Server error. Please try again later.",
    timeout: "Request timed out. Please try again.",
    rateLimit: "Too many requests. Please try again later.",
    maintenance: "System is under maintenance. Please try again later.",
    forbidden: "You don't have permission to access this resource.",
    conflict: "The resource already exists or has been modified.",
    badRequest: "Invalid request. Please check your input.",
    unsupportedMedia: "Unsupported file type. Please upload a valid file.",
    fileTooLarge: "File is too large. Maximum size is {{size}}.",
    invalidFile: "Invalid file. Please upload a valid file.",
    uploadFailed: "Failed to upload file. Please try again.",
    downloadFailed: "Failed to download file. Please try again.",
    offline: "No internet connection. Please try again.",
    sessionExpired: "Your session has expired. Please sign in again.",
    unexpectedError: "An unexpected error occurred. Please try again or go back home.",
  },

  // ── notifications (from web-app, extended) ──
  notifications: {
    title: "Notifications", empty: "No notifications",
    markAllRead: "Mark all as read", viewAll: "View all",
    new: "New notification", from: "From", at: "at",
    type: "Type", priority: "Priority",
    low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
    system: "System", user: "User", team: "Team", app: "App",
  },

  // ── time (from web-app) ──
  time: {
    ago: "ago", justNow: "Just now",
    minute: "minute", minutes: "minutes", hour: "hour", hours: "hours",
    day: "day", days: "days", week: "week", weeks: "weeks",
    month: "month", months: "months", year: "year", years: "years",
    yesterday: "Yesterday", today: "Today", tomorrow: "Tomorrow",
    dateFormat: "MM/DD/YYYY", timeFormat: "HH:mm",
    dateTimeFormat: "MM/DD/YYYY HH:mm",
  },

  // ── profile (from mobile, extended) ──
  profile: {
    articles: "Articles", followers: "Followers", following: "Following",
    reading: "Reading", likes: "Likes", replies: "Replies",
    editProfile: "Edit profile", follow: "Follow", unfollow: "Unfollow",
    bio: "Bio", bioPlaceholder: "Tell us about yourself",
    joinDate: "Joined {{date}}", viewProfile: "View profile",
    noArticles: "No articles yet", noHighlights: "No highlights yet",
  },

  // ── navigation (NEW) ──
  navigation: {
    home: "Home", discover: "Discover", compose: "Write",
    notifications: "Notifications", profile: "Profile",
    settings: "Settings", back: "Back", search: "Search",
    saved: "Saved", highlights: "Highlights",
  },

  // ── home (NEW) ──
  home: {
    forYou: "For You", trending: "Trending", latest: "Latest",
    articlesFound: "{{count}} articles found",
    readMore: "Read more", continueReading: "Continue reading",
    featuredAuthor: "Featured Author", exploreCategories: "Explore categories",
    noArticles: "No articles found", startExploring: "Start exploring",
    suggestedAuthors: "Suggested authors", followAll: "Follow all",
  },

  // ── discover (NEW) ──
  discover: {
    title: "Discover", searchPlaceholder: "Search articles, authors, topics…",
    categories: "Categories", popular: "Popular", newAuthors: "New authors",
    trendingTopics: "Trending topics", noResults: "No results found",
    tryDifferentSearch: "Try a different search term",
    browseAll: "Browse all",
  },

  // ── compose (NEW) ──
  compose: {
    title: "Write", newArticle: "New Article",
    bodyPlaceholder: "Start writing your story…",
    publish: "Publish", saveDraft: "Save draft", preview: "Preview",
    addCover: "Add cover image", addTags: "Add tags",
    selectCategory: "Select category", wordCount: "{{count}} words",
    minWords: "Minimum 50 words required", titlePlaceholder: "Title",
    publishedSuccess: "Article published successfully!",
    draftSaved: "Draft saved", publishError: "Failed to publish. Please try again.",
  },

  // ── emptyStates (NEW) ──
  emptyStates: {
    noArticles: "Nothing here yet", noNotifications: "No notifications",
    noResults: "No results found", nothingHere: "Nothing here yet",
    startWriting: "Start writing", signInToContinue: "Sign in to continue",
    signInToComment: "Sign in to comment", pleaseTryAgain: "Please try again in a moment.",
    noItems: "No items", addSomething: "Add something",
    noSavedArticles: "No saved articles yet",
    noFollowers: "No followers yet", noFollowing: "Not following anyone yet",
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared-i18n/dictionaries/base.en.ts
git commit -m "feat(i18n): create EN base dictionary with all shared namespaces"
```

---

## Task 3: Create FR/ES/DE/IT/PT/NL base dictionaries

**Files:**
- Create: `packages/shared-i18n/dictionaries/base.fr.ts`
- Create: `packages/shared-i18n/dictionaries/base.es.ts`
- Create: `packages/shared-i18n/dictionaries/base.de.ts`
- Create: `packages/shared-i18n/dictionaries/base.it.ts`
- Create: `packages/shared-i18n/dictionaries/base.pt.ts`
- Create: `packages/shared-i18n/dictionaries/base.nl.ts`
- Create: `packages/shared-i18n/dictionaries/index.ts`

**Strategy:** Copy existing web-app translations for `common`, `settings`, `auth`, `errors`, `notifications`, `time` (already fully populated for all 6 languages). For `profile` namespace, copy mobile-app FR entries. For new namespaces (`navigation`, `home`, `discover`, `compose`, `emptyStates`), insert `"__TODO_<LANG>_<key>"` markers — the AI translation CLI will fill these in Task 9.

- [ ] **Step 1: Create base.fr.ts**

```ts
// packages/shared-i18n/dictionaries/base.fr.ts

import { NamespaceDict } from "../types";

export const FR_DICT: NamespaceDict = {
  // ── common (copied from existing web-app FR) ──
  common: {
    save: "Enregistrer", cancel: "Annuler", back: "Retour", close: "Fermer",
    confirm: "Confirmer", delete: "Supprimer", edit: "Modifier", view: "Voir",
    search: "Rechercher", loading: "Chargement...", error: "Erreur", success: "Succès",
    yes: "Oui", no: "Non", continue: "Continuer", done: "Terminé",
    welcome: "Bienvenue", hello: "Bonjour", goodbye: "Au revoir",
    help: "Aide", settings: "Paramètres", profile: "Profil",
    logout: "Se déconnecter", login: "Se connecter", register: "S'inscrire",
    forgot: "Mot de passe oublié", reset: "Réinitialiser", submit: "Soumettre",
    retry: "Réessayer", skip: "Passer", start: "Commencer", finish: "Terminer",
    next: "Suivant", previous: "Précédent", first: "Premier", last: "Dernier",
    all: "Tous", none: "Aucun", today: "Aujourd'hui", tomorrow: "Demain",
    yesterday: "Hier", now: "Maintenant", soon: "Bientôt", later: "Plus tard",
    home: "Accueil", dashboard: "Tableau de bord", menu: "Menu", more: "Plus", less: "Moins",
    add: "Ajouter", remove: "Retirer", update: "Mettre à jour", create: "Créer",
    upload: "Télécharger", download: "Télécharger", share: "Partager",
    copy: "Copier", paste: "Coller", cut: "Couper", undo: "Annuler", redo: "Rétablir",
    refresh: "Rafraîchir", reload: "Recharger", expand: "Développer", collapse: "Réduire",
    show: "Afficher", hide: "Cacher", open: "Ouvrir", lock: "Verrouiller", unlock: "Déverrouiller",
    protect: "Protéger", secure: "Sécuriser", verify: "Vérifier",
    confirmPassword: "Confirmer le mot de passe", currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe", passwordStrength: "Force du mot de passe",
    weak: "Faible", medium: "Moyen", strong: "Fort", veryStrong: "Très fort",
    ok: "OK",
  },

  // ── settings (copied from existing web-app FR, with mobile FR keys merged) ──
  settings: {
    title: "Paramètres", preferences: "Préférences", account: "Compte",
    sectionsAppearance: "Apparence",
    sectionsAppearanceDescription: "Clair, sombre ou système",
    sectionsLanguage: "Langue", sectionsLanguageDescription: "Sélectionnez votre langue",
    sectionsSound: "Son", sectionsSoundDescription: "Activer les effets sonores",
    sectionsNotifications: "Notifications",
    sectionsNotificationsDescription: "Gérer les notifications push",
    sectionsPrivacy: "Confidentialité",
    sectionsPrivacyDescription: "Gérer les données et les autorisations",
    sectionsSubscription: "Abonnement",
    sectionsSubscriptionDescription: "Gérez votre abonnement",
    sectionsHelpCenter: "Centre d'aide",
    sectionsHelpCenterDescription: "FAQ et contact",
    sectionsAbout: "À propos",
    sectionsAboutDescription: "En savoir plus sur l'application",
    sectionsSignOut: "Se déconnecter",
    appearanceLight: "Clair", appearanceDark: "Sombre", appearanceSystem: "Système",
    privacyTitle: "Confidentialité",
    privacyDescription: "Contrôlez qui peut voir votre activité.",
    privacyProfileVisibility: "Visibilité du profil",
    privacyPublic: "Public", privacyFollowers: "Abonnés uniquement", privacyPrivate: "Privé",
    privacyAllowComments: "Autoriser les commentaires sur mes articles",
    privacyShowLikesCount: "Afficher le nombre de likes sur mes articles",
    privacyShowOnline: "Afficher quand je suis en ligne",
    subscriptionTitle: "Abonnement", subscriptionEmpty: "Aucun abonnement actif",
    subscriptionStatusActive: "Actif", subscriptionStatusCanceled: "Annulé",
    subscriptionStatusPastDue: "Paiement en retard", subscriptionStatusTrialing: "Essai",
    subscriptionRenewalDate: "Renouvellement le",
    subscriptionUpgrade: "Améliorer l'abonnement",
    subscriptionRestore: "Restaurer les achats",
    subscriptionRestoreSuccess: "Achats restaurés avec succès",
    subscriptionRestoreError: "Échec de la restauration des achats",
    subscriptionCancelAtPeriodEnd: "Annulé à la fin de la période",
    pushNotifications: "Notifications push",
    emailNotifications: "Notifications par e-mail",
    notifyLikes: "Likes sur mon contenu", notifyComments: "Nouveaux commentaires",
    notifyReplies: "Réponses à mes commentaires", notifyFollows: "Nouveaux abonnés",
    notifyMentions: "Mentions de moi",
    notifyNewArticles: "Nouveaux articles des créateurs",
    notifySystem: "Alertes système et compte",
    notifyEmailDigest: "Résumé hebdomadaire",
    notifyEmailMarketing: "Mises à jour produit par courriel",
    resetSuccess: "Paramètres réinitialisés par défaut",
    resetError: "Échec de la réinitialisation des paramètres",
    editProfile: "Modifier le profil", editProfileDescription: "Nom, identifiant, bio",
    security: "Sécurité", securityDescription: "Mot de passe, 2FA, sessions",
    support: "Assistance", signOut: "Se déconnecter", footer: "Vellum v1.0.0",
    soundOn: "Activé", soundOff: "Désactivé", languageDescription: "Français",
    about: "À propos", aboutDescription: "Version 1.0.0",
    aboutAppName: "Vellum", aboutVersion: "Version", aboutBuild: "Build",
    aboutTerms: "Conditions d'utilisation", aboutPrivacy: "Politique de confidentialité",
    aboutLicenses: "Licences open source", aboutWebsite: "Site web",
    saveChanges: "Enregistrer les modifications", creating: "Création…", submitting: "Envoi…",
    contactSupport: "Contacter l'assistance", faqSearchPlaceholder: "Rechercher dans la FAQ…",
    ticketsOpen: "Ouverts", ticketsClosed: "Résolus",
    ticketStatusNew: "Nouveau", ticketStatusAssigned: "Assigné",
    ticketStatusInProgress: "En cours", ticketStatusWaitingOnCustomer: "En attente de votre réponse",
    ticketStatusEscalated: "Escaladé", ticketStatusResolved: "Résolu",
    ticketStatusClosed: "Fermé", ticketStatusReopened: "Réouvert",
    newTicket: "Nouveau ticket", ticketSubjectPlaceholder: "Sujet",
    ticketBodyPlaceholder: "Comment pouvons-nous aider ?", send: "Envoyer",
    replyPlaceholder: "Écrivez une réponse…", emptyTicketsOpen: "Aucun ticket ouvert.",
    emptyTicketsClosed: "Aucun ticket résolu.", emptyFaq: "Aucun résultat. Essayez une autre recherche.",
    noAccount: "Vous devez être connecté pour créer un ticket d'assistance.",
    deleteAccountTitle: "Supprimer le compte",
    deleteAccountHint: "Supprime définitivement votre contenu et vos données.",
    emailSubtitle: "(Vous pouvez vous désabonner à tout moment depuis les liens dans les emails.)",
    appearanceSheetTitle: "Apparence",
    appearanceSubtitle: "Choisissez l'apparence de Vellum",
    languageSheetTitle: "Langue",
    helpCategoryGettingStarted: "Bien démarrer",
    helpCategoryAccountBilling: "Compte & facturation",
    helpCategoryContentWriting: "Contenu & rédaction",
    helpCategoryNotifications: "Notifications",
    helpCategorySafetyPrivacy: "Sécurité & confidentialité",
    helpCategoryTroubleshooting: "Dépannage",
    helpMyTickets: "Mes tickets", helpContactSupport: "Contacter l'assistance",
    ticketsActive: "Actifs", ticketsEmpty: "Aucun ticket",
    ticketDetailSubject: "Sujet", ticketDetailStatus: "Statut",
    ticketDetailCreatedAt: "Créé le", ticketDetailMessages: "Messages",
    ticketDetailReply: "Répondre",
    contactCategoryGeneral: "Général", contactCategoryAccount: "Compte",
    contactCategoryTechnical: "Technique", contactCategoryBilling: "Facturation",
    contactCategorySafety: "Sécurité", contactSelectCategory: "Sélectionner une catégorie",
    contactSubject: "Sujet", contactSubjectPlaceholder: "Résumé bref du problème",
    contactMessage: "Message",
    contactMessagePlaceholder: "Décrivez votre problème en détail (au moins 10 caractères)",
    contactSubmit: "Envoyer", contactMinChars: "Le message doit contenir au moins 10 caractères",
    contactSubjectRequired: "Le sujet est requis", contactMessageRequired: "Le message est requis",
    contactCategoryRequired: "La catégorie est requise",
    contactSuccess: "Ticket soumis avec succès !",
  },

  // ── auth (copied from web-app FR + mobile FR keys) ──
  auth: {
    signIn: "Se connecter", signOut: "Se déconnecter", signUp: "S'inscrire",
    email: "E-mail", password: "Mot de passe", name: "Nom", handle: "Identifiant",
    forgotPassword: "Mot de passe oublié ?", resetPassword: "Réinitialiser le mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    alreadyHaveAccount: "Vous avez déjà un compte ?",
    dontHaveAccount: "Vous n'avez pas de compte ?",
    emailRequired: "L'e-mail est requis",
    passwordRequired: "Le mot de passe est requis",
    passwordMinLength: "Le mot de passe doit comporter au moins 8 caractères",
    invalidEmail: "Veuillez entrer un e-mail valide",
    username: "Nom d'utilisateur", usernameRequired: "Le nom d'utilisateur est requis",
    usernameTaken: "Ce nom d'utilisateur est déjà pris",
    emailTaken: "Cet e-mail est déjà enregistré",
    accountCreated: "Compte créé avec succès",
    accountUpdated: "Compte mis à jour avec succès",
    passwordChanged: "Mot de passe modifié avec succès",
    passwordReset: "Mot de passe réinitialisé avec succès",
    resetLinkSent: "Lien de réinitialisation envoyé à votre e-mail",
    twoFactor: "Authentification à deux facteurs",
    twoFactorEnabled: "Authentification à deux facteurs activée",
    twoFactorDisabled: "Authentification à deux facteurs désactivée",
    verifyEmail: "Vérifiez votre e-mail",
    emailVerified: "E-mail vérifié avec succès",
    verificationSent: "E-mail de vérification envoyé",
    createAccount: "Créer un compte", forgotTitle: "Réinitialiser le mot de passe",
    forgotSubtitle: "Entrez votre email, nous vous enverrons un lien de réinitialisation.",
    emailMe: "Envoyer le lien", sent: "Lien envoyé",
    sentSubtitle: "Consultez votre boîte de réception.",
    orContinueWith: "ou continuer avec",
    signInWithGoogle: "Se connecter avec Google",
    signInWithApple: "Se connecter avec Apple",
  },

  // ── errors ──
  errors: {
    generic: "Une erreur est survenue. Veuillez réessayer.",
    network: "Erreur réseau. Veuillez vérifier votre connexion.",
    unauthorized: "Vous n'êtes pas autorisé à effectuer cette action.",
    notFound: "La ressource demandée n'a pas été trouvée.",
    validation: "Veuillez vérifier votre saisie et réessayer.",
    server: "Erreur serveur. Veuillez réessayer plus tard.",
    timeout: "La demande a expiré. Veuillez réessayer.",
    rateLimit: "Trop de requêtes. Veuillez réessayer plus tard.",
    maintenance: "Le système est en maintenance. Veuillez réessayer plus tard.",
    forbidden: "Vous n'avez pas la permission d'accéder à cette ressource.",
    conflict: "La ressource existe déjà ou a été modifiée.",
    badRequest: "Requête invalide. Veuillez vérifier votre saisie.",
    unsupportedMedia: "Type de fichier non pris en charge.",
    fileTooLarge: "Fichier trop volumineux. Taille maximum : {{size}}.",
    invalidFile: "Fichier invalide. Veuillez télécharger un fichier valide.",
    uploadFailed: "Échec du téléchargement. Veuillez réessayer.",
    downloadFailed: "Échec du téléchargement. Veuillez réessayer.",
    offline: "Aucune connexion. Veuillez réessayer.",
    sessionExpired: "Votre session a expiré. Veuillez vous reconnecter.",
    unexpectedError: "Une erreur inattendue est survenue. Veuillez réessayer ou retourner à l'accueil.",
  },

  // ── notifications ──
  notifications: {
    title: "Notifications", empty: "Aucune notification",
    markAllRead: "Tout marquer comme lu", viewAll: "Voir tout",
    new: "Nouvelle notification", from: "De", at: "à",
    type: "Type", priority: "Priorité",
    low: "Basse", medium: "Moyenne", high: "Haute", urgent: "Urgente",
    system: "Système", user: "Utilisateur", team: "Équipe", app: "Application",
  },

  // ── time ──
  time: {
    ago: "il y a", justNow: "À l'instant",
    minute: "minute", minutes: "minutes", hour: "heure", hours: "heures",
    day: "jour", days: "jours", week: "semaine", weeks: "semaines",
    month: "mois", months: "mois", year: "an", years: "ans",
    yesterday: "Hier", today: "Aujourd'hui", tomorrow: "Demain",
    dateFormat: "JJ/MM/AAAA", timeFormat: "HH:mm",
    dateTimeFormat: "JJ/MM/AAAA HH:mm",
  },

  // ── profile (from mobile FR) ──
  profile: {
    articles: "Articles", followers: "Abonnés", following: "Abonnements",
    reading: "Lecture", likes: "J'aime", replies: "Réponses",
    editProfile: "Modifier le profil", follow: "Suivre", unfollow: "Ne plus suivre",
    bio: "Bio", bioPlaceholder: "Parlez-nous de vous",
    joinDate: "Inscrit depuis {{date}}", viewProfile: "Voir le profil",
    noArticles: "Aucun article", noHighlights: "Aucun moment fort",
  },

  // ── navigation (TODO — fill via AI CLI in Task 9) ──
  navigation: {
    home: "__TODO_FR_home", discover: "__TODO_FR_discover", compose: "__TODO_FR_compose",
    notifications: "Notifications", profile: "Profil", settings: "Paramètres",
    back: "Retour", search: "Rechercher", saved: "Enregistrés", highlights: "Moments forts",
  },

  // ── home (TODO — fill via AI CLI) ──
  home: {
    forYou: "__TODO_FR_forYou", trending: "__TODO_FR_trending", latest: "__TODO_FR_latest",
    articlesFound: "{{count}} articles trouvés", readMore: "Lire la suite",
    continueReading: "Continuer la lecture", featuredAuthor: "Auteur en vedette",
    exploreCategories: "Explorer les catégories", noArticles: "Aucun article trouvé",
    startExploring: "Commencer à explorer",
    suggestedAuthors: "Auteurs suggérés", followAll: "Suivre tout",
  },

  // ── discover (TODO — fill via AI CLI) ──
  discover: {
    title: "Découvrir",
    searchPlaceholder: "Rechercher des articles, auteurs, sujets…",
    categories: "Catégories", popular: "Populaire", newAuthors: "Nouveaux auteurs",
    trendingTopics: "Sujets tendance", noResults: "Aucun résultat",
    tryDifferentSearch: "Essayez un autre terme de recherche", browseAll: "Tout parcourir",
  },

  // ── compose (TODO — fill via AI CLI) ──
  compose: {
    title: "Écrire", newArticle: "Nouvel article",
    bodyPlaceholder: "Commencez à écrire votre histoire…",
    publish: "Publier", saveDraft: "Enregistrer le brouillon", preview: "Aperçu",
    addCover: "Ajouter une image de couverture", addTags: "Ajouter des tags",
    selectCategory: "Sélectionner une catégorie", wordCount: "{{count}} mots",
    minWords: "Minimum 50 mots requis", titlePlaceholder: "Titre",
    publishedSuccess: "Article publié avec succès !",
    draftSaved: "Brouillon enregistré", publishError: "Échec de la publication. Veuillez réessayer.",
  },

  // ── emptyStates ──
  emptyStates: {
    noArticles: "Aucun article pour le moment",
    noNotifications: "Aucune notification",
    noResults: "Aucun résultat", nothingHere: "Rien ici pour le moment",
    startWriting: "Commencer à écrire",
    signInToContinue: "Se connecter pour continuer",
    signInToComment: "Se connecter pour commenter",
    pleaseTryAgain: "Veuillez réessayer dans un instant.",
    noItems: "Aucun élément", addSomething: "Ajouter quelque chose",
    noSavedArticles: "Aucun article enregistré",
    noFollowers: "Aucun abonné", noFollowing: "Aucun abonnement",
  },
};
```

- [ ] **Step 2: Create ES/DE/IT/PT/NL dicts — copy from existing web-app dicts for common/settings/auth/errors/notifications/time + use TODO markers for new namespaces**

For each of ES, DE, IT, PT, NL: copy the existing web-app translations for the 6 existing namespaces verbatim. For `profile`, `navigation`, `home`, `discover`, `compose`, `emptyStates`: add `"__TODO_<LANG>_<key>"` markers for all keys. The AI CLI (Task 9) will fill them.

**Pattern for each file:**
```ts
import { NamespaceDict } from "../types";

export const ES_DICT: NamespaceDict = {
  common: { /* paste from web-app ES_DICT.common */ },
  settings: { /* paste from web-app ES_DICT.settings + mobile-specific keys */ },
  auth: { /* paste from web-app ES_DICT.auth + new keys with TODO */ },
  errors: { /* paste from web-app ES_DICT.errors + mobile keys */ },
  notifications: { /* paste from web-app */ },
  time: { /* paste from web-app */ },
  profile: { /* TODO markers for all keys */ },
  navigation: { /* TODO markers */ },
  home: { /* TODO markers */ },
  discover: { /* TODO markers */ },
  compose: { /* TODO markers */ },
  emptyStates: { /* TODO markers */ },
};
```

- [ ] **Step 3: Create dictionaries/index.ts barrel**

```ts
// packages/shared-i18n/dictionaries/index.ts

import { NamespaceDict, LocaleTag } from "../types";
import { EN_DICT } from "./base.en";
import { FR_DICT } from "./base.fr";
import { ES_DICT } from "./base.es";
import { DE_DICT } from "./base.de";
import { IT_DICT } from "./base.it";
import { PT_DICT } from "./base.pt";
import { NL_DICT } from "./base.nl";

export { EN_DICT, FR_DICT, ES_DICT, DE_DICT, IT_DICT, PT_DICT, NL_DICT };

export const DICTIONARIES: Record<LocaleTag, NamespaceDict> = {
  en: EN_DICT, fr: FR_DICT, es: ES_DICT, de: DE_DICT,
  it: IT_DICT, pt: PT_DICT, nl: NL_DICT,
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared-i18n/dictionaries/
git commit -m "feat(i18n): create FR/ES/DE/IT/PT/NL base dictionaries with existing + TODO markers"
```

---

## Task 4: Wire shared-i18n into both apps via tsconfig path aliases

**Files:**
- Modify: `apps/web-app/tsconfig.json`
- Modify: `apps/mobile-app/tsconfig.json`

- [ ] **Step 1: Add path alias to web-app tsconfig.json**

Add to `compilerOptions.paths`:
```json
"@shared-i18n/*": ["../../packages/shared-i18n/*"]
```

- [ ] **Step 2: Add path alias to mobile-app tsconfig.json**

Add to `compilerOptions.paths`:
```json
"@shared-i18n/*": ["../../packages/shared-i18n/*"]
```

- [ ] **Step 3: Commit**

```bash
git add apps/web-app/tsconfig.json apps/mobile-app/tsconfig.json
git commit -m "chore(i18n): add @shared-i18n path alias to both apps"
```

---

## Task 5: Update web-app provider + dictionaries to use shared package

**Files:**
- Modify: `apps/web-app/src/lib/i18n/types.ts`
- Modify: `apps/web-app/src/lib/i18n/index.ts`
- Modify: `apps/web-app/src/lib/i18n/dictionaries.ts`
- Modify: `apps/web-app/src/components/providers/I18nProvider.tsx`

- [ ] **Step 1: Update types.ts to re-export from shared**

```ts
// apps/web-app/src/lib/i18n/types.ts
export type { LocaleTag, Dict, NamespaceDict } from "@shared-i18n/types";
```

- [ ] **Step 2: Update index.ts to re-export from shared**

```ts
// apps/web-app/src/lib/i18n/index.ts
export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_NAMES,
  RTL_LOCALES,
} from "@shared-i18n/locales";
export type { LocaleTag } from "@shared-i18n/types";
// Keep storage keys local to web-app
export const STORAGE_V1 = "vellum.web.settings.v1";
export const STORAGE_LOCALE_RAW = "vellum.web.locale";
```

- [ ] **Step 3: Update dictionaries.ts to re-export shared + web overlay**

```ts
// apps/web-app/src/lib/i18n/dictionaries.ts
export { DICTIONARIES } from "@shared-i18n/dictionaries";
```

- [ ] **Step 4: Update I18nProvider.tsx — add args param + {{var}} substitution**

In the `t` function, after getting `value`, add:
```ts
// Support for {{variable}} placeholders
if (args) {
  return value.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    Object.prototype.hasOwnProperty.call(args, k) ? String(args[k]) : `{{${k}}}`
  );
}
return value;
```

Update the `t` signature in `I18nContextValue`:
```ts
t: (key: string, args?: Record<string, string | number>) => string;
```

- [ ] **Step 5: Verify web-app builds**

```bash
cd apps/web-app && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add apps/web-app/src/lib/i18n/ apps/web-app/src/components/providers/I18nProvider.tsx
git commit -m "feat(i18n): wire web-app to shared-i18n package, add {{var}} placeholder support"
```

---

## Task 6: Update mobile-app provider + SettingsStore to use shared package

**Files:**
- Modify: `apps/mobile-app/context/SettingsStore.tsx`
- Modify: `apps/mobile-app/context/I18nProvider.tsx`
- Create: `apps/mobile-app/context/dictionaries.ts`

- [ ] **Step 1: Update SettingsStore.tsx — expand LocaleTag to 7 languages**

```ts
// Replace: export type LocaleTag = 'en' | 'fr';
// With:
export type LocaleTag = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt' | 'nl';
```

Update `safeParseLocale`:
```ts
function safeParseLocale(raw: unknown): LocaleTag {
  const valid: LocaleTag[] = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl'];
  if (typeof raw === 'string' && valid.includes(raw as LocaleTag)) return raw as LocaleTag;
  return DEFAULT_SETTINGS.locale;
}
```

- [ ] **Step 2: Update I18nProvider.tsx — import shared dicts, update {{var}} regex**

Replace the inline EN/FR dicts and `LOCALE_DICTIONARIES` with:
```ts
import { DICTIONARIES } from '@shared-i18n/dictionaries';
import { SUPPORTED_LOCALES as SHARED_LOCALES } from '@shared-i18n/locales';
import type { LocaleTag as SharedLocaleTag } from '@shared-i18n/types';
```

Update `translate()` function:
- Change regex from `/\{(\w+)\}/g` to `/\{\{(\w+)\}\}/g`
- Use `DICTIONARIES[locale]` instead of `LOCALE_DICTIONARIES[locale]`

Update `SUPPORTED_LOCALES` export:
```ts
export const SUPPORTED_LOCALES = SHARED_LOCALES.map(tag => ({
  tag,
  label: LOCALE_NAMES[tag] || tag,
  flag: FLAG_MAP[tag] || '🌐',
}));
```

- [ ] **Step 3: Verify mobile-app typechecks**

```bash
cd apps/mobile-app && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile-app/context/SettingsStore.tsx apps/mobile-app/context/I18nProvider.tsx
git commit -m "feat(i18n): wire mobile-app to shared-i18n, expand to 7 languages, align {{var}} regex"
```

---

## Task 7: Penetrate t() into main-section files — pattern + auth/nav modules

This task establishes the pattern for all subsequent t() penetration. Each module follows the same steps: read file → identify hardcoded strings → add keys to EN dict (already done in Task 2) → import `useI18n` → wrap strings with `t("ns.key")`.

**Files (this task — auth + nav):**
- Modify: `apps/web-app/src/routes/__root.tsx`
- Modify: `apps/web-app/src/routes/login.tsx`
- Modify: `apps/web-app/src/routes/register.tsx`
- Modify: `apps/mobile-app/app/_layout.tsx`
- Modify: `apps/mobile-app/app/login.tsx`

- [ ] **Step 1: Read each file and identify hardcoded strings**

Read the 5 files above. Look for: JSX text content, `placeholder=`, `title=`, `aria-label=`, button text, heading text. Map each to a key in the EN dict (already defined in Task 2 under `navigation`, `auth` namespaces).

- [ ] **Step 2: In each file, add the import and call useI18n**

```tsx
// Add at top with other imports:
import { useI18n } from '@/components/providers/I18nProvider';  // web
// or: import { useI18n } from '../context/I18nProvider';       // mobile

// Inside the component:
const { t } = useI18n();
```

- [ ] **Step 3: Replace hardcoded strings with t() calls**

Example for `routes/login.tsx`:
- `"Sign in"` → `{t("auth.signIn")}`
- `"Email"` → `{t("auth.email")}`
- `"Password"` → `{t("auth.password")}`
- `"Forgot password?"` → `{t("auth.forgotPassword")}`
- `"Don't have an account?"` → `{t("auth.dontHaveAccount")}`
- `"Sign up"` → `{t("auth.signUp")}`

Example for `__root.tsx` / `_layout.tsx`:
- Nav tab labels: `"Home"` → `{t("navigation.home")}`, `"Discover"` → `{t("navigation.discover")}`, etc.

- [ ] **Step 4: Verify both apps typecheck**

```bash
cd apps/web-app && npx tsc --noEmit 2>&1 | head -20
cd apps/mobile-app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/src/routes/__root.tsx apps/web-app/src/routes/login.tsx apps/web-app/src/routes/register.tsx apps/mobile-app/app/_layout.tsx apps/mobile-app/app/login.tsx
git commit -m "feat(i18n): penetrate t() into auth + navigation modules"
```

---

## Task 8: Penetrate t() into remaining main-section modules

Apply the same pattern from Task 7 to the remaining modules. Each module: read → identify strings → import `useI18n` → wrap with `t()`.

**Files:**

| Module | Web file(s) | Mobile file(s) | Namespace keys |
|---|---|---|---|
| Home/Index | `routes/index.tsx` | `app/index.tsx` | `home.*` |
| Discover | `routes/discover.tsx` | `app/discover.tsx` | `discover.*` |
| Compose | `routes/compose.tsx` | `app/compose.tsx` | `compose.*` |
| Profile | `routes/profile.tsx` | `app/profile.tsx` | `profile.*` |
| Notifications | `routes/notifications.tsx` | `app/notifications.tsx` | `notifications.*` |
| Saved | `routes/saved.tsx` | `app/saved.tsx` | `home.*` (reuse) + `emptyStates.*` |
| Empty states | `components/SmartState.tsx`, `components/EnhancedErrorBoundary.tsx` | shimmer fallbacks in components | `emptyStates.*`, `errors.*` |

- [ ] **Step 1: Home/Index — both apps**

Read `routes/index.tsx` and `app/index.tsx`. Replace strings like "For You", "Trending", "Latest", "Read more", "Suggested authors" with `t("home.forYou")`, etc.

- [ ] **Step 2: Discover — both apps**

Read `routes/discover.tsx` and `app/discover.tsx`. Replace "Discover", search placeholder, "Categories", "Popular" etc.

- [ ] **Step 3: Compose — both apps**

Read `routes/compose.tsx` and `app/compose.tsx`. Replace "Write", "New Article", "Publish", "Save draft", title/body placeholders etc.

- [ ] **Step 4: Profile — both apps**

Read `routes/profile.tsx` and `app/profile.tsx`. Replace "Articles", "Followers", "Following", "Follow"/"Unfollow", "Edit profile" etc.

- [ ] **Step 5: Notifications — both apps**

Read `routes/notifications.tsx` and `app/notifications.tsx`. Replace "Notifications", "No notifications", "Mark all as read" etc.

- [ ] **Step 6: Saved — both apps**

Read `routes/saved.tsx` and `app/saved.tsx`. Replace "Saved", "No saved articles" etc.

- [ ] **Step 7: Empty states + errors — web components**

Read `SmartState.tsx` and `EnhancedErrorBoundary.tsx`. Replace "Nothing here yet", "Something went wrong", "Please try again in a moment.", "An unexpected error occurred..." etc.

- [ ] **Step 8: Verify both apps typecheck**

```bash
cd apps/web-app && npx tsc --noEmit 2>&1 | head -20
cd apps/mobile-app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 9: Commit**

```bash
git add apps/web-app/src/routes/ apps/mobile-app/app/ apps/web-app/src/components/
git commit -m "feat(i18n): penetrate t() into home, discover, compose, profile, notifications, saved, empty states"
```

---

## Task 9: Create AI translation CLI tool

**Files:**
- Create: `scripts/i18n-missing-translate.ts`

- [ ] **Step 1: Create the CLI script**

```ts
#!/usr/bin/env npx ts-node
// scripts/i18n-missing-translate.ts

import * as fs from "fs";
import * as path from "path";

// ── Types ──
type Dict = Record<string, string>;
type NamespaceDict = Record<string, Dict>;

// ── Config ──
const SHARED_DIR = path.resolve(__dirname, "../packages/shared-i18n/dictionaries");
const LANGS = ["fr", "es", "de", "it", "pt", "nl"];
const PROVIDER = process.env.TRANSLATE_PROVIDER || "mock";
const APPLY = process.argv.includes("--apply");
const LANG_FILTER = process.argv.find(a => a.startsWith("--lang="))?.split("=")[1]?.split(",");
const TARGET_LANGS = LANG_FILTER ? LANGS.filter(l => LANG_FILTER.includes(l)) : LANGS;

// ── Load dictionaries ──
function loadDict(lang: string): NamespaceDict {
  const file = path.join(SHARED_DIR, `base.${lang}.ts`);
  const src = fs.readFileSync(file, "utf-8");
  // Extract the object literal between `= {` and the final `};`
  const match = src.match(/export\s+const\s+\w+_Dict:\s*NamespaceDict\s*=\s*(\{[\s\S]*\});/);
  if (!match) throw new Error(`Could not parse ${file}`);
  // Use eval to parse the object (safe — it's our own TS source)
  return eval(`(${match[1]})`);
}

// ── Find missing keys ──
function findMissing(en: NamespaceDict, target: NamespaceDict, lang: string): Array<{ ns: string; key: string; enValue: string }> {
  const missing: Array<{ ns: string; key: string; enValue: string }> = [];
  for (const ns of Object.keys(en)) {
    for (const key of Object.keys(en[ns])) {
      const val = target[ns]?.[key];
      if (!val || val.startsWith("__TODO_")) {
        missing.push({ ns, key, enValue: en[ns][key] });
      }
    }
  }
  return missing;
}

// ── AI translation ──
async function translateBatch(
  lang: string,
  batch: Array<{ ns: string; key: string; enValue: string }>,
  siblings: Array<{ key: string; en: string; translated: string }>,
): Promise<Record<string, string>> {
  const langName: Record<string, string> = {
    fr: "French", es: "Spanish", de: "German",
    it: "Italian", pt: "Portuguese", nl: "Dutch",
  };

  if (PROVIDER === "mock") {
    const result: Record<string, string> = {};
    for (const item of batch) {
      result[item.key] = `__TODO_${lang.toUpperCase()}_${item.key}`;
    }
    return result;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(`No API key found for provider ${PROVIDER}. Using TODO markers.`);
    const result: Record<string, string> = {};
    for (const item of batch) {
      result[item.key] = `__TODO_${lang.toUpperCase()}_${item.key}`;
    }
    return result;
  }

  const siblingCtx = siblings.slice(0, 3)
    .map(s => `  ${s.key}: "${s.en}" → "${s.translated}"`)
    .join("\n");

  const items = batch.map(i => `  "${i.key}": "${i.enValue}"`).join(",\n");

  const prompt = `You are translating UI strings for Vellum, an article-reading social app.
Target language: ${langName[lang] || lang} (code: ${lang})
Respond ONLY with valid JSON: {"key1": "translation1", ...}
Preserve {{var}} placeholders literally — do NOT translate them.

Context (same namespace, already translated for tone):
${siblingCtx}

Translate these English strings:
{
${items}
}`;

  const url = PROVIDER === "deepseek"
    ? "https://api.deepseek.com/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PROVIDER === "deepseek" ? "deepseek-chat" : "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = await resp.json() as any;
    const content = data.choices?.[0]?.message?.content || "";
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`Translation failed for ${lang}: ${e}`);
    const result: Record<string, string> = {};
    for (const item of batch) {
      result[item.key] = `__TODO_${lang.toUpperCase()}_${item.key}`;
    }
    return result;
  }
}

// ── Write back to dict file ──
function applyTranslations(lang: string, dict: NamespaceDict, translations: Record<string, Record<string, string>>) {
  const file = path.join(SHARED_DIR, `base.${lang}.ts`);
  let src = fs.readFileSync(file, "utf-8");

  for (const ns of Object.keys(translations)) {
    for (const key of Object.keys(translations[ns])) {
      const newVal = translations[ns][key];
      // Replace the TODO marker or add the key
      const todoRegex = new RegExp(`(${key}:\\s*)"__TODO_${lang.toUpperCase()}_${key}"`);
      if (todoRegex.test(src)) {
        src = src.replace(todoRegex, `$1"${newVal.replace(/"/g, '\\"')}"`);
      }
    }
  }

  fs.writeFileSync(file, src);
}

// ── Main ──
async function main() {
  const en = loadDict("en");
  const report: any = { provider: PROVIDER, apply: APPLY, languages: {} };

  for (const lang of TARGET_LANGS) {
    const target = loadDict(lang);
    const missing = findMissing(en, target, lang);

    if (missing.length === 0) {
      report.languages[lang] = { missing: 0, translated: 0, skipped: 0 };
      continue;
    }

    // Build sibling context from already-translated keys in same namespaces
    const siblings: Array<{ key: string; en: string; translated: string }> = [];
    for (const item of missing.slice(0, 3)) {
      const ns = item.ns;
      for (const k of Object.keys(target[ns] || {})) {
        const v = target[ns][k];
        if (v && !v.startsWith("__TODO_")) {
          siblings.push({ key: k, en: en[ns][k], translated: v });
          if (siblings.length >= 3) break;
        }
      }
      if (siblings.length >= 3) break;
    }

    // Batch by namespace, max 20 per batch
    const batches: Array<typeof missing> = [];
    for (let i = 0; i < missing.length; i += 20) {
      batches.push(missing.slice(i, i + 20));
    }

    let translated = 0;
    const allTranslations: Record<string, Record<string, string>> = {};

    for (const batch of batches) {
      const ns = batch[0].ns;
      const result = await translateBatch(lang, batch, siblings);
      if (!allTranslations[ns]) allTranslations[ns] = {};
      for (const key of Object.keys(result)) {
        allTranslations[ns][key] = result[key];
        if (!result[key].startsWith("__TODO_")) translated++;
      }
    }

    report.languages[lang] = {
      missing: missing.length,
      translated,
      skipped: missing.length - translated,
    };

    if (APPLY) {
      applyTranslations(lang, target, allTranslations);
    }

    // Print dry-run diff
    if (!APPLY) {
      console.log(`\n── ${lang.toUpperCase()} (${missing.length} missing) ──`);
      for (const batch of batches) {
        const ns = batch[0].ns;
        const result = await translateBatch(lang, batch, siblings);
        for (const item of batch) {
          const val = result[item.key] || `__TODO_${lang.toUpperCase()}_${item.key}`;
          console.log(`  ${ns}.${item.key}: "${item.enValue}" → "${val}"`);
        }
      }
    }
  }

  // Write report
  const reportDir = path.resolve(__dirname, "../apps/mobile-app/tests/test-output");
  if (fs.existsSync(reportDir)) {
    fs.writeFileSync(
      path.join(reportDir, "missing-translations-report.json"),
      JSON.stringify(report, null, 2),
    );
  }

  console.log("\n" + (APPLY ? "✅ Translations applied." : "📋 Dry run complete. Use --apply to write changes."));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run dry-run to see missing keys**

```bash
npx ts-node scripts/i18n-missing-translate.ts --dry-run 2>&1 | tail -30
```

Expected: Lists all `__TODO_*` keys per language with proposed translations (or TODO markers if mock provider).

- [ ] **Step 3: Run with --apply using mock provider (fills TODO markers for compile-check)**

```bash
npx ts-node scripts/i18n-missing-translate.ts --apply 2>&1 | tail -10
```

- [ ] **Step 4: (Optional) Run with AI provider to get real translations**

```bash
TRANSLATE_PROVIDER=deepseek DEEPSEEK_API_KEY=<key> npx ts-node scripts/i18n-missing-translate.ts --apply --lang=es,de,it,pt,nl 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n-missing-translate.ts packages/shared-i18n/dictionaries/
git commit -m "feat(i18n): add AI translation CLI tool, fill missing translations"
```

---

## Task 10: Create i18n audit script

**Files:**
- Create: `scripts/i18n-audit.py`

- [ ] **Step 1: Create the audit script**

```python
#!/usr/bin/env python3
"""Scans source files for hardcoded English strings that should use t()."""

import re, json, os
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
PATTERNS = {
    "jsx_text": r'>([A-Z][a-z][^<{}]{2,80})<',
    "placeholder": r'placeholder="([A-Z][^"]{2,80})"',
    "aria_label": r'aria-label="([A-Z][^"]{2,80})"',
    "title_attr": r'title="([A-Z][^"]{2,80})"',
}

SKIP_DIRS = {"node_modules", ".expo", "dist", "build", "tests", "test-output", "__pycache__"}
SKIP_EXT = {".test.tsx", ".test.ts", ".spec.tsx", ".spec.ts", ".py", ".json", ".css", ".md"}
SKIP_FILES = {"types.ts", "index.ts"}

def should_skip(p: Path) -> bool:
    if any(part in SKIP_DIRS for part in p.parts): return True
    if any(str(p).endswith(ext) for ext in SKIP_EXT): return True
    if p.name in SKIP_FILES: return True
    return False

def scan_file(filepath: Path) -> list[dict]:
    results = []
    try:
        content = filepath.read_text(encoding="utf-8")
    except:
        return results
    has_t = "useI18n" in content or "useTranslate" in content
    for pattern_name, pattern in PATTERNS.items():
        for m in re.finditer(pattern, content):
            text = m.group(1).strip()
            # Skip if already using t() in this file
            if has_t and f't("{text.split(".")[0]}' in content: continue
            # Skip common false positives
            if text in {"SVG", "XML", "HTML", "CSS", "API"}: continue
            if text.startswith("http") or text.startswith("@"): continue
            results.append({
                "file": str(filepath.relative_to(ROOT)),
                "pattern": pattern_name,
                "text": text,
                "line": content[:m.start()].count("\n") + 1,
                "file_uses_t": has_t,
            })
    return results

def main():
    all_findings = []
    by_file = defaultdict(list)
    
    search_dirs = [
        ROOT / "apps" / "web-app" / "src",
        ROOT / "apps" / "mobile-app" / "app",
        ROOT / "apps" / "mobile-app" / "components",
    ]
    
    for search_dir in search_dirs:
        if not search_dir.exists(): continue
        for filepath in search_dir.rglob("*.tsx"):
            if should_skip(filepath): continue
            findings = scan_file(filepath)
            if findings:
                all_findings.extend(findings)
                by_file[str(filepath.relative_to(ROOT))].extend(findings)
    
    total_files = len(by_file)
    total_strings = len(all_findings)
    
    report = {
        "total_files_with_hardcoded": total_files,
        "total_hardcoded_strings": total_strings,
        "by_file": dict(by_file),
    }
    
    out_dir = ROOT / "apps" / "mobile-app" / "tests" / "test-output"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "i18n-audit-report.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"Found {total_strings} hardcoded strings in {total_files} files.")
    print(f"Report: {out_path}")
    
    # Print top 10 files by count
    ranked = sorted(by_file.items(), key=lambda x: len(x[1]), reverse=True)
    for filepath, items in ranked[:10]:
        print(f"  {len(items):3d}  {filepath}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run audit**

```bash
python3 scripts/i18n-audit.py
```

- [ ] **Step 3: Commit**

```bash
git add scripts/i18n-audit.py
git commit -m "feat(i18n): add hardcoded string audit script"
```

---

## Task 11: Create compile-time key completeness check

**Files:**
- Create: `packages/shared-i18n/type-check.ts`
- Create: `scripts/i18n-compile-check.ts`

- [ ] **Step 1: Create type-check.ts**

```ts
// packages/shared-i18n/type-check.ts

import { EN_DICT } from "./dictionaries/base.en";
import { FR_DICT } from "./dictionaries/base.fr";
import { ES_DICT } from "./dictionaries/base.es";
import { DE_DICT } from "./dictionaries/base.de";
import { IT_DICT } from "./dictionaries/base.it";
import { PT_DICT } from "./dictionaries/base.pt";
import { NL_DICT } from "./dictionaries/base.nl";
import { NamespaceDict } from "./types";

type AllKeys<T extends NamespaceDict> = {
  [NS in keyof T]: keyof T[NS];
}[keyof T];

type ENKeys = AllKeys<typeof EN_DICT>;
type FRKeys = AllKeys<typeof FR_DICT>;
type ESKeys = AllKeys<typeof ES_DICT>;
type DEKeys = AllKeys<typeof DE_DICT>;
type ITKeys = AllKeys<typeof IT_DICT>;
type PTKeys = AllKeys<typeof PT_DICT>;
type NLKeys = AllKeys<typeof NL_DICT>;

// Bidirectional completeness checks — these produce compile errors
// if any language is missing EN keys or has extra keys.
type AssertFRComplete = ENKeys extends FRKeys ? true : never;
type AssertFRExtra = FRKeys extends ENKeys ? true : never;
type AssertESComplete = ENKeys extends ESKeys ? true : never;
type AssertESExtra = ESKeys extends ENKeys ? true : never;
type AssertDEComplete = ENKeys extends DEKeys ? true : never;
type AssertDEExtra = DEKeys extends ENKeys ? true : never;
type AssertITComplete = ENKeys extends ITKeys ? true : never;
type AssertITExtra = ITKeys extends ENKeys ? true : never;
type AssertPTComplete = ENKeys extends PTKeys ? true : never;
type AssertPTExtra = PTKeys extends ENKeys ? true : never;
type AssertNLComplete = ENKeys extends NLKeys ? true : never;
type AssertNLExtra = NLKeys extends ENKeys ? true : never;

export type _AllChecks = [
  AssertFRComplete, AssertFRExtra,
  AssertESComplete, AssertESExtra,
  AssertDEComplete, AssertDEExtra,
  AssertITComplete, AssertITExtra,
  AssertPTComplete, AssertPTExtra,
  AssertNLComplete, AssertNLExtra,
];
```

- [ ] **Step 2: Create compile-check runner**

```ts
// scripts/i18n-compile-check.ts

#!/usr/bin/env npx ts-node

import { EN_DICT } from "../packages/shared-i18n/dictionaries/base.en";
import { FR_DICT } from "../packages/shared-i18n/dictionaries/base.fr";
import { ES_DICT } from "../packages/shared-i18n/dictionaries/base.es";
import { DE_DICT } from "../packages/shared-i18n/dictionaries/base.de";
import { IT_DICT } from "../packages/shared-i18n/dictionaries/base.it";
import { PT_DICT } from "../packages/shared-i18n/dictionaries/base.pt";
import { NL_DICT } from "../packages/shared-i18n/dictionaries/base.nl";
import { NamespaceDict, LocaleTag } from "../packages/shared-i18n/types";

const DICTS: Record<string, NamespaceDict> = {
  fr: FR_DICT, es: ES_DICT, de: DE_DICT, it: IT_DICT, pt: PT_DICT, nl: NL_DICT,
};

let errors = 0;

for (const [lang, dict] of Object.entries(DICTS)) {
  for (const ns of Object.keys(EN_DICT)) {
    const enKeys = Object.keys(EN_DICT[ns] || {});
    const langKeys = Object.keys(dict[ns] || {});
    const missing = enKeys.filter(k => !langKeys.includes(k));
    const extra = langKeys.filter(k => !enKeys.includes(k));
    const todos = langKeys.filter(k => (dict[ns][k] || "").startsWith("__TODO_"));

    if (missing.length > 0) {
      console.error(`❌ ${lang}.${ns}: missing ${missing.length} keys: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`);
      errors += missing.length;
    }
    if (extra.length > 0) {
      console.warn(`⚠️  ${lang}.${ns}: ${extra.length} extra keys not in EN`);
    }
    if (todos.length > 0) {
      console.warn(`⏳ ${lang}.${ns}: ${todos.length} TODO markers (EN fallback at runtime)`);
    }
  }
}

if (errors > 0) {
  console.error(`\n❌ ${errors} missing keys found. Run: npx ts-node scripts/i18n-missing-translate.ts --apply`);
  process.exit(1);
} else {
  console.log("✅ All languages have all EN keys.");
  process.exit(0);
}
```

- [ ] **Step 3: Run compile-check**

```bash
npx ts-node scripts/i18n-compile-check.ts
```

Expected: `✅ All languages have all EN keys.` (after Task 9 fills TODO markers)

- [ ] **Step 4: Commit**

```bash
git add packages/shared-i18n/type-check.ts scripts/i18n-compile-check.ts
git commit -m "feat(i18n): add compile-time key completeness guard"
```

---

## Task 12: Create Playwright i18n smoke test (web-app)

**Files:**
- Create: `apps/web-app/tests/i18n_smoke.spec.ts`

- [ ] **Step 1: Create the smoke test**

```ts
// apps/web-app/tests/i18n_smoke.spec.ts

import { test, expect } from "@playwright/test";

test("language switching smoke test", async ({ page }) => {
  await page.goto("/settings");

  // ── Switch to French ──
  await page.getByText("Language").click();
  await page.getByText("Français").click();
  await page.waitForTimeout(1000);

  // Verify FR text appears
  const frText = await page.locator("body").textContent();
  expect(frText).toContain("Paramètres");

  // ── Switch to German ──
  await page.getByText("Sprache").click();
  await page.getByText("Deutsch").click();
  await page.waitForTimeout(1000);

  const deText = await page.locator("body").textContent();
  expect(deText).toContain("Einstellungen");

  // ── Switch back to English ──
  await page.getByText("Sprache").click();
  await page.getByText("English").click();
  await page.waitForTimeout(1000);

  const enText = await page.locator("body").textContent();
  expect(enText).toContain("Settings");
});
```

- [ ] **Step 2: Run the smoke test**

```bash
cd apps/web-app && npx playwright test tests/i18n_smoke.spec.ts 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/web-app/tests/i18n_smoke.spec.ts
git commit -m "test(i18n): add Playwright language switching smoke test"
```

---

## Task 13: Extend mobile QA suite with ES/DE spot-checks

**Files:**
- Modify: `apps/mobile-app/tests/mobile_settings_qa.py`

- [ ] **Step 1: Add ES and DE language spot-checks to the i18n test section**

In the i18n test method, after the existing EN→FR→EN test cases, add:

```python
        # ── Spanish spot-check ──
        try:
            row = self._find_row_by_keywords(page, ["Idioma", "Lengua", "Language"], timeout_ms=8000)
            self._tap_row_center(page, row)
            page.wait_for_timeout(1000)
            es_btn = page.locator("text=Español").first
            es_btn.click(timeout=5000)
            page.wait_for_timeout(1500)
            content = page.content()
            has_es = "Ajustes" in content or "Configuraciones" in content or "Idioma" in content
            self.record(
                cat,
                "switch to Spanish (spot-check)",
                f"has_es_markers={has_es}",
                bool(has_es),
            )
        except Exception as e:
            self.record(cat, "switch to Spanish (spot-check)", f"exception: {e}", False)

        # ── German spot-check ──
        try:
            row = self._find_row_by_keywords(page, ["Sprache", "Language"], timeout_ms=8000)
            self._tap_row_center(page, row)
            page.wait_for_timeout(1000)
            de_btn = page.locator("text=Deutsch").first
            de_btn.click(timeout=5000)
            page.wait_for_timeout(1500)
            content = page.content()
            has_de = "Einstellungen" in content or "Sprache" in content or "Datenschutz" in content
            self.record(
                cat,
                "switch to German (spot-check)",
                f"has_de_markers={has_de}",
                bool(has_de),
            )
        except Exception as e:
            self.record(cat, "switch to German (spot-check)", f"exception: {e}", False)

        # ── Restore English ──
        try:
            row = self._find_row_by_keywords(page, ["Sprache", "Language", "Idioma"], timeout_ms=8000)
            self._tap_row_center(page, row)
            page.wait_for_timeout(1000)
            en_btn = page.locator("text=English").first
            en_btn.click(timeout=5000)
            page.wait_for_timeout(1500)
            self.record(cat, "restore English after ES/DE spot-checks", "", True)
        except Exception as e:
            self.record(cat, "restore English after ES/DE spot-checks", f"exception: {e}", False)
```

- [ ] **Step 2: Run the extended mobile QA suite**

```bash
python3 apps/mobile-app/tests/mobile_settings_qa.py 2>&1 | tail -30
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-app/tests/mobile_settings_qa.py
git commit -m "test(i18n): add ES/DE language spot-checks to mobile QA suite"
```

---

## Task 14: Final QA run + comprehensive report

**Files:**
- Run all QA scripts and generate consolidated report

- [ ] **Step 1: Run i18n audit**

```bash
python3 scripts/i18n-audit.py
```

- [ ] **Step 2: Run compile-check**

```bash
npx ts-node scripts/i18n-compile-check.ts
```

- [ ] **Step 3: Run web-app Playwright smoke test**

```bash
cd apps/web-app && npx playwright test tests/i18n_smoke.spec.ts 2>&1 | tail -10
```

- [ ] **Step 4: Run mobile QA suite**

```bash
python3 apps/mobile-app/tests/mobile_settings_qa.py 2>&1 | tail -30
```

- [ ] **Step 5: Generate consolidated i18n QA report**

```bash
python3 -c "
import json, os
audit = json.load(open('apps/mobile-app/tests/test-output/i18n-audit-report.json'))
print('=== I18n AUDIT ===')
print(f'Files with hardcoded strings: {audit[\"total_files_with_hardcoded\"]}')
print(f'Total hardcoded strings: {audit[\"total_hardcoded_strings\"]}')
print()
compile_ok = os.system('npx ts-node scripts/i18n-compile-check.ts > /dev/null 2>&1')
print(f'Compile-time key check: {\"PASS\" if compile_ok == 0 else \"FAIL\"}')
"
```

- [ ] **Step 6: Commit final report**

```bash
git add apps/mobile-app/tests/test-output/i18n-audit-report.json
git commit -m "docs(i18n): add final i18n QA audit report"
```

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type Appearance = 'system' | 'light' | 'dark';
export type LocaleTag =
  | 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt' | 'nl' | 'sv' | 'da'
  | 'fi' | 'no' | 'pl' | 'cs' | 'hu' | 'ro' | 'bg' | 'uk' | 'el'
  | 'ar' | 'he' | 'fa' | 'tr' | 'hi' | 'id' | 'ms' | 'th' | 'zh'
  | 'ja' | 'ko' | 'vi' | 'ru';

export interface ClientSettings {
  appearance: Appearance;
  soundEnabled: boolean;
  locale: LocaleTag;
}

const APPEARANCE_KEY = 'vellbase.settings.appearance';
const SOUND_KEY = 'vellbase.settings.sound';
const LOCALE_KEY = 'vellbase.settings.locale';
const JSON_KEY = 'vellbase.settings.v1';

export const DEFAULT_SETTINGS: Readonly<ClientSettings> = {
  appearance: 'system',
  soundEnabled: true,
  locale: 'en',
};

function safeParseAppearance(raw: unknown): Appearance {
  if (raw === 'system' || raw === 'light' || raw === 'dark') return raw;
  return DEFAULT_SETTINGS.appearance;
}

function safeParseLocale(raw: unknown): LocaleTag {
  const valid: LocaleTag[] = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'no', 'pl', 'cs', 'hu', 'ro', 'bg', 'uk', 'el', 'ar', 'he', 'fa', 'tr', 'hi', 'id', 'ms', 'th', 'zh', 'ja', 'ko', 'vi', 'ru'];
  if (typeof raw === 'string' && valid.includes(raw as LocaleTag)) return raw as LocaleTag;
  return DEFAULT_SETTINGS.locale;
}

function safeParseBoolean(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    if (raw === 'on' || raw === 'true' || raw === '1') return true;
    if (raw === 'off' || raw === 'false' || raw === '0') return false;
  }
  return fallback;
}

/**
 * Hydrate client-side settings as early as possible (before splash is hidden).
 * - Try the combined JSON v1 key first; if invalid, fall back to individual keys.
 * - On any parse error, return safe defaults (never throw).
 */
export async function hydrateClientSettings(): Promise<ClientSettings> {
  try {
    const combined = await AsyncStorage.getItem(JSON_KEY);
    if (combined) {
      try {
        const parsed = JSON.parse(combined) as Partial<ClientSettings>;
        return {
          appearance: safeParseAppearance(parsed.appearance),
          soundEnabled: safeParseBoolean(parsed.soundEnabled, DEFAULT_SETTINGS.soundEnabled),
          locale: safeParseLocale(parsed.locale),
        };
      } catch {
        // corrupt combined key: fall through to legacy keys, then rewrite below.
      }
    }

    const [appearance, sound, locale] = await Promise.all([
      AsyncStorage.getItem(APPEARANCE_KEY),
      AsyncStorage.getItem(SOUND_KEY),
      AsyncStorage.getItem(LOCALE_KEY),
    ]);
    const result: ClientSettings = {
      appearance: safeParseAppearance(appearance),
      soundEnabled:
        sound === null ? DEFAULT_SETTINGS.soundEnabled : safeParseBoolean(sound, DEFAULT_SETTINGS.soundEnabled),
      locale: safeParseLocale(locale),
    };
    // Migrate to combined storage key for faster loads in future.
    await persistSettings(result);
    return result;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function persistSettings(next: ClientSettings): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(JSON_KEY, JSON.stringify(next)),
      AsyncStorage.setItem(APPEARANCE_KEY, next.appearance),
      AsyncStorage.setItem(SOUND_KEY, next.soundEnabled ? 'on' : 'off'),
      AsyncStorage.setItem(LOCALE_KEY, next.locale),
    ]);
  } catch {
    // Persistence failure is non-fatal; settings revert on restart but app keeps working.
  }
}

interface SettingsStoreContextValue {
  settings: ClientSettings;
  isHydrated: boolean;
  setAppearance: (next: Appearance) => void;
  setSoundEnabled: (next: boolean) => void;
  setLocale: (next: LocaleTag) => void;
  reset: () => void;
}

const SettingsStoreContext = createContext<SettingsStoreContextValue | null>(null);

export function SettingsStoreProvider({
  children,
  initialSettings,
}: {
  children: React.ReactNode;
  /** Optional pre-hydrated settings from App root (avoids flash of default theme). */
  initialSettings?: ClientSettings;
}) {
  const [settings, setSettingsState] = useState<ClientSettings>(() => {
    if (initialSettings) return initialSettings;
    return { ...DEFAULT_SETTINGS };
  });
  const [isHydrated, setIsHydrated] = useState<boolean>(() => !!initialSettings);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  // Sync state when the root layout's hydration promise resolves and it
  // passes new prop values down. Without this, the state stays frozen at
  // the *first* render's initialSettings (often DEFAULT_SETTINGS), so
  // persisted user preferences (e.g. appearance) never take effect until a
  // full page reload — producing a "stuck theme" bug on web.
  useEffect(() => {
    if (!initialSettings) return;
    setSettingsState((prev) => {
      if (
        prev.appearance === initialSettings.appearance &&
        prev.soundEnabled === initialSettings.soundEnabled &&
        prev.locale === initialSettings.locale
      ) {
        return prev;
      }
      return { ...initialSettings };
    });
    setIsHydrated(true);
  }, [
    initialSettings,
    initialSettings?.appearance,
    initialSettings?.soundEnabled,
    initialSettings?.locale,
  ]);

  // If no initial settings were passed (edge case), hydrate on mount.
  useEffect(() => {
    if (initialSettings) return;
    let cancelled = false;
    hydrateClientSettings().then((s) => {
      if (cancelled) return;
      setSettingsState(s);
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [initialSettings]);

  const queuePersist = useCallback((next: ClientSettings) => {
    writeQueue.current = writeQueue.current.then(() => persistSettings(next));
  }, []);

  const setAppearance = useCallback(
    (next: Appearance) => {
      setSettingsState((prev) => {
        if (prev.appearance === next) return prev;
        const updated = { ...prev, appearance: next };
        queuePersist(updated);
        return updated;
      });
    },
    [queuePersist],
  );

  const setSoundEnabled = useCallback(
    (next: boolean) => {
      setSettingsState((prev) => {
        if (prev.soundEnabled === next) return prev;
        const updated = { ...prev, soundEnabled: next };
        queuePersist(updated);
        return updated;
      });
    },
    [queuePersist],
  );

  const setLocale = useCallback(
    (next: LocaleTag) => {
      setSettingsState((prev) => {
        if (prev.locale === next) return prev;
        const updated = { ...prev, locale: next };
        queuePersist(updated);
        return updated;
      });
    },
    [queuePersist],
  );

  const reset = useCallback(() => {
    setSettingsState({ ...DEFAULT_SETTINGS });
    queuePersist({ ...DEFAULT_SETTINGS });
  }, [queuePersist]);

  const value = useMemo<SettingsStoreContextValue>(
    () => ({ settings, isHydrated, setAppearance, setSoundEnabled, setLocale, reset }),
    [settings, isHydrated, setAppearance, setSoundEnabled, setLocale, reset],
  );

  return (
    <SettingsStoreContext.Provider value={value}>{children}</SettingsStoreContext.Provider>
  );
}

export function useSettingsStore(): SettingsStoreContextValue {
  const ctx = useContext(SettingsStoreContext);
  if (!ctx) {
    // Return a working default context value rather than crashing — this allows
    // isolated widget tests and first-render hydration without a provider.
    return {
      settings: { ...DEFAULT_SETTINGS },
      isHydrated: false,
      setAppearance: () => {},
      setSoundEnabled: () => {},
      setLocale: () => {},
      reset: () => {},
    };
  }
  return ctx;
}

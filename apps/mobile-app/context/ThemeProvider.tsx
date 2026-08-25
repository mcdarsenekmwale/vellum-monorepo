import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance as RNAppearance, ColorSchemeName, Platform, StyleSheet, useColorScheme, ColorValue } from 'react-native';
import { useSettingsStore, Appearance, DEFAULT_SETTINGS } from './SettingsStore';

export type ThemeVariant = 'light' | 'dark';

export interface ThemeColors {
  [x: string]: ColorValue | undefined;
  background: string;
  surface: string;
  surfaceAlt: string;
  separator: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentMuted: string;
  danger: string;
  success: string;
  warning: string;
  overlay: string;
  shadow: string;
  inverseSurface: string;
  inverseText: string;
  primary: string;
}

export interface ThemeMetrics {
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusPill: number;
  spacingXs: number;
  spacingSm: number;
  spacingMd: number;
  spacingLg: number;
  spacingXl: number;
}

export interface Theme {
  variant: ThemeVariant;
  appearance: Appearance;
  isDark: boolean;
  colors: ThemeColors;
  metrics: ThemeMetrics;
  fonts: {
    serif: string;
    sans: string;
  };
}

const metrics: ThemeMetrics = {
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusPill: 999,
  spacingXs: 4,
  spacingSm: 8,
  spacingMd: 12,
  spacingLg: 16,
  spacingXl: 24,
};

const LIGHT_COLORS: ThemeColors = {
  background: '#f7f4ee',
  surface: '#ffffff',
  surfaceAlt: '#faf8f3',
  separator: '#f5f2ed',
  border: '#e5e0d8',
  textPrimary: '#0f0f10',
  textSecondary: '#555555',
  textMuted: '#999999',
  // Text-on-background WCAG AA (body text ≥ 4.5:1) measured vs bg #f7f4ee:
  //   accent   #b34421  →  5.08:1  (was #d4653a → 3.34:1, failed)
  //   danger   #cc1843  →  5.06:1  (was #e11d48 → 4.28:1, failed)
  //   success  #15582c  →  6.53:1  (was #15803d → 3.70:1, failed)
  //   warning  #8a4108  →  5.59:1  (was #b45309 → 3.94:1, failed)
  accent: '#b34421',
  accentMuted: '#f1dfd3',
  danger: '#cc1843',
  success: '#15582c',
  warning: '#8a4108',
  overlay: 'rgba(15, 15, 16, 0.38)',
  shadow: '#000000',
  inverseSurface: '#0f0f10',
  inverseText: '#faf8f3',
  input: '#e5e5e5',
  inputText: '#0f0f10',
  //light mode colors
  buttonPrimary: '#6666666',
  buttonText: '#ffffff',
  buttonBorder: '#ffffff',
  button: '#ffffff',
  primary: '#944b06',
};

const DARK_COLORS: ThemeColors = {
  background: '#0f0f10',
  surface: '#18181a',
  surfaceAlt: '#1f1f22',
  separator: '#2a2a2e',
  border: '#2e2e32',
  textPrimary: '#faf8f3',
  textSecondary: '#c8c4bb',
  textMuted: '#8a8a8f',
  accent: '#ec7a50',
  accentMuted: '#3a1e13',
  danger: '#f43f5e',
  success: '#22c55e',
  warning: '#f59e0b',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
  inverseSurface: '#f7f4ee',
  inverseText: '#0f0f10',

  //dark mode colors
  input: '#2e2e32',
  inputText: '#b3b3b3ff',
  buttonPrimary: '#000000',
  buttonText: '#ffffff',
  buttonBorder: '#ffffff',
  button: '#ffffff',
  primary: '#944b06',
};

interface ThemeContextValue {
  theme: Theme;
  setAppearance: (next: Appearance) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveColors(appearance: Appearance, system: ColorSchemeName): ThemeColors {
  const prefersDark = appearance === 'dark' || (appearance === 'system' && system === 'dark');
  return prefersDark ? DARK_COLORS : LIGHT_COLORS;
}

function resolveVariant(appearance: Appearance, system: ColorSchemeName): ThemeVariant {
  return appearance === 'dark' || (appearance === 'system' && system === 'dark') ? 'dark' : 'light';
}

/**
 * Applies the effective variant to the root Appearance API (iOS/Android system bars)
 * so the status bar tint matches the user's selected theme (not just system default).
 */
function configureStatusBar(variant: ThemeVariant) {
  try {
    if (Platform.OS !== 'web') {
      RNAppearance.setColorScheme(variant);
    }
  } catch {
    /* Appearance API may be unavailable; ignore. */
  }
}

export function VellbaseThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, setAppearance: persistAppearance } = useSettingsStore();
  const system = useColorScheme();
  const [override, setOverride] = useState<ColorSchemeName>(null);
  const effectiveSystem = override ?? system;

  const colors = useMemo<ThemeColors>(() => resolveColors(settings.appearance, effectiveSystem), [settings.appearance, effectiveSystem]);
  const variant = useMemo<ThemeVariant>(() => resolveVariant(settings.appearance, effectiveSystem), [settings.appearance, effectiveSystem]);

  useEffect(() => {
    if (settings.appearance === 'system') {
      setOverride(null);
      return;
    }
    // When user chooses an explicit Light/Dark, force the OS system color-scheme
    // so components like StatusBar and native alerts match the theme.
    setOverride(variant);
    configureStatusBar(variant);
  }, [settings.appearance, variant]);

  // Web: react-native-screens / expo-router wraps route content in a full-screen
  // absolute View that sometimes carries an inline hardcoded light grey background
  // (rgb(242,242,242) / #f2f2f2). This overlay paints on top of the themed AuthGate
  // container and breaks dark mode on tab-routed screens like /feed. Fix: inject a
  // targeted stylesheet rule that forces the generated `position:absolute; inset:0;`
  // screen wrappers (which RNW encodes as the specific set of r-* classes below)
  // to inherit background from their themed ancestor. Re-run whenever variant flips.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    try {
      const id = '__vellbase_rnscreens_bg_fix__';
      let el = document.getElementById(id) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = id;
        document.head.appendChild(el);
      }
      // These RNW class names together encode `position: absolute; top:0; left:0;
      // right:0; bottom:0; flex:1; display:flex;` — i.e. the screen stack wrapper.
      // Transparentising this wrapper lets the themed AuthGate background show.
      el.innerHTML = `
        .r-position-u8s1d.r-flex-13awgt0.r-bottom-1p0dtai.r-left-1d2f490.r-right-zchlnj.r-top-ipm5af,
        .r-flex-13awgt0.r-bottom-1p0dtai.r-left-1d2f490.r-position-u8s1d.r-right-zchlnj.r-top-ipm5af {
          background-color: transparent !important;
        }
      `;
    } catch {
      /* DOM unavailable – noop. */
    }
  }, [variant, colors.background]);

  const theme = useMemo<Theme>(
    () => ({
      variant,
      appearance: settings.appearance,
      isDark: variant === 'dark',
      colors,
      metrics,
      fonts: {
        serif: 'Georgia',
        sans: Platform.select({ ios: 'SF Pro Text', android: 'Roboto', default: 'System' }) ?? 'System',
      },
    }),
    [variant, settings.appearance, colors],
  );

  const setAppearance = (next: Appearance) => {
    persistAppearance(next);
    if (next === 'system') {
      setOverride(null);
      // Restore system-based OS color scheme.
      try {
        if (Platform.OS !== 'web') RNAppearance.setColorScheme(null as any);
      } catch {
        /* ignore */
      }
    }
  };

  const value = useMemo<ThemeContextValue>(() => ({ theme, setAppearance }), [theme, setAppearance]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Default to light theme for call sites that render before provider is mounted
    // (e.g. isolated component previews / tests).
    return {
      theme: {
        variant: 'light',
        appearance: DEFAULT_SETTINGS.appearance,
        isDark: false,
        colors: LIGHT_COLORS,
        metrics,
        fonts: { serif: 'Georgia', sans: 'System' },
      },
      setAppearance: () => {},
    };
  }
  return ctx;
}

/** Convenience helper so screens don't need to destructure `theme.colors`. */
export function useThemeColors(): ThemeColors {
  return useTheme().theme.colors;
}

/** Shared base stylesheet that scales with theme. */
export function makeThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (t: Theme) => T,
) {
  // We deliberately don't precompute; components call this at module scope to capture their
  // first rendered theme, and rely on prop-driven color changes for re-renders.
  // Consumers who want strict StyleSheet reuse may call useMemo themselves.
  return factory;
}

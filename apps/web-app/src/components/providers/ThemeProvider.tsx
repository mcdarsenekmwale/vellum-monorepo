import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

export const STORAGE_V1 = "vellbase.web.settings.v1";
export const STORAGE_THEME_RAW = "vellbase.web.theme";

type V1Shape = {
  appearance?: ThemeMode;
  locale?: string;
  soundEnabled?: boolean;
};

function readV1(): V1Shape {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_V1) || "{}");
  } catch {
    return {};
  }
}

function writeV1(patch: Partial<V1Shape>): V1Shape {
  const cur = readV1();
  const next = { ...cur, ...patch };
  window.localStorage.setItem(STORAGE_V1, JSON.stringify(next));
  return next;
}

export function applyResolvedTheme(r: Resolved): void {
  if (typeof document === "undefined") return;
  const h = document.documentElement;
  h.classList.toggle("dark", r === "dark");
  h.style.colorScheme = r;
}

export function systemTheme(): Resolved {
  if (typeof window === "undefined") return "light";
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
  const [resolved, setResolvedState] = useState<Resolved>("light");

  // Initial hydration from storage
  useEffect(() => {
    const v1 = readV1();
    const raw = window.localStorage.getItem(STORAGE_THEME_RAW);
    let m: ThemeMode =
      v1.appearance === "dark" || v1.appearance === "light" || v1.appearance === "system"
        ? v1.appearance
        : (raw as ThemeMode);
    if (m !== "light" && m !== "dark" && m !== "system") m = "system";
    setModeState(m);
    const resolvedInit: Resolved = m === "system" ? systemTheme() : m;
    setResolvedState(resolvedInit);
    applyResolvedTheme(resolvedInit);
  }, []);

  // React to OS changes when in system mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = systemTheme();
      setResolvedState(r);
      applyResolvedTheme(r);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    writeV1({ appearance: m });
    window.localStorage.setItem(STORAGE_THEME_RAW, m);
    const r: Resolved = m === "system" ? systemTheme() : m;
    setResolvedState(r);
    applyResolvedTheme(r);
  }, []);

  const value = useMemo<Ctx>(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

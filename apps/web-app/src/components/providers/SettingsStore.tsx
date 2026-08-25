import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "@/lib/api";
import type { UserSettings } from "@/lib/api";

const STORAGE_V1 = "vellbase.web.settings.v1";
const STORAGE_SOUND_RAW = "vellbase.web.sound";

type PrivacyState = {
  allowComments: boolean;
  allowLikes: boolean;
  showOnlineStatus: boolean;
};

type NotificationsState = {
  pushNotifications: boolean;
  emailNotifications: boolean;
  emailMarketing: boolean;
};

type Ctx = {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  privacy: PrivacyState;
  setPrivacy: (patch: Partial<PrivacyState>) => Promise<void>;
  notifications: NotificationsState;
  setNotifications: (patch: Partial<NotificationsState>) => Promise<void>;
  /** Reloads backend settings without resetting local-only state. */
  reloadBackend: () => Promise<void>;
  backendSettings: UserSettings | null;
  isBackendLoading: boolean;
};

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsStoreProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [privacy, setPrivacyState] = useState<PrivacyState>({
    allowComments: true,
    allowLikes: true,
    showOnlineStatus: true,
  });
  const [notifications, setNotificationsState] = useState<NotificationsState>({
    pushNotifications: true,
    emailNotifications: true,
    emailMarketing: false,
  });
  const [backendSettings, setBackendSettings] = useState<UserSettings | null>(null);
  const [isBackendLoading, setIsBackendLoading] = useState(false);

  // Load sound from storage.
  useEffect(() => {
    try {
      const v1 = JSON.parse(localStorage.getItem(STORAGE_V1) || "{}");
      const raw = localStorage.getItem(STORAGE_SOUND_RAW);
      const v =
        typeof v1.soundEnabled === "boolean"
          ? v1.soundEnabled
          : raw === null
            ? true
            : raw !== "off";
      setSoundEnabledState(!!v);
    } catch {
      setSoundEnabledState(true);
    }
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    try {
      const cur = JSON.parse(localStorage.getItem(STORAGE_V1) || "{}");
      localStorage.setItem(
        STORAGE_V1,
        JSON.stringify({ ...cur, soundEnabled: v }),
      );
      localStorage.setItem(STORAGE_SOUND_RAW, v ? "on" : "off");
    } catch {}
  }, []);

  const applyFromBackend = useCallback((s: UserSettings) => {
    setBackendSettings(s);
    setPrivacyState({
      allowComments: !!s.allowComments,
      allowLikes: !!s.allowLikes,
      showOnlineStatus: !!s.showOnlineStatus,
    });
    setNotificationsState({
      pushNotifications: !!s.pushNotifications,
      emailNotifications: !!s.emailNotifications,
      emailMarketing: !!s.emailMarketing,
    });
  }, []);

  const reloadBackend = useCallback(async () => {
    setIsBackendLoading(true);
    try {
      const s = await apiClient.getUserSettings();
      applyFromBackend(s);
    } catch {
      // No backend available — keep optimistic state.
    } finally {
      setIsBackendLoading(false);
    }
  }, [applyFromBackend]);

  // Initial backend load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsBackendLoading(true);
      try {
        const s = await apiClient.getUserSettings();
        if (!cancelled) applyFromBackend(s);
      } catch {
        /* offline / guest — ignore */
      } finally {
        if (!cancelled) setIsBackendLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyFromBackend]);

  const setPrivacy = useCallback(
    async (patch: Partial<PrivacyState>) => {
      setPrivacyState((p) => ({ ...p, ...patch }));
      try {
        const fresh = await apiClient.updateUserSettings(
          patch as Partial<UserSettings>,
        );
        applyFromBackend(fresh);
      } catch {
        // Attempt rollback.
        try {
          const s = await apiClient.getUserSettings();
          applyFromBackend(s);
        } catch {
          /* keep optimistic */
        }
      }
    },
    [applyFromBackend],
  );

  const setNotifications = useCallback(
    async (patch: Partial<NotificationsState>) => {
      setNotificationsState((p) => ({ ...p, ...patch }));
      try {
        const fresh = await apiClient.updateUserSettings(
          patch as Partial<UserSettings>,
        );
        applyFromBackend(fresh);
      } catch {
        try {
          const s = await apiClient.getUserSettings();
          applyFromBackend(s);
        } catch {
          /* keep optimistic */
        }
      }
    },
    [applyFromBackend],
  );

  const value = useMemo<Ctx>(
    () => ({
      soundEnabled,
      setSoundEnabled,
      privacy,
      setPrivacy,
      notifications,
      setNotifications,
      reloadBackend,
      backendSettings,
      isBackendLoading,
    }),
    [
      soundEnabled,
      setSoundEnabled,
      privacy,
      setPrivacy,
      notifications,
      setNotifications,
      reloadBackend,
      backendSettings,
      isBackendLoading,
    ],
  );

  return (
    <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>
  );
}

export function useSettingsStore() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) {
    throw new Error(
      "useSettingsStore must be used inside SettingsStoreProvider",
    );
  }
  return ctx;
}

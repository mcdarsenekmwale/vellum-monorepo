import { Monitor, Moon, Sun, Check } from "lucide-react";
import { BottomSheet } from "@/components/settings/BottomSheet";
import { useTheme, type ThemeMode } from "@/components/providers/ThemeProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { cn } from "@/lib/utils";

const OPTIONS: { mode: ThemeMode; key: "appearanceLight" | "appearanceDark" | "appearanceSystem"; icon: typeof Sun }[] = [
  { mode: "light", key: "appearanceLight", icon: Sun },
  { mode: "dark", key: "appearanceDark", icon: Moon },
  { mode: "system", key: "appearanceSystem", icon: Monitor },
];

export function AppearanceSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { mode, setMode } = useTheme();
  const { t } = useI18n();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("settings.sectionsAppearance")}
      description={t("settings.sectionsAppearanceDescription")}
      dataTestId="appearance-sheet"
    >
      <div className="grid grid-cols-3 gap-3" data-testid="appearance-options">
        {OPTIONS.map(({ mode: m, key, icon: Icon }) => {
          const selected = m === mode;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              data-testid={`appearance-option-${m}`}
              data-mode={m}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border px-3 py-5 text-sm font-medium transition-all",
                selected
                  ? "border-accent bg-accent/10 text-accent ring-1 ring-accent"
                  : "border-border hover:border-accent/40 hover:bg-muted/60",
              )}
            >
              <Icon
                className="size-6"
                strokeWidth={selected ? 2.2 : 1.8}
              />
              <span>{t(`settings.${key}`)}</span>
              {selected && (
                <span className="absolute top-2 right-2 size-4 rounded-full bg-accent text-white grid place-items-center">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ServiceName } from "@/lib/api/services";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export type ChartPref = {
  type: "line" | "bar" | "gauge";
  range: "1h" | "6h" | "24h" | "7d";
  percentiles: "all" | "p50" | "p95" | "p99";
  theme: "default" | "mono" | "colorblind";
};
export type ViewPrefs = Record<ServiceName, ChartPref> & {
  syncToAccount: boolean;
};

const DEFAULTS: ViewPrefs = {
  database: { type: "line", range: "24h", percentiles: "all", theme: "default" },
  api: { type: "line", range: "24h", percentiles: "all", theme: "default" },
  redis: { type: "line", range: "24h", percentiles: "all", theme: "default" },
  storage: { type: "line", range: "24h", percentiles: "all", theme: "default" },
  webhooks: { type: "line", range: "24h", percentiles: "all", theme: "default" },
  syncToAccount: false,
};

export function mergePrefs(p: Partial<ViewPrefs> | null): ViewPrefs {
  return {
    ...DEFAULTS,
    ...(p || {}),
    database: { ...DEFAULTS.database, ...((p as any)?.database ?? {}) },
    api: { ...DEFAULTS.api, ...((p as any)?.api ?? {}) },
    redis: { ...DEFAULTS.redis, ...((p as any)?.redis ?? {}) },
    storage: { ...DEFAULTS.storage, ...((p as any)?.storage ?? {}) },
    webhooks: { ...DEFAULTS.webhooks, ...((p as any)?.webhooks ?? {}) },
    syncToAccount:
      typeof (p as any)?.syncToAccount === "boolean"
        ? (p as any).syncToAccount
        : false,
  } as ViewPrefs;
}

const SERVICES: ServiceName[] = ["database", "api", "redis", "storage", "webhooks"];
const TITLES: Record<ServiceName, string> = {
  database: "Database",
  api: "API Gateway",
  redis: "Redis",
  storage: "Object Storage",
  webhooks: "Webhooks",
};

export function StatusCustomizeDrawer({
  open,
  onOpenChange,
  prefs,
  onSave,
  onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefs: ViewPrefs;
  onSave: (next: ViewPrefs) => void;
  onReset: () => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Visualization preferences</DrawerTitle>
          <DrawerDescription>
            Per-service chart settings. Saved to device unless Sync to account
            is on.
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-6 px-5 pb-10">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Sync to account</Label>
              <div className="text-xs text-muted-foreground">
                Persist across browsers via your admin profile.
              </div>
            </div>
            <Switch
              checked={prefs.syncToAccount}
              onCheckedChange={(c) => onSave({ ...prefs, syncToAccount: c })}
            />
          </div>
          {SERVICES.map((s) => {
            const pref = prefs[s];
            return (
              <div key={s} className="rounded-lg border p-4 space-y-4">
                <div className="font-semibold">{TITLES[s]}</div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider">
                    Chart type
                  </Label>
                  <RadioGroup
                    value={pref.type}
                    onValueChange={(v: any) =>
                      onSave({ ...prefs, [s]: { ...pref, type: v } })
                    }
                    className="flex gap-4"
                  >
                    {(["line", "bar", "gauge"] as const).map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <RadioGroupItem value={t} id={`${s}-t-${t}`} />
                        <Label htmlFor={`${s}-t-${t}`} className="capitalize">
                          {t}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider">
                    Time range
                  </Label>
                  <RadioGroup
                    value={pref.range}
                    onValueChange={(v: any) =>
                      onSave({ ...prefs, [s]: { ...pref, range: v } })
                    }
                    className="flex gap-4"
                  >
                    {(["1h", "6h", "24h", "7d"] as const).map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <RadioGroupItem value={t} id={`${s}-r-${t}`} />
                        <Label htmlFor={`${s}-r-${t}`}>{t}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider">
                    Percentiles
                  </Label>
                  <RadioGroup
                    value={pref.percentiles}
                    onValueChange={(v: any) =>
                      onSave({ ...prefs, [s]: { ...pref, percentiles: v } })
                    }
                    className="flex gap-4 flex-wrap"
                  >
                    {(["all", "p50", "p95", "p99"] as const).map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <RadioGroupItem value={t} id={`${s}-p-${t}`} />
                        <Label htmlFor={`${s}-p-${t}`} className="uppercase">
                          {t}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider">
                    Theme
                  </Label>
                  <RadioGroup
                    value={pref.theme}
                    onValueChange={(v: any) =>
                      onSave({ ...prefs, [s]: { ...pref, theme: v } })
                    }
                    className="flex gap-4 flex-wrap"
                  >
                    {(["default", "mono", "colorblind"] as const).map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <RadioGroupItem value={t} id={`${s}-th-${t}`} />
                        <Label
                          htmlFor={`${s}-th-${t}`}
                          className="capitalize"
                        >
                          {t}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2 sticky bottom-0 bg-background py-3">
            <Button className="flex-1" onClick={() => onSave(prefs)}>
              Save preferences
            </Button>
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

import { useState, useCallback, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Save,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Palette,
  Shield,
  Bell,
  Mail,
  Upload,
  Plug,
  Database,
  Monitor,
  Image,
  Fingerprint,
  Lock,
  FileJson,
  Languages,
  Cloud,
  Check,
  ChevronRight,
  Sparkles,
  Sun,
  Moon,
  MonitorSmartphone,
  LayoutTemplate,
  CreditCard,
  BarChart3,
  X,
  Plus,
  Eye,
  EyeOff,
  Diff,
  Undo2,
  AlertCircle,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  FileArchive,
  Loader2,
  MessageSquare,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSystemSettings, useUpdateSystemSetting, useSeedSettings, useDeleteWorkspace, useResetSettings } from "@/lib/api/hooks";
import type { SystemSetting } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── Types ─── */

type ColorPalette = {
  id: string;
  name: string;
  colors: string[];
  isDefault?: boolean;
};

type BrandFont = {
  id: string;
  name: string;
  family: string;
  category: string;
  isDefault?: boolean;
};

/* ─── Color Palette Presets ─── */

const COLOR_PRESETS = [
  { name: "Vellum", primary: "#d4653a", secondary: "#1a1a1a", accent: "#f7f4ee" },
  { name: "Ocean", primary: "#0ea5e9", secondary: "#0f172a", accent: "#f0f9ff" },
  { name: "Forest", primary: "#10b981", secondary: "#064e3b", accent: "#ecfdf5" },
  { name: "Berry", primary: "#e11d48", secondary: "#881337", accent: "#fff1f2" },
  { name: "Midnight", primary: "#6366f1", secondary: "#1e1b4b", accent: "#eef2ff" },
  { name: "Amber", primary: "#f59e0b", secondary: "#78350f", accent: "#fffbeb" },
  { name: "Slate", primary: "#64748b", secondary: "#0f172a", accent: "#f8fafc" },
  { name: "Custom", primary: "", secondary: "", accent: "" },
];

// Branding fonts
const BRAND_FONTS: BrandFont[] = [
  { id: "inter", name: "Inter", family: "Inter", category: "Sans-serif", isDefault: true },
  { id: "roboto", name: "Roboto", family: "Roboto", category: "Sans-serif" },
  { id: "poppins", name: "Poppins", family: "Poppins", category: "Sans-serif" },
  { id: "playfair", name: "Playfair Display", family: "Playfair Display", category: "Serif" },
  { id: "merriweather", name: "Merriweather", family: "Merriweather", category: "Serif" },
  { id: "montserrat", name: "Montserrat", family: "Montserrat", category: "Sans-serif" },
  { id: "open-sans", name: "Open Sans", family: "Open Sans", category: "Sans-serif" },
  { id: "lato", name: "Lato", family: "Lato", category: "Sans-serif" },
  { id: "raleway", name: "Raleway", family: "Raleway", category: "Sans-serif" },
  { id: "source-code", name: "Source Code Pro", family: "Source Code Pro", category: "Monospace" },
];

const LAYOUTS = [
  { id: "default", name: "Default", description: "Standard layout with sidebar" },
  { id: "compact", name: "Compact", description: "Dense layout for power users" },
  { id: "spacious", name: "Spacious", description: "Extra padding and breathing room" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Los_Angeles", "Europe/London",
  "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney",
  "Pacific/Auckland", "America/Sao_Paulo", "Africa/Johannesburg",
  "Asia/Dubai", "America/Chicago", "America/Denver", "Europe/Berlin",
];

/* ─── Tab Configuration ─── */

type TabConfig = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  description: string;
};

const TABS: TabConfig[] = [
  {
    id: "general",
    label: "General",
    icon: Monitor,
    category: "general",
    description: "Workspace name, timezone, and core behavior.",
  },
  {
    id: "branding",
    label: "Branding",
    icon: Image,
    category: "branding",
    description: "Logo, favicon, colors, and custom CSS.",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    category: "appearance",
    description: "Default theme, density, and layout preferences.",
  },
  {
    id: "authentication",
    label: "Authentication",
    icon: Fingerprint,
    category: "auth",
    description: "Sign-in methods, SSO, and session policies.",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    category: "security",
    description: "2FA, password rules, and audit logging.",
  },
  {
    id: "uploads",
    label: "Uploads",
    icon: Upload,
    category: "uploads",
    description: "File size limits, allowed types, and storage.",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    category: "notifications",
    description: "Push, in-app, and digest preferences.",
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
    category: "email",
    description: "SMTP, templates, and sender identity.",
  },
  {
    id: "api",
    label: "API",
    icon: FileJson,
    category: "api",
    description: "Rate limits, keys, and webhook endpoints.",
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    category: "integrations",
    description: "Third-party services and OAuth apps.",
  },
  {
    id: "localization",
    label: "Localization",
    icon: Languages,
    category: "localization",
    description: "Default language, date format, and currency.",
  },
  {
    id: "backups",
    label: "Backups",
    icon: Cloud,
    category: "backups",
    description: "Schedule, retention, and manual snapshots.",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    category: "analytics",
    description: "Tracking, reporting, and data retention.",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    category: "billing",
    description: "Plans, usage limits, and invoicing.",
  },
];

/* ─── Helpers ─── */

type SettingsByCategory = Record<string, SystemSetting[]>;

function isBooleanSetting(value: string): boolean {
  return value === "true" || value === "false";
}

function isNumberSetting(value: string): boolean {
  return value.trim() !== "" && !isNaN(Number(value));
}

function formatSettingKey(key: string): string {
  return key
    .replace(/[._-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferInputType(value: string): "text" | "number" | "boolean" | "textarea" | "url" | "email" | "select" | "multiselect" | "color" {
  if (isBooleanSetting(value)) return "boolean";
  if (isNumberSetting(value)) return "number";
  if (value.startsWith("#") && (value.length === 7 || value.length === 4)) return "color";
  if (value.includes(",")) return "multiselect";
  if (value.includes("@")) return "email";
  if (value.startsWith("http")) return "url";
  if (value.length > 120) return "textarea";
  if (["active", "inactive", "enabled", "disabled", "light", "dark", "system"].includes(value.toLowerCase())) return "select";
  return "text";
}

/* ─── Settings Change Tracking Hook ─── */

type SaveResult = {
  key: string;
  success: boolean;
  error?: string;
};

function useSettingsSection(settings: SystemSetting[]) {
  const updateSetting = useUpdateSystemSetting();

  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [currentValues, setCurrentValues] = useState<Record<string, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Sync with incoming settings data
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    setOriginalValues(map);
    setCurrentValues((prev) => {
      // Preserve any pending changes that haven't been saved
      const merged = { ...map };
      for (const [k, v] of Object.entries(prev)) {
        if (map[k] !== undefined && map[k] !== v) {
          merged[k] = v; // keep user's unsaved change
        }
      }
      return merged;
    });
    setSaveErrors({});
  }, [settings]);

  const changes = useMemo(() => {
    const result: Array<{ key: string; label: string; original: string; current: string; type: string }> = [];
    for (const [key, current] of Object.entries(currentValues)) {
      const orig = originalValues[key];
      if (orig !== undefined && orig !== current) {
        const setting = settings.find((s) => s.key === key);
        result.push({
          key,
          label: formatSettingKey(key),
          original: orig,
          current,
          type: setting?.category ?? "general",
        });
      }
    }
    return result;
  }, [currentValues, originalValues, settings]);

  const hasChanges = changes.length > 0;

  const updateValue = useCallback((key: string, value: string) => {
    setCurrentValues((prev) => ({ ...prev, [key]: value }));
    setSaveErrors((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
    setSavedKeys((prev) => {
      const n = new Set(prev);
      n.delete(key);
      return n;
    });
  }, []);

  const getValue = useCallback(
    (key: string, fallback = "") => {
      if (currentValues[key] !== undefined) return currentValues[key];
      const s = settings.find((x) => x.key === key);
      return s?.value ?? fallback;
    },
    [currentValues, settings]
  );

  const reset = useCallback(() => {
    setCurrentValues({ ...originalValues });
    setSaveErrors({});
    setSavedKeys(new Set());
  }, [originalValues]);

  const saveChanges = useCallback(
    async (changesToSave?: Array<{ key: string; value: string }>): Promise<SaveResult[]> => {
      const entries = changesToSave ?? changes.map((c) => ({ key: c.key, value: c.current }));
      if (entries.length === 0) return [];

      setIsSaving(true);
      setSaveErrors({});
      const results: SaveResult[] = [];
      const newOriginals = { ...originalValues };
      const newlySaved = new Set<string>();

      for (const { key, value } of entries) {
        try {
          await updateSetting.mutateAsync({ key, value });
          newOriginals[key] = value;
          newlySaved.add(key);
          results.push({ key, success: true });
        } catch (err: any) {
          const msg = err?.message ?? err?.response?.data?.message ?? "Save failed";
          results.push({ key, success: false, error: msg });
        }
      }

      setOriginalValues(newOriginals);
      setCurrentValues((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.success) {
            next[r.key] = newOriginals[r.key];
          }
        }
        return next;
      });
      setSavedKeys(newlySaved);
      setSaveErrors(
        results.reduce((acc, r) => {
          if (!r.success && r.error) acc[r.key] = r.error;
          return acc;
        }, {} as Record<string, string>)
      );
      setIsSaving(false);
      return results;
    },
    [changes, originalValues, updateSetting]
  );

  return {
    changes,
    hasChanges,
    isSaving: isSaving || updateSetting.isPending,
    updateValue,
    getValue,
    reset,
    saveChanges,
    saveErrors,
    savedKeys,
  };
}

/* ─── Confirmation Dialog ─── */

function SettingsConfirmDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
  onCancel,
  isSaving,
  saveErrors,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  changes: Array<{ key: string; label: string; original: string; current: string; type: string }>;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
  saveErrors: Record<string, string>;
}) {
  const hasErrors = Object.keys(saveErrors).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Diff className="size-5" />
            Review changes
          </DialogTitle>
          <DialogDescription className="text-sm">
            {hasErrors
              ? "Some settings could not be saved. Review the errors below."
              : `You are about to save ${changes.length} setting${changes.length !== 1 ? "s" : ""}. Review your changes before confirming.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {changes.map((change) => {
            const error = saveErrors[change.key];
            const isBoolean = change.original === "true" || change.original === "false";

            return (
              <div
                key={change.key}
                className={cn(
                  "rounded-lg border p-3 space-y-2",
                  error && "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{change.label}</span>
                  <Badge variant="outline" className="text-[9px]">
                    {change.type}
                  </Badge>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm">
                  <div className="rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground truncate">
                    {isBoolean ? (change.original === "true" ? "Enabled" : "Disabled") : change.original || "(empty)"}
                  </div>
                  <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                  <div className={cn(
                    "rounded px-2 py-1.5 text-xs font-medium truncate",
                    error
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      : "bg-primary/10 text-primary"
                  )}>
                    {isBoolean ? (change.current === "true" ? "Enabled" : "Disabled") : change.current || "(empty)"}
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            <Undo2 className="size-3.5 mr-1.5" />
            {hasErrors ? "Close" : "Cancel"}
          </Button>
          {!hasErrors && (
            <Button onClick={onConfirm} disabled={isSaving}>
              <Save className="size-3.5 mr-1.5" />
              {isSaving ? "Saving..." : `Save ${changes.length} change${changes.length !== 1 ? "s" : ""}`}
            </Button>
          )}
          {hasErrors && (
            <Button variant="outline" onClick={onConfirm} disabled={isSaving}>
              <RotateCcw className="size-3.5 mr-1.5" />
              Retry failed
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Route ─── */

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings · Vellum Admin" }] }),
  component: SettingsPage,
});

/* ─── Main Page ─── */

function SettingsPage() {
  const { data, isLoading } = useSystemSettings();
  const settingsByCategory = (data ?? {}) as SettingsByCategory;
  const [activeTab, setActiveTab] = useState("general");

  const activeTabConfig = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Manage workspace configuration and platform behavior."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Database className="size-3" />
              {Object.keys(settingsByCategory).length} categories
            </Badge>
          </div>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]"
      >
        {/* Sidebar Navigation */}
        <aside className="space-y-4">
          <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-0.5 bg-transparent p-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasSettings = (settingsByCategory[tab.category] ?? []).length > 0;

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    "justify-start text-left",
                    "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm",
                    "hover:bg-muted/50",
                    !isActive && "text-muted-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  />
                  <span className="flex-1">{tab.label}</span>
                  {hasSettings && (
                    <Badge
                      variant="secondary"
                      className="h-4 min-w-4 px-1 text-[10px] font-medium"
                    >
                      {(settingsByCategory[tab.category] ?? []).length}
                    </Badge>
                  )}
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 opacity-0 transition-opacity",
                      isActive && "opacity-100"
                    )}
                  />
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Quick Info Card */}
          <div className="rounded-lg border bg-card p-4 text-card-foreground">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              <Database className="size-3.5" />
              Workspace Info
            </div>
            <div className="space-y-2 text-sm">
              <InfoRow label="Name" value={(settingsByCategory["general"] ?? []).find((s) => s.key === "workspace.name")?.value ?? "Vellum Admin"} />
              <InfoRow label="Language" value={(settingsByCategory["general"] ?? []).find((s) => s.key === "workspace.language")?.value ?? "English"} />
              <InfoRow label="Timezone" value={(settingsByCategory["general"] ?? []).find((s) => s.key === "workspace.timezone")?.value ?? "UTC"} />
              <InfoRow label="Theme" value={(settingsByCategory["appearance"] ?? []).find((s) => s.key === "theme.default")?.value ?? "System"} />
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="min-w-0">
          {/* Tab Header */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold">{activeTabConfig.label}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTabConfig.description}
            </p>
          </div>

          {TABS.map((tab) => {
            const categorySettings = settingsByCategory[tab.category] ?? [];
            const hasSettings = categorySettings.length > 0;

            return (
              <TabsContent key={tab.id} value={tab.id} className="mt-0 space-y-6">
                {isLoading ? (
                  <SettingsSkeleton />
                ) : tab.id === "branding" ? (
                  <BrandingPanel settings={categorySettings} />
                ) : tab.id === "appearance" ? (
                  <AppearancePanel settings={categorySettings} />
                ) : tab.id === "security" ? (
                  <SecurityPanel settings={categorySettings} />
                ) : tab.id === "uploads" ? (
                  <UploadsPanel settings={categorySettings} />
                ) : tab.id === "localization" ? (
                  <LocalizationPanel settings={categorySettings} />
                ) : tab.id === "integrations" ? (
                  <IntegrationsPanel settings={categorySettings} />
                ) 
                : hasSettings ? (
                  <CategorySettingsPanel
                    category={tab.label}
                    settings={categorySettings}
                  />
                ) : (
                  <EmptyCategoryState label={tab.label} />
                )}

                {/* Danger Zone — only on General */}
                {tab.id === "general" && <DangerZone />}
              </TabsContent>
            );
          })}
        </main>
      </Tabs>
    </div>
  );
}

/* ─── Info Row ─── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-xs truncate max-w-[120px]">{value}</span>
    </div>
  );
}

/* ─── Branding Panel ─── */

function BrandingPanel({ settings }: { settings: SystemSetting[] }) {
  const section = useSettingsSection(settings);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showCSSPreview, setShowCSSPreview] = useState(false);

  const primary = section.getValue("branding.primary_color", "#d4653a");
  const secondary = section.getValue("branding.secondary_color", "#1a1a1a");
  const accent = section.getValue("branding.accent_color", "#f7f4ee");
  const logoUrl = section.getValue("branding.logo_url", "");
  const faviconUrl = section.getValue("branding.favicon_url", "");
  const customCSS = section.getValue("branding.custom_css", "/* Brand customizations */\n.brand-primary { color: #d4653a; }\n.brand-secondary { color: #1a1a1a; }");

  const currentPreset = COLOR_PRESETS.find(
    (p) => p.primary === primary && p.secondary === secondary && p.accent === accent
  );
  const selectedPreset = currentPreset?.name ?? "Custom";

  const applyPreset = (name: string) => {
    const p = COLOR_PRESETS.find((cp) => cp.name === name);
    if (p && name !== "Custom") {
      section.updateValue("branding.primary_color", p.primary);
      section.updateValue("branding.secondary_color", p.secondary);
      section.updateValue("branding.accent_color", p.accent);
    }
  };

  const handleSaveClick = () => {
    if (!section.hasChanges) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const results = await section.saveChanges();
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (successes.length > 0 && failures.length === 0) {
      toast.success(`Saved ${successes.length} branding setting${successes.length !== 1 ? "s" : ""}`);
      setConfirmOpen(false);
    } else if (successes.length > 0 && failures.length > 0) {
      toast.warning(`Saved ${successes.length}, ${failures.length} failed`);
    } else if (failures.length > 0) {
      toast.error(`Failed to save ${failures.length} setting${failures.length !== 1 ? "s" : ""}`);
    }
  };

  const handleReset = () => {
    section.reset();
    toast.info("Branding settings reset to last saved values");
  };

  return (
    <>
      <div className="space-y-6">
        {/* Color Palette Section */}
        <SectionCard
          title="Color palette"
          description="Choose a preset or define custom brand colors."
        >
          <div className="space-y-6">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.name)}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                    selectedPreset === preset.name
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex gap-0.5 rounded-lg overflow-hidden size-10">
                    <div className="flex-1" style={{ backgroundColor: preset.primary || "#ccc" }} />
                    <div className="flex-1" style={{ backgroundColor: preset.secondary || "#ccc" }} />
                    <div className="flex-1" style={{ backgroundColor: preset.accent || "#ccc" }} />
                  </div>
                  <span className="text-[10px] font-medium">{preset.name}</span>
                  {selectedPreset === preset.name && (
                    <div className="absolute -top-1 -right-1 size-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="size-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {selectedPreset === "Custom" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorInput
                  label="Primary"
                  value={primary}
                  onChange={(v) => section.updateValue("branding.primary_color", v)}
                />
                <ColorInput
                  label="Secondary"
                  value={secondary}
                  onChange={(v) => section.updateValue("branding.secondary_color", v)}
                />
                <ColorInput
                  label="Accent"
                  value={accent}
                  onChange={(v) => section.updateValue("branding.accent_color", v)}
                />
              </div>
            )}

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</span>
                <Badge variant="outline" className="text-[9px]">Live</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-10 px-4 rounded-md flex items-center text-sm font-medium text-white shadow-sm" style={{ backgroundColor: primary }}>Primary Button</div>
                <div className="h-10 px-4 rounded-md flex items-center text-sm font-medium text-white shadow-sm" style={{ backgroundColor: secondary }}>Secondary</div>
                <div className="h-10 px-4 rounded-md flex items-center text-sm font-medium border shadow-sm" style={{ backgroundColor: accent, borderColor: secondary, color: secondary }}>Accent Surface</div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Logo & assets" description="Upload your workspace logo and favicon.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logo URL</Label>
              <Input
                value={logoUrl}
                onChange={(e) => section.updateValue("branding.logo_url", e.target.value)}
                placeholder="https://cdn.example.com/logo.svg"
              />
              {logoUrl && (
                <div className="mt-2 p-3 rounded-lg border bg-muted/30 flex items-center justify-center h-16">
                  <img src={logoUrl} alt="Logo preview" className="max-h-full max-w-[120px] object-contain" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Favicon URL</Label>
              <Input
                value={faviconUrl}
                onChange={(e) => section.updateValue("branding.favicon_url", e.target.value)}
                placeholder="https://cdn.example.com/favicon.ico"
              />
              {faviconUrl && (
                <div className="mt-2 p-3 rounded-lg border bg-muted/30 flex items-center justify-center h-16">
                  <img src={faviconUrl} alt="Favicon preview" className="size-8 object-contain" />
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Custom CSS"
          description="Override styles with your own CSS. Changes apply instantly."
          action={
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowCSSPreview(!showCSSPreview)}>
              {showCSSPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showCSSPreview ? "Hide" : "Preview"}
            </Button>
          }
        >
          <div className="space-y-4">
            <textarea
              rows={8}
              value={customCSS}
              onChange={(e) => section.updateValue("branding.custom_css", e.target.value)}
              placeholder=":root { --custom-prop: #value; }"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {showCSSPreview && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Preview</div>
                <style dangerouslySetInnerHTML={{ __html: customCSS }} />
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="brand-primary text-sm font-medium">Brand Primary Text</div>
                    <div className="brand-secondary text-sm font-medium">Brand Secondary Text</div>
                  </div>
                  <button className="custom-button text-sm font-medium">Custom Button</button>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {section.hasChanges ? (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {section.changes.length} unsaved change{section.changes.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                All changes saved
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={section.isSaving || !section.hasChanges}>
              <RotateCcw className="size-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSaveClick} disabled={section.isSaving || !section.hasChanges}>
              <Save className="size-4 mr-2" />
              {section.isSaving ? "Saving..." : "Save Branding"}
            </Button>
          </div>
        </div>
      </div>

      <SettingsConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={section.changes}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
        isSaving={section.isSaving}
        saveErrors={section.saveErrors}
      />
    </>
  );
}

/* ─── Color Input Component ─── */

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <div
          className="size-8 rounded-md border shrink-0"
          style={{ backgroundColor: value || "#ccc" }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

/* ─── Appearance Panel ─── */

function AppearancePanel({ settings }: { settings: SystemSetting[] }) {
  const section = useSettingsSection(settings);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const theme = section.getValue("theme.default", "system");
  const density = section.getValue("theme.density", "comfortable");
  const layout = section.getValue("theme.layout", "default");
  const selectedFont = section.getValue("theme.font_family", "inter");
  const animations = section.getValue("theme.animations", "true") === "true";
  const reducedMotion = section.getValue("theme.reduced_motion", "false") === "true";
  const currentFont = BRAND_FONTS.find((f) => f.id === selectedFont);

  const handleSaveClick = () => {
    if (!section.hasChanges) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const results = await section.saveChanges();
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (successes.length > 0 && failures.length === 0) {
      toast.success(`Saved ${successes.length} appearance setting${successes.length !== 1 ? "s" : ""}`);
      setConfirmOpen(false);
    } else if (successes.length > 0 && failures.length > 0) {
      toast.warning(`Saved ${successes.length}, ${failures.length} failed`);
    } else if (failures.length > 0) {
      toast.error(`Failed to save ${failures.length} setting${failures.length !== 1 ? "s" : ""}`);
    }
  };

  const handleReset = () => {
    section.reset();
    toast.info("Appearance settings reset to last saved values");
  };

  return (
    <>
      <div className="space-y-6">
        <SectionCard title="Interface Options" description="Additional interface preferences.">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg p-2 hover:bg-accent/30 transition-colors">
              <div>
                <div className="text-sm font-medium">Enable animations</div>
                <div className="text-xs text-muted-foreground">Smooth transitions and animations</div>
              </div>
              <Switch
                checked={animations}
                onCheckedChange={(v) => section.updateValue("theme.animations", v ? "true" : "false")}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg p-2 hover:bg-accent/30 transition-colors">
              <div>
                <div className="text-sm font-medium">Reduced motion</div>
                <div className="text-xs text-muted-foreground">Minimize animations for accessibility</div>
              </div>
              <Switch
                checked={reducedMotion}
                onCheckedChange={(v) => section.updateValue("theme.reduced_motion", v ? "true" : "false")}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Theme" description="Choose the default appearance for all users.">
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: MonitorSmartphone },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => section.updateValue("theme.default", t.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                    theme === t.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <Icon className={cn("size-6", theme === t.id ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Density" description="Control the spacing and compactness of the interface.">
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "compact", label: "Compact", desc: "Tight spacing" },
              { id: "comfortable", label: "Comfortable", desc: "Balanced" },
              { id: "spacious", label: "Spacious", desc: "Relaxed" },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => section.updateValue("theme.density", d.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all",
                  density === d.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                )}
              >
                <LayoutTemplate className={cn("size-5 mb-1", density === d.id ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium">{d.label}</span>
                <span className="text-[11px] text-muted-foreground">{d.desc}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Layout" description="Control the layout of the interface.">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Layout</Label>
              <div className="grid grid-cols-3 gap-3">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => section.updateValue("theme.layout", l.id)}
                    className={cn(
                      "rounded-lg border-2 p-3 text-left transition-all",
                      layout === l.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                    )}
                  >
                    <div className="text-sm font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{l.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Typography" description="Select the default typeface.">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary Font</Label>
                <Select value={selectedFont} onValueChange={(v) => section.updateValue("theme.font_family", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAND_FONTS.map((font) => (
                      <SelectItem key={font.id} value={font.id}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: font.family }}>{font.name}</span>
                          <Badge variant="outline" className="text-[9px]">{font.category}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-medium" style={{ fontFamily: currentFont?.family }}>
                The quick brown fox jumps over the lazy dog.
              </p>
              <p className="text-sm text-muted-foreground mt-2">Preview of {currentFont?.name ?? selectedFont} at 24px.</p>
            </div>
          </div>
        </SectionCard>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {section.hasChanges ? (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {section.changes.length} unsaved change{section.changes.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                All changes saved
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={section.isSaving || !section.hasChanges}>
              <RotateCcw className="size-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSaveClick} disabled={section.isSaving || !section.hasChanges}>
              <Save className="size-4 mr-2" />
              {section.isSaving ? "Saving..." : "Save Appearance"}
            </Button>
          </div>
        </div>
      </div>

      <SettingsConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={section.changes}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
        isSaving={section.isSaving}
        saveErrors={section.saveErrors}
      />
    </>
  );
}

/* ─── Security Panel ─── */

function SecurityPanel({ settings }: { settings: SystemSetting[] }) {
  const section = useSettingsSection(settings);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newIp, setNewIp] = useState("");

  const passwordMinLength = section.getValue("security.min_password_length", "8");
  const sessionTimeout = section.getValue("auth.session_timeout", "3600");
  const allowedIpsRaw = section.getValue("security.allowed_ips", "");
  const allowedIps = allowedIpsRaw ? allowedIpsRaw.split(",").filter(Boolean) : [];

  const addIp = () => {
    if (newIp && !allowedIps.includes(newIp)) {
      const updated = [...allowedIps, newIp];
      section.updateValue("security.allowed_ips", updated.join(","));
      setNewIp("");
    }
  };

  const removeIp = (ip: string) => {
    const updated = allowedIps.filter((i) => i !== ip);
    section.updateValue("security.allowed_ips", updated.join(","));
  };

  const handleSaveClick = () => {
    if (!section.hasChanges) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const results = await section.saveChanges();
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (successes.length > 0 && failures.length === 0) {
      toast.success(`Saved ${successes.length} security setting${successes.length !== 1 ? "s" : ""}`);
      setConfirmOpen(false);
    } else if (successes.length > 0 && failures.length > 0) {
      toast.warning(`Saved ${successes.length}, ${failures.length} failed`);
    } else if (failures.length > 0) {
      toast.error(`Failed to save ${failures.length} setting${failures.length !== 1 ? "s" : ""}`);
    }
  };

  const handleReset = () => {
    section.reset();
    setNewIp("");
    toast.info("Security settings reset to last saved values");
  };

  return (
    <>
      <div className="space-y-6">
        <SectionCard title="Password policy" description="Configure minimum requirements for user passwords.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Minimum length</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={passwordMinLength}
                  onChange={(e) => section.updateValue("security.min_password_length", e.target.value)}
                  min={6}
                  max={128}
                />
                <span className="text-sm text-muted-foreground shrink-0">characters</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session timeout</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) => section.updateValue("auth.session_timeout", e.target.value)}
                  min={60}
                  max={86400}
                />
                <span className="text-sm text-muted-foreground shrink-0">seconds</span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="IP allowlist" description="Restrict access to specific IP addresses. Leave empty to allow all.">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                placeholder="192.168.1.1 or 10.0.0.0/8"
                onKeyDown={(e) => e.key === "Enter" && addIp()}
              />
              <Button variant="outline" size="sm" onClick={addIp}>
                <Plus className="size-4" />
              </Button>
            </div>
            {allowedIps.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {allowedIps.map((ip) => (
                  <Badge key={ip} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                    {ip}
                    <button onClick={() => removeIp(ip)} className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5">
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No IP restrictions configured.</p>
            )}
          </div>
        </SectionCard>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {section.hasChanges ? (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {section.changes.length} unsaved change{section.changes.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                All changes saved
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={section.isSaving || !section.hasChanges}>
              <RotateCcw className="size-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSaveClick} disabled={section.isSaving || !section.hasChanges}>
              <Save className="size-4 mr-2" />
              {section.isSaving ? "Saving..." : "Save Security"}
            </Button>
          </div>
        </div>
      </div>

      <SettingsConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={section.changes}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
        isSaving={section.isSaving}
        saveErrors={section.saveErrors}
      />
    </>
  );
}

/* ─── Uploads Panel ─── */

function UploadsPanel({ settings }: { settings: SystemSetting[] }) {
  const section = useSettingsSection(settings);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newMimeType, setNewMimeType] = useState("");

  // Get values from settings
  const maxFileSize = section.getValue("uploads.max_file_size", "52428800");
  const maxStoragePerUser = section.getValue("uploads.max_storage_per_user", "1073741824");
  const imageMaxDimensions = section.getValue("uploads.image_max_dimensions", "4096");
  const storageProvider = section.getValue("uploads.storage_provider", "local");
  const allowedMimeTypesRaw = section.getValue("uploads.allowed_mime_types", "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,application/pdf");
  const allowedMimeTypes = allowedMimeTypesRaw ? allowedMimeTypesRaw.split(",").filter(Boolean) : [];

  // Common MIME types with icons
  const commonMimeTypes = [
    { value: "image/jpeg", label: "JPEG", icon: FileImage, group: "Images" },
    { value: "image/png", label: "PNG", icon: FileImage, group: "Images" },
    { value: "image/gif", label: "GIF", icon: FileImage, group: "Images" },
    { value: "image/webp", label: "WEBP", icon: FileImage, group: "Images" },
    { value: "image/svg+xml", label: "SVG", icon: FileImage, group: "Images" },
    { value: "image/bmp", label: "BMP", icon: FileImage, group: "Images" },
    { value: "video/mp4", label: "MP4", icon: FileVideo, group: "Videos" },
    { value: "video/webm", label: "WEBM", icon: FileVideo, group: "Videos" },
    { value: "video/quicktime", label: "MOV", icon: FileVideo, group: "Videos" },
    { value: "video/avi", label: "AVI", icon: FileVideo, group: "Videos" },
    { value: "audio/mpeg", label: "MP3", icon: FileAudio, group: "Audio" },
    { value: "audio/wav", label: "WAV", icon: FileAudio, group: "Audio" },
    { value: "audio/ogg", label: "OGG", icon: FileAudio, group: "Audio" },
    { value: "application/pdf", label: "PDF", icon: FileText, group: "Documents" },
    { value: "application/msword", label: "DOC", icon: FileText, group: "Documents" },
    { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "DOCX", icon: FileText, group: "Documents" },
    { value: "application/vnd.ms-excel", label: "XLS", icon: FileText, group: "Documents" },
    { value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "XLSX", icon: FileText, group: "Documents" },
    { value: "application/vnd.ms-powerpoint", label: "PPT", icon: FileText, group: "Documents" },
    { value: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PPTX", icon: FileText, group: "Documents" },
    { value: "application/zip", label: "ZIP", icon: FileArchive, group: "Archives" },
    { value: "application/x-rar-compressed", label: "RAR", icon: FileArchive, group: "Archives" },
    { value: "application/x-7z-compressed", label: "7Z", icon: FileArchive, group: "Archives" },
  ];

  const toggleMimeType = (value: string) => {
    const newTypes = allowedMimeTypes.includes(value)
      ? allowedMimeTypes.filter((t) => t !== value)
      : [...allowedMimeTypes, value];
    section.updateValue("uploads.allowed_mime_types", newTypes.join(","));
  };

  const addCustomMimeType = () => {
    if (newMimeType && !allowedMimeTypes.includes(newMimeType)) {
      const newTypes = [...allowedMimeTypes, newMimeType];
      section.updateValue("uploads.allowed_mime_types", newTypes.join(","));
      setNewMimeType("");
    }
  };

  const removeMimeType = (value: string) => {
    const newTypes = allowedMimeTypes.filter((t) => t !== value);
    section.updateValue("uploads.allowed_mime_types", newTypes.join(","));
  };

  // Format bytes to human readable
  const formatBytes = (bytes: string) => {
    const num = parseInt(bytes);
    if (isNaN(num)) return bytes;
    if (num === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleSaveClick = () => {
    if (!section.hasChanges) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const results = await section.saveChanges();
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (successes.length > 0 && failures.length === 0) {
      toast.success(`Saved ${successes.length} upload setting${successes.length !== 1 ? "s" : ""}`);
      setConfirmOpen(false);
    } else if (successes.length > 0 && failures.length > 0) {
      toast.warning(`Saved ${successes.length}, ${failures.length} failed`);
    } else if (failures.length > 0) {
      toast.error(`Failed to save ${failures.length} setting${failures.length !== 1 ? "s" : ""}`);
    }
  };

  const handleReset = () => {
    section.reset();
    setNewMimeType("");
    toast.info("Uploads settings reset to last saved values");
  };

  return (
    <>
      <div className="space-y-6">
        {/* Storage Provider */}
        <SectionCard
          title="Storage provider"
          description="Select where your files will be stored."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "local", label: "Local", icon: Database, description: "Local filesystem" },
                { id: "s3", label: "S3", icon: Cloud, description: "Amazon S3" },
                { id: "cloudinary", label: "Cloudinary", icon: Image, description: "Cloudinary CDN" },
              ].map((provider) => {
                const Icon = provider.icon;
                const isSelected = storageProvider === provider.id;
                return (
                  <button
                    key={provider.id}
                    onClick={() => section.updateValue("uploads.storage_provider", provider.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <Icon className={cn("size-6", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{provider.label}</span>
                    <span className="text-[11px] text-muted-foreground text-center">{provider.description}</span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 size-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="size-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Storage provider: local, s3, or cloudinary
            </p>
          </div>
        </SectionCard>

        {/* File Size Limits */}
        <SectionCard
          title="File size limits"
          description="Configure maximum file sizes for uploads."
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Max File Size
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={maxFileSize}
                    onChange={(e) => section.updateValue("uploads.max_file_size", e.target.value)}
                    min={1}
                    max={1073741824}
                    className="font-mono"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">bytes</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(maxFileSize)} — Max file size in bytes, default 50MB
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Max Storage Per User
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={maxStoragePerUser}
                    onChange={(e) => section.updateValue("uploads.max_storage_per_user", e.target.value)}
                    min={1}
                    max={10737418240}
                    className="font-mono"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">bytes</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(maxStoragePerUser)} — Max storage per user in bytes, default 1GB
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Image Max Dimensions
              </Label>
              <div className="flex items-center gap-2 max-w-[200px]">
                <Input
                  type="number"
                  value={imageMaxDimensions}
                  onChange={(e) => section.updateValue("uploads.image_max_dimensions", e.target.value)}
                  min={100}
                  max={16384}
                  className="font-mono"
                />
                <span className="text-sm text-muted-foreground shrink-0">pixels</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Max image dimension in pixels
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Allowed MIME Types */}
        <SectionCard
          title="Allowed MIME types"
          description="Select which file types can be uploaded."
        >
          <div className="space-y-4">
            {/* Grouped MIME types */}
            {["Images", "Videos", "Audio", "Documents", "Archives"].map((group) => {
              const types = commonMimeTypes.filter((t) => t.group === group);
              const selectedCount = types.filter((t) => allowedMimeTypes.includes(t.value)).length;

              return (
                <div key={group} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {group}
                    </span>
                    <Badge variant="secondary" className="text-[9px]">
                      {selectedCount}/{types.length}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {types.map((type) => {
                      const isSelected = allowedMimeTypes.includes(type.value);
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          onClick={() => toggleMimeType(type.value)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs transition-all",
                            isSelected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                          )}
                        >
                          <Icon className={cn("size-3.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Custom MIME type input */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Add Custom MIME Type
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newMimeType}
                  onChange={(e) => setNewMimeType(e.target.value)}
                  placeholder="application/json"
                  className="font-mono text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addCustomMimeType()}
                />
                <Button variant="outline" size="sm" onClick={addCustomMimeType}>
                  <Plus className="size-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Current allowed MIME types */}
            {allowedMimeTypes.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Allowed Types ({allowedMimeTypes.length})
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm("Remove all allowed MIME types?")) {
                        section.updateValue("uploads.allowed_mime_types", "");
                      }
                    }}
                  >
                    <X className="size-3 mr-1" />
                    Clear all
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allowedMimeTypes.map((mime) => {
                    const matched = commonMimeTypes.find((t) => t.value === mime);
                    return (
                      <Badge
                        key={mime}
                        variant="secondary"
                        className="gap-1 pl-2 pr-1 py-1 font-mono text-[10px]"
                      >
                        {matched ? matched.label : mime}
                        <button
                          onClick={() => removeMimeType(mime)}
                          className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                        >
                          <X className="size-2.5" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              {allowedMimeTypes.length} MIME types currently allowed.
              {allowedMimeTypes.length === 0 && " No types selected. Users won't be able to upload files."}
            </p>
          </div>
        </SectionCard>

        {/* Footer Actions */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {section.hasChanges ? (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {section.changes.length} unsaved change{section.changes.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                All changes saved
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={section.isSaving || !section.hasChanges}>
              <RotateCcw className="size-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSaveClick} disabled={section.isSaving || !section.hasChanges}>
              <Save className="size-4 mr-2" />
              {section.isSaving ? "Saving..." : "Save Uploads"}
            </Button>
          </div>
        </div>
      </div>

      <SettingsConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={section.changes}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
        isSaving={section.isSaving}
        saveErrors={section.saveErrors}
      />
    </>
  );
}

/* ─── Localization Panel ─── */

function LocalizationPanel({ settings }: { settings: SystemSetting[] }) {
  const section = useSettingsSection(settings);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const defaultLanguage = section.getValue("localization.default_language", "en");
  const supportedLanguagesRaw = section.getValue("localization.supported_languages", "en,es,fr,de,ja");
  const supportedLanguages = supportedLanguagesRaw ? supportedLanguagesRaw.split(",").filter(Boolean) : [];
  const dateFormat = section.getValue("localization.date_format", "MM/DD/YYYY");
  const timeFormat = section.getValue("localization.time_format", "12h");
  const currency = section.getValue("localization.currency", "USD");

  const toggleLanguage = (code: string) => {
    const newLanguages = supportedLanguages.includes(code)
      ? supportedLanguages.filter((l) => l !== code)
      : [...supportedLanguages, code];
    section.updateValue("localization.supported_languages", newLanguages.join(","));
  };

  const handleSaveClick = () => {
    if (!section.hasChanges) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const results = await section.saveChanges();
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (successes.length > 0 && failures.length === 0) {
      toast.success(`Saved ${successes.length} localization setting${successes.length !== 1 ? "s" : ""}`);
      setConfirmOpen(false);
    } else if (successes.length > 0 && failures.length > 0) {
      toast.warning(`Saved ${successes.length}, ${failures.length} failed`);
    } else if (failures.length > 0) {
      toast.error(`Failed to save ${failures.length} setting${failures.length !== 1 ? "s" : ""}`);
    }
  };

  const handleReset = () => {
    section.reset();
    toast.info("Localization settings reset to last saved values");
  };

  return (
    <>
      <div className="space-y-6">
        <SectionCard
          title="Localization settings"
          description="Configure language, date format, and regional preferences."
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Default Language
                </Label>
                <Select value={defaultLanguage} onValueChange={(v) => section.updateValue("localization.default_language", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Currency
                </Label>
                <Select value={currency} onValueChange={(v) => section.updateValue("localization.currency", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                    <SelectItem value="CAD">CAD (C$)</SelectItem>
                    <SelectItem value="AUD">AUD (A$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date Format
                </Label>
                <Select value={dateFormat} onValueChange={(v) => section.updateValue("localization.date_format", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="MMMM D, YYYY">MMMM D, YYYY</SelectItem>
                    <SelectItem value="D MMMM YYYY">D MMMM YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Time Format
                </Label>
                <Select value={timeFormat} onValueChange={(v) => section.updateValue("localization.time_format", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                    <SelectItem value="24h">24-hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Supported Languages
                </Label>
                <Badge variant="secondary" className="text-[10px]">
                  {supportedLanguages.length} selected
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <Badge
                    key={lang.code}
                    variant={supportedLanguages.includes(lang.code) ? "default" : "outline"}
                    className="cursor-pointer gap-1 px-3 py-1.5 text-xs"
                    onClick={() => toggleLanguage(lang.code)}
                  >
                    {supportedLanguages.includes(lang.code) && (
                      <Check className="size-3" />
                    )}
                    {lang.name}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Click to toggle languages. {supportedLanguages.length} languages currently supported.
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {section.hasChanges ? (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {section.changes.length} unsaved change{section.changes.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                All changes saved
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={section.isSaving || !section.hasChanges}>
              <RotateCcw className="size-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSaveClick} disabled={section.isSaving || !section.hasChanges}>
              <Save className="size-4 mr-2" />
              {section.isSaving ? "Saving..." : "Save Localization"}
            </Button>
          </div>
        </div>
      </div>

      <SettingsConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={section.changes}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
        isSaving={section.isSaving}
        saveErrors={section.saveErrors}
      />
    </>
  );
}

/* ─── Integrations Panel ─── */

function IntegrationsPanel({ settings }: { settings: SystemSetting[] }) {
  const section = useSettingsSection(settings);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeIntegration, setActiveIntegration] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: 'success' | 'error' | 'testing' | null; message?: string }>>({});

  // Get values from settings
  const googleAnalyticsId = section.getValue("integrations.google_analytics_id", "");
  const slackWebhook = section.getValue("integrations.slack_webhook", "");
  const sentryDsn = section.getValue("integrations.sentry_dsn", "");
  const stripeKey = section.getValue("integrations.stripe_key", "");
  const analyticsEnabled = section.getValue("integrations.analytics_enabled", "false") === "true";

  // Define integration configurations
  const integrations = [
    {
      id: "google_analytics",
      name: "Google Analytics",
      icon: BarChart3,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      description: "Track user behavior and engagement metrics",
      fields: [
        {
          key: "integrations.google_analytics_id",
          label: "Tracking ID",
          value: googleAnalyticsId,
          placeholder: "UA-XXXXXXXX-X or G-XXXXXXXX",
          type: "text",
          hint: "Google Analytics tracking ID",
        },
      ],
      enabled: analyticsEnabled,
    },
    {
      id: "slack",
      name: "Slack",
      icon: MessageSquare,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      description: "Receive notifications and alerts in your Slack workspace",
      fields: [
        {
          key: "integrations.slack_webhook",
          label: "Webhook URL",
          value: slackWebhook,
          placeholder: "https://hooks.slack.com/services/...",
          type: "url",
          hint: "Slack webhook URL for notifications",
        },
      ],
      enabled: true,
    },
    {
      id: "sentry",
      name: "Sentry",
      icon: AlertTriangle,
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      description: "Monitor errors and performance issues in real-time",
      fields: [
        {
          key: "integrations.sentry_dsn",
          label: "DSN",
          value: sentryDsn,
          placeholder: "https://...@sentry.io/...",
          type: "url",
          hint: "Sentry DSN for error tracking",
        },
      ],
      enabled: true,
    },
    {
      id: "stripe",
      name: "Stripe",
      icon: CreditCard,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      description: "Process payments and manage subscriptions",
      fields: [
        {
          key: "integrations.stripe_key",
          label: "API Key",
          value: stripeKey,
          placeholder: "sk_live_... or sk_test_...",
          type: "password",
          hint: "Stripe API key for payments",
        },
      ],
      enabled: true,
    },
  ];

  const handleTestIntegration = async (integrationId: string) => {
    setTestResults((prev) => ({ ...prev, [integrationId]: { status: 'testing' } }));

    // Simulate testing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Random success/error for demo
    const success = Math.random() > 0.3;
    setTestResults((prev) => ({
      ...prev,
      [integrationId]: {
        status: success ? 'success' : 'error',
        message: success 
          ? 'Connection successful' 
          : 'Failed to connect. Please check your credentials.',
      },
    }));

    if (success) {
      toast.success(`${integrationId} connected successfully`);
    } else {
      toast.error(`Failed to connect ${integrationId}`);
    }
  };

  const handleSaveClick = () => {
    if (!section.hasChanges) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const results = await section.saveChanges();
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (successes.length > 0 && failures.length === 0) {
      toast.success(`Saved ${successes.length} integration setting${successes.length !== 1 ? "s" : ""}`);
      setConfirmOpen(false);
    } else if (successes.length > 0 && failures.length > 0) {
      toast.warning(`Saved ${successes.length}, ${failures.length} failed`);
    } else if (failures.length > 0) {
      toast.error(`Failed to save ${failures.length} setting${failures.length !== 1 ? "s" : ""}`);
    }
  };

  const handleReset = () => {
    section.reset();
    setTestResults({});
    toast.info("Integrations settings reset to last saved values");
  };

  const hasLocalChange = (key: string) => section.changes.some((c) => c.key === key);

  return (
    <>
      <div className="space-y-6">
        {/* Enable Analytics */}
        <SectionCard
          title="Analytics"
          description="Enable or disable analytics tracking across the platform."
        >
          <div className="flex items-center justify-between rounded-lg px-3 py-3">
            <div className="space-y-0.5 pr-4">
              <div className="text-sm font-medium">Analytics Enabled</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Enable analytics tracking
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={analyticsEnabled}
                onCheckedChange={(v) => section.updateValue("integrations.analytics_enabled", v ? "true" : "false")}
              />
            </div>
          </div>
        </SectionCard>

        {/* Integration Cards */}
        <div className="space-y-4">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            const isExpanded = activeIntegration === integration.id;
            const testResult = testResults[integration.id];
            const hasUnsavedChanges = integration.fields.some((field) => 
              hasLocalChange(field.key)
            );

            return (
              <div
                key={integration.id}
                className={cn(
                  "rounded-xl border transition-all",
                  hasUnsavedChanges && "border-primary/30 shadow-sm",
                  isExpanded && "shadow-md"
                )}
              >
                {/* Integration Header */}
                <div
                  className={cn(
                    "flex items-center gap-4 p-4 cursor-pointer transition-colors",
                    isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                  )}
                  onClick={() => setActiveIntegration(isExpanded ? null : integration.id)}
                >
                  <div className={cn(
                    "size-10 rounded-lg flex items-center justify-center border shrink-0",
                    integration.color
                  )}>
                    <Icon className="size-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{integration.name}</span>
                      {hasUnsavedChanges && (
                        <Badge variant="outline" className="text-[9px] border-amber-500/50 text-amber-600">
                          Unsaved
                        </Badge>
                      )}
                      {testResult?.status === 'success' && (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/50 text-emerald-600">
                          <Check className="size-2.5 mr-0.5" />
                          Connected
                        </Badge>
                      )}
                      {testResult?.status === 'error' && (
                        <Badge variant="outline" className="text-[9px] border-rose-500/50 text-rose-600">
                          <X className="size-2.5 mr-0.5" />
                          Failed
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {integration.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {integration.fields.some((f) => f.value) && (
                      <Badge variant="secondary" className="text-[9px]">
                        Configured
                      </Badge>
                    )}
                    <ChevronRight className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-90"
                    )} />
                  </div>
                </div>

                {/* Integration Fields */}
                {isExpanded && (
                  <div className="border-t p-4 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Configure your {integration.name} integration. Fill in the fields below to connect.
                    </p>

                    {integration.fields.map((field) => {
                      const isFieldChanged = hasLocalChange(field.key);
                      const isSaved = section.savedKeys.has(field.key);

                      return (
                        <div key={field.key} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-medium">
                              {field.label}
                            </Label>
                            {isSaved && !isFieldChanged && (
                              <Badge
                                variant="outline"
                                className="h-3.5 px-1 text-[9px] font-medium text-emerald-600 border-emerald-200 bg-emerald-50"
                              >
                                <Check className="size-2.5 mr-0.5" />
                                Saved
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type={field.type}
                              value={field.value}
                              onChange={(e) => section.updateValue(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className={cn(
                                "flex-1",
                                isFieldChanged && "border-primary/50 ring-1 ring-primary/20"
                              )}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestIntegration(integration.id)}
                              disabled={!field.value || testResult?.status === 'testing'}
                              className="shrink-0 gap-1.5"
                            >
                              {testResult?.status === 'testing' ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : testResult?.status === 'success' ? (
                                <Check className="size-3.5 text-emerald-500" />
                              ) : testResult?.status === 'error' ? (
                                <X className="size-3.5 text-rose-500" />
                              ) : (
                                <Zap className="size-3.5" />
                              )}
                              Test
                            </Button>
                          </div>
                          {field.hint && (
                            <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                          )}
                          {testResult?.status === 'error' && testResult.message && (
                            <p className="text-[11px] text-rose-500 flex items-center gap-1">
                              <AlertCircle className="size-3" />
                              {testResult.message}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveIntegration(null)}
                      >
                        Collapse
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {section.hasChanges ? (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {section.changes.length} unsaved change{section.changes.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                All changes saved
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={section.isSaving || !section.hasChanges}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSaveClick}
              disabled={section.isSaving || !section.hasChanges}
              className="gap-1.5"
            >
              <Save className="size-3.5" />
              {section.isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      <SettingsConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={section.changes}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
        isSaving={section.isSaving}
        saveErrors={section.saveErrors}
      />
    </>
  );
}

/* ─── Category Settings Panel ─── */

function CategorySettingsPanel({
  category,
  settings,
}: {
  category: string;
  settings: SystemSetting[];
}) {
  const section = useSettingsSection(settings);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSaveClick = () => {
    if (!section.hasChanges) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const results = await section.saveChanges();
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (successes.length > 0 && failures.length === 0) {
      toast.success(`Saved ${successes.length} setting${successes.length !== 1 ? "s" : ""}`);
      setConfirmOpen(false);
    } else if (successes.length > 0 && failures.length > 0) {
      toast.warning(`Saved ${successes.length}, ${failures.length} failed`);
    } else if (failures.length > 0) {
      toast.error(`Failed to save ${failures.length} setting${failures.length !== 1 ? "s" : ""}`);
    }
  };

  const handleCancel = () => {
    setConfirmOpen(false);
  };

  const handleReset = () => {
    section.reset();
    toast.info("Changes reset to last saved values");
  };

  // Check if this is the general category
  const isGeneralCategory = category === "General";

  // Filter out duplicate workspace settings - keep only the most relevant ones
  const getFilteredSettings = useMemo(() => {
    if (!isGeneralCategory) return settings;

    // Define which workspace keys to keep (prefer shorter, more specific keys)
    const workspacePriority: Record<string, number> = {
      "workspace.name": 1,
      "workspace.language": 1,
      "workspace.timezone": 1,
      "workspace.url": 1,
      "workspace.description": 1,
      "workspace.maintenance_message": 1,
    };

    // Group settings by their base key (without prefixes)
    const groupedByBaseKey: Record<string, SystemSetting[]> = {};
    
    settings.forEach((setting) => {
      // Extract the base key (e.g., "timezone" from "workspace.timezone")
      const parts = setting.key.split(".");
      const baseKey = parts.length > 1 ? parts.slice(1).join(".") : setting.key;
      
      if (!groupedByBaseKey[baseKey]) {
        groupedByBaseKey[baseKey] = [];
      }
      groupedByBaseKey[baseKey].push(setting);
    });

    // For each group, keep the setting with the highest priority or the shortest key
    const filtered: SystemSetting[] = [];
    
    Object.values(groupedByBaseKey).forEach((group) => {
      if (group.length === 1) {
        filtered.push(group[0]);
      } else {
        // Sort by key length (shorter is better) and then by priority
        const sorted = group.sort((a, b) => {
          // Prefer workspace.* keys over others
          const aIsWorkspace = a.key.startsWith("workspace.");
          const bIsWorkspace = b.key.startsWith("workspace.");
          if (aIsWorkspace && !bIsWorkspace) return -1;
          if (!aIsWorkspace && bIsWorkspace) return 1;
          
          // Then by key length
          return a.key.length - b.key.length;
        });
        filtered.push(sorted[0]);
      }
    });

    return filtered;
  }, [settings, isGeneralCategory]);

  // Group by inferred input type using filtered settings
  const grouped = getFilteredSettings.reduce(
    (acc, s) => {
      const type = inferInputType(section.getValue(s.key, s.value));
      acc[type].push(s);
      return acc;
    },
    {
      text: [] as SystemSetting[],
      number: [] as SystemSetting[],
      boolean: [] as SystemSetting[],
      textarea: [] as SystemSetting[],
      url: [] as SystemSetting[],
      email: [] as SystemSetting[],
      select: [] as SystemSetting[],
      multiselect: [] as SystemSetting[],
      color: [] as SystemSetting[],
    }
  );

  const hasLocalChange = (key: string) => section.changes.some((c) => c.key === key);

  // Get workspace-specific settings for display
  const workspaceLanguage = section.getValue("workspace.language", "en");
  const workspaceTimezone = section.getValue("workspace.timezone", "UTC");
  const workspaceName = section.getValue("workspace.name", "Vellum Dev Space");
  const workspaceDescription = section.getValue("workspace.description", "");
  const workspaceUrl = section.getValue("workspace.url", "");
  const maintenanceMessage = section.getValue("workspace.maintenance_message", "");
  const maintenanceMode = section.getValue("maintenance.mode", "false");

  return (
    <>
      <SectionCard
        title={`${category} configuration`}
        description="Edit values below. Changes are staged until you save."
      >
        <div className="space-y-6">
          {/* Workspace-specific settings for General category */}
          {isGeneralCategory && (
            <>
              {/* Workspace Name and Description */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Workspace Name"
                  hint="The name of your workspace"
                  saved={section.savedKeys.has("workspace.name")}
                >
                  <Input
                    value={workspaceName}
                    onChange={(e) => section.updateValue("workspace.name", e.target.value)}
                    placeholder="Enter workspace name"
                    className={cn(
                      section.changes.some((c) => c.key === "workspace.name") && 
                      "border-primary/50 ring-1 ring-primary/20"
                    )}
                  />
                </Field>
                <Field
                  label="Workspace URL"
                  hint="The canonical URL of your workspace"
                  saved={section.savedKeys.has("workspace.url")}
                >
                  <Input
                    value={workspaceUrl}
                    onChange={(e) => section.updateValue("workspace.url", e.target.value)}
                    placeholder="https://example.com"
                    className={cn(
                      section.changes.some((c) => c.key === "workspace.url") && 
                      "border-primary/50 ring-1 ring-primary/20"
                    )}
                  />
                </Field>
              </div>

              {/* Workspace Description */}
              <Field
                label="Workspace Description"
                hint="A brief description of your workspace"
                saved={section.savedKeys.has("workspace.description")}
                className="sm:col-span-2"
              >
                <textarea
                  value={workspaceDescription}
                  onChange={(e) => section.updateValue("workspace.description", e.target.value)}
                  rows={2}
                  placeholder="Describe your workspace..."
                  className={cn(
                    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    section.changes.some((c) => c.key === "workspace.description") && 
                    "border-primary/50 ring-1 ring-primary/20"
                  )}
                />
              </Field>

              {/* Language and Timezone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Workspace Language"
                  hint="Default language for the workspace"
                  saved={section.savedKeys.has("workspace.language")}
                >
                  <Select
                    value={workspaceLanguage}
                    onValueChange={(v) => section.updateValue("workspace.language", v)}
                  >
                    <SelectTrigger className={cn(
                      section.changes.some((c) => c.key === "workspace.language") && 
                      "border-primary/50 ring-1 ring-primary/20"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Workspace Timezone"
                  hint="Default timezone for the workspace"
                  saved={section.savedKeys.has("workspace.timezone")}
                >
                  <Select
                    value={workspaceTimezone}
                    onValueChange={(v) => section.updateValue("workspace.timezone", v)}
                  >
                    <SelectTrigger className={cn(
                      section.changes.some((c) => c.key === "workspace.timezone") && 
                      "border-primary/50 ring-1 ring-primary/20"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Maintenance Settings */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors">
                  <div className="space-y-0.5 pr-4">
                    <div className="text-sm font-medium">Maintenance Mode</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      When enabled, only admins can access the platform
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={maintenanceMode === "true"}
                      onCheckedChange={(v) =>
                        section.updateValue("maintenance.mode", v ? "true" : "false")
                      }
                    />
                  </div>
                </div>

                <Field
                  label="Maintenance Message"
                  hint="Message shown to users during maintenance"
                  saved={section.savedKeys.has("workspace.maintenance_message")}
                >
                  <Input
                    value={maintenanceMessage}
                    onChange={(e) => section.updateValue("workspace.maintenance_message", e.target.value)}
                    placeholder="We'll be right back!"
                    className={cn(
                      section.changes.some((c) => c.key === "workspace.maintenance_message") && 
                      "border-primary/50 ring-1 ring-primary/20"
                    )}
                  />
                </Field>
              </div>
            </>
          )}

          {/* Color fields - shown for non-general categories or if there are color settings */}
          {!isGeneralCategory && grouped.color.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {grouped.color.map((setting) => {
                const isSaved = section.savedKeys.has(setting.key);
                const changed = hasLocalChange(setting.key);
                const err = section.saveErrors[setting.key];

                return (
                  <Field
                    key={setting.key}
                    label={formatSettingKey(setting.key)}
                    hint={setting.description}
                    saved={isSaved && !changed}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="size-8 rounded-md border shrink-0"
                        style={{ backgroundColor: section.getValue(setting.key, "") || "#ccc" }}
                      />
                      <Input
                        value={section.getValue(setting.key, "")}
                        onChange={(e) => section.updateValue(setting.key, e.target.value)}
                        disabled={section.isSaving}
                        className={cn(
                          "font-mono text-sm",
                          changed && "border-primary/50 ring-1 ring-primary/20",
                          err && "border-red-300 ring-1 ring-red-200"
                        )}
                      />
                    </div>
                    {err && (
                      <p className="text-[11px] text-red-500 mt-1">{err}</p>
                    )}
                  </Field>
                );
              })}
            </div>
          )}

          {/* Other settings grouped by type - shown for non-general categories */}
          {!isGeneralCategory && (
            <>
              {/* Text / URL / Email fields */}
              {(grouped.text.length > 0 ||
                grouped.url.length > 0 ||
                grouped.email.length > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[...grouped.text, ...grouped.url, ...grouped.email].map(
                    (setting) => {
                      const type = inferInputType(section.getValue(setting.key, setting.value));
                      const isSaved = section.savedKeys.has(setting.key);
                      const changed = hasLocalChange(setting.key);
                      const err = section.saveErrors[setting.key];

                      return (
                        <Field
                          key={setting.key}
                          label={formatSettingKey(setting.key)}
                          hint={setting.description}
                          saved={isSaved && !changed}
                        >
                          <Input
                            type={type === "email" ? "email" : "text"}
                            value={section.getValue(setting.key, "")}
                            onChange={(e) =>
                              section.updateValue(setting.key, e.target.value)
                            }
                            disabled={section.isSaving}
                            className={cn(
                              changed && "border-primary/50 ring-1 ring-primary/20",
                              err && "border-red-300 ring-1 ring-red-200"
                            )}
                          />
                          {err && (
                            <p className="text-[11px] text-red-500 mt-1">{err}</p>
                          )}
                        </Field>
                      );
                    }
                  )}
                </div>
              )}

              {/* Textarea fields */}
              {grouped.textarea.length > 0 && (
                <div className="space-y-4">
                  {grouped.textarea.map((setting) => {
                    const isSaved = section.savedKeys.has(setting.key);
                    const changed = hasLocalChange(setting.key);
                    const err = section.saveErrors[setting.key];

                    return (
                      <Field
                        key={setting.key}
                        label={formatSettingKey(setting.key)}
                        hint={setting.description}
                        saved={isSaved && !changed}
                        className="sm:col-span-2"
                      >
                        <textarea
                          value={section.getValue(setting.key, "")}
                          onChange={(e) => section.updateValue(setting.key, e.target.value)}
                          disabled={section.isSaving}
                          rows={3}
                          className={cn(
                            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                            changed && "border-primary/50 ring-1 ring-primary/20",
                            err && "border-red-300 ring-1 ring-red-200"
                          )}
                        />
                        {err && (
                          <p className="text-[11px] text-red-500 mt-1">{err}</p>
                        )}
                      </Field>
                    );
                  })}
                </div>
              )}

              {/* Number fields */}
              {grouped.number.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {grouped.number.map((setting) => {
                    const isSaved = section.savedKeys.has(setting.key);
                    const changed = hasLocalChange(setting.key);
                    const err = section.saveErrors[setting.key];

                    return (
                      <Field
                        key={setting.key}
                        label={formatSettingKey(setting.key)}
                        hint={setting.description}
                        saved={isSaved && !changed}
                      >
                        <Input
                          type="number"
                          value={section.getValue(setting.key, "")}
                          onChange={(e) =>
                            section.updateValue(setting.key, e.target.value)
                          }
                          disabled={section.isSaving}
                          className={cn(
                            changed && "border-primary/50 ring-1 ring-primary/20",
                            err && "border-red-300 ring-1 ring-red-200"
                          )}
                        />
                        {err && (
                          <p className="text-[11px] text-red-500 mt-1">{err}</p>
                        )}
                      </Field>
                    );
                  })}
                </div>
              )}

              {/* Boolean toggles */}
              {grouped.boolean.length > 0 && (
                <div className="space-y-1">
                  {grouped.boolean.map((setting) => {
                    const isSaved = section.savedKeys.has(setting.key);
                    const changed = hasLocalChange(setting.key);
                    const err = section.saveErrors[setting.key];

                    return (
                      <div
                        key={setting.key}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-3 transition-colors",
                          changed && "bg-accent/30",
                          err && "bg-red-50 dark:bg-red-950/20"
                        )}
                      >
                        <div className="space-y-0.5 pr-4">
                          <div className="text-sm font-medium">
                            {formatSettingKey(setting.key)}
                          </div>
                          {setting.description && (
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              {setting.description}
                            </div>
                          )}
                          {err && (
                            <div className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
                              <AlertCircle className="size-3" />
                              {err}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSaved && !changed && (
                            <Check className="size-3.5 text-emerald-500" />
                          )}
                          <Switch
                            checked={
                              section.getValue(setting.key, "false") === "true"
                            }
                            onCheckedChange={(v) =>
                              section.updateValue(
                                setting.key,
                                v ? "true" : "false"
                              )
                            }
                            disabled={section.isSaving}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* No settings fallback */}
          {getFilteredSettings.length === 0 && (
            <EmptyCategoryState label={category} />
          )}

          {/* Footer Actions */}
          {getFilteredSettings.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {section.hasChanges ? (
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      {section.changes.length} unsaved change
                      {section.changes.length !== 1 ? "s" : ""}
                    </span>
                  ) : Object.keys(section.saveErrors).length > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-red-500" />
                      {Object.keys(section.saveErrors).length} save error
                      {Object.keys(section.saveErrors).length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      All changes saved
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={section.isSaving || (!section.hasChanges && Object.keys(section.saveErrors).length === 0)}
                    className="gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveClick}
                    disabled={section.isSaving || !section.hasChanges}
                    className="gap-1.5"
                  >
                    <Save className="size-3.5" />
                    {section.isSaving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <SettingsConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={section.changes}
        onConfirm={handleConfirmSave}
        onCancel={handleCancel}
        isSaving={section.isSaving}
        saveErrors={section.saveErrors}
      />
    </>
  );
}

/* ─── Danger Zone ─── */

function DangerZone() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const deleteWorkspace = useDeleteWorkspace();
  const resetSettings = useResetSettings();
  const seedSettings = useSeedSettings();
  const navigate = window.location.assign;

  const handleDeleteConfirm = () => {
    deleteWorkspace.mutate(undefined, {
      onSuccess: () => {
        toast.success("Workspace deleted successfully");
        setDeleteDialogOpen(false);
        navigate("/auth/login");
      },
      onError: () => {
        toast.error("Failed to delete workspace");
      },
    });
  };

  const handleResetConfirm = () => {
    resetSettings.mutate(undefined, {
      onSuccess: () => {
        toast.success("Settings reset to defaults");
        setResetDialogOpen(false);
      },
      onError: () => {
        toast.error("Failed to reset settings");
      },
    });
  };

  const handleSeedConfirm = () => {
    seedSettings.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(result.message);
        setSeedDialogOpen(false);
      },
      onError: () => {
        toast.error("Failed to seed settings");
      },
    });
  };

  const canDelete = confirmDeleteText === "DELETE";

  return (
    <SectionCard
      title="Danger zone"
      description="Irreversible destructive actions. Proceed with caution."
      className="border-destructive/20"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="size-4" />
              Delete workspace
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed max-w-md">
              Permanently removes all data across users, content, analytics,
              and configuration. This action cannot be undone.
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="size-3.5 mr-1.5" />
            Delete
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-4 text-muted-foreground" />
              Reset all settings
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed max-w-md">
              Restore all system settings to their default values. User data
              will not be affected.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setResetDialogOpen(true)}
          >
            <RotateCcw className="size-3.5 mr-1.5" />
            Reset
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-muted-foreground" />
              Seed default settings
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed max-w-md">
              Populate the database with the full set of platform default
              settings. No-op if settings already exist; safe to re-run.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setSeedDialogOpen(true)}
          >
            <Sparkles className="size-3.5 mr-1.5" />
            Seed
          </Button>
        </div>
      </div>

      {/* Delete Workspace Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
              <AlertTriangle className="size-5" />
              Delete workspace
            </DialogTitle>
            <DialogDescription className="text-sm">
              This will permanently delete all data including users, content,
              analytics, and configuration. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3">
              <div className="text-xs font-medium text-red-600 dark:text-red-500">
                Confirm deletion
              </div>
              <div className="text-[11px] text-red-700/70 dark:text-red-400/70 mt-1">
                Type <code className="px-0.5 rounded bg-red-200 dark:bg-red-900">DELETE</code> to confirm
              </div>
            </div>
            <Input
              type="text"
              placeholder="Type DELETE..."
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value.toUpperCase())}
              className={cn(
                "border-red-200 dark:border-red-900/50 focus-visible:ring-red-500",
                canDelete && "border-green-500 bg-green-50"
              )}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={!canDelete || deleteWorkspace.isPending}
            >
              {deleteWorkspace.isPending ? "Deleting..." : "Delete workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Settings Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-5" />
              Reset all settings
            </DialogTitle>
            <DialogDescription className="text-sm">
              This will restore all system settings to their default values.
              User data will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleResetConfirm}
              disabled={resetSettings.isPending}
            >
              {resetSettings.isPending ? "Resetting..." : "Reset settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed Settings Dialog */}
      <Dialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5" />
              Seed default settings
            </DialogTitle>
            <DialogDescription className="text-sm">
              This populates the database with the full set of platform default
              settings. If settings already exist, the operation is a no-op and
              existing values are preserved. Safe to re-run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSeedConfirm}
              disabled={seedSettings.isPending}
            >
              {seedSettings.isPending ? "Seeding..." : "Seed settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/* ─── Empty State ─── */

function EmptyCategoryState({ label }: { label: string }) {
  return (
    <SectionCard
      title={`${label} settings`}
      description="Configure how this area behaves."
    >
      <div className="py-12 text-center">
        <div className="inline-flex items-center justify-center size-12 rounded-full bg-muted mb-3">
          <Database className="size-5 text-muted-foreground" />
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          No settings in this category
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Settings will appear here once configured.
        </div>
      </div>
    </SectionCard>
  );
}

/* ─── Skeleton ─── */

function SettingsSkeleton() {
  return (
    <SectionCard>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </SectionCard>
  );
}

/* ─── Field Component ─── */

function Field({
  label,
  children,
  hint,
  saved,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  saved?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        {saved && (
          <Badge
            variant="outline"
            className="h-3.5 px-1 text-[9px] font-medium text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
          >
            <Check className="size-2.5 mr-0.5" />
            Saved
          </Badge>
        )}
      </div>
      {children}
      {hint && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}
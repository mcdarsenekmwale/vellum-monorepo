import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Save,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Globe,
  Palette,
  Shield,
  Bell,
  Mail,
  Upload,
  Key,
  Plug,
  Database,
  Monitor,
  Type,
  Image,
  Fingerprint,
  Lock,
  FileJson,
  Languages,
  Cloud,
  Check,
  ChevronRight,
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
import { useSystemSettings, useUpdateSystemSetting, useDeleteWorkspace, useResetSettings } from "@/lib/api/hooks";
import type { SystemSetting } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

function inferInputType(value: string): "text" | "number" | "boolean" | "textarea" | "url" | "email" {
  if (isBooleanSetting(value)) return "boolean";
  if (isNumberSetting(value)) return "number";
  if (value.includes("@")) return "email";
  if (value.startsWith("http")) return "url";
  if (value.length > 120) return "textarea";
  return "text";
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
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"
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
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              <Database className="size-3.5" />
              Workspace Info
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{(settingsByCategory["general"] ?? []).find((s) => s.key === "workspace.name")?.value ?? "Vellum Admin"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language</span>
                <span className="font-medium">{(settingsByCategory["general"] ?? []).find((s) => s.key === "workspace.language")?.value ?? "English"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timezone</span>
                <span className="font-medium">{(settingsByCategory["general"] ?? []).find((s) => s.key === "workspace.timezone")?.value ?? "UTC"}</span>
              </div>
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
                ) : hasSettings ? (
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

/* ─── Category Settings Panel ─── */

function CategorySettingsPanel({
  category,
  settings,
}: {
  category: string;
  settings: SystemSetting[];
}) {
  const updateSetting = useUpdateSystemSetting();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const getValue = useCallback(
    (key: string, fallback: string) => {
      if (localValues[key] !== undefined) return localValues[key];
      const setting = settings.find((s) => s.key === key);
      return setting?.value ?? fallback;
    },
    [localValues, settings]
  );

  const handleChange = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    setSavedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleSave = () => {
    const entries = Object.entries(localValues);
    if (entries.length === 0) return;

    let index = 0;
    const newlySaved = new Set<string>();

    const saveNext = () => {
      if (index >= entries.length) {
        setSavedKeys(newlySaved);
        setLocalValues({});
        return;
      }
      const [key, value] = entries[index];
      index++;
      newlySaved.add(key);
      updateSetting.mutate({ key, value }, { onSuccess: saveNext });
    };
    saveNext();
  };

  const handleReset = () => {
    setLocalValues({});
    setSavedKeys(new Set());
  };

  const isSaving = updateSetting.isPending;
  const hasChanges = Object.keys(localValues).length > 0;

  // Group by inferred input type
  const grouped = settings.reduce(
    (acc, s) => {
      const type = inferInputType(s.value);
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
    }
  );

  return (
    <SectionCard
      title={`${category} configuration`}
      description="Edit values below. Changes are staged until you save."
    >
      <div className="space-y-6">
        {/* Text / URL / Email fields */}
        {(grouped.text.length > 0 ||
          grouped.url.length > 0 ||
          grouped.email.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[...grouped.text, ...grouped.url, ...grouped.email].map(
              (setting) => {
                const type = inferInputType(setting.value);
                const isSaved = savedKeys.has(setting.key);
                const hasLocalChange = localValues[setting.key] !== undefined;

                return (
                  <Field
                    key={setting.key}
                    label={formatSettingKey(setting.key)}
                    hint={setting.description}
                    saved={isSaved}
                  >
                    <Input
                      type={type === "email" ? "email" : "text"}
                      value={getValue(setting.key, "")}
                      onChange={(e) =>
                        handleChange(setting.key, e.target.value)
                      }
                      disabled={isSaving}
                      className={cn(
                        hasLocalChange && "border-primary/50 ring-1 ring-primary/20"
                      )}
                    />
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
              const isSaved = savedKeys.has(setting.key);
              const hasLocalChange = localValues[setting.key] !== undefined;

              return (
                <Field
                  key={setting.key}
                  label={formatSettingKey(setting.key)}
                  hint={setting.description}
                  saved={isSaved}
                  className="sm:col-span-2"
                >
                  <textarea
                    value={getValue(setting.key, "")}
                    onChange={(e) => handleChange(setting.key, e.target.value)}
                    disabled={isSaving}
                    rows={3}
                    className={cn(
                      "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                      hasLocalChange && "border-primary/50 ring-1 ring-primary/20"
                    )}
                  />
                </Field>
              );
            })}
          </div>
        )}

        {/* Number fields */}
        {grouped.number.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {grouped.number.map((setting) => {
              const isSaved = savedKeys.has(setting.key);
              const hasLocalChange = localValues[setting.key] !== undefined;

              return (
                <Field
                  key={setting.key}
                  label={formatSettingKey(setting.key)}
                  hint={setting.description}
                  saved={isSaved}
                >
                  <Input
                    type="number"
                    value={getValue(setting.key, "")}
                    onChange={(e) =>
                      handleChange(setting.key, e.target.value)
                    }
                    disabled={isSaving}
                    className={cn(
                      hasLocalChange && "border-primary/50 ring-1 ring-primary/20"
                    )}
                  />
                </Field>
              );
            })}
          </div>
        )}

        {/* Boolean toggles */}
        {grouped.boolean.length > 0 && (
          <div className="space-y-1">
            {grouped.boolean.map((setting) => {
              const isSaved = savedKeys.has(setting.key);
              const hasLocalChange = localValues[setting.key] !== undefined;

              return (
                <div
                  key={setting.key}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-3 transition-colors",
                    hasLocalChange && "bg-accent/30"
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
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSaved && (
                      <Check className="size-3.5 text-emerald-500" />
                    )}
                    <Switch
                      checked={
                        getValue(setting.key, "false") === "true"
                      }
                      onCheckedChange={(v) =>
                        handleChange(
                          setting.key,
                          v ? "true" : "false"
                        )
                      }
                      disabled={isSaving}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No settings fallback */}
        {settings.length === 0 && (
          <EmptyCategoryState label={category} />
        )}

        {/* Footer Actions */}
        {settings.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {hasChanges ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    {Object.keys(localValues).length} unsaved change
                    {Object.keys(localValues).length !== 1 ? "s" : ""}
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
                  disabled={isSaving || !hasChanges}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="gap-1.5"
                >
                  <Save className="size-3.5" />
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

/* ─── Danger Zone ─── */

function DangerZone() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const deleteWorkspace = useDeleteWorkspace();
  const resetSettings = useResetSettings();
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
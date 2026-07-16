// components/dashboard/ai-settings-panel.tsx
"use client";

import { useState, useEffect } from "react";
import {
  X,
  Bot,
  Sparkles,
  Shield,
  AlertTriangle,
  Eye,
  Zap,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Info,
  RotateCcw,
  Save,
  TestTube,
  BarChart3,
  MessageSquare,
  Ban,
  CheckCircle2,
  Sliders,
  BrainCircuit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAISettings, useUpdateAISettings, useTestAIModeration } from "@/lib/api/hooks";
import type { AISettings } from "@/lib/api/services";

interface AISettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultSettings: AISettings = {
  enabled: true,
  autoFlag: true,
  autoResolve: false,
  riskThresholds: {
    high: 80,
    medium: 50,
  },
  categories: {
    spam: true,
    harassment: true,
    misinformation: true,
    copyright: true,
    violence: true,
    hateSpeech: true,
    selfHarm: true,
    sexualContent: true,
  },
  notifications: {
    emailOnCritical: true,
    digestFrequency: "hourly",
  },
  modelConfig: {
    model: "gpt-4",
    temperature: 0.3,
    maxTokens: 500,
    customPrompt: "",
  },
  trainingData: {
    useHistoricalReports: true,
    feedbackLoop: true,
    lastRetrained: "2024-07-10T14:30:00Z",
  },
};

function parseStoredSettings(stored: Record<string, string>): AISettings {
  try {
    const parsed: Partial<AISettings> = {};
    
    if (stored.enabled !== undefined) parsed.enabled = stored.enabled === "true";
    if (stored.autoFlag !== undefined) parsed.autoFlag = stored.autoFlag === "true";
    if (stored.autoResolve !== undefined) parsed.autoResolve = stored.autoResolve === "true";
    
    if (stored.riskThresholds) {
      parsed.riskThresholds = JSON.parse(stored.riskThresholds);
    }
    if (stored.categories) {
      parsed.categories = JSON.parse(stored.categories);
    }
    if (stored.notifications) {
      parsed.notifications = JSON.parse(stored.notifications);
    }
    if (stored.modelConfig) {
      parsed.modelConfig = JSON.parse(stored.modelConfig);
    }
    if (stored.trainingData) {
      parsed.trainingData = JSON.parse(stored.trainingData);
    }
    
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

export function AISettingsPanel({ open, onOpenChange }: AISettingsPanelProps) {
  const { data: storedSettings, isLoading } = useAISettings();
  const updateSettings = useUpdateAISettings();
  const testModeration = useTestAIModeration();
  
  const [config, setConfig] = useState<AISettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState("general");
  const [hasChanges, setHasChanges] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<null | {
    score: number;
    category: string;
    riskLevel: string;
    confidence: number;
    reasoning: string;
  }>(null);

  useEffect(() => {
    if (storedSettings) {
      setConfig(parseStoredSettings(storedSettings));
    }
  }, [storedSettings, open]);

  const updateConfig = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateNested = <K extends keyof AISettings, SK extends keyof AISettings[K]>(
    key: K,
    subKey: SK,
    value: AISettings[K][SK]
  ) => {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as object), [subKey]: value },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings.mutate(config, {
      onSuccess: () => {
        setHasChanges(false);
        toast.success("AI settings saved", {
          description: "Your moderation configuration has been updated.",
        });
      },
      onError: (err) => {
        toast.error("Failed to save settings", { description: err.message });
      },
    });
  };

  const handleReset = () => {
    setConfig(defaultSettings);
    setHasChanges(true);
    toast.info("Settings reset to defaults");
  };

  const runTest = async () => {
    if (!testInput.trim()) return;
    setTestResult(null);
    
    testModeration.mutate(
      { content: testInput, thresholds: config.riskThresholds },
      {
        onSuccess: (result) => {
          setTestResult({
            score: result.score,
            category: result.category,
            riskLevel: result.riskLevel,
            confidence: result.confidence,
            reasoning: result.reasoning,
          });
        },
        onError: (err) => {
          toast.error("Moderation test failed", { description: err.message });
        },
      }
    );
  };

  const categoryLabels: Record<string, { label: string; description: string; color: string }> = {
    spam: { label: "Spam", description: "Unwanted repetitive or promotional content", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    harassment: { label: "Harassment", description: "Targeting individuals with abuse or intimidation", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    misinformation: { label: "Misinformation", description: "False or misleading information", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    copyright: { label: "Copyright", description: "Unauthorized use of protected material", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    violence: { label: "Violence", description: "Content depicting or promoting violence", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
    hateSpeech: { label: "Hate Speech", description: "Attacks based on protected characteristics", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
    selfHarm: { label: "Self-Harm", description: "Content promoting or depicting self-injury", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
    sexualContent: { label: "Sexual Content", description: "Explicit or inappropriate sexual material", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  };

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading settings...</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-md bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <SheetTitle>AI Moderation Settings</SheetTitle>
            </div>
            <SheetDescription>
              Configure how AI assists with content moderation and report handling.
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="gap-1.5 text-xs">
                <Sliders className="size-3.5" /> General
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-1.5 text-xs">
                <Shield className="size-3.5" /> Categories
              </TabsTrigger>
              <TabsTrigger value="model" className="gap-1.5 text-xs">
                <BrainCircuit className="size-3.5" /> Model
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1.5 text-xs">
                <MessageSquare className="size-3.5" /> Alerts
              </TabsTrigger>
            </TabsList>

            {/* ─── General Tab ───────────────────────────────────────── */}
            <TabsContent value="general" className="space-y-6 mt-4">
              {/* Master Toggle */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">AI Moderation</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable AI-powered content analysis and risk scoring
                    </p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(v) => updateConfig("enabled", v)}
                  />
                </div>
                {!config.enabled && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    AI moderation is disabled. All reports will require manual review.
                  </div>
                )}
              </div>

              {/* Automation Settings */}
              <div className={cn("space-y-4", !config.enabled && "opacity-50 pointer-events-none")}>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="size-4" /> Automation
                </h4>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Auto-Flag Content</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically flag high-risk content for review
                      </p>
                    </div>
                    <Switch
                      checked={config.autoFlag}
                      onCheckedChange={(v) => updateConfig("autoFlag", v)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Auto-Resolve</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically resolve low-risk, clear-cut cases
                      </p>
                    </div>
                    <Switch
                      checked={config.autoResolve}
                      onCheckedChange={(v) => updateConfig("autoResolve", v)}
                    />
                  </div>
                  {config.autoResolve && (
                    <div className="rounded-md bg-muted p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Auto-resolve threshold</span>
                        <span className="font-medium">{config.riskThresholds.medium}% risk</span>
                      </div>
                      <Slider
                        value={[config.riskThresholds.medium]}
                        onValueChange={([v]) =>
                          updateNested("riskThresholds", "medium", v)
                        }
                        min={10}
                        max={90}
                        step={5}
                      />
                      <p className="text-muted-foreground">
                        Reports below this score will be automatically resolved if no human flags them within 24 hours.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Thresholds */}
              <div className={cn("space-y-4", !config.enabled && "opacity-50 pointer-events-none")}>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="size-4" /> Risk Thresholds
                </h4>

                <div className="space-y-4 rounded-lg border p-4">
                  {/* High Risk */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium uppercase tracking-wider">High Risk</Label>
                      <Badge variant="destructive" className="text-xs">
                        {config.riskThresholds.high}%+
                      </Badge>
                    </div>
                    <Slider
                      value={[config.riskThresholds.high]}
                      onValueChange={([v]) =>
                        updateNested("riskThresholds", "high", Math.max(v, config.riskThresholds.medium + 10))
                      }
                      min={50}
                      max={100}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Immediately escalates to critical priority and notifies moderators
                    </p>
                  </div>

                  <Separator />

                  {/* Medium Risk */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium uppercase tracking-wider">Medium Risk</Label>
                      <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                        {config.riskThresholds.medium}% - {config.riskThresholds.high - 1}%
                      </Badge>
                    </div>
                    <Slider
                      value={[config.riskThresholds.medium]}
                      onValueChange={([v]) =>
                        updateNested("riskThresholds", "medium", Math.min(v, config.riskThresholds.high - 10))
                      }
                      min={20}
                      max={80}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Flagged for review within standard queue
                    </p>
                  </div>

                  {/* Low Risk Preview */}
                  <div className="flex items-center gap-2 rounded-md bg-emerald-500/5 p-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Below {config.riskThresholds.medium}% — Low risk, monitored passively
                    </span>
                  </div>
                </div>
              </div>

              {/* Test Panel */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <TestTube className="size-4" /> Test Configuration
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setTestDialogOpen(true)}
                  >
                    <Sparkles className="size-3.5" /> Run Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Test your current settings against sample content to verify detection accuracy.
                </p>
              </div>
            </TabsContent>

            {/* ─── Categories Tab ────────────────────────────────────── */}
            <TabsContent value="categories" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Detection Categories</h4>
                  <p className="text-xs text-muted-foreground">
                    Select which content types the AI should monitor
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateConfig(
                        "categories",
                        Object.fromEntries(
                          Object.keys(config.categories).map((k) => [k, true])
                        ) as AISettings["categories"]
                      )
                    }
                  >
                    Enable All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateConfig(
                        "categories",
                        Object.fromEntries(
                          Object.keys(config.categories).map((k) => [k, false])
                        ) as AISettings["categories"]
                      )
                    }
                  >
                    Disable All
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                {Object.entries(categoryLabels).map(([key, { label, description, color }]) => (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition-colors",
                      config.categories[key as keyof AISettings["categories"]]
                        ? "border-primary/20 bg-primary/5"
                        : "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("size-2 rounded-full", color.split(" ")[0])} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{label}</span>
                          {config.categories[key as keyof AISettings["categories"]] && (
                            <Badge variant="outline" className={cn("text-[10px] h-4", color)}>
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.categories[key as keyof AISettings["categories"]]}
                      onCheckedChange={(v) =>
                        updateNested("categories", key as keyof AISettings["categories"], v)
                      }
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ─── Model Tab ─────────────────────────────────────────── */}
            <TabsContent value="model" className="space-y-6 mt-4">
              {/* Model Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">AI Model</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "gpt-4", label: "GPT-4", desc: "Most accurate", recommended: true },
                    { id: "gpt-3.5", label: "GPT-3.5", desc: "Faster, cheaper" },
                    { id: "claude", label: "Claude 3", desc: "Long context" },
                    { id: "custom", label: "Custom", desc: "Self-hosted" },
                  ].map((model) => (
                    <button
                      key={model.id}
                      onClick={() => updateNested("modelConfig", "model", model.id as any)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all",
                        config.modelConfig.model === model.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{model.label}</span>
                        {model.recommended && (
                          <Badge className="text-[10px] h-4">Recommended</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{model.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Temperature */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Temperature</Label>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                    {config.modelConfig.temperature}
                  </span>
                </div>
                <Slider
                  value={[config.modelConfig.temperature * 100]}
                  onValueChange={([v]) => updateNested("modelConfig", "temperature", v / 100)}
                  min={0}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Consistent (0.0)</span>
                  <span>Balanced (0.5)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Max Response Tokens</Label>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                    {config.modelConfig.maxTokens}
                  </span>
                </div>
                <Slider
                  value={[config.modelConfig.maxTokens]}
                  onValueChange={([v]) => updateNested("modelConfig", "maxTokens", v)}
                  min={100}
                  max={2000}
                  step={50}
                />
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Custom System Prompt</Label>
                <textarea
                  value={config.modelConfig.customPrompt}
                  onChange={(e) => updateNested("modelConfig", "customPrompt", e.target.value)}
                  placeholder="Enter custom instructions for the AI moderator..."
                  className="w-full min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Override the default moderation instructions. Leave empty to use system defaults.
                </p>
              </div>

              {/* Training Data */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="size-4" /> Training & Feedback
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Use Historical Reports</Label>
                    <p className="text-xs text-muted-foreground">
                      Improve accuracy using past moderation decisions
                    </p>
                  </div>
                  <Switch
                    checked={config.trainingData.useHistoricalReports}
                    onCheckedChange={(v) => updateNested("trainingData", "useHistoricalReports", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Moderator Feedback Loop</Label>
                    <p className="text-xs text-muted-foreground">
                      Learn from moderator corrections and overrides
                    </p>
                  </div>
                  <Switch
                    checked={config.trainingData.feedbackLoop}
                    onCheckedChange={(v) => updateNested("trainingData", "feedbackLoop", v)}
                  />
                </div>

                {config.trainingData.lastRetrained && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="size-3.5" />
                    Last retrained: {new Date(config.trainingData.lastRetrained).toLocaleDateString()}
                  </div>
                )}

                <Button variant="outline" size="sm" className="gap-1.5 w-full">
                  <RotateCcw className="size-3.5" /> Retrain Model Now
                </Button>
              </div>
            </TabsContent>

            {/* ─── Notifications Tab ─────────────────────────────────── */}
            <TabsContent value="notifications" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Email on Critical</Label>
                    <p className="text-xs text-muted-foreground">
                      Send immediate email alerts for high-risk reports
                    </p>
                  </div>
                  <Switch
                    checked={config.notifications.emailOnCritical}
                    onCheckedChange={(v) => updateNested("notifications", "emailOnCritical", v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Digest Frequency</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: "realtime", label: "Real-time" },
                      { value: "hourly", label: "Hourly" },
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                    ].map((freq) => (
                      <button
                        key={freq.value}
                        onClick={() => updateNested("notifications", "digestFrequency", freq.value as any)}
                        className={cn(
                          "rounded-md border px-3 py-2 text-xs font-medium transition-all",
                          config.notifications.digestFrequency === freq.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "hover:border-primary/30"
                        )}
                      >
                        {freq.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Slack Webhook URL</Label>
                  <input
                    type="url"
                    value={config.notifications.slackWebhook ?? ""}
                    onChange={(e) => updateNested("notifications", "slackWebhook", e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Send moderation alerts to a Slack channel
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <SheetFooter className="mt-6 pt-4 border-t flex-col sm:flex-row gap-2">
            <Button variant="outline" className="gap-1.5" onClick={handleReset}>
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateSettings.isPending}
              className="gap-1.5"
            >
              <Save className="size-4" />
              {updateSettings.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </SheetFooter>

          {hasChanges && (
            <div className="mt-2 text-xs text-center text-amber-600 dark:text-amber-400">
              You have unsaved changes
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Test Dialog ───────────────────────────────────────────── */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="size-5" /> Test AI Moderation
            </DialogTitle>
            <DialogDescription>
              Enter sample content to see how your current settings would classify it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Test Content</Label>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Paste content to analyze..."
                className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button
              onClick={runTest}
              disabled={!testInput.trim() || testModeration.isPending}
              className="w-full gap-1.5"
            >
              {testModeration.isPending ? (
                <>
                  <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Analyze Content
                </>
              )}
            </Button>

            {testResult && (
              <div className="rounded-lg border p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Risk Score</span>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold",
                      getRiskColor(testResult.score)
                    )}
                  >
                    {testResult.score}%
                    <span className="text-[10px] font-normal">{testResult.riskLevel}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Category</span>
                  <Badge variant="outline" className="capitalize">
                    {testResult.category}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Confidence</span>
                  <span className="text-sm tabular-nums">{testResult.confidence}%</span>
                </div>

                <Separator />

                <div className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reasoning
                  </span>
                  <p className="text-sm text-muted-foreground">{testResult.reasoning}</p>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
                  <Info className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Based on current thresholds: High ≥{config.riskThresholds.high}%, Medium ≥{config.riskThresholds.medium}%
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getRiskColor(score: number) {
  if (score >= 80) return "text-destructive bg-destructive/10 border-destructive/20";
  if (score >= 50) return "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400";
  return "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400";
}
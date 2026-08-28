import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useAISettings,
  useUpdateAISettings,
  useTestAIModel,
  AI_MODEL_OPTIONS,
  type AIModelName,
  type AISettings,
} from "@/lib/api/hooks";
import { Brain, Loader2, CheckCircle2, XCircle, Zap, Clock, Hash, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ModelSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ModelSwitchDialog({ open, onOpenChange, onSaved }: ModelSwitchDialogProps) {
  const { data: settingsRaw } = useAISettings();
  const updateSettings = useUpdateAISettings();
  const testModel = useTestAIModel();

  const settings = settingsRaw as unknown as AISettings | undefined;

  /* Form state */
  const [model, setModel] = useState<AIModelName>("gpt-4o");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  const [customPrompt, setCustomPrompt] = useState("");
  const [testPrompt, setTestPrompt] = useState("Give me a quick two-sentence intro about yourself.");
  const [testOutput, setTestOutput] = useState<{
    success: boolean;
    output?: string;
    error?: string;
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
  } | null>(null);

  /* Prefill from existing settings on open */
  useEffect(() => {
    if (open && settings?.modelConfig) {
      setModel((settings.modelConfig.model as AIModelName) ?? "gpt-4o");
      setTemperature(settings.modelConfig.temperature ?? 0.7);
      setMaxTokens(settings.modelConfig.maxTokens ?? 2048);
      setCustomPrompt(settings.modelConfig.customPrompt ?? "");
      setTestOutput(null);
    }
  }, [open, settings]);

  const runTest = async () => {
    if (!testPrompt.trim()) {
      toast.error("Please enter a test prompt");
      return;
    }
    setTestOutput(null);
    testModel.mutate(
      {
        model,
        temperature,
        maxTokens,
        customPrompt: model === "custom" ? customPrompt : undefined,
        testPrompt,
      },
      {
        onSuccess: (res) => {
          setTestOutput(res);
          if (res.success) {
            toast.success(`Model test passed in ${res.latencyMs}ms`);
          } else {
            toast.error(res.error ?? "Model test failed");
          }
        },
        onError: (err) => {
          toast.error(`Test error: ${(err as Error).message || "Unknown"}`);
          setTestOutput({
            success: false,
            error: (err as Error).message || "Test request failed",
            latencyMs: 0,
            tokensIn: 0,
            tokensOut: 0,
          });
        },
      }
    );
  };

  const handleSave = async () => {
    const payload: Partial<AISettings> = {
      ...((settings ?? {}) as AISettings),
      modelConfig: {
        model,
        temperature,
        maxTokens,
        customPrompt: model === "custom" ? customPrompt.trim() || undefined : undefined,
      },
    };
    updateSettings.mutate(payload as AISettings, {
      onSuccess: () => {
        toast.success("AI model settings updated");
        onOpenChange(false);
        onSaved?.();
      },
      onError: (err) => {
        toast.error(`Failed to update: ${(err as Error).message || "Unknown error"}`);
      },
    });
  };

  const activeLabel = useMemo(
    () => AI_MODEL_OPTIONS.find((o) => o.value === model)?.label ?? String(model),
    [model]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Brain className="size-5 text-emerald-500" />
            Switch AI Model
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Choose a preset model or configure advanced parameters. Test before saving.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preset" className="flex-1 overflow-y-auto pr-1">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="preset" className="gap-1.5">
              <Zap className="size-3.5" /> Preset
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5">
              <Hash className="size-3.5" /> Advanced
            </TabsTrigger>
          </TabsList>

          {/* ---------- PRESET TAB ---------- */}
          <TabsContent value="preset" className="space-y-4 mt-0">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Select a model preset
            </Label>
            <RadioGroup
              value={model}
              onValueChange={(v) => setModel(v as AIModelName)}
              className="grid gap-2"
            >
              {AI_MODEL_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    model === opt.value
                      ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                      : "hover:bg-muted/40"
                  )}
                >
                  <RadioGroupItem value={opt.value} id={`opt-${opt.value}`} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{opt.label}</span>
                      {opt.note?.includes("recommended") && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        >
                          Recommended
                        </Badge>
                      )}
                      {opt.note?.includes("Legacy") && (
                        <Badge variant="secondary" className="text-[10px]">
                          Legacy
                        </Badge>
                      )}
                      {opt.note?.includes("Custom") && (
                        <Badge variant="outline" className="text-[10px] border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {opt.note}
                    </p>
                  </div>
                </Label>
              ))}
            </RadioGroup>

            {model === "custom" && (
              <div className="space-y-2 rounded-lg border p-3">
                <Label
                  htmlFor="custom-slug"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Custom model slug
                </Label>
                <Input
                  id="custom-slug"
                  placeholder="meta-llama/llama-3.1-405b-instruct"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Paste the fully-qualified model slug from your custom provider
                  (OpenRouter-compatible).
                </p>
              </div>
            )}
          </TabsContent>

          {/* ---------- ADVANCED TAB ---------- */}
          <TabsContent value="advanced" className="space-y-5 mt-0">
            {/* Temperature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Temperature
                </Label>
                <span className="font-mono text-sm tabular-nums">{temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[temperature]}
                min={0}
                max={2}
                step={0.1}
                onValueChange={([v]) => setTemperature(v)}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0 — Precise</span>
                <span>1 — Balanced</span>
                <span>2 — Creative</span>
              </div>
            </div>

            {/* Max tokens */}
            <div className="space-y-2">
              <Label
                htmlFor="max-tokens"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Max tokens (output)
              </Label>
              <Input
                id="max-tokens"
                type="number"
                min={64}
                max={8192}
                step={64}
                value={maxTokens}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  setMaxTokens(Math.max(64, Math.min(8192, Math.floor(v))));
                }}
              />
              <p className="text-[11px] text-muted-foreground">Range: 64 – 8192 tokens.</p>
            </div>

            {/* Custom prompt (for custom model) */}
            <div className="space-y-2">
              <Label
                htmlFor="custom-prompt"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Custom model slug / system prompt override
              </Label>
              <Textarea
                id="custom-prompt"
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={
                  model === "custom"
                    ? "Fully-qualified model slug (required). e.g. anthropic/claude-3-opus"
                    : "Optional system-prompt override appended to persona instructions."
                }
              />
            </div>

            {/* --- Test model section --- */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                <Label className="text-sm font-medium">Test before save</Label>
              </div>
              <Textarea
                rows={2}
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Quick 2-sentence intro…"
                className="text-sm"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runTest}
                  disabled={testModel.isPending || !testPrompt.trim()}
                  className="gap-1.5"
                >
                  {testModel.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Testing…
                    </>
                  ) : (
                    <>
                      <Zap className="size-3.5" />
                      Run test
                    </>
                  )}
                </Button>
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  {testOutput && (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {testOutput.latencyMs}ms
                      </span>
                      <span>
                        {testOutput.tokensIn} in · {testOutput.tokensOut} out
                      </span>
                    </>
                  )}
                </div>
              </div>

              {testOutput && (
                <div
                  className={cn(
                    "rounded-md border p-3 text-xs space-y-2",
                    testOutput.success
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        testOutput.success ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      )}
                    >
                      {testOutput.success ? (
                        <>
                          <CheckCircle2 className="size-3.5" /> Test passed
                        </>
                      ) : (
                        <>
                          <XCircle className="size-3.5" /> Test failed
                        </>
                      )}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground max-h-40 overflow-y-auto font-mono bg-background/40 rounded p-2">
                    {testOutput.success
                      ? testOutput.output ?? "(no output)"
                      : testOutput.error ?? "Unknown error"}
                  </pre>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-row gap-2 pt-3 border-t shrink-0">
          <div className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
            Current: <span className="font-medium text-foreground">{activeLabel}</span>
            {` · T=${temperature.toFixed(1)} · ${maxTokens} tok`}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

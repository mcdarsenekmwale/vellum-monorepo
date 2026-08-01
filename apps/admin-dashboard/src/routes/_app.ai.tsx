import { createFileRoute } from "@tanstack/react-router";
import {
  Bot,
  Play,
  Zap,
  Plus,
  Sparkles,
  Pencil,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Brain,
  Info,
  X,
  ChevronRight,
  Settings,
  Code,
  Clock,
  Globe,
  Type,
  Hash,
  ToggleLeft,
  Calendar,
  Tag,
  Save,
  Loader2,
  Copy,
  Check,
  Eye,
  Terminal,
  Cpu,
  Activity,
  Pause,
  PlayCircle,
  MoreVertical,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Code2,
  FileJson,
  ListChecks,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useAIAgents,
  useCreateAIAgent,
  useUpdateAIAgent,
  useDeleteAIAgent,
  useTestAIModeration,
  type AIAgent,
} from "@/lib/api/hooks";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { SectionCard } from "@/components/dashboard/section-card";
import { toast } from "sonner";

/* ─── Constants ─── */

const AVAILABLE_MODELS = [
  "gpt-4o",
  "gpt-4",
  "gpt-3.5-turbo",
  "claude-3-5-sonnet",
  "claude-3-opus",
  "claude-3-haiku",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

const AVAILABLE_TONES = [
  "informative",
  "casual",
  "professional",
  "witty",
  "poetic",
  "technical",
];

const AVAILABLE_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
];

const TONE_OPTIONS = AVAILABLE_TONES;
const LANGUAGE_OPTIONS = AVAILABLE_LANGUAGES;

const DEFAULT_CONFIG = {
  tone: "informative",
  language: "en",
  schedule: "0 9 * * *",
  wordCount: { min: 500, max: 1500 },
  categories: ["Technology"],
  autoPublish: false,
  maxDailyPosts: 10,
};

type SheetMode = "create" | "edit" | "view";

export const Route = createFileRoute("/_app/ai")({
  head: () => ({ meta: [{ title: "AI Automation · Vellum Admin" }] }),
  component: AIPage,
});

/* ─── Main Page ─── */

function AIPage() {
  const { data, isLoading, refetch } = useAIAgents();
  const createAgent = useCreateAIAgent();
  const updateAgent = useUpdateAIAgent();
  const deleteAgent = useDeleteAIAgent();
  const testModeration = useTestAIModeration();
  const agents = data ?? [];

  // Computed stats
  const totalRuns = useMemo(() => agents.reduce((sum, a) => sum + a.runs, 0), [agents]);
  const activeCount = useMemo(() => agents.filter((a) => a.status === "active").length, [agents]);
  const pausedCount = useMemo(() => agents.filter((a) => a.status === "paused").length, [agents]);
  const uniqueModels = useMemo(() => new Set(agents.map((a) => a.model)).size, [agents]);

  /* ─── Sheet State ─── */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("view");
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [jsonMode, setJsonMode] = useState(false);

  /* ─── Form State ─── */
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formModel, setFormModel] = useState("gpt-4o");
  const [formStatus, setFormStatus] = useState("active");
  const [formTone, setFormTone] = useState("informative");
  const [formLanguage, setFormLanguage] = useState("en");
  const [formSchedule, setFormSchedule] = useState("0 9 * * *");
  const [formMinWords, setFormMinWords] = useState(500);
  const [formMaxWords, setFormMaxWords] = useState(1500);
  const [formCategories, setFormCategories] = useState("Technology, AI, Science");
  const [formAutoPublish, setFormAutoPublish] = useState(false);
  const [formMaxDailyPosts, setFormMaxDailyPosts] = useState(10);
  const [formConfigJson, setFormConfigJson] = useState("");

  /* ─── Dialog State ─── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<AIAgent | null>(null);

  /* ─── Playground State ─── */
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundResult, setPlaygroundResult] = useState<null | {
    score: number;
    riskLevel: string;
    category: string;
    confidence: number;
    reasoning: string;
  }>(null);

  /* ─── Form Helpers ─── */

  const resetForm = useCallback(() => {
    setFormName("");
    setFormDescription("");
    setFormModel("gpt-4o");
    setFormStatus("active");
    setFormTone("informative");
    setFormLanguage("en");
    setFormSchedule("0 9 * * *");
    setFormMinWords(500);
    setFormMaxWords(1500);
    setFormCategories("Technology, AI, Science");
    setFormAutoPublish(false);
    setFormMaxDailyPosts(10);
    setFormConfigJson(JSON.stringify(DEFAULT_CONFIG, null, 2));
    setJsonMode(false);
    setActiveTab("overview");
  }, []);

  const populateForm = useCallback((agent: AIAgent | null, mode: SheetMode) => {
    setSheetMode(mode);
    setSelectedAgent(agent);
    setJsonMode(false);
    setActiveTab("overview");

    if (mode === "create" || !agent) {
      resetForm();
      return;
    }

    setFormName(agent.name);
    setFormDescription(agent.description ?? "");
    setFormModel(agent.model);
    setFormStatus(agent.status);
    setFormTone(agent.config?.tone ?? "informative");
    setFormLanguage(agent.config?.language ?? "en");
    setFormSchedule(agent.config?.schedule?.cron ?? agent.config?.schedule ?? "0 9 * * *");
    setFormMinWords(agent.config?.wordCount?.min ?? 500);
    setFormMaxWords(agent.config?.wordCount?.max ?? 1500);
    setFormCategories((agent.config?.categories ?? []).join(", "));
    setFormAutoPublish( agent.config?.publishing?.autoPublish  ?? agent.config?.autoPublish ?? false);
    setFormMaxDailyPosts(agent.config?.publishing?.maxDailyPosts ?? agent.config?.maxDailyPosts ??  10);
    setFormConfigJson(JSON.stringify(agent.config ?? DEFAULT_CONFIG, null, 2));
  }, [resetForm]);

  const buildPayload = useCallback(() => {
    let config: Record<string, unknown>;
    if (jsonMode) {
      try {
        config = JSON.parse(formConfigJson);
      } catch {
        config = { ...DEFAULT_CONFIG };
      }
    } else {
      config = {
        tone: formTone,
        language: formLanguage,
        schedule: formSchedule,
        wordCount: {
          min: Number(formMinWords),
          max: Number(formMaxWords),
        },
        categories: formCategories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        autoPublish: formAutoPublish,
        maxDailyPosts: Number(formMaxDailyPosts),
      };
    }
    return {
      name: formName.trim(),
      description: formDescription.trim() || null,
      model: formModel,
      status: formStatus,
      config,
    };
  }, [
    formName,
    formDescription,
    formModel,
    formStatus,
    formTone,
    formLanguage,
    formSchedule,
    formMinWords,
    formMaxWords,
    formCategories,
    formAutoPublish,
    formMaxDailyPosts,
    formConfigJson,
    jsonMode,
  ]);

  const isFormValid = useMemo(() => {
    if (!formName.trim()) return false;
    if (jsonMode) {
      try {
        JSON.parse(formConfigJson);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }, [formName, formConfigJson, jsonMode]);

  /* ─── Sheet Actions ─── */

  const openSheetCreate = useCallback(() => {
    resetForm();
    setSheetMode("create");
    setSheetOpen(true);
  }, [resetForm]);

  const openSheetView = useCallback((agent: AIAgent) => {
    populateForm(agent, "view");
    setSheetOpen(true);
  }, [populateForm]);

  const openSheetEdit = useCallback((agent: AIAgent) => {
    populateForm(agent, "edit");
    setSheetOpen(true);
  }, [populateForm]);

  const switchToEdit = useCallback(() => {
    if (selectedAgent) {
      setSheetMode("edit");
      setJsonMode(false);
    }
  }, [selectedAgent]);

  const handleCreate = useCallback(() => {
    if (!isFormValid) return;
    createAgent.mutate(buildPayload(), {
      onSuccess: () => {
        setSheetOpen(false);
        refetch();
        toast.success("AI agent created successfully");
      },
      onError: (error) => {
        toast.error("Failed to create agent: " + (error.message || "Unknown error"));
      },
    });
  }, [createAgent, buildPayload, isFormValid, refetch]);

  const handleEdit = useCallback(() => {
    if (!selectedAgent || !isFormValid) return;
    updateAgent.mutate(
      { id: selectedAgent.id, ...buildPayload() },
      {
        onSuccess: () => {
          setSheetMode("view");
          refetch();
          toast.success("AI agent updated successfully");
        },
        onError: (error) => {
          toast.error("Failed to update agent: " + (error.message || "Unknown error"));
        },
      }
    );
  }, [selectedAgent, updateAgent, buildPayload, isFormValid, refetch]);

  const openDelete = useCallback((agent: AIAgent) => {
    setDeletingAgent(agent);
    setDeleteDialogOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!deletingAgent) return;
    deleteAgent.mutate(deletingAgent.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setDeletingAgent(null);
        setSheetOpen(false);
        refetch();
        toast.success("AI agent deleted successfully");
      },
      onError: (error) => {
        toast.error("Failed to delete agent: " + (error.message || "Unknown error"));
      },
    });
  }, [deletingAgent, deleteAgent, refetch]);

  const handleToggleStatus = useCallback((agent: AIAgent) => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    updateAgent.mutate(
      { id: agent.id, status: newStatus },
      {
        onSuccess: () => {
          refetch();
          toast.success(`Agent ${newStatus === "active" ? "activated" : "paused"} successfully`);
        },
        onError: (error) => {
          toast.error("Failed to update agent status: " + (error.message || "Unknown error"));
        },
      }
    );
  }, [updateAgent, refetch]);

  /* ─── Playground Actions ─── */

  const handlePlaygroundTest = useCallback(() => {
    if (!playgroundInput.trim()) {
      toast.error("Please enter content to analyze");
      return;
    }
    testModeration.mutate(
      { content: playgroundInput.trim() },
      {
        onSuccess: (result) => {
          setPlaygroundResult(result);
          toast.success("Analysis complete");
        },
        onError: (error) => {
          toast.error("Failed to analyze content: " + (error.message || "Unknown error"));
        },
      }
    );
  }, [playgroundInput, testModeration]);

  const resetPlayground = useCallback(() => {
    setPlaygroundInput("");
    setPlaygroundResult(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="AI"
        title="AI Automation"
        description="Manage agents, prompt templates, executions and permissions."
        actions={
          <div className="flex items-center gap-2">
            <Dialog open={playgroundOpen} onOpenChange={(open) => {
              setPlaygroundOpen(open);
              if (!open) resetPlayground();
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Sparkles className="size-4" /> Playground
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Brain className="size-5" /> AI Moderation Playground
                  </DialogTitle>
                  <DialogDescription>
                    Test content against your current moderation settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Test Content
                    </Label>
                    <Textarea
                      value={playgroundInput}
                      onChange={(e) => setPlaygroundInput(e.target.value)}
                      placeholder="Paste content to analyze..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handlePlaygroundTest}
                      disabled={!playgroundInput.trim() || testModeration.isPending}
                      className="flex-1 gap-1.5"
                    >
                      {testModeration.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" /> Analyze Content
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetPlayground}
                      disabled={!playgroundInput && !playgroundResult}
                    >
                      Clear
                    </Button>
                  </div>

                  {playgroundResult && (
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Risk Score</span>
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold",
                            playgroundResult.riskLevel === "high"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : playgroundResult.riskLevel === "medium"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                          )}
                        >
                          {playgroundResult.score}%
                          <span className="text-[10px] font-normal capitalize">
                            {playgroundResult.riskLevel}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-md bg-muted/30 p-3 border">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Category
                          </div>
                          <div className="text-sm font-medium capitalize">
                            {playgroundResult.category}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 border">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Confidence
                          </div>
                          <div className="text-sm font-medium">
                            {playgroundResult.confidence}%
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Reasoning
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {playgroundResult.reasoning}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPlaygroundOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button size="sm" onClick={openSheetCreate} className="gap-1.5">
              <Plus className="size-4" /> New agent
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active agents"
          value={activeCount}
          icon={Bot}
          sub={`${pausedCount} paused`}
          color="emerald"
        />
        <StatCard
          label="Total runs"
          value={totalRuns.toLocaleString()}
          icon={Activity}
          color="blue"
        />
        <StatCard
          label="Total agents"
          value={agents.length}
          icon={Cpu}
          color="amber"
        />
        <StatCard
          label="Models in use"
          value={uniqueModels}
          icon={Terminal}
          color="purple"
        />
      </div>

      {/* Agents List */}
      <SectionCard title="Agents" description="Deployed AI workers" padded={false}>
        {isLoading ? (
          <div className="p-5">
            <ChartSkeleton height={200} />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 grid size-16 place-items-center rounded-full bg-muted/30">
              <Bot className="size-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No AI agents deployed</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Create your first AI agent to automate content generation,
              summarization, and other workflows.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={openSheetCreate}>
              <Plus className="size-4" /> Create your first agent
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {agents.map((a) => (
              <li key={a.id} className="group flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openSheetView(a)}
                      className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer group-hover:text-primary"
                    >
                      {a.name}
                    </button>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {a.model}
                    </Badge>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        a.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          a.status === "active" ? "bg-emerald-500" : "bg-amber-500",
                        )}
                      />
                      {a.status}
                    </span>
                    {a.featured && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-600 dark:text-amber-400">
                        Featured
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {a.description ?? "No description"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{a.runs.toLocaleString()} runs</span>
                    {a.lastRunAt && (
                      <span>
                        · last run {formatDistanceToNow(new Date(a.lastRunAt), { addSuffix: true })}
                      </span>
                    )}
                    {a.config?.language && (
                      <span>· {AVAILABLE_LANGUAGES.find(l => l.value === a.config.language)?.label || a.config.language}</span>
                    )}
                    {a.config?.categories?.length > 0 && (
                      <span>· {a.config.categories.slice(0, 2).join(", ")}{a.config.categories.length > 2 && " +" + (a.config.categories.length - 2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className="flex size-8 cursor-pointer items-center justify-center"
                    onClick={() => handleToggleStatus(a)}
                    title={a.status === "active" ? "Pause agent" : "Activate agent"}
                  >
                    <Switch
                      checked={a.status === "active"}
                      onCheckedChange={() => handleToggleStatus(a)}
                      disabled={updateAgent.isPending}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openSheetEdit(a)}
                    className="gap-1.5"
                  >
                    <Pencil className="size-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive gap-1.5"
                    onClick={() => openDelete(a)}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ==================== AGENT SHEET / OFFCANVAS ==================== */}
      <Sheet open={sheetOpen} onOpenChange={(open) => {
        setSheetOpen(open);
        if (!open) resetForm();
      }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="space-y-1 pb-4 gap-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">
                {sheetMode === "create"
                  ? "Create agent"
                  : sheetMode === "edit"
                  ? "Edit agent"
                  : selectedAgent?.name}
              </SheetTitle>
              {sheetMode === "view" && selectedAgent && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={switchToEdit}
                    className="gap-1.5"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive gap-1.5"
                    onClick={() => {
                      if (selectedAgent) openDelete(selectedAgent);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              {sheetMode === "create"
                ? "Deploy a new AI agent to automate content workflows."
                : sheetMode === "edit"
                ? "Update agent configuration and settings."
                : "View agent details, configuration and run history."}
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 rounded-xs">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview" className="gap-1.5">
                <Settings2 className="size-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="configuration" className="gap-1.5">
                <FileJson className="size-3.5" />
                Configuration
              </TabsTrigger>
            </TabsList>

            {/* -------- Overview Tab -------- */}
            <TabsContent value="overview" className="mt-4 space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label
                  htmlFor="sheet-name"
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  <Bot className="size-3.5" />
                  Agent name
                </Label>
                <Input
                  id="sheet-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Content Summarizer"
                  disabled={sheetMode === "view"}
                  className={cn(
                    sheetMode === "view" && "bg-muted border-transparent"
                  )}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label
                  htmlFor="sheet-description"
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  <Info className="size-3.5" />
                  Description
                </Label>
                <Textarea
                  id="sheet-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of what this agent does..."
                  rows={3}
                  disabled={sheetMode === "view"}
                  className={cn(
                    sheetMode === "view" && "bg-muted border-transparent resize-none"
                  )}
                />
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label
                  htmlFor="sheet-model"
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  <Brain className="size-3.5" />
                  Model
                </Label>
                <Select
                  value={formModel}
                  onValueChange={setFormModel}
                  disabled={sheetMode === "view"}
                >
                  <SelectTrigger
                    id="sheet-model"
                    className={cn(
                      sheetMode === "view" && "bg-muted border-transparent"
                    )}
                  >
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-md border p-3",
                  sheetMode === "view" && "bg-muted border-transparent"
                )}
              >
                <div className="space-y-0.5">
                  <Label htmlFor="sheet-status" className="text-sm font-medium">
                    Active status
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {formStatus === "active"
                      ? "Agent is running and processing tasks"
                      : "Agent is paused and will not process tasks"}
                  </p>
                </div>
                <Switch
                  id="sheet-status"
                  checked={formStatus === "active"}
                  onCheckedChange={(checked) =>
                    setFormStatus(checked ? "active" : "paused")
                  }
                  disabled={sheetMode === "view"}
                />
              </div>

              {/* View-only metadata */}
              {sheetMode === "view" && selectedAgent && (
                <div className="rounded-md bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Clock className="size-3.5" />
                    Metadata
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Created</span>
                      <p className="font-medium">
                        {new Date(selectedAgent.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Updated</span>
                      <p className="font-medium">
                        {new Date(selectedAgent.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Total runs</span>
                      <p className="font-medium">
                        {selectedAgent.runs.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Last run</span>
                      <p className="font-medium">
                        {selectedAgent.lastRunAt
                          ? formatDistanceToNow(
                              new Date(selectedAgent.lastRunAt),
                              { addSuffix: true }
                            )
                          : "Never"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* -------- Configuration Tab -------- */}
            <TabsContent value="configuration" className="mt-4 space-y-5">
              {/* JSON Mode Toggle */}
              {sheetMode !== "view" && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Code2 className="size-4" />
                      Edit as JSON
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Toggle to edit raw configuration object
                    </p>
                  </div>
                  <Switch
                    checked={jsonMode}
                    onCheckedChange={setJsonMode}
                  />
                </div>
              )}

              {jsonMode && sheetMode !== "view" ? (
                <div className="space-y-2">
                  <Label
                    htmlFor="sheet-config-json"
                    className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Configuration JSON
                  </Label>
                  <Textarea
                    id="sheet-config-json"
                    value={formConfigJson}
                    onChange={(e) => {
                      setFormConfigJson(e.target.value);
                    }}
                    rows={20}
                    className={cn(
                      "font-mono text-xs",
                      (() => {
                        try {
                          JSON.parse(formConfigJson);
                          return "border-emerald-500/30";
                        } catch {
                          return "border-destructive";
                        }
                      })()
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      try {
                        JSON.parse(formConfigJson);
                        return "✓ Valid JSON";
                      } catch {
                        return "⚠️ Invalid JSON — fix formatting before saving";
                      }
                    })()}
                  </p>
                </div>
              ) : (
                <>
                  {/* Tone */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="sheet-tone"
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      <Type className="size-3.5" />
                      Tone
                    </Label>
                    <Select
                      value={formTone}
                      onValueChange={setFormTone}
                      disabled={sheetMode === "view"}
                    >
                      <SelectTrigger
                        id="sheet-tone"
                        className={cn(
                          sheetMode === "view" && "bg-muted border-transparent"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Language */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="sheet-language"
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      <Globe className="size-3.5" />
                      Language
                    </Label>
                    <Select
                      value={formLanguage}
                      onValueChange={setFormLanguage}
                      disabled={sheetMode === "view"}
                    >
                      <SelectTrigger
                        id="sheet-language"
                        className={cn(
                          sheetMode === "view" && "bg-muted border-transparent"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Schedule */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="sheet-schedule"
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      <Calendar className="size-3.5" />
                      Schedule (Cron)
                    </Label>
                    <Input
                      id="sheet-schedule"
                      value={formSchedule}
                      onChange={(e) => setFormSchedule(e.target.value)}
                      placeholder="0 9 * * *"
                      disabled={sheetMode === "view"}
                      className={cn(
                        "font-mono text-sm",
                        sheetMode === "view" && "bg-muted border-transparent"
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cron expression for automated runs. Example:{" "}
                      <code className="rounded bg-muted px-1 py-0.5">0 9 * * *</code>{" "}
                      runs daily at 9:00 AM.
                    </p>
                  </div>

                  {/* Word Count */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <Hash className="size-3.5" />
                      Word count range
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        value={formMinWords}
                        onChange={(e) => setFormMinWords(Number(e.target.value))}
                        placeholder="Min"
                        disabled={sheetMode === "view"}
                        className={cn(
                          sheetMode === "view" && "bg-muted border-transparent"
                        )}
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="number"
                        value={formMaxWords}
                        onChange={(e) => setFormMaxWords(Number(e.target.value))}
                        placeholder="Max"
                        disabled={sheetMode === "view"}
                        className={cn(
                          sheetMode === "view" && "bg-muted border-transparent"
                        )}
                      />
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="sheet-categories"
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      <ListChecks className="size-3.5" />
                      Categories
                    </Label>
                    <Input
                      id="sheet-categories"
                      value={formCategories}
                      onChange={(e) => setFormCategories(e.target.value)}
                      placeholder="Technology, AI, Science"
                      disabled={sheetMode === "view"}
                      className={cn(
                        sheetMode === "view" && "bg-muted border-transparent"
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of content categories.
                    </p>
                  </div>

                  {/* Max Daily Posts */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="sheet-max-posts"
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      <Hash className="size-3.5" />
                      Max daily posts
                    </Label>
                    <Input
                      id="sheet-max-posts"
                      type="number"
                      value={formMaxDailyPosts}
                      onChange={(e) =>
                        setFormMaxDailyPosts(Number(e.target.value))
                      }
                      disabled={sheetMode === "view"}
                      className={cn(
                        sheetMode === "view" && "bg-muted border-transparent"
                      )}
                    />
                  </div>

                  {/* Auto Publish */}
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-md border p-3",
                      sheetMode === "view" && "bg-muted border-transparent"
                    )}
                  >
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="sheet-auto-publish"
                        className="text-sm font-medium flex items-center gap-2"
                      >
                        <ToggleLeft className="size-4" />
                        Auto-publish
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically publish generated content without review
                      </p>
                    </div>
                    <Switch
                      id="sheet-auto-publish"
                      checked={formAutoPublish}
                      onCheckedChange={setFormAutoPublish}
                      disabled={sheetMode === "view"}
                    />
                  </div>

                  {/* Config JSON Preview (view mode only) */}
                  {sheetMode === "view" && selectedAgent?.config && (
                    <div className="rounded-md bg-muted/50 p-4 space-y-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Raw configuration
                      </span>
                      <pre className="text-xs overflow-auto max-h-64 font-mono bg-muted rounded p-3">
                        {JSON.stringify(selectedAgent.config, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          <SheetFooter className="pt-4 flex-row gap-2">
            {sheetMode === "view" ? (
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (sheetMode === "edit" && selectedAgent) {
                      populateForm(selectedAgent, "view");
                    } else {
                      setSheetOpen(false);
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={sheetMode === "create" ? handleCreate : handleEdit}
                  disabled={
                    (sheetMode === "create"
                      ? createAgent.isPending
                      : updateAgent.isPending) || !isFormValid
                  }
                  className="gap-1.5"
                >
                  {sheetMode === "create" ? (
                    createAgent.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Create agent
                      </>
                    )
                  ) : updateAgent.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save changes
                    </>
                  )}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Delete Agent
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{deletingAgent?.name}</strong>
              ? This cannot be undone and all run history will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteAgent.isPending}
            >
              {deleteAgent.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Agent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color: "emerald" | "blue" | "amber" | "purple";
}) {
  const colors = {
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    purple: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div
          className={cn(
            "grid size-8 place-items-center rounded-md border",
            colors[color],
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
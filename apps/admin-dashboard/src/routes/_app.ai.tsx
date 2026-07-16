import { createFileRoute } from "@tanstack/react-router";
import { Bot, Play, Zap, Plus, Sparkles, Pencil, Trash2, AlertTriangle, ShieldAlert, ShieldCheck, Brain, CheckCircle2, Info } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
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
  useAIAgents,
  useCreateAIAgent,
  useUpdateAIAgent,
  useDeleteAIAgent,
  useTestAIModeration,
  useAISettings,
  type AIAgent,
} from "@/lib/api/hooks";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

export const Route = createFileRoute("/_app/ai")({
  head: () => ({ meta: [{ title: "AI Automation · Vellum Admin" }] }),
  component: AIPage,
});

function AIPage() {
  const { data, isLoading, refetch } = useAIAgents();
  const createAgent = useCreateAIAgent();
  const updateAgent = useUpdateAIAgent();
  const deleteAgent = useDeleteAIAgent();
  const testModeration = useTestAIModeration();
  const { data: aiSettings } = useAISettings();
  const agents = data ?? [];

  const totalRuns = agents.reduce((sum, a) => sum + a.runs, 0);
  const activeCount = agents.filter((a) => a.status === "active").length;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AIAgent | null>(null);

  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundResult, setPlaygroundResult] = useState<null | {
    score: number;
    riskLevel: string;
    category: string;
    confidence: number;
    reasoning: string;
  }>(null);

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createModel, setCreateModel] = useState("gpt-4o");
  const [createStatus, setCreateStatus] = useState("active");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  const resetCreateForm = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateModel("gpt-4o");
    setCreateStatus("active");
  };

  const handleCreate = () => {
    if (!createName.trim()) return;
    createAgent.mutate(
      {
        name: createName.trim(),
        description: createDescription.trim() || null,
        model: createModel,
        status: createStatus,
      },
      {
        onSuccess: () => {
          resetCreateForm();
          setIsCreateOpen(false);
          refetch();
        },
      },
    );
  };

  const openEdit = (agent: AIAgent) => {
    setEditingAgent(agent);
    setEditName(agent.name);
    setEditDescription(agent.description ?? "");
    setEditModel(agent.model);
    setEditStatus(agent.status);
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingAgent || !editName.trim()) return;
    updateAgent.mutate(
      {
        id: editingAgent.id,
        name: editName.trim(),
        description: editDescription.trim() || null,
        model: editModel,
        status: editStatus,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingAgent(null);
          refetch();
        },
      },
    );
  };

  const openDelete = (agent: AIAgent) => {
    setDeletingAgent(agent);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingAgent) return;
    deleteAgent.mutate(deletingAgent.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingAgent(null);
        refetch();
      },
    });
  };

  const handleToggleStatus = (agent: AIAgent) => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    updateAgent.mutate(
      { id: agent.id, status: newStatus },
      {
        onSuccess: () => {
          refetch();
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="AI Automation"
        description="Manage agents, prompt templates, executions and permissions."
        actions={
          <>
            <Dialog open={isPlaygroundOpen} onOpenChange={(open) => {
              setIsPlaygroundOpen(open);
              if (!open) {
                setPlaygroundInput("");
                setPlaygroundResult(null);
              }
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
                    Test content against your current moderation settings to see how it would be classified.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="playground-input">Test Content</Label>
                    <Textarea
                      id="playground-input"
                      value={playgroundInput}
                      onChange={(e) => setPlaygroundInput(e.target.value)}
                      placeholder="Paste content to analyze...&#10;&#10;Try:&#10;- 'You are so stupid, I hate you!'&#10;- 'Get free money now, click here!'&#10;- 'This is a legitimate article about technology.'"
                      className="w-full min-h-[120px] resize-y"
                    />
                  </div>

                  <Button
                    onClick={() => {
                      if (!playgroundInput.trim()) return;
                      setPlaygroundResult(null);
                      testModeration.mutate({ content: playgroundInput.trim() }, {
                        onSuccess: (result) => {
                          setPlaygroundResult({
                            score: result.score,
                            riskLevel: result.riskLevel,
                            category: result.category,
                            confidence: result.confidence,
                            reasoning: result.reasoning,
                          });
                        },
                      });
                    }}
                    disabled={!playgroundInput.trim() || testModeration.isPending}
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

                  {playgroundResult && (
                    <div className="rounded-lg border p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Risk Score</span>
                        <div className="flex items-center gap-2">
                          {playgroundResult.riskLevel === "high" && <AlertTriangle className="size-4 text-destructive" />}
                          {playgroundResult.riskLevel === "medium" && <ShieldAlert className="size-4 text-amber-500" />}
                          {playgroundResult.riskLevel === "low" && <ShieldCheck className="size-4 text-emerald-500" />}
                          <div
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold",
                              playgroundResult.riskLevel === "high" ? "text-destructive bg-destructive/10 border-destructive/20" :
                              playgroundResult.riskLevel === "medium" ? "text-amber-600 bg-amber-500/10 border-amber-500/20" :
                              "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                            )}
                          >
                            {playgroundResult.score}%
                            <span className="text-[10px] font-normal capitalize">{playgroundResult.riskLevel}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-md bg-muted/50 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Category</div>
                          <div className="text-sm font-medium capitalize">{playgroundResult.category}</div>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Confidence</div>
                          <div className="text-sm font-medium">{playgroundResult.confidence}%</div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Reasoning
                        </span>
                        <p className="text-sm text-muted-foreground">{playgroundResult.reasoning}</p>
                      </div>

                      <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
                        <Info className="size-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          This result is based on your current AI moderation settings. Adjust thresholds in AI Settings to change behavior.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="rounded-md bg-muted/30 p-3 text-xs space-y-1">
                    <div className="font-medium text-muted-foreground">Quick Test Cases:</div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setPlaygroundInput("You are so stupid, I hate you!")}>
                        Harassment
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setPlaygroundInput("Get free money now, click here!")}>
                        Spam
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setPlaygroundInput("This is a legitimate article about technology.")}>
                        Normal
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPlaygroundOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={isCreateOpen}
              onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) resetCreateForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> New agent
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create agent</DialogTitle>
                  <DialogDescription>
                    Deploy a new AI agent to automate content workflows.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-name">Agent name</Label>
                    <Input
                      id="create-name"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g. Content Summarizer"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-description">Description</Label>
                    <Textarea
                      id="create-description"
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="Brief description of what this agent does..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-model">Model</Label>
                    <Select value={createModel} onValueChange={setCreateModel}>
                      <SelectTrigger id="create-model">
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
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="create-status">Active status</Label>
                      <p className="text-xs text-muted-foreground">
                        {createStatus === "active"
                          ? "Agent is running and processing tasks"
                          : "Agent is paused and will not process tasks"}
                      </p>
                    </div>
                    <Switch
                      id="create-status"
                      checked={createStatus === "active"}
                      onCheckedChange={(checked) => setCreateStatus(checked ? "active" : "paused")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      resetCreateForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createAgent.isPending || !createName.trim()}
                  >
                    {createAgent.isPending ? "Creating..." : "Create agent"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active agents" value={activeCount} icon={Bot} tone="primary" />
        <StatCard label="Total runs" value={totalRuns.toLocaleString()} icon={Play} tone="info" />
        <StatCard label="Total agents" value={agents.length} icon={Zap} tone="success" />
        <StatCard
          label="Models in use"
          value={new Set(agents.map((a) => a.model)).size}
          tone="warning"
        />
      </div>

      <SectionCard title="Agents" description="Deployed AI workers" padded={false}>
        {isLoading ? (
          <div className="p-5">
            <ChartSkeleton height={200} />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 grid size-16 place-items-center rounded-full bg-primary/10">
              <Bot className="size-8 text-primary/50" />
            </div>
            <p className="text-sm font-medium">No AI agents deployed</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Create your first AI agent to automate content generation, summarization, and other
              workflows.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setIsCreateOpen(true)}>
              <Plus className="size-4" /> Create your first agent
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {agents.map((a) => (
              <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 px-5 py-4">
                <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {a.model}
                    </Badge>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {a.description ?? "No description"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.runs.toLocaleString()} runs
                    {a.lastRunAt
                      ? ` · last run ${formatDistanceToNow(new Date(a.lastRunAt), { addSuffix: true })}`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                    onClick={() => openEdit(a)}
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit agent</DialogTitle>
            <DialogDescription>Update agent configuration and settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Agent name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-model">Model</Label>
              <Select value={editModel} onValueChange={setEditModel}>
                <SelectTrigger id="edit-model">
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
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-status">Active status</Label>
                <p className="text-xs text-muted-foreground">
                  {editStatus === "active"
                    ? "Agent is running and processing tasks"
                    : "Agent is paused and will not process tasks"}
                </p>
              </div>
              <Switch
                id="edit-status"
                checked={editStatus === "active"}
                onCheckedChange={(checked) => setEditStatus(checked ? "active" : "paused")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateAgent.isPending || !editName.trim()}>
              {updateAgent.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingAgent?.name}</strong>? This action
              cannot be undone and all associated run history will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteAgent.isPending}>
              {deleteAgent.isPending ? "Deleting..." : "Delete agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

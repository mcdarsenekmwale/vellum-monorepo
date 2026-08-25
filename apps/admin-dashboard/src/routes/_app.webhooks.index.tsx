import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  LayoutDashboard,
  Inbox,
  Send,
  Activity,
  TrendingUp,
  Webhook,
  Check,
  Copy,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useWebhooks,
  useWebhookStats,
  useBulkUpdateWebhooks,
  useUpdateWebhook,
  useDeleteWebhook,
  useRotateWebhookSecret,
  type WebhookConfig,
 
} from "@/lib/api/hooks";
import { WebhookCard } from "@/components/webhooks/WebhookCard";
import { WebhookFormDialog } from "@/components/webhooks/WebhookFormDialog";
import { WebhookTestDialog } from "@/components/webhooks/WebhookTestDialog";
import { WebhookStatsPanel } from "@/components/webhooks/WebhookStatsPanel";
import { useTestWebhook } from "@/lib/api/hooks";
import type { TestResult } from "@/lib/api/services";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/webhooks/")({
  head: () => ({ meta: [{ title: "Webhooks · Vellbase Admin" }] }),
  component: WebhooksPage,
});

function WebhooksPage() {
  const { data: webhooks, isLoading: loadingList, refetch: refetchList } = useWebhooks();
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useWebhookStats();
  const bulkMut = useBulkUpdateWebhooks();
  const updateMut = useUpdateWebhook();
  const deleteMut = useDeleteWebhook();
  const rotateMut = useRotateWebhookSecret();
  const testMut = useTestWebhook();

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOMING" | "OUTGOING">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PAUSED">("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookConfig | null>(null);

  const [isTestOpen, setIsTestOpen] = useState(false);
  const [testWebhook, setTestWebhook] = useState<WebhookConfig | null>(null);

  const [isSecretOpen, setIsSecretOpen] = useState(false);
  const [secretWebhook, setSecretWebhook] = useState<WebhookConfig | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<WebhookConfig | null>(null);

  const list = webhooks ?? [];
  const total = list.length;
  const totalIncoming = list.filter((w) => w.type === "INCOMING").length;
  const totalOutgoing = list.filter((w) => w.type === "OUTGOING").length;
  const active = list.filter((w) => w.isActive).length;
  const successRate = useMemo(() => {
    let ok = 0;
    let n = 0;
    for (const w of list) {
      const logs = w.logs ?? [];
      for (const l of logs) {
        n++;
        if (l.statusCode && l.statusCode >= 200 && l.statusCode < 300 && !l.error) ok++;
      }
    }
    return n === 0 ? null : Math.round((ok / n) * 100);
  }, [list]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((w) => {
      if (typeFilter !== "ALL" && w.type !== typeFilter) return false;
      if (statusFilter === "ACTIVE" && !w.isActive) return false;
      if (statusFilter === "PAUSED" && w.isActive) return false;
      if (!term) return true;
      return (
        w.name.toLowerCase().includes(term) ||
        w.url.toLowerCase().includes(term) ||
        w.events.some((e) => e.toLowerCase().includes(term))
      );
    });
  }, [list, q, typeFilter, statusFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((w) => selected.has(w.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const next = new Set(selected);
      filtered.forEach((w) => next.delete(w.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((w) => next.add(w.id));
      setSelected(next);
    }
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulk = async (action: "enable" | "disable" | "delete") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await bulkMut.mutateAsync({ ids, action });
      toast.success(
        action === "delete"
          ? `Deleted ${ids.length} webhook${ids.length > 1 ? "s" : ""}`
          : `Updated ${ids.length} webhook${ids.length > 1 ? "s" : ""}`,
      );
      if (action === "delete") clearSelection();
    } catch (err: any) {
      toast.error(err?.message ?? "Bulk action failed");
    }
  };

  const runTest = async (
    payload: Parameters<typeof testMut.mutateAsync>[0]["data"],
  ): Promise<TestResult> => {
    if (!testWebhook) throw new Error("No webhook selected");
    return testMut.mutateAsync({ id: testWebhook.id, data: payload });
  };

  const openEdit = (w: WebhookConfig) => setEditing(w);
  const openDelete = (w: WebhookConfig) => {
    setDeleting(w);
    setIsDeleteOpen(true);
  };
  const openSecret = (w: WebhookConfig) => {
    setSecretWebhook(w);
    setCopiedSecret(false);
    setIsSecretOpen(true);
  };
  const openTest = (w: WebhookConfig) => {
    setTestWebhook(w);
    setIsTestOpen(true);
  };
  const handleToggleActive = async (w: WebhookConfig, next: boolean) => {
    try {
      await updateMut.mutateAsync({ id: w.id, isActive: next });
      toast.success(next ? "Webhook activated" : "Webhook paused");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      toast.success("Webhook deleted");
      setIsDeleteOpen(false);
      setDeleting(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const handleRotateSecret = async () => {
    if (!secretWebhook) return;
    try {
      const result = await rotateMut.mutateAsync(secretWebhook.id);
      setSecretWebhook({ ...secretWebhook, secret: result.secret });
      setCopiedSecret(false);
      toast.success("Secret rotated");
    } catch (err: any) {
      toast.error(err?.message ?? "Rotate failed");
    }
  };

  const copySecret = async () => {
    if (!secretWebhook?.secret) return;
    await navigator.clipboard.writeText(secretWebhook.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 1800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Webhooks"
        description="Inbound & outbound event delivery with retry, signed requests, Teams cards, and audit logs."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                refetchList();
                refetchStats();
              }}
            >
              <RefreshCw
                className={cn("size-3.5", (loadingList || loadingStats) && "animate-spin")}
              />
              Refresh
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
              <Plus className="size-4" /> New webhook
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total
                </div>
                {loadingList ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {total.toLocaleString()}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">Configured webhooks</div>
              </div>
              <div className="grid size-9 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <LayoutDashboard className="size-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Incoming
                </div>
                {loadingList ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {totalIncoming.toLocaleString()}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">Receive ingress</div>
              </div>
              <div className="grid size-9 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Inbox className="size-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Outgoing
                </div>
                {loadingList ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {totalOutgoing.toLocaleString()}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">Send outbound</div>
              </div>
              <div className="grid size-9 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Send className="size-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Active
                </div>
                {loadingList ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {active.toLocaleString()}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">{total - active} paused</div>
              </div>
              <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Activity className="size-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Success rate
                </div>
                {loadingList ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <div
                    className={cn(
                      "mt-1 text-2xl font-semibold tabular-nums",
                      successRate === null && "text-muted-foreground",
                      successRate !== null &&
                        successRate < 80 &&
                        "text-rose-600 dark:text-rose-400",
                      successRate !== null &&
                        successRate >= 80 &&
                        successRate < 95 &&
                        "text-amber-600 dark:text-amber-400",
                      successRate !== null &&
                        successRate >= 95 &&
                        "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {successRate === null ? "—" : `${successRate}%`}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">Last deliveries</div>
              </div>
              <div className="grid size-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <TrendingUp className="size-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <WebhookStatsPanel
        stats={stats}
        loading={loadingStats}
        onRefresh={() => refetchStats()}
        scope="overview"
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, URL, or events…"
                  className="pl-9 h-9"
                />
              </div>
              <Tabs
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as any)}
                className="shrink-0"
              >
                <TabsList className="h-9">
                  <TabsTrigger value="ALL" className="text-xs h-8 px-3">
                    All types
                  </TabsTrigger>
                  <TabsTrigger value="INCOMING" className="text-xs h-8 px-3">
                    Incoming
                  </TabsTrigger>
                  <TabsTrigger value="OUTGOING" className="text-xs h-8 px-3">
                    Outgoing
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="h-9 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active only</SelectItem>
                  <SelectItem value="PAUSED">Paused only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selected.size > 0 ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 pl-3 pr-2 py-1.5 h-9">
                  <Badge variant="outline" className="text-[10px]">
                    {selected.size.toLocaleString()} selected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 border-0"
                    onClick={() => handleBulk("enable")}
                    disabled={bulkMut.isPending}
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Enable
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 border-0"
                    onClick={() => handleBulk("disable")}
                    disabled={bulkMut.isPending}
                  >
                    <XCircle className="size-3.5 text-amber-500" />
                    Disable
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 border-0 text-destructive"
                    onClick={() => handleBulk("delete")}
                    disabled={bulkMut.isPending}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
                    ×
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Filter className="size-3.5" />
                  {filtered.length.toLocaleString()} of {total.toLocaleString()} shown
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9">
                    <Sparkles className="size-3.5 text-amber-500" />
                    <span className="hidden sm:inline">Quick add</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
                    <Plus className="size-3.5 mr-2" />
                    Blank webhook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
                    <Sparkles className="size-3.5 mr-2 text-amber-500" />
                    From template…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center gap-2 pb-2 border-b">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                aria-label="Select all visible"
              />
              <Label className="text-xs cursor-pointer select-none" onClick={toggleSelectAll}>
                {allVisibleSelected
                  ? "Deselect all"
                  : `Select all ${filtered.length.toLocaleString()} visible`}
              </Label>
            </div>
          )}

          <div className="space-y-0.5" />

          {loadingList ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5 space-y-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 grid size-16 place-items-center rounded-full bg-muted/50">
                <Webhook className="size-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">No webhooks match</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {total === 0
                  ? "Create your first webhook to start sending or receiving event notifications."
                  : "Try clearing the search or filters, or create a new webhook."}
              </p>
              <div className="mt-5 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setTypeFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear filters
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="size-4" /> Create webhook
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((w) => (
                <WebhookCard
                  key={w.id}
                  webhook={w}
                  selected={selected.has(w.id)}
                  onSelectChange={(checked) => {
                    const next = new Set(selected);
                    if (checked) next.add(w.id);
                    else next.delete(w.id);
                    setSelected(next);
                  }}
                  onEdit={openEdit}
                  onDelete={openDelete}
                  onTest={openTest}
                  onShowSecret={openSecret}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WebhookFormDialog
        open={isCreateOpen || !!editing}
        onOpenChange={(next) => {
          if (!next) {
            setIsCreateOpen(false);
            setEditing(null);
          }
        }}
        initial={editing ?? null}
      />

      <WebhookTestDialog
        open={isTestOpen}
        onOpenChange={(next) => {
          setIsTestOpen(next);
          if (!next) setTestWebhook(null);
        } }
        webhook={testWebhook!} 
        onTest={runTest}        
      />

      <Dialog open={isSecretOpen} onOpenChange={setIsSecretOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              Webhook signing secret
            </DialogTitle>
            <DialogDescription>
              Use this secret to verify HMAC signatures for webhook{" "}
              <strong>{secretWebhook?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-sm break-all pr-2 select-all">
                  {secretWebhook?.secret ?? "—"}
                </code>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={copySecret} className="gap-1">
                    {copiedSecret ? (
                      <>
                        <Check className="size-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRotateSecret}
                    disabled={rotateMut.isPending}
                    className="gap-1"
                  >
                    <RefreshCw className={cn("size-3.5", rotateMut.isPending && "animate-spin")} />
                    Rotate
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Rotating the secret invalidates signatures produced by the old one immediately. Update
              your consumer before rotating to avoid dropped deliveries.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSecretOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleting?.name}</strong>? This action cannot
              be undone and all related delivery logs will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMut.isPending}
              className="gap-1"
            >
              <Trash2 className="size-4" />
              {deleteMut.isPending ? "Deleting…" : "Delete webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

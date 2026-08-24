import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardList,
  Settings2,
  Pencil,
  KeyRound,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Shield,
  Globe,
  Server,
  Users,
  Send,
  PlayCircle,
  LayoutDashboard,
  AlertTriangle,
  Activity,
  Clock,
  Calendar,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useWebhook,
  useWebhookStats,
  useWebhookLogs,
  useUpdateWebhook,
  useDeleteWebhook,
  useRotateWebhookSecret,
  useExportWebhookLogs,
  useTestWebhook,
  type WebhookConfig,
} from "@/lib/api/hooks";
import type { TestResult, WebhookLogsFilter } from "@/lib/api/services";
import { WebhookStatsPanel } from "@/components/webhooks/WebhookStatsPanel";
import { WebhookLogsTable } from "@/components/webhooks/WebhookLogsTable";
import { WebhookFormDialog } from "@/components/webhooks/WebhookFormDialog";
import { WebhookTestDialog } from "@/components/webhooks/WebhookTestDialog";
import { TeamsCardPreview } from "@/components/webhooks/TeamsCardPreview";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/webhooks/$id")({
  head: () => ({ meta: [{ title: "Webhook detail · Vellum Admin" }] }),
  component: WebhookDetailPage,
});

function WebhookDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: wh, isLoading: loadingWh, refetch: refetchWh } = useWebhook(id);

  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useWebhookStats(id);

  const [filter, setFilter] = useState<WebhookLogsFilter>({
    status: "all",
    limit: 100,
    offset: 0,
  });
  const {
    data: logsRes,
    isLoading: loadingLogs,
    refetch: refetchLogs,
  } = useWebhookLogs(id, filter);

  const updateMut = useUpdateWebhook();
  const deleteMut = useDeleteWebhook();
  const rotateMut = useRotateWebhookSecret();
  const exportMut = useExportWebhookLogs();
  const testMut = useTestWebhook();

  const [tab, setTab] = useState<"overview" | "logs" | "config">("overview");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSecretOpen, setIsSecretOpen] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [copiedFields, setCopiedFields] = useState<Record<string, boolean>>({});

  const w = wh ?? ({} as WebhookConfig);
  const logs = logsRes?.items ?? [];
  const totalLogs = logsRes?.total ?? logs.length;

  const copyField = async (key: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedFields((s) => ({ ...s, [key]: true }));
    setTimeout(() => setCopiedFields((s) => ({ ...s, [key]: false })), 1500);
  };

  const copySecret = async () => {
    if (!w?.secret) return;
    await navigator.clipboard.writeText(w.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 1500);
  };

  const runTest = async (
    payload: Parameters<typeof testMut.mutateAsync>[0]["data"],
  ): Promise<TestResult> => {
    if (!w?.id) throw new Error("Webhook not loaded");
    return testMut.mutateAsync({ id: w.id, data: payload });
  };

  const handleRotateSecret = async () => {
    if (!w?.id) return;
    try {
      await rotateMut.mutateAsync(w.id);
      toast.success("Secret rotated — new secret shown below");
      setCopiedSecret(false);
      refetchWh();
    } catch (err: any) {
      toast.error(err?.message ?? "Rotate failed");
    }
  };

  const handleToggleActive = async (next: boolean) => {
    if (!w?.id) return;
    try {
      await updateMut.mutateAsync({ id: w.id, isActive: next });
      toast.success(next ? "Webhook activated" : "Webhook paused");
      refetchWh();
    } catch (err: any) {
      toast.error(err?.message ?? "Update failed");
    }
  };

  const handleDelete = async () => {
    if (!w?.id) return;
    try {
      await deleteMut.mutateAsync(w.id);
      toast.success("Webhook deleted");
      navigate({ to: "/webhooks" });
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const handleExport = async () => {
    if (!w?.id) return;
    try {
      const r = await exportMut.mutateAsync({ id: w.id, filter });
      toast.success(`Export queued (${r.count} records)`);
    } catch (err: any) {
      toast.error(err?.message ?? "Export failed");
    }
  };

  const typeBadge = useMemo(() => {
    if (w.type === "INCOMING") {
      return {
        label: "Incoming",
        className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
        icon: <Server className="size-3" />,
      };
    }
    return {
      label: "Outgoing",
      className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      icon: <Send className="size-3" />,
    };
  }, [w.type]);

  if (loadingWh && !wh) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!wh && !loadingWh) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Platform"
          title="Webhook not found"
          description="This webhook may have been deleted."
          actions={
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/webhooks">
                <ArrowLeft className="size-4" />
                Back to list
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform / Webhooks"
        title={w?.name ?? "Webhook"}
        description={
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Badge variant="outline" className={cn("text-[10px] gap-1", typeBadge.className)}>
              {typeBadge.icon}
              {typeBadge.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                w?.isActive
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/20",
              )}
            >
              {w?.isActive ? "Active" : "Paused"}
            </Badge>
            {w?.teamsCardType && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 border-indigo-500/30 text-indigo-600"
              >
                <Users className="size-3" />
                Teams {w.teamsCardType === "ADAPTIVE" ? "Adaptive" : "Message"} Card
              </Badge>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => copyField("url", w?.url ?? "")}
                    className="font-mono text-xs hover:text-foreground truncate max-w-md inline-flex items-center gap-1"
                    title={w?.url}
                  >
                    {w?.url}
                    {copiedFields.url ? (
                      <Check className="size-3 text-emerald-500 shrink-0" />
                    ) : (
                      <Copy className="size-3 opacity-60 shrink-0" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[11px]">
                  Click to copy URL
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/webhooks">
                <ArrowLeft className="size-4" />
                All webhooks
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                refetchWh();
                refetchStats();
                refetchLogs();
              }}
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  (loadingWh || loadingStats || loadingLogs) && "animate-spin",
                )}
              />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsTestOpen(true)}
            >
              <PlayCircle className="size-4" />
              Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full md:w-auto grid-cols-3 md:inline-flex">
          <TabsTrigger value="overview" className="gap-1.5">
            <BadgeCheck className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ClipboardList className="size-3.5" />
            Logs
            {typeof totalLogs === "number" && totalLogs > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] py-0 h-4">
                {totalLogs}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings2 className="size-3.5" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-5">
          <WebhookStatsPanel
            stats={stats}
            loading={loadingStats}
            onRefresh={() => refetchStats()}
            scope="single"
          />

          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Recent activity</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTab("logs")}
                  >
                    Open logs →
                  </Button>
                </div>
                {loadingLogs ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Clock className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                    No deliveries yet. Send a test to see activity here.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {logs.slice(0, 8).map((l) => {
                      const ok =
                        l.statusCode && l.statusCode >= 200 && l.statusCode < 300 && !l.error;
                      return (
                        <li
                          key={l.id}
                          className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2.5"
                        >
                          <div
                            className={cn(
                              "grid size-8 place-items-center rounded-md",
                              ok
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-rose-500/10 text-rose-600",
                            )}
                          >
                            {ok ? (
                              <BadgeCheck className="size-4" />
                            ) : (
                              <AlertTriangle className="size-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {l.event}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-mono text-[10px]",
                                  ok
                                    ? "border-emerald-500/30 text-emerald-600"
                                    : "border-rose-500/30 text-rose-600",
                                )}
                              >
                                {l.statusCode ?? "Failed"}
                              </Badge>
                              {typeof l.durationMs === "number" && (
                                <span className="text-[10px] tabular-nums text-muted-foreground">
                                  {l.durationMs.toLocaleString()}ms
                                </span>
                              )}
                            </div>
                            {l.error && (
                              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 truncate font-mono">
                                {l.error}
                              </p>
                            )}
                          </div>
                          <div className="text-[11px] tabular-nums text-muted-foreground text-right">
                            {format(new Date(l.createdAt), "HH:mm:ss")}
                          </div>
                          <div className="text-[10px] text-muted-foreground text-right hidden sm:block">
                            {format(new Date(l.createdAt), "MMM d")}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="text-sm font-semibold">Quick info</h3>
                <dl className="space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="size-3.5 text-muted-foreground" />
                    <dt className="w-20 shrink-0 text-muted-foreground">Events</dt>
                    <dd className="flex flex-wrap gap-1">
                      {w?.events?.map((e) => (
                        <Badge key={e} variant="secondary" className="font-mono text-[10px]">
                          {e}
                        </Badge>
                      )) ?? <span className="text-muted-foreground">—</span>}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <dt className="w-20 shrink-0 text-muted-foreground">Created</dt>
                    <dd className="tabular-nums">
                      {w?.createdAt ? format(new Date(w.createdAt), "PPp") : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="size-3.5 text-muted-foreground" />
                    <dt className="w-20 shrink-0 text-muted-foreground">Last run</dt>
                    <dd className="tabular-nums">
                      {w?.lastTriggeredAt ? format(new Date(w.lastTriggeredAt), "PPp") : "Never"}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="size-3.5 text-muted-foreground" />
                    <dt className="w-20 shrink-0 text-muted-foreground">Security</dt>
                    <dd>
                      {w?.requiresAuth ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 border-emerald-500/30 text-emerald-600"
                        >
                          <Shield className="size-2.5" />
                          HMAC enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          None
                        </Badge>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-start gap-2">
                    <Globe className="size-3.5 text-muted-foreground mt-0.5" />
                    <dt className="w-20 shrink-0 text-muted-foreground">IP allowlist</dt>
                    <dd className="flex-1 min-w-0">
                      {!w?.allowedIps?.length ? (
                        <span className="text-muted-foreground">Unrestricted</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {w.allowedIps.slice(0, 4).map((ip) => (
                            <Badge key={ip} variant="outline" className="font-mono text-[10px]">
                              {ip}
                            </Badge>
                          ))}
                          {w.allowedIps.length > 4 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{w.allowedIps.length - 4}
                            </Badge>
                          )}
                        </div>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="pt-3 border-t space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => setIsSecretOpen(true)}
                  >
                    <KeyRound className="size-4" />
                    View / rotate signing secret
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start gap-2",
                      w?.isActive ? "text-amber-600" : "text-emerald-600",
                    )}
                    onClick={() => handleToggleActive(!w?.isActive)}
                    disabled={updateMut.isPending}
                  >
                    {w?.isActive ? (
                      <>
                        <AlertTriangle className="size-4" />
                        Pause deliveries
                      </>
                    ) : (
                      <>
                        <BadgeCheck className="size-4" />
                        Resume deliveries
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-destructive"
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete webhook
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-4">
          <WebhookLogsTable
            logs={logs}
            total={totalLogs}
            loading={loadingLogs}
            events={w?.events}
            filter={filter}
            onFilterChange={setFilter}
            onRefresh={() => refetchLogs()}
            onExport={handleExport}
            exportLoading={exportMut.isPending}
          />
        </TabsContent>

        <TabsContent value="config" className="mt-4 space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Configuration snapshot</h3>
                  <Badge variant="outline" className="text-[10px]">
                    Read-only
                  </Badge>
                </div>
                <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 text-sm">
                  <ConfigRow label="Name" value={w?.name} />
                  <ConfigRow
                    label="Type"
                    value={
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] gap-1", typeBadge.className)}
                      >
                        {typeBadge.icon}
                        {typeBadge.label}
                      </Badge>
                    }
                  />
                  <ConfigRow
                    label="URL"
                    mono
                    value={w?.url}
                    copyable
                    copyKey="url"
                    copied={copiedFields.url}
                    onCopy={() => copyField("url", w?.url ?? "")}
                  />
                  <ConfigRow
                    label="Format"
                    value={
                      <Badge variant="secondary" className="text-[10px]">
                        {w?.format ?? "JSON"}
                      </Badge>
                    }
                  />
                  <ConfigRow
                    label="Status"
                    value={
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          w?.isActive
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                        )}
                      >
                        {w?.isActive ? "Active" : "Paused"}
                      </Badge>
                    }
                  />
                  <ConfigRow
                    label="Events subscribed"
                    value={
                      <div className="flex flex-wrap gap-1">
                        {w?.events?.map((e) => (
                          <Badge key={e} variant="secondary" className="font-mono text-[10px]">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    }
                  />
                  <ConfigRow label="Max retries" value={`${w?.retryMaxAttempts ?? 3} ×`} />
                  <ConfigRow label="Backoff" value={`${w?.retryBackoffDelay ?? 1000}ms initial`} />
                  <ConfigRow
                    label="HMAC signing"
                    value={
                      w?.requiresAuth ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Shield className="size-3" />
                          Enabled
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Disabled</span>
                      )
                    }
                  />
                  <ConfigRow
                    label="Secret"
                    mono
                    value={w?.secret ? "••••••••••••" : "Not set"}
                    copyable={!!w?.secret}
                    copyKey="secret"
                    copied={copiedFields.secret}
                    onCopy={() => copyField("secret", w?.secret ?? "")}
                  />
                  <ConfigRow
                    label="IP allowlist"
                    value={
                      w?.allowedIps?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {w.allowedIps.map((ip) => (
                            <Badge key={ip} variant="outline" className="font-mono text-[10px]">
                              {ip}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unrestricted</span>
                      )
                    }
                  />
                  <ConfigRow
                    label="Headers"
                    value={
                      w?.headers && Object.keys(w.headers).length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(w.headers).map(([k, v]) => (
                            <div
                              key={k}
                              className="font-mono text-[11px] rounded-md border bg-muted/30 px-2 py-1"
                            >
                              <span className="text-muted-foreground">{k}:</span>{" "}
                              <span className="break-all">{v}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )
                    }
                  />
                  <ConfigRow
                    label="Created at"
                    value={w?.createdAt ? format(new Date(w.createdAt), "PPp") : "—"}
                  />
                  <ConfigRow
                    label="Last updated"
                    value={w?.updatedAt ? format(new Date(w.updatedAt), "PPp") : "—"}
                  />
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <KeyRound className="size-4" />
                      Signing secret management
                    </h3>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <code className="font-mono text-xs break-all pr-2 select-all">
                        {w?.secret ?? "Not set — outbound webhooks will not be signed"}
                      </code>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copySecret}
                          className="gap-1 h-8"
                          disabled={!w?.secret}
                        >
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
                          disabled={rotateMut.isPending || !w?.id}
                          className="gap-1 h-8"
                        >
                          <RefreshCw
                            className={cn("size-3.5", rotateMut.isPending && "animate-spin")}
                          />
                          Rotate
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Rotation takes effect immediately. Requesters using the old secret will fail
                      signature validation for incoming webhooks after rotate.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {w?.teamsCardType && w.type === "OUTGOING" && (
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="size-4" />
                      Teams card layout
                    </h3>
                    <TeamsCardPreview cardType={w.teamsCardType} template={w.teamsCardTemplate} />
                  </CardContent>
                </Card>
              )}

              <Card className="border-rose-500/30 dark:border-rose-500/20 bg-rose-500/[0.02]">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="size-4" />
                    Danger zone
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Deleting this webhook will permanently remove its configuration, delivery logs,
                    and any in-flight retry attempts.
                  </p>
                  <Button
                    variant="destructive"
                    className="w-full justify-start gap-2"
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete webhook
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <WebhookFormDialog
        open={isEditOpen}
        onOpenChange={(next) => {
          setIsEditOpen(next);
          if (!next) refetchWh();
        }}
        initial={wh ?? null}
      />

      <WebhookTestDialog
        open={isTestOpen}
        onOpenChange={(next) => {
          setIsTestOpen(next);
          if (next) return;
          refetchLogs();
          refetchStats();
          refetchWh();
        }}
        webhook={wh!}
        onTest={async (data) => runTest(data)}
      />

      <Dialog open={isSecretOpen} onOpenChange={setIsSecretOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              Signing secret
            </DialogTitle>
            <DialogDescription>
              Shared HMAC key for webhook <strong>{w?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-sm break-all pr-2 select-all">
                  {w?.secret ?? "—"}
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
              Keep this value in a secure secrets manager on your side — never commit it.
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
              Permanently delete <strong>{w?.name}</strong>? Delivery logs and retry state will be
              removed and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="gap-1"
            >
              <Trash2 className="size-4" />
              {deleteMut.isPending ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigRow(props: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyable?: boolean;
  copyKey?: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  const { label, value, mono, copyable, copied, onCopy } = props;
  return (
    <>
      <dt className="text-xs text-muted-foreground pt-1.5">{label}</dt>
      <dd className="min-w-0">
        {copyable && typeof value === "string" ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn("truncate", mono && "font-mono text-xs")}>{value}</span>
            <button
              type="button"
              onClick={onCopy}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        ) : mono && typeof value === "string" ? (
          <code className="text-xs break-all">{value}</code>
        ) : (
          value
        )}
      </dd>
    </>
  );
}

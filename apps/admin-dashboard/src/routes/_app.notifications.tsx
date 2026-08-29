import { createFileRoute } from "@tanstack/react-router";
import {
  Send,
  Mail,
  Bell,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Trash2,
  MoreHorizontal,
  Filter,
  RefreshCw,
  Loader2,
  Check,
  X,
  ChevronDown,
  Users,
  TrendingUp,
  Server,
  Settings2,
  Download,
  PlayCircle,
  Rocket,
  RotateCw,
  Sparkles,
  EyeOff,
  Link as LinkIcon,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  useAdminNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useCreateNotification,
  useUsers,
  useActivityStats,
  useActivityFeed,
  useSimulatedEvent,
  useActivityPrefsMatrix,
  useExportActivityPrefsCsv,
  type Notification,
  type ActivityKindC,
  type ActivityGroupItem,
  type FireSimulatedEventDto,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Vellbase Admin" }] }),
  component: NotificationsPage,
});

type ChannelFilter = "all" | "email" | "push" | "in-app" | "sms";
type StatusFilter = "all" | "read" | "unread";
type SortOption = "newest" | "oldest";
type PageTab = "all" | "unread" | "read" | "push" | "email" | "sms" | "simulator" | "preferences" | "inspector";

const ACTIVITY_KINDS: ActivityKindC[] = [
  "LIKE",
  "COMMENT",
  "REPLY",
  "FOLLOW",
  "MENTION",
  "BOOKMARK",
  "SYSTEM",
  "SHARE",
];

interface SseEventRow {
  id: string;
  receivedAt: number;
  kind?: string;
  userId?: string;
  raw: string;
}

function NotificationsPage() {
  const { data, isLoading, error, refetch } = useAdminNotifications({ pageSize: 50 });
  const { can } = useAuth();
  const rows = data?.data ?? [];

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotif = useDeleteNotification();
  const createNotif = useCreateNotification();
  const { data: usersData } = useUsers({ pageSize: 100 });
  const users = usersData?.data ?? [];

  const [activeTab, setActiveTab] = useState<PageTab>("all");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Compose form state
  const [composeUserId, setComposeUserId] = useState("");
  const [composeKind, setComposeKind] = useState("in_app");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Dropdown filter states
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // ====== Sub-project C: New state ======
  // Stats hook
  const { data: actStats, isLoading: statsLoading, refetch: refetchStats } = useActivityStats();

  // Simulator tab state
  const [simKind, setSimKind] = useState<ActivityKindC>("LIKE");
  const [simTargetUserId, setSimTargetUserId] = useState<string>("");
  const [simActorId, setSimActorId] = useState<string>("");
  const [simArticleSlug, setSimArticleSlug] = useState<string>("");
  const [simHighlightId, setSimHighlightId] = useState<string>("");
  const [simCommentId, setSimCommentId] = useState<string>("");
  const [simPreviewText, setSimPreviewText] = useState<string>("");
  const [simLinkHref, setSimLinkHref] = useState<string>("");
  const fireEvt = useSimulatedEvent();
  const [simSseRows, setSimSseRows] = useState<SseEventRow[]>([]);
  const [simSseStatus, setSimSseStatus] = useState<"idle" | "connecting" | "open" | "closed" | "error">("idle");
  const [simLastFireAt, setSimLastFireAt] = useState<number | null>(null);
  const [simSseLatency, setSimSseLatency] = useState<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Preferences tab state
  const [prefsPage, setPrefsPage] = useState(1);
  const prefsPageSize = 50;
  const prefsQuery = useActivityPrefsMatrix(prefsPage, prefsPageSize);
  const exportCsv = useExportActivityPrefsCsv();

  // Inspector tab state
  const [inspectorUserId, setInspectorUserId] = useState<string>("");
  const inspectorFeed = useActivityFeed(inspectorUserId || null, { limit: 50 });

  // Filter rows based on active tab and dropdown filters
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Tab filters (only legacy channel tabs)
    if (activeTab === "unread") result = result.filter((n) => !n.read);
    else if (activeTab === "read") result = result.filter((n) => n.read);
    else if (activeTab === "push") result = result.filter((n) => n.kind === "push");
    else if (activeTab === "email") result = result.filter((n) => n.kind === "email");
    else if (activeTab === "sms") result = result.filter((n) => n.kind === "sms");
    else if (activeTab === "simulator" || activeTab === "preferences" || activeTab === "inspector") {
      result = [];
    }

    // Dropdown filters
    if (channelFilter !== "all") {
      const kind = channelFilter === "in-app" ? "in_app" : channelFilter;
      result = result.filter((n) => n.kind === kind);
    }

    if (statusFilter !== "all") {
      result = result.filter((n) =>
        statusFilter === "read" ? n.read : !n.read
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [rows, activeTab, channelFilter, statusFilter, sortBy]);

  const hasActiveDropdownFilters = channelFilter !== "all" || statusFilter !== "all";

  const clearFilters = useCallback(() => {
    setChannelFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
  }, []);

  // Stats
  const totalCount = rows.length;
  const unreadCount = rows.filter((n) => !n.read).length;
  const pushCount = rows.filter((n) => n.kind === "push").length;
  const emailCount = rows.filter((n) => n.kind === "email").length;

  const getChannelIcon = (kind: string) => {
    switch (kind) {
      case "push":
        return <Bell className="size-4" />;
      case "email":
        return <Mail className="size-4" />;
      case "sms":
        return <Smartphone className="size-4" />;
      case "in_app":
        return <MessageSquare className="size-4" />;
      default:
        return <Bell className="size-4" />;
    }
  };

  const getChannelColor = (kind: string) => {
    switch (kind) {
      case "push":
        return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
      case "email":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "sms":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "in_app":
        return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const openDetail = (notification: Notification) => {
    setSelectedNotification(notification);
    setIsDetailOpen(true);
    if (!notification.read) {
      markRead.mutate(notification.id, {
        onSuccess: () => refetch(),
      });
    }
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        toast.success("All notifications marked as read");
        refetch();
      },
      onError: () => toast.error("Failed to mark all as read"),
    });
  };

  const handleMarkOneRead = (id: string) => {
    markRead.mutate(id, {
      onSuccess: () => {
        refetch();
      },
      onError: () => toast.error("Failed to mark as read"),
    });
  };

  const handleDelete = (id: string) => {
    deleteNotif.mutate(id, {
      onSuccess: () => {
        toast.success("Notification deleted");
        refetch();
      },
      onError: () => toast.error("Failed to delete notification"),
    });
  };

  const handleCompose = () => {
    if (!composeUserId) {
      toast.error("Please select a recipient");
      return;
    }
    if (!composeBody.trim()) {
      toast.error("Message body is required");
      return;
    }
    createNotif.mutate(
      {
        userId: composeUserId,
        kind: composeKind,
        body: composeBody,
        title: composeTitle || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Notification sent");
          setIsComposeOpen(false);
          setComposeUserId("");
          setComposeKind("in_app");
          setComposeTitle("");
          setComposeBody("");
          refetch();
        },
        onError: (err: any) => {
          toast.error("Failed to send notification", {
            description: err?.message,
          });
        },
      }
    );
  };

  // ============ Simulator: handle SSE lifecycle ============
  useEffect(() => {
    if (activeTab !== "simulator") {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
        setSimSseStatus("idle");
      }
      return;
    }

    try {
      const storageKey = "vellbase.admin.session.v1";
      const raw = localStorage.getItem(storageKey);
      let token: string | null = null;
      try {
        if (raw) token = JSON.parse(raw).token || null;
      } catch {
        token = null;
      }
      const base =
        (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
        (import.meta.env.DEV
          ? "http://localhost:3001/api"
          : "https://cmrxaaqf14uh403f7xj4wceyp.ewr.prisma.build/api");
      const baseClean = base.replace(/\/+$/, "");
      const url = `${baseClean}/admin/activity/stream?token=${encodeURIComponent(token ?? "")}`;
      setSimSseStatus("connecting");
      const es = new EventSource(url, { withCredentials: true });
      sseRef.current = es;

      es.addEventListener("open", () => setSimSseStatus("open"));
      es.addEventListener("error", () => {
        setSimSseStatus("error");
        try { es.close(); } catch {}
        sseRef.current = null;
      });

      const onMsg = (e: MessageEvent<any>) => {
        const receivedAt = Date.now();
        let raw = e.data;
        let kind: string | undefined;
        let userId: string | undefined;
        try {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          kind = parsed?.kind;
          userId = parsed?.userId;
          raw = JSON.stringify(parsed);
        } catch {
          /* keep as string */
        }
        setSimSseRows((prev) =>
          [
            { id: `${receivedAt}-${Math.random().toString(36).slice(2, 8)}`, receivedAt, kind, userId, raw },
            ...prev,
          ].slice(0, 100),
        );
        // Compute latency: if we just fired, compute first-seen delta
        setSimLastFireAt((lastFire) => {
          if (lastFire != null) {
            setSimSseLatency(receivedAt - lastFire);
          }
          return lastFire;
        });
      };
      es.addEventListener("message", onMsg as any);
      es.addEventListener("activity", onMsg as any);

      return () => {
        try { es.close(); } catch {}
        sseRef.current = null;
        setSimSseStatus("idle");
      };
    } catch (e) {
      setSimSseStatus("error");
    }
    // We explicitly re-run when tab becomes simulator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleFireEvent = () => {
    if (!simTargetUserId) {
      toast.error("Please select a target user");
      return;
    }
    const dto: FireSimulatedEventDto = {
      userId: simTargetUserId,
      kind: simKind,
      actorId: simActorId || undefined,
      articleSlug: simArticleSlug.trim() || undefined,
      highlightId: simHighlightId.trim() || undefined,
      commentId: simCommentId.trim() || undefined,
      previewText: simPreviewText.trim() || undefined,
      linkHref: simLinkHref.trim() || undefined,
    };
    setSimSseLatency(null);
    setSimLastFireAt(Date.now());
    fireEvt.mutate(dto, {
      onSuccess: (r) => {
        if (r.ok) {
          toast.success(`Simulated ${simKind} fired`, {
            description: `HTTP round-trip ${r.latencyMs ?? "?"}ms — waiting for SSE…`,
          });
        } else {
          toast.warning("Simulator endpoint not yet live", {
            description: "Activity routes added in Task 8. SSE latency unavailable until then.",
          });
        }
      },
      onError: (e: any) => {
        toast.error("Failed to fire simulated event", {
          description: e?.message,
        });
      },
    });
  };

  const latencyColor = (ms: number | null): string => {
    if (ms == null) return "bg-muted text-muted-foreground border-border";
    if (ms < 200) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    if (ms <= 500) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  };

  const handleExportCsv = async () => {
    try {
      const blob = await exportCsv.mutateAsync();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity-preferences-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Preferences CSV exported");
    } catch (e: any) {
      toast.error("Export failed", { description: e?.message });
    }
  };

  // Tabs display value -> Tabs uses string values. Build tab list.
  const legacyChannelTabs: { value: PageTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "push", label: "Push" },
    { value: "email", label: "Email" },
    { value: "sms", label: "SMS" },
    { value: "simulator", label: "Simulator" },
    { value: "preferences", label: "Preferences" },
    { value: "inspector", label: "Activity Inspector" },
  ];

  return (
    <div className="space-y-6">
      {/* Header with title + actions */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Community
            </p>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg border bg-primary/5 text-primary">
                <Bell className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Push, email, in-app and SMS delivery; activity simulator and preference matrix.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => { refetch(); refetchStats(); }}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            {can("notifications", "write") && (
              <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Send className="size-4" /> Compose
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Compose notification</DialogTitle>
                    <DialogDescription>
                      Send a new notification to a user across channels.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="recipient" className="text-xs font-medium">
                        Recipient
                      </Label>
                      <Select value={composeUserId} onValueChange={setComposeUserId}>
                        <SelectTrigger id="recipient">
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="channel" className="text-xs font-medium">
                        Channel
                      </Label>
                      <Select value={composeKind} onValueChange={setComposeKind}>
                        <SelectTrigger id="channel">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_app">In-App</SelectItem>
                          <SelectItem value="push">Push</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-xs font-medium">
                        Title <span className="text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="title"
                        value={composeTitle}
                        onChange={(e) => setComposeTitle(e.target.value)}
                        placeholder="Notification title"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="body" className="text-xs font-medium">
                        Message
                      </Label>
                      <Textarea
                        id="body"
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        placeholder="Write your notification message..."
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsComposeOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCompose}
                      disabled={createNotif.isPending}
                      className="gap-1.5"
                    >
                      {createNotif.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          Send notification
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* ============ NEW: Activity Stats 4-card strip ============ */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active feed rows
              </CardTitle>
              <div className="grid size-8 place-items-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Sparkles className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold tabular-nums">
                  {statsLoading ? (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  ) : (
                    actStats?.activeFeedRows ?? 0
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <TrendingUp className="size-3" /> groups
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Materialised activity feed rows system-wide.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Unread total
              </CardTitle>
              <div className="grid size-8 place-items-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Bell className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold tabular-nums">
                  {statsLoading ? (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  ) : (
                    actStats?.unreadTotal ?? 0
                  )}
                </div>
                {(actStats?.unreadTotal ?? 0) > 0 && (
                  <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Activity items still pending a read receipt.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Avg group size
              </CardTitle>
              <div className="grid size-8 place-items-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Users className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                {statsLoading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  (actStats?.avgGroupSize ?? 0).toFixed(2)
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mean actor count per aggregated group row.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                SSE connected users
              </CardTitle>
              <div className="grid size-8 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Server className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold tabular-nums">
                  {statsLoading ? (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  ) : (
                    actStats?.sseConnectedUsers ?? 0
                  )}
                </div>
                {(actStats?.sseConnectedUsers ?? 0) > 0 && (
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Live /api/activity/stream subscriber count.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Channel summary pills (compact) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "All", count: totalCount, icon: Bell, match: ["all"] },
            { label: "Unread", count: unreadCount, icon: AlertCircle, match: ["unread", "read"] as PageTab[] },
            { label: "Push", count: pushCount, icon: Bell, match: ["push"] },
            { label: "Email", count: emailCount, icon: Mail, match: ["email"] },
            { label: "SMS", count: rows.filter((n) => n.kind === "sms").length, icon: Smartphone, match: ["sms"] },
          ].map((tab) => {
            const active = tab.match.includes(activeTab as any);
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.match[0] as PageTab)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                  active
                    ? "border-primary/20 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-card hover:bg-accent/50"
                )}
              >
                <div
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <tab.icon className="size-4" />
                </div>
                <div>
                  <div className="text-lg font-semibold leading-none">{tab.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{tab.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ Master Tabs: All / Push / Email / SMS / Simulator / Preferences / Inspector ============ */}
      <Tabs value={activeTab as any} onValueChange={(v) => setActiveTab(v as PageTab)} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent border-b p-0">
          {legacyChannelTabs.map((t) => {
            const isSim = t.value === "simulator";
            const isPref = t.value === "preferences";
            const isInsp = t.value === "inspector";
            return (
              <TabsTrigger
                key={t.value}
                value={t.value as any}
                className={cn(
                  "rounded-md border-b-2 border-transparent px-3 py-2 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  activeTab === t.value
                    ? "border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {isSim && <PlayCircle className="size-3.5" />}
                  {isPref && <Settings2 className="size-3.5" />}
                  {isInsp && <Eye className="size-3.5" />}
                  {t.label}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Legacy channels content (All / Unread / Read / Push / Email / SMS) */}
        {(["all", "unread", "read", "push", "email", "sms"] as PageTab[]).includes(activeTab) && (
          <TabsContent value={activeTab as any} className="mt-0">
            {/* Notifications List */}
            <ListPage<Notification>
              title=""
              description=""
              rows={filteredRows}
              isLoading={isLoading}
              error={error}
              searchKeys={["kind", "body", "userId"]}
              pageSize={20}
              enableSelection={true}
              enableExport={true}
              enablePagination={true}
              filters={
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Channel Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant={channelFilter !== "all" ? "default" : "outline"} size="sm" className="gap-1.5 h-8">
                        <Filter className="size-3.5" />
                        Channel
                        <ChevronDown className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Filter by channel</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {([
                        { value: "all", label: "All channels" },
                        { value: "email", label: "Email" },
                        { value: "push", label: "Push" },
                        { value: "in-app", label: "In-App" },
                      ] as const).map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => setChannelFilter(option.value)}
                          className={cn(channelFilter === option.value && "bg-accent")}
                        >
                          {option.label}
                          {channelFilter === option.value && <Check className="ml-2 size-3.5" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Status Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant={statusFilter !== "all" ? "default" : "outline"} size="sm" className="gap-1.5 h-8">
                        <CheckCircle2 className="size-3.5" />
                        Status
                        <ChevronDown className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {([
                        { value: "all", label: "All statuses" },
                        { value: "read", label: "Read" },
                        { value: "unread", label: "Unread" },
                      ] as const).map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => setStatusFilter(option.value)}
                          className={cn(statusFilter === option.value && "bg-accent")}
                        >
                          {option.label}
                          {statusFilter === option.value && <Check className="ml-2 size-3.5" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Sort */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8">
                        <Clock className="size-3.5" />
                        Sort
                        <ChevronDown className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {([
                        { value: "newest", label: "Newest first" },
                        { value: "oldest", label: "Oldest first" },
                      ] as const).map(({ value, label }) => (
                        <DropdownMenuItem
                          key={value}
                          onClick={() => setSortBy(value)}
                          className={cn(sortBy === value && "bg-accent")}
                        >
                          {label}
                          {sortBy === value && <Check className="ml-2 size-3.5" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={handleMarkAllRead}
                      disabled={markAllRead.isPending}
                    >
                      {markAllRead.isPending ? (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5 mr-1" />
                      )}
                      Mark all read
                    </Button>
                  )}

                  {/* Active filter badges */}
                  {hasActiveDropdownFilters && (
                    <>
                      <div className="h-6 w-px bg-border" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Active filters:</span>
                        {channelFilter !== "all" && (
                          <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setChannelFilter("all")}>
                            Channel: {channelFilter}
                            <X className="size-3" />
                          </Badge>
                        )}
                        {statusFilter !== "all" && (
                          <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setStatusFilter("all")}>
                            Status: {statusFilter}
                            <X className="size-3" />
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={clearFilters}
                        >
                          Clear all
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              }
              columns={[
                {
                  key: "notification",
                  header: "Notification",
                  cell: (n) => (
                    <button
                      onClick={() => openDetail(n)}
                      className="flex items-start gap-3 text-left w-full group"
                    >
                      <div
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-lg border",
                          getChannelColor(n.kind)
                        )}
                      >
                        {getChannelIcon(n.kind)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium capitalize">{n.kind}</span>
                          {!n.read && (
                            <span className="size-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.body ?? "—"}
                        </div>
                        {n.metadata?.title && (
                          <div className="text-xs font-medium text-foreground mt-1">
                            {n.metadata.title}
                          </div>
                        )}
                      </div>
                    </button>
                  ),
                },
                {
                  key: "recipient",
                  header: "Recipient",
                  cell: (n) => (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={n.user?.avatar ?? ""} alt={n.user?.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {n.user?.name?.[0]?.toUpperCase() ?? n.userId?.slice(0, 1)?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm truncate">{n.user?.name ?? `User ${n.userId?.slice(0, 8)}`}</div>
                        <div className="text-[11px] text-muted-foreground">{n.user?.email ?? n.userId}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (n) => (
                    <div className="flex items-center gap-2">
                      <StatusBadge status={n.read ? "delivered" : "pending"} />
                      {n.read && n.readAt && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.updatedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  ),
                  className: "w-32",
                },
                {
                  key: "channel",
                  header: "Channel",
                  cell: (n) => (
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] font-medium capitalize", getChannelColor(n.kind))}
                    >
                      {n.kind}
                    </Badge>
                  ),
                  className: "hidden sm:table-cell w-24",
                },
                {
                  key: "sent",
                  header: "Sent",
                  cell: (n) => (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </div>
                      {n.scheduledFor && (
                        <div className="text-[11px] text-amber-500 mt-0.5">
                          Scheduled
                        </div>
                      )}
                    </div>
                  ),
                  className: "hidden md:table-cell w-28",
                  headerClassName: "text-right",
                },
              ]}
              renderRowActions={(n) => (
                <div className="flex items-center justify-end gap-0.5 opacity-100 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-primary"
                    onClick={() => openDetail(n)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => openDetail(n)}>
                        <Eye className="size-3.5 mr-2" />
                        View details
                      </DropdownMenuItem>
                      {!n.read && (
                        <DropdownMenuItem onClick={() => handleMarkOneRead(n.id)}>
                          <CheckCircle2 className="size-3.5 mr-2" />
                          Mark as read
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(n.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              onRowClick={(n) => openDetail(n)}
            />
          </TabsContent>
        )}

        {/* ============ Simulator TabsContent ============ */}
        <TabsContent value="simulator" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Rocket className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Live Simulator</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Fire a synthetic activity event into the backend; watch it arrive live via SSE.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Kind</Label>
                  <Select value={simKind} onValueChange={(v) => setSimKind(v as ActivityKindC)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Target user (userId)</Label>
                  <Select value={simTargetUserId} onValueChange={setSimTargetUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a target user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} · {u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Actor (optional)</Label>
                  <Select value={simActorId} onValueChange={setSimActorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional actor user (defaults to target)" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} · {u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Article slug</Label>
                    <Input
                      value={simArticleSlug}
                      onChange={(e) => setSimArticleSlug(e.target.value)}
                      placeholder="e.g. why-i-wrote-vellbase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Highlight id</Label>
                    <Input
                      value={simHighlightId}
                      onChange={(e) => setSimHighlightId(e.target.value)}
                      placeholder="optional highlight id"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium">Comment id</Label>
                    <Input
                      value={simCommentId}
                      onChange={(e) => setSimCommentId(e.target.value)}
                      placeholder="optional comment id"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium">Preview text</Label>
                    <Input
                      value={simPreviewText}
                      onChange={(e) => setSimPreviewText(e.target.value)}
                      placeholder="Optional preview snippet shown in feed"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium">Link target href</Label>
                    <Input
                      value={simLinkHref}
                      onChange={(e) => setSimLinkHref(e.target.value)}
                      placeholder="/posts/… or external URL"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] border",
                      simSseStatus === "open"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                        : simSseStatus === "connecting"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                        : simSseStatus === "error"
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400"
                        : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    <span className="mr-1 inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          simSseStatus === "open"
                            ? "bg-emerald-500 animate-pulse"
                            : simSseStatus === "connecting"
                            ? "bg-amber-500 animate-pulse"
                            : simSseStatus === "error"
                            ? "bg-rose-500"
                            : "bg-muted-foreground"
                        )}
                      />
                      SSE: {simSseStatus}
                    </span>
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-[11px] border", latencyColor(simSseLatency))}
                  >
                    SSE latency{" "}
                    <span className="ml-1 font-semibold tabular-nums">
                      {simSseLatency == null ? "—" : `${simSseLatency} ms`}
                    </span>
                  </Badge>
                </div>

                <Button
                  onClick={handleFireEvent}
                  disabled={fireEvt.isPending}
                  className="w-full gap-1.5"
                >
                  {fireEvt.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <PlayCircle className="size-4" />
                  )}
                  Fire simulated {simKind} event
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Uses admin-only <code className="bg-muted px-1 rounded">POST /admin/activity/fire-event</code> route
                  (Task 8). Until it is added, returns a graceful stub so this UI renders.
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">SSE live viewer</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Stream from <code className="bg-muted px-1 rounded">/admin/activity/stream</code> — new events prepend below.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSimSseRows([])}
                  className="gap-1.5"
                >
                  <RotateCw className="size-3.5" /> Clear
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[520px] border-y">
                  {simSseRows.length === 0 ? (
                    <div className="grid place-items-center h-full py-16 text-center">
                      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground mb-3">
                        <EyeOff className="size-5" />
                      </div>
                      <p className="text-sm font-medium">No events yet</p>
                      <p className="text-xs text-muted-foreground max-w-sm mt-1">
                        Fire a simulated event on the left, or wait for real activity to
                        stream through from other clients.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {simSseRows.map((r) => (
                        <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                          <div className="grid size-7 shrink-0 place-items-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mt-0.5">
                            <Sparkles className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {r.kind && (
                                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                                  {r.kind}
                                </Badge>
                              )}
                              {r.userId && (
                                <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[180px]">
                                  user {r.userId.slice(0, 10)}…
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                                {new Date(r.receivedAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <pre className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap break-words font-mono bg-muted/40 rounded p-2 border border-border/60">
{r.raw}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ Preferences TabsContent ============ */}
        <TabsContent value="preferences" className="mt-0 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" />
                Activity preferences matrix
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Per-user grouping toggles, reminder cadence and Expo push token counts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => prefsQuery.refetch()}
                className="gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExportCsv}
                disabled={exportCsv.isPending}
                className="gap-1.5"
              >
                {exportCsv.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Export CSV
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">User</TableHead>
                      <TableHead className="text-center">Group likes</TableHead>
                      <TableHead className="text-center">Group comments</TableHead>
                      <TableHead className="text-center">Group follows</TableHead>
                      <TableHead>Reminder cadence</TableHead>
                      <TableHead className="text-right">Expo tokens</TableHead>
                      <TableHead>Quiet hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prefsQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          <Loader2 className="size-4 inline-block animate-spin mr-2" /> Loading matrix…
                        </TableCell>
                      </TableRow>
                    ) : !prefsQuery.data || prefsQuery.data.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          <div className="grid place-items-center">
                            <EyeOff className="size-6 mb-2 text-muted-foreground/70" />
                            <p className="text-sm font-medium">No preference rows yet</p>
                            <p className="text-xs max-w-md mt-1">
                              Endpoint <code className="bg-muted px-1 rounded">/admin/activity/prefs-matrix</code> will
                              populate this table once Task 8 adds the backend route.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      prefsQuery.data.rows.map((row) => (
                        <TableRow key={row.userId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="size-7">
                                <AvatarImage src={row.avatar ?? ""} alt={row.name ?? ""} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                  {row.name?.[0]?.toUpperCase() ?? row.handle?.[0]?.toUpperCase() ?? "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="text-sm truncate font-medium">
                                  {row.name || row.handle || row.userId}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {row.email ?? `@${row.handle ?? row.userId.slice(0, 10)}`}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="grid place-items-center">
                              <Switch checked={row.groupLikes} disabled />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="grid place-items-center">
                              <Switch checked={row.groupComments} disabled />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="grid place-items-center">
                              <Switch checked={row.groupFollows} disabled />
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Clock className="size-3 text-muted-foreground" />
                              Every{" "}
                              <span className="font-semibold tabular-nums">
                                {row.activityReminderEveryMinutes}
                              </span>{" "}
                              min
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">
                            <Badge variant="outline" className="text-[11px]">
                              {row.expoPushTokensCount} tokens
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {row.quietHoursStart || row.quietHoursEnd ? (
                              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                                {row.quietHoursStart ?? "—"} → {row.quietHoursEnd ?? "—"}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">not set</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Total rows: <span className="font-medium text-foreground">{prefsQuery.data?.total ?? 0}</span>
              {prefsQuery.data && prefsQuery.data.total > prefsPageSize && (
                <> · Page {prefsPage} / {Math.ceil(prefsQuery.data.total / prefsPageSize)}</>
              )}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={prefsPage <= 1 || prefsQuery.isFetching}
                onClick={() => setPrefsPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  prefsQuery.isFetching ||
                  !prefsQuery.data ||
                  prefsPage * prefsPageSize >= prefsQuery.data.total
                }
                onClick={() => setPrefsPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ============ Activity Inspector TabsContent ============ */}
        <TabsContent value="inspector" className="mt-0 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="size-4 text-muted-foreground" />
                Activity inspector
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick a user to inspect their aggregated ActivityItem group cards.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-full sm:w-[380px] space-y-1.5">
                <Label className="text-xs font-medium">User</Label>
                <Select value={inspectorUserId} onValueChange={setInspectorUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user to inspect" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} · {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {inspectorUserId ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const u = users.find((x) => x.id === inspectorUserId);
                    if (!u) return null;
                    return (
                      <>
                        <Avatar className="size-9">
                          <AvatarImage src={u.avatar ?? ""} alt={u.name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {u.name?.[0]?.toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            @{u.handle} · {u.email}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Total: <span className="font-semibold text-foreground tabular-nums">{inspectorFeed.data?.total ?? 0}</span>
                  </span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>
                    Unread:{" "}
                    <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {inspectorFeed.data?.unread ?? 0}
                    </span>
                  </span>
                </div>
              </div>

              {inspectorFeed.isLoading ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    <Loader2 className="size-4 inline-block animate-spin mr-2" /> Loading feed…
                  </CardContent>
                </Card>
              ) : !inspectorFeed.data || inspectorFeed.data.items.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="grid size-12 mx-auto place-items-center rounded-full bg-muted text-muted-foreground mb-3">
                      <EyeOff className="size-5" />
                    </div>
                    <p className="text-sm font-medium">No activity groups</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                      Either this user has not yet generated any activity, or{" "}
                      <code className="bg-muted px-1 rounded">/admin/activity/feed/:userId</code> is
                      still pending Task 8 implementation.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {inspectorFeed.data.items.map((it: ActivityGroupItem) => (
                    <ActivityGroupCard key={it.id} item={it} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="grid size-12 mx-auto place-items-center rounded-full bg-muted text-muted-foreground mb-3">
                  <Users className="size-5" />
                </div>
                <p className="text-sm font-medium">Pick a user</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                  Select any user to see their activity feed groups with counts, actor previews
                  and clickable link targets.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Notification Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "grid size-10 place-items-center rounded-lg border",
                  selectedNotification ? getChannelColor(selectedNotification.kind) : ""
                )}
              >
                {selectedNotification && getChannelIcon(selectedNotification.kind)}
              </div>
              <div>
                <DialogTitle className="text-base capitalize">
                  {selectedNotification?.kind} notification
                </DialogTitle>
                <DialogDescription>
                  {selectedNotification?.read ? "Delivered" : "Pending delivery"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm">{selectedNotification.body}</p>
                {selectedNotification.metadata?.title && (
                  <p className="text-sm font-medium mt-2">
                    {selectedNotification.metadata.title}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-medium">
                    {selectedNotification.user?.name ?? selectedNotification.userId}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Channel</span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs capitalize", getChannelColor(selectedNotification.kind))}
                  >
                    {selectedNotification.kind}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sent</span>
                  <span>
                    {formatDistanceToNow(new Date(selectedNotification.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                {selectedNotification.read && selectedNotification.readAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Read</span>
                    <span className="text-emerald-500">
                      {formatDistanceToNow(new Date(selectedNotification.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Close
            </Button>
            {!selectedNotification?.read && (
              <Button
                onClick={() => {
                  if (selectedNotification) {
                    handleMarkOneRead(selectedNotification.id);
                    setIsDetailOpen(false);
                  }
                }}
                disabled={markRead.isPending}
                className="gap-1.5"
              >
                {markRead.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Mark as read
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Activity group card (inspector)
// ============================================================================
function ActivityGroupCard({ item }: { item: ActivityGroupItem }) {
  const kindColor = (k: ActivityKindC) => {
    switch (k) {
      case "LIKE": return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "COMMENT":
      case "REPLY": return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
      case "FOLLOW": return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
      case "MENTION": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "BOOKMARK": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "SYSTEM": return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
      case "SHARE": return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const avatarSrc = (a: { avatar?: string | null; avatarUrl?: string | null }) =>
    a.avatar || a.avatarUrl || "";

  const fallbackChar = (a: { name?: string | null; handle?: string | null; id: string }) =>
    (a.name?.[0] ?? a.handle?.[0] ?? a.id?.[0] ?? "?").toUpperCase();

  const actors = item.actors ?? [];
  const visible = actors.slice(0, 5);

  return (
    <Card className={cn(!item.read && "ring-1 ring-primary/10")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wider", kindColor(item.kind))}>
              {item.kind}
            </Badge>
            <Badge variant="secondary" className="text-[10px] tabular-nums">
              {item.count} ×
            </Badge>
            {!item.read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {formatDistanceToNow(new Date(item.latestActivityAt), { addSuffix: true })}
          </span>
        </div>

        {item.previewText && (
          <p className="text-sm text-foreground line-clamp-2">{item.previewText}</p>
        )}

        {/* Actor preview */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {visible.length === 0 ? (
              <div className="grid size-7 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
                ?
              </div>
            ) : (
              visible.map((a, idx) => (
                <Avatar
                  key={a.id + "-" + idx}
                  className="size-7 border-2 border-background"
                  title={a.name ?? a.handle ?? a.id}
                >
                  <AvatarImage src={avatarSrc(a)} />
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {fallbackChar(a)}
                  </AvatarFallback>
                </Avatar>
              ))
            )}
            {item.extraActorCount > 0 && (
              <div className="grid size-7 place-items-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                +{item.extraActorCount}
              </div>
            )}
          </div>
          {actors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              {actors.slice(0, 3).map((a, idx) => (
                <code key={a.id + "-p-" + idx} className="bg-muted px-1 rounded font-mono">
                  {a.id.slice(0, 8)}
                </code>
              ))}
              {actors.length > 3 && <span>+{actors.length - 3} more</span>}
            </div>
          )}
        </div>

        {/* Link targets */}
        {(item.articleSlug || item.highlightId || item.commentId || item.linkHref) && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60">
            <LinkIcon className="size-3 text-muted-foreground shrink-0" />
            {item.articleSlug && (
              <a
                href={`/posts/${item.articleSlug}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-primary hover:underline truncate max-w-[200px]"
                title={item.articleSlug}
              >
                /posts/{item.articleSlug}
              </a>
            )}
            {item.highlightId && (
              <a
                href={`/highlights/${item.highlightId}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-primary hover:underline truncate max-w-[180px]"
                title={item.highlightId}
              >
                /highlights/{item.highlightId.slice(0, 10)}…
              </a>
            )}
            {item.commentId && (
              <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 rounded truncate max-w-[180px]" title={item.commentId}>
                comment {item.commentId.slice(0, 10)}…
              </span>
            )}
            {item.linkHref && (
              <a
                href={item.linkHref}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-primary hover:underline truncate max-w-[220px]"
                title={item.linkHref}
              >
                {item.linkHref}
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

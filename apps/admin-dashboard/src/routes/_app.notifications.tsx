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
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useAdminNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useCreateNotification,
  useUsers,
  type Notification,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo, useCallback } from "react";
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

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Vellum Admin" }] }),
  component: NotificationsPage,
});

type ChannelFilter = "all" | "email" | "push" | "in-app" | "sms";
type StatusFilter = "all" | "read" | "unread";
type SortOption = "newest" | "oldest";

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

  const [activeTab, setActiveTab] = useState("all");
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

  // Filter rows based on active tab and dropdown filters
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Tab filters
    if (activeTab !== "all") {
      if (activeTab === "unread") result = result.filter((n) => !n.read);
      else if (activeTab === "read") result = result.filter((n) => n.read);
      else if (activeTab === "push") result = result.filter((n) => n.kind === "push");
      else if (activeTab === "email") result = result.filter((n) => n.kind === "email");
      else if (activeTab === "sms") result = result.filter((n) => n.kind === "sms");
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

  return (
    <div className="space-y-6">
      {/* Custom header with tabs */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Community
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Push, email, in-app and SMS delivery across all audiences.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
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

        {/* Channel stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {[
            { label: "All", count: totalCount, icon: Bell, active: activeTab === "all" },
            { label: "Unread", count: unreadCount, icon: AlertCircle, active: activeTab === "unread" },
            { label: "Push", count: pushCount, icon: Bell, active: activeTab === "push" },
            { label: "Email", count: emailCount, icon: Mail, active: activeTab === "email" },
            { label: "SMS", count: rows.filter((n) => n.kind === "sms").length, icon: Smartphone, active: activeTab === "sms" },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label.toLowerCase())}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                tab.active
                  ? "border-primary/20 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card hover:bg-accent/50"
              )}
            >
              <div
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-md",
                  tab.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                <tab.icon className="size-4" />
              </div>
              <div>
                <div className="text-lg font-semibold leading-none">{tab.count}</div>
                <div className="text-xs text-muted-foreground mt-1">{tab.label}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

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

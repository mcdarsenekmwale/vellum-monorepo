"use client";

import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Bell,
  Command as CmdIcon,
  Plus,
  Check,
  Settings,
  LogOut,
  User,
  Shield,
  FileText,
  Image,
  Video,
  Users,
  Inbox,
  ExternalLink,
  Loader2,
  Trash2,
  AlertTriangle,
  Info,
  CheckCheck,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useUnreadNotificationCount,
  useAdminNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useCurrentUser,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

type NotificationKind = "report" | "article" | "user" | "system" | "comment" | "like";

const NOTIFICATION_ICONS: Record<NotificationKind, React.ReactNode> = {
  report: <AlertTriangle className="size-4 text-amber-500" />,
  article: <FileText className="size-4 text-blue-500" />,
  user: <Users className="size-4 text-emerald-500" />,
  system: <Info className="size-4 text-muted-foreground" />,
  comment: <MessageSquare className="size-4 text-violet-500" />,
  like: <Heart className="size-4 text-rose-500" />,
};

const NOTIFICATION_COLORS: Record<NotificationKind, string> = {
  report: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  article: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  user: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  system: "bg-muted text-muted-foreground",
  comment: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  like: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

// Import missing icons
import { MessageSquare, Heart } from "lucide-react";

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { logout, can } = useAuth();
  const { data: currentUser } = useCurrentUser();

  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  const item = ALL_NAV_ITEMS.find((n) => n.to === "/" + first);

  // ─── Notifications ───────────────────────────────────────────────────
  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.count ?? 0;
  const { data: notifData, isLoading: notifsLoading } = useAdminNotifications({ pageSize: 8 });
  const recentNotifications = notifData?.data ?? [];
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const [notifOpen, setNotifOpen] = useState(false);

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenPalette();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        navigate({ to: "/articles/new" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenPalette, navigate]);

  const handleMarkAllRead = useCallback(() => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success("All notifications marked as read"),
      onError: () => toast.error("Failed to mark notifications as read"),
    });
  }, [markAllRead]);

  const handleMarkOneRead = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    markRead.mutate(id, {
      onSuccess: () => {
        // Silent — no toast for single read to avoid noise
      },
    });
  }, [markRead]);

  const handleDeleteNotif = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotification.mutate(id, {
      onSuccess: () => toast.success("Notification removed"),
    });
  }, [deleteNotification]);

  const handleNotifClick = useCallback((n: typeof recentNotifications[0]) => {
    if (!n.read) handleMarkOneRead(n.id);
    setNotifOpen(false);

    // Navigate based on notification kind and metadata
    if (n.link) {
      navigate({ to: n.link });
    } else if (n.targetId) {
      switch (n.kind) {
        case "report":
          navigate({ to: "/reports/$reportId", params: { reportId: n.targetId } });
          break;
        case "article":
          navigate({ to: "/articles/$articleId", params: { articleId: n.targetId } });
          break;
        case "user":
          navigate({ to: "/users/$userId", params: { userId: n.targetId } });
          break;
        case "comment":
          navigate({ to: "/articles/$articleId", params: { articleId: n.targetId }, search: { comment: n.commentId } });
          break;
      }
    }
  }, [navigate, handleMarkOneRead]);

  // ─── Breadcrumb Builder ─────────────────────────────────────────────
  const buildBreadcrumbs = () => {
    const crumbs: { label: string; to?: string }[] = [{ label: "Vellum", to: "/dashboard" }];

    if (item) {
      crumbs.push({ label: item.title, to: item.to });
    }

    // Handle nested routes like /users/123 or /articles/123/edit
    if (parts.length > 1) {
      const isId = /^[a-zA-Z0-9_-]+$/.test(parts[1]) && parts[1].length > 8;
      if (isId) {
        crumbs.push({ label: "Detail" });
      } else {
        crumbs.push({ label: parts[1].replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) });
      }
    }

    if (parts.length > 2) {
      crumbs.push({ label: parts[2].replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) });
    }

    return crumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  // ─── Quick Actions ─────────────────────────────────────────────────
  const quickActions = [
    { label: "New article", icon: FileText, to: "/articles/new", shortcut: "⌘N" },
    { label: "Invite user", icon: Users, to: "/users", search: { invite: true } },
    { label: "New highlight", icon: Video, to: "/highlights/new" },
    { label: "Upload media", icon: Image, to: "/media" },
    { label: "New report", icon: Shield, to: "/reports", requires: "reports", permission: "write" },
  ].filter((a) => !a.requires || can(a.requires as any, a.permission as any));

  return (
    <TooltipProvider delayDuration={200}>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sm:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* ─── Breadcrumbs ───────────────────────────────────────────── */}
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center">
                {idx > 0 && <BreadcrumbSeparator className="mx-1.5" />}
                <BreadcrumbItem>
                  {crumb.to && idx < breadcrumbs.length - 1 ? (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.to} className="hover:text-foreground transition-colors">
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className={cn(
                      "truncate",
                      idx === breadcrumbs.length - 1 ? "max-w-[200px]" : "max-w-[120px]"
                    )}>
                      {crumb.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        {/* ─── Right Actions ─────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Search Trigger */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenPalette}
                className="hidden md:flex h-9 w-[260px] items-center gap-2 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Search className="size-3.5 shrink-0" />
                <span className="truncate">Search or jump to…</span>
                <kbd className="ml-auto flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium shadow-sm">
                  <CmdIcon className="size-3" />K
                </kbd>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Command palette</TooltipContent>
          </Tooltip>

          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={onOpenPalette}
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>

          {/* New Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="hidden sm:inline-flex gap-1.5">
                <Plus className="size-4" /> New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Create new</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {quickActions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  onClick={() => navigate({ to: action.to, search: action.search })}
                  className="gap-2.5"
                >
                  <action.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{action.label}</span>
                  {action.shortcut && (
                    <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Notifications"
                className="relative"
              >
                <Bell className="size-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-in zoom-in-50">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0" sideOffset={8}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={handleMarkAllRead}
                      disabled={markAllRead.isPending}
                    >
                      {markAllRead.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <CheckCheck className="size-3" />
                      )}
                      Mark all read
                    </Button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Inbox className="size-8 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No notifications</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      You're all caught up!
                    </p>
                  </div>
                ) : (
                  recentNotifications.map((n) => {
                    const kind = n.kind as NotificationKind;
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn(
                          "group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b last:border-0",
                          n.read
                            ? "hover:bg-accent/30"
                            : "bg-accent/20 hover:bg-accent/40"
                        )}
                      >
                        {/* Icon */}
                        <div className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          NOTIFICATION_COLORS[kind] ?? NOTIFICATION_COLORS.system
                        )}>
                          {NOTIFICATION_ICONS[kind] ?? <Info className="size-4" />}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">
                              {n.title ?? n.kind}
                            </p>
                            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                            {n.body ?? "—"}
                          </p>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <button
                                onClick={(e) => handleMarkOneRead(n.id, e)}
                                className="text-[11px] text-primary hover:underline flex items-center gap-1"
                              >
                                <Check className="size-3" /> Mark read
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDeleteNotif(n.id, e)}
                              className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
                            >
                              <Trash2 className="size-3" /> Remove
                            </button>
                          </div>
                        </div>

                        {/* Unread dot */}
                        {!n.read && (
                          <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="border-t p-2">
                <DropdownMenuItem
                  onClick={() => {
                    setNotifOpen(false);
                    navigate({ to: "/notifications" });
                  }}
                  className="justify-center text-sm font-medium text-primary cursor-pointer"
                >
                  View all notifications
                  <ExternalLink className="size-3 ml-1.5" />
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Logout Button */}
          <Button onClick={() => {
            logout();
            toast.success("Signed out successfully");
          }}
            variant='ghost' size={'icon'}
            className="gap-2 text-destructive focus:text-destructive cursor-pointer hover:text-destructive/80 hover:bg-transparent transition-colors"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
    </TooltipProvider>
  );
}
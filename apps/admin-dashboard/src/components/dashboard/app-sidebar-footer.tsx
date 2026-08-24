// components/layout/AppSidebarFooter.tsx

import { useState, useCallback, useEffect } from "react";
import {
  ChevronsUpDown,
  ChevronsDownUp,
  LogOut,
  User,
  Settings,
  Shield,
  Activity,
  Circle,
  CircleCheck,
  CircleX,
  CircleAlert,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { SidebarFooter } from "@/components/ui/sidebar";
import { useNavigate } from "@tanstack/react-router";
import { avatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsSupportAgent, useUpdateUserPresence } from "@/lib/api/hooks";

// ─── Types ───

type UserStatus = "ONLINE" | "AWAY" | "BUSY" | "OFFLINE";

interface UserStatusOption {
  value: UserStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  description: string;
}

// ─── Status Configuration ───

const USER_STATUSES: UserStatusOption[] = [
  {
    value: "ONLINE",
    label: "Online",
    icon: Circle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    description: "Available and ready to help",
  },
  {
    value: "AWAY",
    label: "Away",
    icon: CircleAlert,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    description: "Temporarily unavailable",
  },
  {
    value: "BUSY",
    label: "Busy",
    icon: CircleX,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    description: "Currently handling tickets",
  },
  {
    value: "OFFLINE",
    label: "Offline",
    icon: CircleCheck,
    color: "text-muted-foreground",
    bg: "bg-muted/30",
    description: "Not available",
  },
];

// ─── Helper Functions ───

function getStatusConfig(status: UserStatus): UserStatusOption {
  return USER_STATUSES.find((s) => s.value === status) || USER_STATUSES[0];
}

// ─── Main Component ───

interface AppSidebarFooterProps {
  user?: any;
  logout: () => void;
}

export function AppSidebarFooter(props: AppSidebarFooterProps) {
  const { user, logout } = props;
  const navigate = useNavigate();
  const updateStatus = useUpdateUserPresence();

  // ─── Check if user is a support agent (by checking agent table) ───
  const { data: isAgent, isLoading: isAgentLoading } = useIsSupportAgent(
    user?.id
  );

  // ─── State ───
  const [currentStatus, setCurrentStatus] = useState<UserStatus>("ONLINE");
  const [isUpdating, setIsUpdating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ─── Check if user can manage status ───
  const canManageStatus = user?.id && isAgent && !isAgentLoading;

  // ─── Load user's current status from presence ───
  useEffect(() => {
    if (user?.presence?.status) {
      const statusMap: Record<string, UserStatus> = {
        online: "ONLINE",
        away: "AWAY",
        busy: "BUSY",
        offline: "OFFLINE",
      };
      const mapped = statusMap[user.presence.status.toLowerCase()];
      if (mapped) {
        setCurrentStatus(mapped);
      }
    }
  }, [user]);

  // ─── Handle status change ───
  const handleStatusChange = useCallback(
    async (status: UserStatus) => {
      if (!user?.id) return;

      setIsUpdating(true);
      try {
        await updateStatus.mutateAsync({
          userId: user.id,
          status: status.toLowerCase(),
        });
        setCurrentStatus(status);
        toast.success(`Status updated to ${getStatusConfig(status).label}`);
      } catch (error) {
        toast.error("Failed to update status");
      } finally {
        setIsUpdating(false);
      }
    },
    [user, updateStatus],
  );

  // ─── Get current status config ───
  const statusConfig = getStatusConfig(currentStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <SidebarFooter className="border-t">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xs px-2 py-2 text-left hover:bg-sidebar-accent cursor-pointer transition-colors",
              isUpdating && "opacity-50 pointer-events-none"
            )}
          >
            <div className="flex flex-row w-full items-center justify-between gap-2.5">
              {/* Avatar with status indicator */}
              <div className="relative shrink-0">
                <Avatar className="size-8">
                  <AvatarImage
                    src={avatarUrl(user?.avatarSeed ?? "guest")}
                    alt={user?.name ?? "You"}
                  />
                  <AvatarFallback>{user?.name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>

                {/* Status dot - only shown if user is a support agent */}
                {canManageStatus && (
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background flex items-center justify-center",
                      statusConfig.bg,
                      statusConfig.color
                    )}
                  >
                    <StatusIcon className="size-2 fill-current" />
                  </span>
                )}
              </div>

              {!collapsed && (
                <div className="min-w-0 leading-tight flex-1">
                  <div className="truncate text-sm font-medium">
                    {user?.name ?? "Signed out"}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span>{user?.role ?? "—"}</span>
                    {canManageStatus && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className={statusConfig.color}>
                          {statusConfig.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {!collapsed ? (
                <ChevronsUpDown className="size-4 shrink-0" />
              ) : (
                <ChevronsDownUp className="size-4 shrink-0" />
              )}
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="right" align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </DropdownMenuLabel>

          {/* ─── Status Management (Only for Support Agents) ─── */}
          {canManageStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Activity className="size-4" />
                  Status
                  {isUpdating && (
                    <Loader2 className="size-3 ml-auto animate-spin" />
                  )}
                  <span
                    className={cn(
                      "ml-auto text-xs font-medium",
                      statusConfig.color
                    )}
                  >
                    {statusConfig.label}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {USER_STATUSES.map((status) => {
                    const Icon = status.icon;
                    const isActive = currentStatus === status.value;
                    return (
                      <DropdownMenuItem
                        key={status.value}
                        onClick={() => handleStatusChange(status.value)}
                        className={cn("gap-2", isActive && "bg-accent")}
                        disabled={isUpdating}
                      >
                        <Icon className={cn("size-4", status.color)} />
                        <div className="flex-1">
                          <div>{status.label}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {status.description}
                          </div>
                        </div>
                        {isActive && (
                          <div className="size-2 rounded-full bg-primary" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}

          <DropdownMenuSeparator />

          {/* ─── Navigation Items ─── */}
          <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
            <User className="mr-2 size-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
            <Settings className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>

          {/* ─── Support Quick Actions ─── */}
          {canManageStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/support" })}>
                <Shield className="mr-2 size-4" />
                Support Dashboard
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          {/* ─── Sign Out ─── */}
          <DropdownMenuItem
            onSelect={() => {
              logout();
              navigate({ to: "/auth/login" });
            }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarFooter>
  );
}
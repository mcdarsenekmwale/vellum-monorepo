"use client";

import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV } from "@/lib/nav";
import { avatarUrl } from "@/lib/avatar";
import { useAuth } from "@/lib/auth/context";
import { canVisit } from "@/lib/auth/rbac";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg overflow-hidden border border-border">
            <img src="/favicon.svg" alt="Vellum" className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display italic text-xl tracking-tight">Vellum</div>
              <div className="truncate text-[11px] text-muted-foreground">
                Admin Console
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => {
          const items = group.items.filter((item) => canVisit(user?.role, item.to));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active =
                      pathname === item.to || pathname.startsWith(item.to + "/");
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <Link to={item.to} className="flex items-center gap-2">
                            <item.icon className="size-4 shrink-0" />
                            <span className="truncate">{item.title}</span>
                            {item.badge && !collapsed && (
                              <Badge
                                variant="secondary"
                                className="ml-auto h-5 px-1.5 text-[10px] font-medium"
                              >
                                {item.badge}
                              </Badge>
                            )}
                            {active && !collapsed && (
                              <ChevronRight className="ml-auto size-3.5 opacity-60" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild >
            <button className="flex w-full items-center gap-2.5 rounded-xs px-2 py-2 text-left hover:bg-sidebar-accent cursor-pointer">
              <div className="flex row w-full items-center justify-between gap-2.5">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={avatarUrl(user?.avatarSeed ?? "guest")} alt={user?.name ?? "You"} />
                  <AvatarFallback>{user?.name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-sm font-medium">{user?.name ?? "Signed out"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {user?.role ?? "—"} · {user?.email ?? ""}
                    </div>
                  </div>
                )}
              </div>
              {!collapsed ? <ChevronsUpDown className="size-4" /> : <ChevronsDownUp className="size-4" />}
            </button>

          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
    </Sidebar>
  );
}

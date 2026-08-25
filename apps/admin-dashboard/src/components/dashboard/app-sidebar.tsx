"use client";

import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { NAV } from "@/lib/nav";
import { useAuth } from "@/lib/auth/context";
import { canVisit } from "@/lib/auth/rbac";
import { AppSidebarFooter } from "./app-sidebar-footer";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, logout } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg overflow-hidden border border-border">
            <img src="/favicon.svg" alt="Vellbase" className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display italic text-xl tracking-tight">Vellbase</div>
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
                    const active = pathname === item.to || pathname.startsWith(item.to + "/");
                    const title = (item.to === "/support") && user?.role === "SupportAdmin" ? "Overview" : item.title;
                    
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={title}>
                          <Link to={item.to} className="flex items-center gap-2">
                            <item.icon className="size-4 shrink-0" />
                            <span className="truncate">{title}</span>
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

      <AppSidebarFooter user={user} logout={logout} />
    </Sidebar>
  );
}

// lib/navigation.ts

import {
  LayoutDashboard,
  Users,
  Shield,
  KeyRound,
  FileText,
  MessageSquare,
  Film,
  Video,
  Image as ImageIcon,
  FolderTree,
  Tags,
  ListMusic,
  Music2,
  MessagesSquare,
  Flag,
  Gavel,
  UserPlus,
  Bell,
  BarChart3,
  Megaphone,
  Bot,
  Webhook,
  Cog,
  HardDrive,
  Terminal,
  ScrollText,
  Activity,
  ToggleLeft,
  Settings,
  UserCircle,
  HelpCircle,
  Headphones,
  Ticket,
  BookOpen,
  FileKey,
  ShieldPlus,
  Trash2,
  Building2,
  Users2,
  UserCogIcon,
  FileSpreadsheet,
  GitCompare,
  LockKeyhole,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { Role, roleAtLeast } from "./auth/rbac";


// ─── Navigation Item Types ───

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
  minRole?: Role; // Minimum role required to see this item
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// ─── Navigation Configuration ───

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard, minRole: "User" },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Users", to: "/users", icon: Users, minRole: "Admin" },
      // { title: "Deleted Users", to: "/users/deleted", icon: Trash2, minRole: "Admin" },
      { title: "Roles", to: "/roles", icon: Shield, minRole: "Admin" },
      { title: "Permissions", to: "/permissions", icon: KeyRound, minRole: "Admin" },
    ],
  },
  {
    label: "Access",
    items: [
      { title: "Access Control", to: "/access-control", icon: Shield, minRole: "Admin" },
      { title: "Request Access", to: "/request-access", icon: ShieldPlus, minRole: 'Creator' },
      { title: "Role Requests", to: "/role-requests", icon: FileKey, minRole: 'Admin' },
      { title: "Ticket Access Requests", to: "/support/tickets/access-requests", icon: LockKeyhole, minRole: "SupportAdmin" },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Articles", to: "/articles", icon: FileText, minRole: "Guest" },
      { title: "Posts", to: "/posts", icon: MessageSquare, minRole: "Guest" },
      { title: "Highlights", to: "/highlights", icon: Film, minRole: "Guest" },
      { title: "Videos", to: "/videos", icon: Video, minRole: "Guest" },
      { title: "Media Library", to: "/media", icon: ImageIcon, minRole: "Creator" },
      { title: "Categories", to: "/categories", icon: FolderTree, minRole: "Guest" },
      { title: "Tags", to: "/tags", icon: Tags, minRole: "Guest" },
      { title: "Playlists", to: "/playlists", icon: ListMusic, minRole: "Guest" },
      { title: "Music", to: "/music", icon: Music2, minRole: "Guest" },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Comments", to: "/comments", icon: MessagesSquare, minRole: "Moderator" },
      { title: "Reports", to: "/reports", icon: Flag, minRole: "Moderator" },
      { title: "Moderation", to: "/moderation", icon: Gavel, minRole: "Moderator" },
      { title: "Followers", to: "/followers", icon: UserPlus, minRole: "Moderator" },
      { title: "Notifications", to: "/notifications", icon: Bell, minRole: "User" },
    ],
  },
  {
    label: "Growth",
    items: [
      { title: "Analytics", to: "/analytics", icon: BarChart3, minRole: "Editor" },
      { title: "Advertisements", to: "/advertisements", icon: Megaphone, minRole: "Editor" },
    ],
  },
  {
    label: "Platform",
    items: [
      { title: "AI Automation", to: "/ai", icon: Bot, minRole: "Editor" },
      { title: "Webhooks", to: "/webhooks", icon: Webhook, minRole: "Admin" },
      { title: "Background Jobs", to: "/jobs", icon: Cog, minRole: "Admin" },
      { title: "Storage", to: "/storage", icon: HardDrive, minRole: "Admin" },
      { title: "API", to: "/api", icon: Terminal, minRole: "Admin" },
    ],
  },
  {
    label: "Support",
    items: [
      { title: "Support Dashboard", to: "/support", icon: Headphones, minRole: "SupportAgent" },
      { title: "Departments", to: "/support/departments", icon: Building2, minRole: "SupportAdmin" },
      { title: "Teams", to: "/support/teams", icon: Users2, minRole: "SupportAdmin" },
      { title: "Tickets", to: "/support/tickets", icon: Ticket, minRole: "SupportAgent" },
      { title: "Agents", to: "/support/agents", icon: UserCogIcon, minRole: "SupportAdmin" },
      { title: "Reports", to: "/support/reports", icon: FileSpreadsheet, minRole: "SupportAdmin" },
      { title: "Comparisons", to: "/support/comparisons", icon: GitCompare, minRole: "SupportAdmin" },
      { title: "Knowledge Base", to: "/support/kb", icon: BookOpen, minRole: "SupportAgent" },
      { title: "Canned Responses", to: "/support/canned-responses", icon: ClipboardList, minRole: "SupportAgent" },
      { title: "Help Center", to: "/help", icon: HelpCircle, minRole: "Guest" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Audit Logs", to: "/audit", icon: ScrollText, minRole: "Admin" },
      { title: "System Status", to: "/status", icon: Activity, minRole: "Moderator" },
      { title: "Feature Flags", to: "/flags", icon: ToggleLeft, minRole: "Admin" },
      { title: "Settings", to: "/settings", icon: Settings, minRole: "Admin" },
      { title: "Profile", to: "/profile", icon: UserCircle, minRole: "User" },
    ],
  },
];

// ─── Navigation Utilities ───

/**
 * Get all navigation items as a flat array
 */
export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((group) => group.items);

/**
 * Filter navigation items by role
 */
export function filterNavByRole(role: Role | undefined): NavGroup[] {
  if (!role) {
    // Guest: only show public items
    return NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.minRole || item.minRole === "Guest"),
    })).filter((group) => group.items.length > 0);
  }

  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.minRole) return true;
      return roleAtLeast(role, item.minRole);
    }),
  })).filter((group) => group.items.length > 0);
}

/**
 * Check if a user has access to a navigation item
 */
export function canAccessNavItem(role: Role | undefined, item: NavItem): boolean {
  if (!item.minRole) return true;
  if (!role) return item.minRole === "Guest";
  return roleAtLeast(role, item.minRole);
}

/**
 * Get the route for a navigation item by title
 */
export function getNavRoute(title: string): string | undefined {
  const item = ALL_NAV_ITEMS.find((item) => item.title === title);
  return item?.to;
}

/**
 * Get the current active navigation group based on path
 */
export function getActiveNavGroup(path: string): string | undefined {
  for (const group of NAV) {
    for (const item of group.items) {
      if (path.startsWith(item.to)) {
        return group.label;
      }
    }
  }
  return undefined;
}
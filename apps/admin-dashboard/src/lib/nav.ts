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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { title: "Users", to: "/users", icon: Users },
      { title: "Roles", to: "/roles", icon: Shield },
      { title: "Permissions", to: "/permissions", icon: KeyRound },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Articles", to: "/articles", icon: FileText },
      { title: "Posts", to: "/posts", icon: MessageSquare },
      { title: "Highlights", to: "/highlights", icon: Film },
      { title: "Videos", to: "/videos", icon: Video },
      { title: "Media Library", to: "/media", icon: ImageIcon },
      { title: "Categories", to: "/categories", icon: FolderTree },
      { title: "Tags", to: "/tags", icon: Tags },
      { title: "Playlists", to: "/playlists", icon: ListMusic },
      { title: "Music", to: "/music", icon: Music2 },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Comments", to: "/comments", icon: MessagesSquare },
      { title: "Reports", to: "/reports", icon: Flag },
      { title: "Moderation", to: "/moderation", icon: Gavel },
      { title: "Followers", to: "/followers", icon: UserPlus },
      { title: "Notifications", to: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Growth",
    items: [
      { title: "Analytics", to: "/analytics", icon: BarChart3 },
      { title: "Advertisements", to: "/advertisements", icon: Megaphone },
    ],
  },
  {
    label: "Platform",
    items: [
      { title: "AI Automation", to: "/ai", icon: Bot },
      { title: "Webhooks", to: "/webhooks", icon: Webhook },
      { title: "Background Jobs", to: "/jobs", icon: Cog },
      { title: "Storage", to: "/storage", icon: HardDrive },
      { title: "API", to: "/api", icon: Terminal },
    ],
  },
  {
    label: "Support",
    items: [
      { title: "Support Dashboard", to: "/support", icon: Headphones },
      { title: "Tickets", to: "/support/tickets", icon: Ticket },
      { title: "Knowledge Base", to: "/support/kb", icon: BookOpen },
      { title: "Help Center", to: "/help", icon: HelpCircle },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Audit Logs", to: "/audit", icon: ScrollText },
      { title: "System Status", to: "/status", icon: Activity },
      { title: "Feature Flags", to: "/flags", icon: ToggleLeft },
      { title: "Settings", to: "/settings", icon: Settings },
      { title: "Profile", to: "/profile", icon: UserCircle },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

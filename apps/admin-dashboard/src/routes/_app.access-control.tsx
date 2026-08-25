// routes/_app/access-control.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Users,
  Key,
  Lock,
  Unlock,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Eye,
  RefreshCw,
  Download,
  Loader2,
  FileText,
  Bot,
  Image,
  Hash,
  ListMusic,
  Ticket,
  Database,
  BookOpen,
  Sparkles,
  Settings,
  Globe,
  Mail,
  Bell,
  BarChart3,
  Code,
  Link2,
  FolderOpen,
  Package,
  Users2,
  Monitor,
  Smartphone,
  Cloud,
  Server,
  Activity,
  Zap,
  Star,
  Award,
  Gift,
  Music,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useAccessRequests,
  useAccessRequestStats,
  useApproveAccessRequest,
  useRejectAccessRequest,
  useDeleteAccessRequest,
  useBulkApproveAccessRequests,
  useBulkRejectAccessRequests,
  type AccessRequestEntry,
  type AccessRequestStatus,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/_app/access-control")({
  head: () => ({ meta: [{ title: "Access Control · Vellbase Admin" }] }),
  component: AccessControlPage,
});

// ─── Types ───

type ResourceType =
  | "articles"
  | "highlights"
  | "playlists"
  | "tracks"
  | "tags"
  | "media"
  | "users"
  | "roles"
  | "permissions"
  | "api"
  | "bots"
  | "tickets"
  | "storage"
  | "knowledge_base"
  | "settings"
  | "features"
  | "analytics"
  | "notifications"
  | "email"
  | "integrations";

interface PermissionDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
}

interface ResourceDefinition {
  type: ResourceType;
  label: string;
  icon: React.ElementType;
  description: string;
  permissions: PermissionDefinition[];
}

// ─── Resource Definitions ───

const RESOURCE_DEFINITIONS: Record<ResourceType, ResourceDefinition> = {
  articles: {
    type: "articles",
    label: "Articles",
    icon: FileText,
    description: "Create, edit, publish, and manage articles",
    permissions: [
      {
        id: "art-view", key: "articles:view", name: "View", description: "View articles",
        category: ""
      },
      {
        id: "art-create", key: "articles:create", name: "Create", description: "Create new articles",
        category: ""
      },
      {
        id: "art-edit", key: "articles:edit", name: "Edit", description: "Edit existing articles",
        category: ""
      },
      {
        id: "art-delete", key: "articles:delete", name: "Delete", description: "Delete articles",
        category: ""
      },
      {
        id: "art-publish", key: "articles:publish", name: "Publish", description: "Publish/unpublish articles",
        category: ""
      },
    ],
  },
  highlights: {
    type: "highlights",
    label: "Highlights",
    icon: Sparkles,
    description: "Manage highlighted content and featured items",
    permissions: [
      {
        id: "hl-view", key: "highlights:view", name: "View", description: "View highlights",
        category: ""
      },
      {
        id: "hl-create", key: "highlights:create", name: "Create", description: "Create highlights",
        category: ""
      },
      {
        id: "hl-edit", key: "highlights:edit", name: "Edit", description: "Edit highlights",
        category: ""
      },
      {
        id: "hl-delete", key: "highlights:delete", name: "Delete", description: "Delete highlights",
        category: ""
      },
      {
        id: "hl-feature", key: "highlights:feature", name: "Feature", description: "Feature/unfeature content",
        category: ""
      },
    ],
  },
  playlists: {
    type: "playlists",
    label: "Playlists",
    icon: ListMusic,
    description: "Create and manage music playlists",
    permissions: [
      {
        id: "pl-view", key: "playlists:view", name: "View", description: "View playlists",
        category: ""
      },
      {
        id: "pl-create", key: "playlists:create", name: "Create", description: "Create playlists",
        category: ""
      },
      {
        id: "pl-edit", key: "playlists:edit", name: "Edit", description: "Edit playlists",
        category: ""
      },
      {
        id: "pl-delete", key: "playlists:delete", name: "Delete", description: "Delete playlists",
        category: ""
      },
      {
        id: "pl-manage-tracks", key: "playlists:manage-tracks", name: "Manage Tracks", description: "Add/remove tracks",
        category: ""
      },
    ],
  },
  tracks: {
    type: "tracks",
    label: "Tracks",
    icon: Music,
    description: "Manage individual audio tracks",
    permissions: [
      {
        id: "tr-view", key: "tracks:view", name: "View", description: "View tracks",
        category: ""
      },
      {
        id: "tr-upload", key: "tracks:upload", name: "Upload", description: "Upload tracks",
        category: ""
      },
      {
        id: "tr-edit", key: "tracks:edit", name: "Edit", description: "Edit track metadata",
        category: ""
      },
      {
        id: "tr-delete", key: "tracks:delete", name: "Delete", description: "Delete tracks",
        category: ""
      },
    ],
  },
  tags: {
    type: "tags",
    label: "Tags",
    icon: Hash,
    description: "Manage content tagging and categorization",
    permissions: [
      {
        id: "tag-view", key: "tags:view", name: "View", description: "View tags",
        category: ""
      },
      {
        id: "tag-create", key: "tags:create", name: "Create", description: "Create tags",
        category: ""
      },
      {
        id: "tag-edit", key: "tags:edit", name: "Edit", description: "Edit tags",
        category: ""
      },
      {
        id: "tag-delete", key: "tags:delete", name: "Delete", description: "Delete tags",
        category: ""
      },
    ],
  },
  media: {
    type: "media",
    label: "Media",
    icon: Image,
    description: "Manage images, videos, and audio files",
    permissions: [
      {
        id: "med-view", key: "media:view", name: "View", description: "View media",
        category: ""
      },
      {
        id: "med-upload", key: "media:upload", name: "Upload", description: "Upload media",
        category: ""
      },
      {
        id: "med-edit", key: "media:edit", name: "Edit", description: "Edit media metadata",
        category: ""
      },
      {
        id: "med-delete", key: "media:delete", name: "Delete", description: "Delete media",
        category: ""
      },
    ],
  },
  users: {
    type: "users",
    label: "Users",
    icon: Users,
    description: "Manage user accounts and profiles",
    permissions: [
      {
        id: "usr-view", key: "users:view", name: "View", description: "View users",
        category: ""
      },
      {
        id: "usr-create", key: "users:create", name: "Create", description: "Create users",
        category: ""
      },
      {
        id: "usr-edit", key: "users:edit", name: "Edit", description: "Edit users",
        category: ""
      },
      {
        id: "usr-delete", key: "users:delete", name: "Delete", description: "Delete users",
        category: ""
      },
      {
        id: "usr-suspend", key: "users:suspend", name: "Suspend", description: "Suspend/reactivate users",
        category: ""
      },
    ],
  },
  roles: {
    type: "roles",
    label: "Roles",
    icon: Shield,
    description: "Manage roles and permissions",
    permissions: [
      {
        id: "role-view", key: "roles:view", name: "View", description: "View roles",
        category: ""
      },
      {
        id: "role-create", key: "roles:create", name: "Create", description: "Create roles",
        category: ""
      },
      {
        id: "role-edit", key: "roles:edit", name: "Edit", description: "Edit roles",
        category: ""
      },
      {
        id: "role-delete", key: "roles:delete", name: "Delete", description: "Delete roles",
        category: ""
      },
    ],
  },
  permissions: {
    type: "permissions",
    label: "Permissions",
    icon: ShieldCheck,
    description: "Manage granular permissions",
    permissions: [
      {
        id: "perm-view", key: "permissions:view", name: "View", description: "View permissions",
        category: ""
      },
      {
        id: "perm-grant", key: "permissions:grant", name: "Grant", description: "Grant permissions",
        category: ""
      },
      {
        id: "perm-revoke", key: "permissions:revoke", name: "Revoke", description: "Revoke permissions",
        category: ""
      },
    ],
  },
  api: {
    type: "api",
    label: "API",
    icon: Code,
    description: "Manage API access and keys",
    permissions: [
      {
        id: "api-view", key: "api:view", name: "View", description: "View API keys",
        category: ""
      },
      {
        id: "api-create", key: "api:create", name: "Create", description: "Create API keys",
        category: ""
      },
      {
        id: "api-revoke", key: "api:revoke", name: "Revoke", description: "Revoke API keys",
        category: ""
      },
      {
        id: "api-configure", key: "api:configure", name: "Configure", description: "Configure API settings",
        category: ""
      },
    ],
  },
  bots: {
    type: "bots",
    label: "Bots",
    icon: Bot,
    description: "Manage AI bots and automation",
    permissions: [
      {
        id: "bot-view", key: "bots:view", name: "View", description: "View bots",
        category: ""
      },
      {
        id: "bot-create", key: "bots:create", name: "Create", description: "Create bots",
        category: ""
      },
      {
        id: "bot-edit", key: "bots:edit", name: "Edit", description: "Edit bots",
        category: ""
      },
      {
        id: "bot-delete", key: "bots:delete", name: "Delete", description: "Delete bots",
        category: ""
      },
      {
        id: "bot-deploy", key: "bots:deploy", name: "Deploy", description: "Deploy bots",
        category: ""
      },
    ],
  },
  tickets: {
    type: "tickets",
    label: "Tickets",
    icon: Ticket,
    description: "Manage support tickets",
    permissions: [
      {
        id: "tkt-view", key: "tickets:view", name: "View", description: "View tickets",
        category: ""
      },
      {
        id: "tkt-create", key: "tickets:create", name: "Create", description: "Create tickets",
        category: ""
      },
      {
        id: "tkt-update", key: "tickets:update", name: "Update", description: "Update tickets",
        category: ""
      },
      {
        id: "tkt-resolve", key: "tickets:resolve", name: "Resolve", description: "Resolve tickets",
        category: ""
      },
    ],
  },
  storage: {
    type: "storage",
    label: "Storage",
    icon: Database,
    description: "Manage file storage and quotas",
    permissions: [
      {
        id: "stor-view", key: "storage:view", name: "View", description: "View storage",
        category: ""
      },
      {
        id: "stor-upload", key: "storage:upload", name: "Upload", description: "Upload files",
        category: ""
      },
      {
        id: "stor-delete", key: "storage:delete", name: "Delete", description: "Delete files",
        category: ""
      },
      {
        id: "stor-manage", key: "storage:manage", name: "Manage", description: "Manage storage settings",
        category: ""
      },
    ],
  },
  knowledge_base: {
    type: "knowledge_base",
    label: "Knowledge Base",
    icon: BookOpen,
    description: "Manage help articles and documentation",
    permissions: [
      {
        id: "kb-view", key: "knowledge_base:view", name: "View", description: "View articles",
        category: ""
      },
      {
        id: "kb-create", key: "knowledge_base:create", name: "Create", description: "Create articles",
        category: ""
      },
      {
        id: "kb-edit", key: "knowledge_base:edit", name: "Edit", description: "Edit articles",
        category: ""
      },
      {
        id: "kb-delete", key: "knowledge_base:delete", name: "Delete", description: "Delete articles",
        category: ""
      },
    ],
  },
  settings: {
    type: "settings",
    label: "Settings",
    icon: Settings,
    description: "Manage system settings",
    permissions: [
      {
        id: "set-view", key: "settings:view", name: "View", description: "View settings",
        category: ""
      },
      {
        id: "set-update", key: "settings:update", name: "Update", description: "Update settings",
        category: ""
      },
    ],
  },
  features: {
    type: "features",
    label: "Features",
    icon: Zap,
    description: "Manage feature flags and toggles",
    permissions: [
      {
        id: "feat-view", key: "features:view", name: "View", description: "View features",
        category: ""
      },
      {
        id: "feat-toggle", key: "features:toggle", name: "Toggle", description: "Toggle features",
        category: ""
      },
    ],
  },
  analytics: {
    type: "analytics",
    label: "Analytics",
    icon: BarChart3,
    description: "Access analytics and reports",
    permissions: [
      {
        id: "ana-view", key: "analytics:view", name: "View", description: "View analytics",
        category: ""
      },
      {
        id: "ana-export", key: "analytics:export", name: "Export", description: "Export reports",
        category: ""
      },
    ],
  },
  notifications: {
    type: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Manage notifications and alerts",
    permissions: [
      {
        id: "not-view", key: "notifications:view", name: "View", description: "View notifications",
        category: ""
      },
      {
        id: "not-send", key: "notifications:send", name: "Send", description: "Send notifications",
        category: ""
      },
    ],
  },
  email: {
    type: "email",
    label: "Email",
    icon: Mail,
    description: "Manage email templates and sending",
    permissions: [
      {
        id: "eml-view", key: "email:view", name: "View", description: "View templates",
        category: ""
      },
      {
        id: "eml-create", key: "email:create", name: "Create", description: "Create templates",
        category: ""
      },
      {
        id: "eml-send", key: "email:send", name: "Send", description: "Send emails",
        category: ""
      },
    ],
  },
  integrations: {
    type: "integrations",
    label: "Integrations",
    icon: Link2,
    description: "Manage third-party integrations",
    permissions: [
      {
        id: "int-view", key: "integrations:view", name: "View", description: "View integrations",
        category: ""
      },
      {
        id: "int-configure", key: "integrations:configure", name: "Configure", description: "Configure integrations",
        category: ""
      },
    ],
  },
};

// ─── Main Component ───

const PAGE_SIZE = 20;
const JUSTIFICATION_MIN = 5;

function AccessControlPage() {
  // Filter / pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Selection state (for bulk actions)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Review dialog state
  const [selectedRequest, setSelectedRequest] = useState<AccessRequestEntry | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewJustification, setReviewJustification] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);

  // Bulk dialog state
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkJustification, setBulkJustification] = useState("");

  // ── Data hooks (all called unconditionally — no early returns before this) ──

  const queryParams = useMemo(
    () => ({
      status: (statusFilter !== "all" ? (statusFilter as AccessRequestStatus) : undefined),
      resourceType: resourceFilter !== "all" ? resourceFilter : undefined,
      page,
      limit: PAGE_SIZE,
      orderBy: "createdAt" as const,
      orderDir: "desc" as const,
    }),
    [statusFilter, resourceFilter, page],
  );

  const requestsQuery = useAccessRequests(queryParams);
  const statsQuery = useAccessRequestStats();

  // ── Mutation hooks ──

  const approveMutation = useApproveAccessRequest();
  const rejectMutation = useRejectAccessRequest();
  const deleteMutation = useDeleteAccessRequest();
  const bulkApproveMutation = useBulkApproveAccessRequests();
  const bulkRejectMutation = useBulkRejectAccessRequests();

  // ── Derived data ──

  const allRequests = requestsQuery.data?.data ?? [];
  const total = requestsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const stats = statsQuery.data;

  // Client-side search + type filter (server handles status + resourceType + pagination)
  const filteredRequests = useMemo(() => {
    return allRequests.filter((req) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        req.requester.name.toLowerCase().includes(q) ||
        req.requester.email.toLowerCase().includes(q) ||
        req.requester.handle.toLowerCase().includes(q) ||
        req.permissionKey.toLowerCase().includes(q) ||
        req.resourceType.toLowerCase().includes(q) ||
        req.justification.toLowerCase().includes(q);

      const matchesType = typeFilter === "all" || req.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [allRequests, searchQuery, typeFilter]);

  // ── Helpers ──

  const getResourceIcon = (type: string) => {
    const def = RESOURCE_DEFINITIONS[type as ResourceType];
    return def?.icon ?? Shield;
  };

  const getResourceLabel = (type: string) => {
    const def = RESOURCE_DEFINITIONS[type as ResourceType];
    return def?.label ?? type;
  };

  const getPermissionLabel = (key: string) => {
    for (const def of Object.values(RESOURCE_DEFINITIONS)) {
      const perm = def.permissions.find((p) => p.key === key);
      if (perm) return perm.name;
    }
    return key.split(":")[1] ?? key;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "warning" | "success" | "destructive" | "secondary"; icon: any }> = {
      PENDING: { variant: "warning", icon: Clock },
      APPROVED: { variant: "success", icon: CheckCircle2 },
      REJECTED: { variant: "destructive", icon: XCircle },
      CANCELLED: { variant: "secondary", icon: XCircle },
    };
    const { variant, icon: Icon } = config[status] ?? config.PENDING;
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1",
          variant === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-500",
          variant === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
          variant === "destructive" && "border-rose-500/30 bg-rose-500/10 text-rose-500",
          variant === "secondary" && "text-muted-foreground",
        )}
      >
        <Icon className="size-3" />
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </Badge>
    );
  };

  // ── Selection handlers ──

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allPending = filteredRequests.filter((r) => r.status === "PENDING");
      const allSelected = allPending.length > 0 && allPending.every((r) => prev.has(r.id));
      if (allSelected) {
        const next = new Set(prev);
        allPending.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      allPending.forEach((r) => next.add(r.id));
      return next;
    });
  }, [filteredRequests]);

  // ── Filter change handlers (reset page) ──

  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };

  const handleResourceChange = (v: string) => {
    setResourceFilter(v);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setResourceFilter("all");
    setPage(1);
  };

  // ── Refresh / export ──

  const handleRefresh = () => {
    requestsQuery.refetch();
    statsQuery.refetch();
    toast.success("Access requests refreshed");
  };

  const handleExport = () => {
    if (filteredRequests.length === 0) {
      toast.error("No requests to export");
      return;
    }
    const headers = ["ID", "Requester", "Email", "Resource", "Permission", "Type", "Status", "Justification", "Created At"];
    const rows = filteredRequests.map((r) => [
      r.id,
      r.requester.name,
      r.requester.email,
      r.resourceType,
      r.permissionKey,
      r.type,
      r.status,
      `"${r.justification.replace(/"/g, '""')}"`,
      r.createdAt,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-requests-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Access requests exported");
  };

  // ── Review dialog ──

  const openReview = (req: AccessRequestEntry) => {
    setSelectedRequest(req);
    setIsReviewOpen(true);
    setReviewJustification("");
    setReviewAction(null);
  };

  const closeReview = () => {
    setIsReviewOpen(false);
    setSelectedRequest(null);
    setReviewJustification("");
    setReviewAction(null);
  };

  const handleReview = (action: "approve" | "reject") => {
    if (!selectedRequest) return;
    const trimmed = reviewJustification.trim();
    if (trimmed.length < JUSTIFICATION_MIN) {
      toast.error(`Justification must be at least ${JUSTIFICATION_MIN} characters`);
      return;
    }
    setReviewAction(action);
    const mutation = action === "approve" ? approveMutation : rejectMutation;
    mutation.mutate(
      { id: selectedRequest.id, adminJustification: trimmed },
      {
        onSuccess: () => {
          toast.success(
            action === "approve"
              ? `Access request for ${getResourceLabel(selectedRequest.resourceType)} approved`
              : `Access request for ${getResourceLabel(selectedRequest.resourceType)} rejected`,
          );
          closeReview();
        },
        onError: (e) => {
          toast.error(`Failed to ${action}: ${(e as Error).message ?? "Unknown error"}`);
          setReviewAction(null);
        },
      },
    );
  };

  // ── Delete ──

  const handleDelete = (req: AccessRequestEntry) => {
    deleteMutation.mutate(req.id, {
      onSuccess: () => {
        toast.success("Access request deleted");
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(req.id);
          return next;
        });
      },
      onError: (e) => toast.error("Failed to delete: " + ((e as Error).message ?? "Unknown error")),
    });
  };

  // ── Bulk actions ──

  const openBulkApprove = () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one request to bulk approve");
      return;
    }
    setBulkJustification("");
    setBulkApproveOpen(true);
  };

  const openBulkReject = () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one request to bulk reject");
      return;
    }
    setBulkJustification("");
    setBulkRejectOpen(true);
  };

  const handleBulkApproveConfirm = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const trimmed = bulkJustification.trim();
    if (trimmed.length < JUSTIFICATION_MIN) {
      toast.error(`Justification must be at least ${JUSTIFICATION_MIN} characters`);
      return;
    }
    bulkApproveMutation.mutate(
      { ids, adminJustification: trimmed },
      {
        onSuccess: (res) => {
          toast.success(`Approved ${res.approved} of ${res.total} requests`);
          setBulkApproveOpen(false);
          setBulkJustification("");
          setSelectedIds(new Set());
        },
        onError: (e) => toast.error("Bulk approve failed: " + ((e as Error).message ?? "Unknown error")),
      },
    );
  };

  const handleBulkRejectConfirm = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const trimmed = bulkJustification.trim();
    if (trimmed.length < JUSTIFICATION_MIN) {
      toast.error(`Justification must be at least ${JUSTIFICATION_MIN} characters`);
      return;
    }
    bulkRejectMutation.mutate(
      { ids, adminJustification: trimmed },
      {
        onSuccess: (res) => {
          toast.success(`Rejected ${res.rejected} of ${res.total} requests`);
          setBulkRejectOpen(false);
          setBulkJustification("");
          setSelectedIds(new Set());
        },
        onError: (e) => toast.error("Bulk reject failed: " + ((e as Error).message ?? "Unknown error")),
      },
    );
  };

  // ── Loading / error flags ──

  const isLoading = requestsQuery.isLoading;
  const isFetching = requestsQuery.isFetching;
  const hasError = requestsQuery.isError;
  const hasFilters =
    !!searchQuery || statusFilter !== "all" || typeFilter !== "all" || resourceFilter !== "all";

  const allPendingOnPage = filteredRequests.filter((r) => r.status === "PENDING");
  const allPendingSelected =
    allPendingOnPage.length > 0 && allPendingOnPage.every((r) => selectedIds.has(r.id));

  // ── Render ──

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access"
        title="Access Control"
        description="Manage access requests for all platform resources including articles, APIs, bots, media, and more."
        actions={
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleRefresh}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh requests</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExport}
                >
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export to CSV</TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsQuery.isLoading ? (
          <>
            <Skeleton className="h-[88px] rounded-xl" />
            <Skeleton className="h-[88px] rounded-xl" />
            <Skeleton className="h-[88px] rounded-xl" />
            <Skeleton className="h-[88px] rounded-xl" />
          </>
        ) : (
          <>
            <StatCard label="Total Requests" value={stats?.total ?? 0} icon={Shield} tone="primary" />
            <StatCard
              label="Pending Review"
              value={stats?.pending ?? 0}
              icon={Clock}
              tone="warning"
              delta={(stats?.pending ?? 0) > 0 ? "Action required" : undefined}
            />
            <StatCard label="Approved" value={stats?.approved ?? 0} icon={ShieldCheck} tone="success" />
            <StatCard label="Rejected" value={stats?.rejected ?? 0} icon={ShieldX} tone="destructive" />
          </>
        )}
      </div>

      {/* Resource Type Quick Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-2">
          Resources:
        </span>
        {Object.entries(RESOURCE_DEFINITIONS).map(([key, def]) => {
          const isActive = resourceFilter === key;
          const Icon = def.icon;
          return (
            <Button
              key={key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => handleResourceChange(isActive ? "all" : key)}
            >
              <Icon className="size-3.5" />
              {def.label}
            </Button>
          );
        })}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{selectedIds.size}</span>
            <span className="text-muted-foreground">
              request{selectedIds.size === 1 ? "" : "s"} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openBulkApprove}>
              <CheckCircle2 className="size-3.5" />
              Bulk Approve
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openBulkReject}>
              <XCircle className="size-3.5" />
              Bulk Reject
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            placeholder="Search requests..."
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PERMANENT">Permanent</SelectItem>
              <SelectItem value="TEMPORARY">Temporary</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Filter className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Requests Table */}
      <SectionCard padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allPendingSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all pending"
                  />
                </TableHead>
                <TableHead className="w-[180px]">Requester</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Permission</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Justification</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : hasError ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="size-8 text-destructive/50" />
                      <p className="text-sm font-medium text-destructive">Failed to load access requests</p>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => requestsQuery.refetch()}>
                        <RefreshCw className="size-3.5" />
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Shield className="size-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No access requests found</p>
                      <p className="text-xs text-muted-foreground/70">
                        {hasFilters ? "Try adjusting your filters" : "All requests will appear here"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => {
                  const Icon = getResourceIcon(req.resourceType);
                  const isSelected = selectedIds.has(req.id);
                  const isPending = req.status === "PENDING";
                  return (
                    <TableRow key={req.id} className="group hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(req.id)}
                          disabled={!isPending}
                          aria-label={`Select request ${req.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {req.requester.name?.[0] ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{req.requester.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{req.requester.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icon className="size-3.5 text-muted-foreground" />
                          <span className="text-sm">{getResourceLabel(req.resourceType)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {getPermissionLabel(req.permissionKey)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            req.type === "PERMANENT"
                              ? "border-primary/30 text-primary"
                              : "border-amber-500/30 text-amber-500",
                          )}
                        >
                          {req.type === "PERMANENT" ? "Permanent" : "Temporary"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[180px]">
                        <p className="text-sm truncate">{req.justification}</p>
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openReview(req)}
                          >
                            <Eye className="size-3.5" />
                            Review
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openReview(req)}>
                                <Eye className="mr-2 size-3.5" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(req)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="mr-2 size-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} — {total} total request{total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={(o) => !o && closeReview()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Review Access Request
            </DialogTitle>
            <DialogDescription>
              Review the request details and approve or reject the access request.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              {/* Requester Info */}
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {selectedRequest.requester.name?.[0] ?? "?"}
                </div>
                <div>
                  <div className="font-medium">{selectedRequest.requester.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedRequest.requester.email}</div>
                </div>
              </div>

              {/* Request Details */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Resource
                  </Label>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = getResourceIcon(selectedRequest.resourceType);
                      return <Icon className="size-4 text-muted-foreground" />;
                    })()}
                    <span className="font-medium capitalize">{getResourceLabel(selectedRequest.resourceType)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground me-2">
                    Permission
                  </Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {getPermissionLabel(selectedRequest.permissionKey)}
                  </Badge>
                </div>
              </div>

              {/* Access Type */}
              <div className="space-y-1">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground me-2">
                  Access Type
                </Label>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    selectedRequest.type === "PERMANENT"
                      ? "border-primary/30 text-primary"
                      : "border-amber-500/30 text-amber-500",
                  )}
                >
                  {selectedRequest.type === "PERMANENT" ? "Permanent" : "Temporary"}
                </Badge>
              </div>

              {/* Temporary Dates */}
              {selectedRequest.type === "TEMPORARY" && (
                <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-dashed p-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Starts At
                    </Label>
                    <div className="text-sm">
                      {selectedRequest.startsAt
                        ? new Date(selectedRequest.startsAt).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Expires At
                    </Label>
                    <div className="text-sm">
                      {selectedRequest.expiresAt
                        ? new Date(selectedRequest.expiresAt).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* Justification */}
              <div className="space-y-1">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Justification
                </Label>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  {selectedRequest.justification}
                </div>
              </div>

              {/* Admin Review Comment */}
              <div className="space-y-2">
                <Label htmlFor="review-comment">
                  Admin Justification <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="review-comment"
                  value={reviewJustification}
                  onChange={(e) => setReviewJustification(e.target.value)}
                  placeholder={`Provide a reason for your decision (min ${JUSTIFICATION_MIN} characters)...`}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {reviewJustification.trim().length}/{JUSTIFICATION_MIN} characters minimum
                </p>
              </div>

              {/* Previous Review Info */}
              {selectedRequest.reviewer && selectedRequest.reviewedAt && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span>
                      Reviewed by <span className="font-medium text-foreground">{selectedRequest.reviewer.name}</span> on{" "}
                      {new Date(selectedRequest.reviewedAt).toLocaleString()}
                    </span>
                  </div>
                  {selectedRequest.adminJustification && (
                    <p className="mt-2 text-muted-foreground">
                      <span className="font-medium text-foreground">Admin note:</span>{" "}
                      {selectedRequest.adminJustification}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeReview} disabled={approveMutation.isPending || rejectMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview("reject")}
              disabled={approveMutation.isPending || rejectMutation.isPending || reviewJustification.trim().length < JUSTIFICATION_MIN}
              className="gap-1.5"
            >
              {rejectMutation.isPending && reviewAction === "reject" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <XCircle className="size-4" />
              )}
              Reject
            </Button>
            <Button
              variant="default"
              onClick={() => handleReview("approve")}
              disabled={approveMutation.isPending || rejectMutation.isPending || reviewJustification.trim().length < JUSTIFICATION_MIN}
              className="gap-1.5"
            >
              {approveMutation.isPending && reviewAction === "approve" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approve Dialog */}
      <Dialog open={bulkApproveOpen} onOpenChange={(o) => !o && setBulkApproveOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-500" />
              Bulk Approve Access Requests
            </DialogTitle>
            <DialogDescription>
              You are approving{" "}
              <span className="font-semibold text-foreground">{selectedIds.size}</span> selected
              request{selectedIds.size === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-approve-j" className="text-xs uppercase tracking-wider text-muted-foreground">
                Admin Justification <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="bulk-approve-j"
                rows={3}
                value={bulkJustification}
                onChange={(e) => setBulkJustification(e.target.value)}
                placeholder={`Shared reason for all approvals (min ${JUSTIFICATION_MIN} characters)...`}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {bulkJustification.trim().length}/{JUSTIFICATION_MIN} characters minimum
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkApproveOpen(false)} disabled={bulkApproveMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkApproveConfirm}
              disabled={bulkApproveMutation.isPending || selectedIds.size === 0 || bulkJustification.trim().length < JUSTIFICATION_MIN}
            >
              {bulkApproveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Approving&hellip;
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" /> Approve {selectedIds.size}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectOpen} onOpenChange={(o) => !o && setBulkRejectOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-rose-500" />
              Bulk Reject Access Requests
            </DialogTitle>
            <DialogDescription>
              You are rejecting{" "}
              <span className="font-semibold text-foreground">{selectedIds.size}</span> selected
              request{selectedIds.size === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-reject-j" className="text-xs uppercase tracking-wider text-muted-foreground">
                Admin Justification <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="bulk-reject-j"
                rows={3}
                value={bulkJustification}
                onChange={(e) => setBulkJustification(e.target.value)}
                placeholder={`Shared reason for all rejections (min ${JUSTIFICATION_MIN} characters)...`}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {bulkJustification.trim().length}/{JUSTIFICATION_MIN} characters minimum
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectOpen(false)} disabled={bulkRejectMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkRejectConfirm}
              disabled={bulkRejectMutation.isPending || selectedIds.size === 0 || bulkJustification.trim().length < JUSTIFICATION_MIN}
            >
              {bulkRejectMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Rejecting&hellip;
                </>
              ) : (
                <>
                  <XCircle className="size-4" /> Reject {selectedIds.size}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
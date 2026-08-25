// routes/_app/request-access.tsx
"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth/context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RoleSelect } from "@/components/dashboard/users_action_components";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  useCreateRoleRequest,
  useMyAccessRequests,
  useMyRoleRequests,
  useCancelAccessRequest,
  useSearchResources,
  useCreateResourceAccessRequest,
  type RoleRequestType,
  type AccessRequestType,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Clock,
  Send,
  CalendarDays,
  History,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  FileText,
  User,
  Calendar,
  Check,
  Info,
  Shield,
  ChevronRight,
  Search,
  Ticket,
  File,
  Video,
  Image,
  Music,
  ListMusic,
  Tag,
  Users,
  Bot,
  Database,
  Settings,
  Globe,
  Link2,
  Sparkles,
  FolderOpen,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/request-access")({
  head: () => ({
    meta: [{ title: "Request Access · Vellbase" }],
  }),
  component: RoleRequestPage,
});

// ─── Constants ───

const JUSTIFICATION_MIN_LENGTH = 5;
const JUSTIFICATION_MAX_LENGTH = 500;

// ─── Resource Configuration ───

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  ticket: Ticket,
  article: FileText,
  highlight: Sparkles,
  video: Video,
  image: Image,
  music: Music,
  playlist: ListMusic,
  tag: Tag,
  user: Users,
  bot: Bot,
  storage: Database,
  settings: Settings,
  integration: Link2,
  category: FolderOpen,
  api: Globe,
  media: File,
  role: Shield,
};

const RESOURCE_LABELS: Record<string, string> = {
  ticket: "Ticket",
  article: "Article",
  highlight: "Highlight",
  video: "Video",
  image: "Image",
  music: "Music",
  playlist: "Playlist",
  tag: "Tag",
  user: "User",
  bot: "Bot",
  storage: "Storage",
  settings: "Settings",
  integration: "Integration",
  category: "Category",
  api: "API",
  media: "Media",
  role: "Role",
};

const STATUS_CONFIG = {
  PENDING: { label: "Pending", variant: "warning" as const, icon: Clock, color: "text-amber-500" },
  APPROVED: { label: "Approved", variant: "success" as const, icon: CheckCircle2, color: "text-emerald-500" },
  REJECTED: { label: "Rejected", variant: "destructive" as const, icon: X, color: "text-rose-500" },
  CANCELLED: { label: "Cancelled", variant: "secondary" as const, icon: X, color: "text-muted-foreground" },
};

// ─── Helper Functions ───

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRoleKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function getRequestTypeLabel(type: string): string {
  if (type === "PERMANENT") return "Permanent";
  if (type === "TEMPORARY") return "Temporary";
  return type;
}

function getResourceTypeLabel(type: string): string {
  return RESOURCE_LABELS[type] || type;
}

function getResourceIcon(type: string): React.ElementType {
  return RESOURCE_ICONS[type] || File;
}

function isRoleRequest(request: any): boolean {
  return request.resourceType === "role" || request.requestedRoleKey !== undefined;
}

function isResourceRequest(request: any): boolean {
  return request.resourceType !== undefined && request.resourceType !== "role";
}

// ─── Search Results Component ───

function SearchResults({
  results,
  isLoading,
  onRequestAccess,
  selectedResource,
  setSelectedResource,
  isRequesting,
}: {
  results: any[];
  isLoading: boolean;
  onRequestAccess: (resource: any) => void;
  selectedResource: any | null;
  setSelectedResource: (resource: any | null) => void;
  isRequesting: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Search className="size-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No resources found</p>
        <p className="text-xs text-muted-foreground/70">
          Try adjusting your search terms
        </p>
      </div>
    );
  }

  // Single result - show preview with request button
  if (results.length === 1) {
    const resource = results[0];
    const Icon = getResourceIcon(resource.type);
    const label = getResourceTypeLabel(resource.type);

    return (
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="size-8 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Found 1 result</div>
            <h4 className="text-lg font-semibold mt-1">
              {resource.title || resource.subject || resource.name}
            </h4>
            <div className="flex items-center justify-center gap-3 mt-1 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                {label}
              </Badge>
              <span className="font-mono text-xs">{resource.id}</span>
              {resource.status && (
                <StatusBadge status={resource.status.toLowerCase()} />
              )}
            </div>
            {resource.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                {resource.description}
              </p>
            )}
          </div>
          <Button
            onClick={() => onRequestAccess(resource)}
            className="gap-2 mt-2"
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />
                Request Access
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Multiple results - show list with request buttons
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-3">
        Found {results.length} results
      </div>
      {results.map((resource) => {
        const Icon = getResourceIcon(resource.type);
        const label = getResourceTypeLabel(resource.type);
        const isSelected = selectedResource?.id === resource.id;

        return (
          <div
            key={resource.id}
            className={cn(
              "flex items-center gap-4 rounded-lg border p-4 transition-all cursor-pointer hover:bg-muted/30",
              isSelected && "border-primary bg-primary/5"
            )}
            onClick={() => setSelectedResource(resource)}
          >
            <div className="size-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
                  {resource.title || resource.subject || resource.name}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{resource.id}</span>
                {resource.status && (
                  <>
                    <span>·</span>
                    <StatusBadge status={resource.status.toLowerCase()} />
                  </>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={isSelected ? "default" : "outline"}
              className="shrink-0 gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onRequestAccess(resource);
              }}
              disabled={isRequesting}
            >
              {isRequesting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="size-3.5" />
              )}
              {isRequesting ? "Requesting..." : "Request Access"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Resource Access Request Dialog ───

function ResourceAccessDialog({
  open,
  onOpenChange,
  resource,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: any | null;
  onSubmit: (data: {
    resourceType: string;
    resourceId: string;
    permission: string;
    justification: string;
    type: "PERMANENT" | "TEMPORARY";
    startsAt?: string;
    expiresAt?: string;
  }) => void;
  isPending: boolean;
}) {
  const [permission, setPermission] = useState("");
  const [justification, setJustification] = useState("");
  const [requestType, setRequestType] = useState<"PERMANENT" | "TEMPORARY">("PERMANENT");
  const [startsAt, setStartsAt] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens with a new resource
  useEffect(() => {
    if (open && resource) {
      const defaultPermissions: Record<string, string> = {
        ticket: "read",
        article: "read",
        highlight: "read",
        video: "read",
      };
      setPermission(defaultPermissions[resource.type] || "read");
      setJustification("");
      setRequestType("PERMANENT");
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open, resource]);

  const Icon = resource ? getResourceIcon(resource.type) : File;
  const label = resource ? getResourceTypeLabel(resource.type) : "";

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!permission) {
      next.permission = "Please select a permission";
    }

    if (justification.trim().length < JUSTIFICATION_MIN_LENGTH) {
      next.justification = `Justification must be at least ${JUSTIFICATION_MIN_LENGTH} characters`;
    }

    if (requestType === "TEMPORARY") {
      if (!startsAt) {
        next.startsAt = "Start date is required";
      }
      if (!expiresAt) {
        next.expiresAt = "Expiry date is required";
      }
      if (startsAt && expiresAt) {
        const start = new Date(startsAt).getTime();
        const end = new Date(expiresAt).getTime();
        const now = Date.now();
        const THIRTY_MIN_MS = 30 * 60 * 1000;

        if (end - start < THIRTY_MIN_MS) {
          next.expiresAt = "Expiry must be at least 30 minutes after the start time";
        }
        if (end <= now) {
          next.expiresAt = "Expiry must be in the future";
        }
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!resource || !validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        resourceType: resource.type,
        resourceId: resource.id,
        permission,
        justification: justification.trim(),
        type: requestType,
        ...(requestType === "TEMPORARY" && {
          startsAt: new Date(startsAt).toISOString(),
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      });
      onOpenChange(false);
      toast.success("Access request submitted successfully");
    } catch (error) {
      // Error is handled in the parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Request Access
          </DialogTitle>
          <DialogDescription>
            Request access to <strong>{resource?.title || resource?.subject || resource?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {resource && (
          <div className="space-y-4 py-2">
            {/* ─── Resource Preview ─── */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded bg-primary/10 flex items-center justify-center">
                  <Icon className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {resource.title || resource.subject || resource.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{resource.id}</span>
                    <span>·</span>
                    <Badge variant="outline" className="text-[9px]">
                      {label}
                    </Badge>
                    {resource.status && (
                      <>
                        <span>·</span>
                        <StatusBadge status={resource.status.toLowerCase()} />
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  asChild
                >
                  <a href={`/${resource.type}s/${resource.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3" />
                    View
                  </a>
                </Button>
              </div>
              {resource.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {resource.description}
                </p>
              )}
            </div>

            <Separator />

            {/* ─── Permission ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Permission Needed <span className="text-rose-500">*</span>
              </Label>
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger>
                  <SelectValue placeholder="Select permission..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="write">Write</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {errors.permission && (
                <p className="text-xs text-rose-500">{errors.permission}</p>
              )}
            </div>

            {/* ─── Request Type ─── */}
            <div className="space-y-3">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Access Type <span className="text-rose-500">*</span>
              </Label>
              <RadioGroup
                value={requestType}
                onValueChange={(v) => setRequestType(v as "PERMANENT" | "TEMPORARY")}
                className="grid grid-cols-2 gap-3"
              >
                <div>
                  <RadioGroupItem
                    value="PERMANENT"
                    id="dialog-type-permanent"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="dialog-type-permanent"
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all",
                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                      "hover:bg-muted/50"
                    )}
                  >
                    <Check className="size-4" />
                    Permanent
                  </Label>
                </div>
                <div>
                  <RadioGroupItem
                    value="TEMPORARY"
                    id="dialog-type-temporary"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="dialog-type-temporary"
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all",
                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                      "hover:bg-muted/50"
                    )}
                  >
                    <Clock className="size-4" />
                    Temporary
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* ─── Date Range (Temporary) ─── */}
            {requestType === "TEMPORARY" && (
              <div className="rounded-lg border-2 border-dashed p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="size-4" />
                  Temporary Access Window
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Starts at <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className={errors.startsAt ? "border-rose-500" : ""}
                    />
                    {errors.startsAt && (
                      <p className="text-xs text-rose-500">{errors.startsAt}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Expires at <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className={errors.expiresAt ? "border-rose-500" : ""}
                    />
                    {errors.expiresAt && (
                      <p className="text-xs text-rose-500">{errors.expiresAt}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2 text-xs text-muted-foreground">
                  <Info className="size-3.5" />
                  Temporary access must be at least 30 minutes and expire in the future
                </div>
              </div>
            )}

            {/* ─── Justification ─── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Justification <span className="text-rose-500">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {justification.length} / {JUSTIFICATION_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                value={justification}
                onChange={(e) =>
                  setJustification(e.target.value.slice(0, JUSTIFICATION_MAX_LENGTH))
                }
                placeholder="Explain why you need access to this resource..."
                rows={4}
                className={errors.justification ? "border-rose-500" : ""}
              />
              {errors.justification ? (
                <p className="text-xs text-rose-500">{errors.justification}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <Progress
                    value={Math.min((justification.length / JUSTIFICATION_MIN_LENGTH) * 100, 100)}
                    className="h-1 w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    Minimum {JUSTIFICATION_MIN_LENGTH} characters
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || isSubmitting}
            className="gap-2"
          >
            {(isPending || isSubmitting) ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Submit Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Resource Access Form ───

function ResourceAccessForm({
  onRequestSubmit,
  isPending,
}: {
  onRequestSubmit: (data: {
    resourceType: string;
    resourceId: string;
    permission: string;
    justification: string;
    type: "PERMANENT" | "TEMPORARY";
    startsAt?: string;
    expiresAt?: string;
  }) => void;
  isPending: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const searchResources = useSearchResources();

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchResources.mutateAsync({
        query: searchQuery.trim(),
        payload: { query: searchQuery.trim(), limit: 20 },
      });
      setSearchResults(results);
    } catch (error) {
      toast.error("Failed to search resources");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchResources]);

  const handleRequestAccess = useCallback((resource: any) => {
    setSelectedResource(resource);
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (data: {
      resourceType: string;
      resourceId: string;
      permission: string;
      justification: string;
      type: "PERMANENT" | "TEMPORARY";
      startsAt?: string;
      expiresAt?: string;
    }) => {
      try {
        await onRequestSubmit(data);
        // Reset search results after successful submission
        setSearchResults([]);
        setSearchQuery("");
        setSelectedResource(null);
      } catch (error) {
        // Error is handled in the parent
        throw error;
      }
    },
    [onRequestSubmit]
  );

  return (
    <div className="space-y-6">
      {/* ─── Resource Access Dialog ─── */}
      <ResourceAccessDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={selectedResource}
        onSubmit={handleSubmit}
        isPending={isPending}
      />

      {/* ─── Search ─── */}
      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Search for Resource
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, title, ticket number..."
              className="pl-9"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ─── Results ─── */}
      {searchResults.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Results
          </Label>
          <SearchResults
            results={searchResults}
            isLoading={isSearching}
            onRequestAccess={handleRequestAccess}
            selectedResource={selectedResource}
            setSelectedResource={setSelectedResource}
            isRequesting={false}
          />
        </div>
      )}
    </div>
  );
}

// ─── Combined History Item Component ───

function HistoryItem({
  request,
  onCancel,
  isCancelling,
}: {
  request: any;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}) {
  const status = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING;
  const StatusIcon = status.icon;
  const isRole = isRoleRequest(request);
  const isResource = isResourceRequest(request);

  // Determine the resource type and label
  let resourceType = "unknown";
  let resourceLabel = "Unknown";
  let ResourceIcon: React.ElementType = File;
  let resourceId = "";
  let resourceTitle = "";

  if (isRole) {
    resourceType = "role";
    resourceLabel = "Role";
    ResourceIcon = Shield;
    resourceId = request.requestedRoleKey || request.resourceId || "";
    resourceTitle = formatRoleKey(request.requestedRoleKey || request.resourceId || "");
  } else if (isResource) {
    resourceType = request.resourceType || "unknown";
    resourceLabel = getResourceTypeLabel(resourceType);
    ResourceIcon = getResourceIcon(resourceType);
    resourceId = request.resourceId || "";
    resourceTitle = request.resource?.title || request.resource?.subject || request.resource?.name || resourceId;
  }

  // Get permission label
  const permissionLabel = request.permissionKey || "read";

  return (
    <div className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5 min-w-0 flex-1">
          {/* ─── Header: Request Type, Resource, Status ─── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Request Type Badge */}
            <Badge
              variant={isRole ? "default" : "secondary"}
              className={cn(
                "text-[10px] gap-1",
                isRole && "bg-primary/10 text-primary border-primary/30"
              )}
            >
              {isRole ? (
                <Shield className="size-3" />
              ) : (
                <FileText className="size-3" />
              )}
              {isRole ? "Role" : "Resource"}
            </Badge>

            {/* Resource Type */}
            <Badge variant="outline" className="text-[10px] gap-1">
              <ResourceIcon className="size-3" />
              {resourceLabel}
            </Badge>

            {/* Access Type */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                request.type === "PERMANENT"
                  ? "border-primary/30 text-primary"
                  : "border-amber-500/30 text-amber-600 dark:text-amber-400"
              )}
            >
              {getRequestTypeLabel(request.type)}
            </Badge>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <StatusIcon className={cn("size-3.5", status.color)} />
              <span className="text-xs font-medium text-muted-foreground">
                {status.label}
              </span>
            </div>
          </div>

          {/* ─── Resource Name/Title ─── */}
          <div className="flex items-center gap-2 mt-1">
            {
              isResource ? (
                <Link to={`/support/tickets/${request.resourceId}`} target="_self" 
                className="font-semibold text-sm  hover:text-primary/80 cursor-pointer transition-colors duration-300">
                  {resourceTitle || "Untitled"}
                </Link>
              ) : (
                <span className="font-semibold text-sm">
                  {resourceTitle || "Untitled"}
                </span>
              )
            }
            {!isRole && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {permissionLabel}
              </Badge>
            )}
          </div>

          {/* ─── ID and Metadata ─── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">ID: {resourceId.slice(0, 12)}...</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              Submitted {formatDate(request.createdAt)}
            </span>
            {request.type === "TEMPORARY" && request.startsAt && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                Valid {formatDateTime(request.startsAt)} → {formatDateTime(request.expiresAt || request.startsAt)}
              </span>
            )}
            {request.resolvedBy && (
              <span className="flex items-center gap-1">
                <User className="size-3" />
                Resolved by {request.resolvedBy.name || request.resolvedBy.email}
              </span>
            )}
          </div>

          {/* ─── Justification ─── */}
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {request.justification}
          </p>

          {/* ─── Admin Justification (if rejected/approved) ─── */}
          {request.adminJustification && (
            <div className="mt-1 rounded-md bg-muted/30 p-2 text-xs text-muted-foreground border-l-2 border-muted-foreground/30">
              <span className="font-medium">Admin note:</span> {request.adminJustification}
            </div>
          )}
        </div>

        {/* ─── Actions ─── */}
        {request.status === "PENDING" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isCancelling}
            onClick={() => onCancel(request.id)}
            className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
          >
            {isCancelling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───

function RoleRequestPage() {
  const { user } = useAuth();
  const createRoleRequest = useCreateRoleRequest();
  const cancelAccessRequest = useCancelAccessRequest();
  const createResourceRequest = useCreateResourceAccessRequest();
  
  // Fetch both role and resource requests
  const roleRequests = useMyRoleRequests({ page: 1, limit: 50 });
  const resourceRequests = useMyAccessRequests({ page: 1, limit: 50 });

  const [requestedRoleKey, setRequestedRoleKey] = useState<string>("");
  const [requestType, setRequestType] = useState<RoleRequestType>("PERMANENT");
  const [startsAt, setStartsAt] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [justification, setJustification] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [activeTab, setActiveTab] = useState<"role" | "resource" | "history">("role");
  const [roleRequestStatus, setRoleRequestStatus] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // ─── Combine and sort all requests ───
  const allRequests = useMemo(() => {
    const roleData = roleRequests.data?.data || [];
    const resourceData = resourceRequests.data?.data || [];

    // Combine both types
    const combined = [...roleData, ...resourceData];

    // Sort by createdAt (newest first)
    return combined.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [roleRequests.data, resourceRequests.data]);

  const isLoading = roleRequests.isLoading || resourceRequests.isLoading;
  const isError = roleRequests.isError || resourceRequests.isError;

  // ─── Status banner reset ───
  useEffect(() => {
    if (roleRequestStatus.status === "success" || roleRequestStatus.status === "error") {
      const timer = setTimeout(() => {
        setRoleRequestStatus({ status: "idle" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [roleRequestStatus]);

  // ─── Validation ───
  const validateRoleRequest = (): boolean => {
    const next: Record<string, string | undefined> = {};

    if (!requestedRoleKey) {
      next.role = "Please select a role to request";
    }

    if (justification.trim().length < JUSTIFICATION_MIN_LENGTH) {
      next.justification = `Justification must be at least ${JUSTIFICATION_MIN_LENGTH} characters`;
    }

    if (requestType === "TEMPORARY") {
      if (!startsAt) {
        next.startsAt = "Start date is required";
      }
      if (!expiresAt) {
        next.expiresAt = "Expiry date is required";
      }
      if (startsAt && expiresAt) {
        const start = new Date(startsAt).getTime();
        const end = new Date(expiresAt).getTime();
        const now = Date.now();
        const THIRTY_MIN_MS = 30 * 60 * 1000;

        if (end - start < THIRTY_MIN_MS) {
          next.expiresAt = "Expiry must be at least 30 minutes after the start time";
        }
        if (end <= now) {
          next.expiresAt = "Expiry must be in the future";
        }
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ─── Handlers ───
  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setRoleRequestStatus({ status: "loading", message: "Submitting your role request..." });

    if (!validateRoleRequest()) {
      setRoleRequestStatus({
        status: "error",
        message: "Please fix the validation errors above.",
      });
      return;
    }

    const payload: Parameters<typeof createRoleRequest.mutateAsync>[0] = {
      requestedRoleKey,
      type: requestType,
      justification: justification.trim(),
    };

    if (requestType === "TEMPORARY") {
      payload.startsAt = new Date(startsAt).toISOString();
      payload.expiresAt = new Date(expiresAt).toISOString();
    }

    try {
      await createRoleRequest.mutateAsync(payload);
      setRoleRequestStatus({
        status: "success",
        message: "✅ Role request submitted successfully! An admin will review it shortly.",
      });
      setJustification("");
      setRequestedRoleKey("");
      setTimeout(() => setActiveTab("history"), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit request";
      setRoleRequestStatus({
        status: "error",
        message: `❌ ${msg}`,
      });
    }
  };

  const handleResourceRequestSubmit = useCallback(
    async (data: {
      resourceType: string;
      resourceId: string;
      permission: string;
      justification: string;
      type: "PERMANENT" | "TEMPORARY";
      startsAt?: string;
      expiresAt?: string;
    }) => {
      try {
        await createResourceRequest.mutateAsync({
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          permissionKey: data.permission,
          type: data.type as AccessRequestType,
          justification: data.justification,
          ...(data.startsAt && { startsAt: data.startsAt }),
          ...(data.expiresAt && { expiresAt: data.expiresAt }),
        });
        toast.success("Resource access request submitted successfully");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to submit request";
        toast.error("Failed to submit access request", {
          description: msg,
        });
        throw new Error(msg);
      }
    },
    [createResourceRequest]
  );

  const handleCancel = async (requestId: string) => {
    try {
      await cancelAccessRequest.mutateAsync(requestId);
      toast.success("Request cancelled successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel request";
      toast.error("Cancellation failed", {
        description: msg,
      });
    }
  };

  const justificationCount = justification.length;
  const justificationValid = justification.trim().length >= JUSTIFICATION_MIN_LENGTH;

  return (
    <div className="mx-auto w-full space-y-6 px-0 sm:px-4">
      <PageHeader
        eyebrow="Access"
        title="Request Access"
        description="Submit a formal request for role elevation or specific resource access. Administrators will review your justification and respond as soon as possible."
        actions={
          <Badge variant="outline" className="gap-1">
            <Shield className="size-3" />
            {user?.role || "User"}
          </Badge>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "role" | "resource" | "history")}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"
      >
        {/* ─── Sidebar Navigation ─── */}
        <aside className="space-y-4">
          <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-0.5 bg-transparent p-0">
            <TabsTrigger
              value="role"
              className={cn(
                "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                "justify-start text-left",
                "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm",
                "hover:bg-muted/50",
                activeTab !== "role" && "text-muted-foreground"
              )}
            >
              <Shield className="size-4" />
              <span className="flex-1">Role Access</span>
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 opacity-0 transition-opacity",
                  activeTab === "role" && "opacity-100"
                )}
              />
            </TabsTrigger>

            <TabsTrigger
              value="resource"
              className={cn(
                "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                "justify-start text-left",
                "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm",
                "hover:bg-muted/50",
                activeTab !== "resource" && "text-muted-foreground"
              )}
            >
              <FileText className="size-4" />
              <span className="flex-1">Resource Access</span>
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 opacity-0 transition-opacity",
                  activeTab === "resource" && "opacity-100"
                )}
              />
            </TabsTrigger>

            <TabsTrigger
              value="history"
              className={cn(
                "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                "justify-start text-left",
                "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm",
                "hover:bg-muted/50",
                activeTab !== "history" && "text-muted-foreground"
              )}
            >
              <History className="size-4" />
              <span className="flex-1">History</span>
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 opacity-0 transition-opacity",
                  activeTab === "history" && "opacity-100"
                )}
              />
            </TabsTrigger>
          </TabsList>
        </aside>

        {/* ─── Content Area ─── */}
        <main className="min-w-0">
          {/* ─── Role Access Tab ─── */}
          <TabsContent value="role" className="mt-1">
            <Card>
              <CardHeader className="space-y-1">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheck className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Request Role Access</CardTitle>
                    <CardDescription className="text-sm">
                      Request an elevated role or temporary access. All fields marked with{" "}
                      <span className="text-rose-500">*</span> are required.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <form onSubmit={handleRoleSubmit}>
                <CardContent className="space-y-6">
                  {/* ─── Role Request Status Banner ─── */}
                  {roleRequestStatus.status !== "idle" && (
                    <div
                      className={cn(
                        "rounded-lg border p-4 flex items-start gap-3",
                        roleRequestStatus.status === "loading" &&
                          "border-blue-500/30 bg-blue-500/5",
                        roleRequestStatus.status === "success" &&
                          "border-emerald-500/30 bg-emerald-500/5",
                        roleRequestStatus.status === "error" &&
                          "border-rose-500/30 bg-rose-500/5"
                      )}
                    >
                      {roleRequestStatus.status === "loading" && (
                        <Loader2 className="size-5 animate-spin text-blue-500 shrink-0 mt-0.5" />
                      )}
                      {roleRequestStatus.status === "success" && (
                        <CheckCircle className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      {roleRequestStatus.status === "error" && (
                        <AlertCircle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p
                          className={cn(
                            "text-sm",
                            roleRequestStatus.status === "loading" &&
                              "text-blue-600 dark:text-blue-400",
                            roleRequestStatus.status === "success" &&
                              "text-emerald-600 dark:text-emerald-400",
                            roleRequestStatus.status === "error" &&
                              "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {roleRequestStatus.message}
                        </p>
                        {roleRequestStatus.status === "success" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            You will be notified when your request is reviewed.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ─── Role picker ─── */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="role-select"
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      <ShieldCheck className="size-3.5" />
                      Requested role <span className="text-rose-500 normal-case tracking-normal">*</span>
                    </Label>
                    <RoleSelect
                      value={requestedRoleKey}
                      onValueChange={(v) => {
                        setRequestedRoleKey(v);
                        setErrors((p) => ({ ...p, role: undefined }));
                      }}
                    />
                    {errors.role && (
                      <p className="flex items-center gap-1 text-xs text-rose-500">
                        <AlertCircle className="size-3" /> {errors.role}
                      </p>
                    )}
                  </div>

                  {/* ─── Request type ─── */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <Clock className="size-3.5" />
                      Access type <span className="text-rose-500 normal-case tracking-normal">*</span>
                    </Label>
                    <RadioGroup
                      value={requestType}
                      onValueChange={(v) => setRequestType(v as RoleRequestType)}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      <div className="relative">
                        <RadioGroupItem
                          value="PERMANENT"
                          id="type-permanent"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="type-permanent"
                          className={cn(
                            "flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border-2 p-4 transition-all",
                            "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                            "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <Check className="size-3.5 text-primary" />
                            </div>
                            <span className="font-medium">Permanent</span>
                          </div>
                          <span className="text-sm text-muted-foreground pl-8">
                            Ongoing role assignment until changed
                          </span>
                        </Label>
                      </div>
                      <div className="relative">
                        <RadioGroupItem
                          value="TEMPORARY"
                          id="type-temporary"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="type-temporary"
                          className={cn(
                            "flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border-2 p-4 transition-all",
                            "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                            "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                              <Clock className="size-3.5 text-amber-500" />
                            </div>
                            <span className="font-medium">Temporary</span>
                          </div>
                          <span className="text-sm text-muted-foreground pl-8">
                            Time-bound access with start and expiry dates
                          </span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* ─── Date range (temporary only) ─── */}
                  {requestType === "TEMPORARY" && (
                    <div className="rounded-lg border-2 border-dashed p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <CalendarDays className="size-4" />
                        Temporary Access Window
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label
                            htmlFor="starts-at"
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Starts at <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            id="starts-at"
                            type="datetime-local"
                            value={startsAt}
                            onChange={(e) => {
                              setStartsAt(e.target.value);
                              setErrors((p) => ({ ...p, startsAt: undefined }));
                            }}
                            className={cn(
                              "focus-visible:ring-offset-0",
                              errors.startsAt &&
                                "border-rose-500 focus-visible:ring-rose-500"
                            )}
                          />
                          {errors.startsAt && (
                            <p className="flex items-center gap-1 text-xs text-rose-500">
                              <AlertCircle className="size-3" /> {errors.startsAt}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="expires-at"
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Expires at <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            id="expires-at"
                            type="datetime-local"
                            value={expiresAt}
                            onChange={(e) => {
                              setExpiresAt(e.target.value);
                              setErrors((p) => ({ ...p, expiresAt: undefined }));
                            }}
                            className={cn(
                              "focus-visible:ring-offset-0",
                              errors.expiresAt &&
                                "border-rose-500 focus-visible:ring-rose-500"
                            )}
                          />
                          {errors.expiresAt && (
                            <p className="flex items-center gap-1 text-xs text-rose-500">
                              <AlertCircle className="size-3" /> {errors.expiresAt}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2 text-xs text-muted-foreground">
                        <Info className="size-3.5" />
                        Temporary access must be at least 30 minutes and expire in the future
                      </div>
                    </div>
                  )}

                  {/* ─── Justification ─── */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="justification"
                        className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        <FileText className="size-3.5" />
                        Business justification{" "}
                        <span className="text-rose-500 normal-case tracking-normal">*</span>
                      </Label>
                      <span
                        className={cn(
                          "text-[11px] tabular-nums",
                          justificationCount > JUSTIFICATION_MAX_LENGTH
                            ? "text-rose-500"
                            : justificationValid
                            ? "text-emerald-500"
                            : "text-muted-foreground/70"
                        )}
                      >
                        {justificationCount} / {JUSTIFICATION_MAX_LENGTH}
                        {justificationValid && justificationCount > 0 && (
                          <Check className="ml-1 inline size-3" />
                        )}
                      </span>
                    </div>
                    <Textarea
                      id="justification"
                      value={justification}
                      onChange={(e) => {
                        setJustification(e.target.value.slice(0, JUSTIFICATION_MAX_LENGTH));
                        setErrors((p) => ({ ...p, justification: undefined }));
                      }}
                      rows={5}
                      placeholder={
                        "Please explain the business case for this role change. Include:\n• What tasks or projects require this access?\n• Which teams or stakeholders are affected?\n• Any relevant dates or deadlines."
                      }
                      className={cn(
                        "resize-none focus-visible:ring-offset-0",
                        errors.justification &&
                          "border-rose-500 focus-visible:ring-rose-500"
                      )}
                    />
                    {errors.justification ? (
                      <p className="flex items-center gap-1 text-xs text-rose-500">
                        <AlertCircle className="size-3" /> {errors.justification}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(
                            (justificationCount / JUSTIFICATION_MIN_LENGTH) * 100,
                            100
                          )}
                          className="h-1 w-24"
                        />
                        <span className="text-xs text-muted-foreground">
                          Minimum {JUSTIFICATION_MIN_LENGTH} characters
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex-col-reverse gap-2 border-t sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setRequestedRoleKey("");
                      setRequestType("PERMANENT");
                      setJustification("");
                      setErrors({});
                      setRoleRequestStatus({ status: "idle" });
                    }}
                    disabled={createRoleRequest.isPending}
                  >
                    Reset form
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRoleRequest.isPending || roleRequestStatus.status === "loading"}
                    className="gap-2"
                  >
                    {createRoleRequest.isPending ||
                    roleRequestStatus.status === "loading" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Submit request
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* ─── Resource Access Tab ─── */}
          <TabsContent value="resource" className="mt-1">
            <Card>
              <CardHeader className="space-y-1">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Request Resource Access</CardTitle>
                    <CardDescription className="text-sm">
                      Search for a specific resource (ticket, article, highlight, etc.) and request
                      access.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <ResourceAccessForm
                  onRequestSubmit={handleResourceRequestSubmit}
                  isPending={createResourceRequest.isPending}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── History Tab ─── */}
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <History className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Request History</CardTitle>
                    <CardDescription className="text-sm">
                      All your role and resource access requests
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Loading requests...
                  </div>
                ) : isError ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <AlertCircle className="size-8 text-rose-500" />
                    <p className="text-sm font-medium text-rose-500">
                      Failed to load request history
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        roleRequests.refetch();
                        resourceRequests.refetch();
                      }}
                    >
                      Try again
                    </Button>
                  </div>
                ) : allRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="size-16 rounded-full bg-muted/30 flex items-center justify-center">
                      <History className="size-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-base font-medium text-muted-foreground">
                      No requests yet
                    </p>
                    <p className="text-sm text-muted-foreground/70 max-w-sm">
                      Submit your first access request using the "Role Access" or "Resource Access"
                      tabs above
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("role")}
                      className="mt-2 gap-1.5"
                    >
                      <Send className="size-3.5" />
                      Create request
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allRequests.map((request) => {
                      const isCancelling = cancelAccessRequest.isPending && 
                        cancelAccessRequest.variables === request.id;
                      
                      return (
                        <HistoryItem
                          key={request.id}
                          request={request}
                          onCancel={handleCancel}
                          isCancelling={isCancelling}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}
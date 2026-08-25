import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Filter,
  Ticket,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  ChevronDown,
  ChevronUp,
  Eye,
  Mail,
  Tag,
  Calendar,
  Send,
  Paperclip,
  RefreshCw,
  Download,
  Loader2,
  MoreVertical,
  X,
  Check,
  Users,
  MessageSquare,
  ExternalLink,
  ArrowUpDown,
  AlertTriangle,
  History,
  Shield,
  FileText,
  Settings,
  UserPlus,
  ListIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { useState, useCallback, useMemo, useReducer, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { Textarea } from "@/components/ui/textarea";
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
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import {
  getSupportTicketsV2,
  getSupportDashboard,
  getSupportAgents,
  assignTicket,
  addTicketMessage,
  escalateTicket,
  updateTicketStatusV2,
} from "@/lib/api/services";
import { avatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  normalizeTicketRow,
  statsFromDashboard,
  mapSortParamToApiOrderBy,
  type SortParam,
  type NormalizedTicketRow,
  type SupportStatCards,
} from "@/lib/support/support-ticket.logic";
import {
  sheetReducer,
  initSheetState,
  canAssignTo,
  filterAssignableAgents,
  canAssignTicket,
  AssignerContext,
} from "@/lib/support/support-sheet-assignment.logic";
import { useCurrentUser } from "@/lib/api/hooks";
import { canVisit } from "@/lib/auth/rbac";

export const Route = createFileRoute("/_app/support/tickets/")({
  head: () => ({ meta: [{ title: "Support Tickets · Vellbase Admin" }] }),
  component: TicketsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    status: (search.status as string) || undefined,
    unassigned: (search.unassigned as string) || undefined,
  }),
});

/* ─── Constants & Config ─── */

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  NEW: {
    label: "New",
    dot: "bg-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  ASSIGNED: {
    label: "Assigned",
    dot: "bg-purple-500",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  IN_PROGRESS: {
    label: "In Progress",
    dot: "bg-yellow-500",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/20",
  },
  WAITING_ON_CUSTOMER: {
    label: "Waiting on Customer",
    dot: "bg-orange-500",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
  },
  WAITING_ON_INTERNAL: {
    label: "Waiting on Internal",
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  ESCALATED: {
    label: "Escalated",
    dot: "bg-red-500",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
  RESOLVED: {
    label: "Resolved",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  CLOSED: {
    label: "Closed",
    dot: "bg-gray-500",
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    border: "border-gray-500/20",
  },
  REOPENED: {
    label: "Reopened",
    dot: "bg-sky-500",
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  EMERGENCY: { label: "Emergency", bg: "bg-red-600", text: "text-white", dot: "bg-red-600" },
  CRITICAL: { label: "Critical", bg: "bg-orange-600", text: "text-white", dot: "bg-orange-600" },
  HIGH: { label: "High", bg: "bg-yellow-600", text: "text-white", dot: "bg-yellow-600" },
  MEDIUM: { label: "Medium", bg: "bg-blue-600", text: "text-white", dot: "bg-blue-600" },
  LOW: { label: "Low", bg: "bg-gray-600", text: "text-white", dot: "bg-gray-600" },
};

/* ─── Enhanced Assignment Dialog Component ───────────────────────────── */

function AssignTicketDialog({
  open,
  onOpenChange,
  ticketId,
  currentAssigneeId,
  onAssign,
  agents,
  currentUser,
  actorRole,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string | null;
  currentAssigneeId?: string;
  onAssign: (id: string, assigneeId: string) => Promise<any>;
  agents: any[];
  currentUser: any;
  actorRole: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(currentAssigneeId || "");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Filter agents based on search query and role
  const filteredAgents = useMemo(() => {
    if (!agents) return [];

    const roleFiltered = filterAssignableAgents({
      agents,
      actorRole,
      search: "",
    });

    if (!searchQuery.trim()) return roleFiltered;

    const query = searchQuery.toLowerCase().trim();
    return roleFiltered.filter((agent: any) => {
      const name = agent.user?.name?.toLowerCase() || "";
      const email = agent.user?.email?.toLowerCase() || "";
      const handle = agent.user?.handle?.toLowerCase() || "";
      return name.includes(query) || email.includes(query) || handle.includes(query);
    });
  }, [agents, actorRole, searchQuery]);

  // Bounce animation for no results
  const triggerBounce = useCallback(() => {
    setIsBouncing(true);
    setTimeout(() => setIsBouncing(false), 500);
  }, []);

  // Handle search with animation
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      if (value.length > 1 && filteredAgents.length === 0) {
        triggerBounce();
      }
      console.log('searching ...', value);
    },
    [filteredAgents.length, triggerBounce]
  );

  // Handle assign action
  const handleAssign = async () => {
    if (!ticketId || !selectedAssigneeId || isAssigning) return;

    setIsAssigning(true);
    try {
      await onAssign(ticketId, selectedAssigneeId);
      toast.success("Ticket assigned successfully");
      onOpenChange(false);
      setSearchQuery("");
      setSelectedAssigneeId("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to assign ticket");
    } finally {
      setIsAssigning(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSearchQuery("");
      setSelectedAssigneeId(currentAssigneeId || "");
      setIsAssigning(false);
      setIsBouncing(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Assign Ticket
          </DialogTitle>
          <DialogDescription>
            Search and assign this ticket to a support agent.
            {currentAssigneeId && " Current assignee will be replaced."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search Input with Bounce Animation */}
          <div className="space-y-1.5">
            <Label htmlFor="assign-search" className="text-xs font-medium text-muted-foreground">
              Search Agents
            </Label>
            <div
              className={cn(
                "relative transition-all duration-300",
                isBouncing && "animate-bounce"
              )}
            >
              <Search
                className={cn(
                  "absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-300",
                  isBouncing ? "text-destructive" : "text-muted-foreground"
                )}
              />
              <Input
                ref={searchInputRef}
                id="assign-search"
                placeholder="Search by name, email, or handle..."
                className={cn(
                  "pl-9 h-10 transition-all duration-300",
                  isBouncing && "border-destructive ring-2 ring-destructive/20"
                )}
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {searchQuery && filteredAgents.length === 0 && (
              <p className="text-xs text-destructive animate-pulse flex items-center gap-1">
                <AlertCircle className="size-3" />
                No agents found matching "{searchQuery}"
              </p>
            )}
          </div>

          {/* Results List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">
                {filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""} available
              </Label>
              {filteredAgents.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {selectedAssigneeId ? "1 selected" : "None selected"}
                </span>
              )}
            </div>

            <div
              className={cn(
                "rounded-md border divide-y max-h-64 overflow-y-auto transition-all duration-300",
                isBouncing && "border-destructive"
              )}
            >
              {filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="size-12 rounded-full bg-muted/30 flex items-center justify-center mb-2">
                    <Users className="size-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {searchQuery ? "No matching agents" : "No agents available"}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                    {searchQuery
                      ? "Try adjusting your search terms"
                      : "Contact an admin to add support agents"}
                  </p>
                </div>
              ) : (
                filteredAgents.map((agent: any) => {
                  const isSelected = agent.userId === selectedAssigneeId;
                  const isCurrentUser = agent.userId === currentUser?.id;
                  const name = agent.user?.name || "Unknown Agent";
                  const email = agent.user?.email || "";
                  const initials = name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <button
                      key={agent.userId}
                      type="button"
                      onClick={() => setSelectedAssigneeId(agent.userId)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 text-left transition-all duration-200",
                        "hover:bg-muted/70",
                        isSelected && "bg-primary/10 hover:bg-primary/15",
                        "focus:outline-none focus:ring-2 focus:ring-primary/30"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="size-9">
                          <AvatarImage src={avatarUrl(agent.user?.avatar || "")} />
                          <AvatarFallback
                            className={cn(
                              "text-xs font-medium",
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}
                          >
                            {initials || "?"}
                          </AvatarFallback>
                        </Avatar>
                        {agent.user?.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{name}</span>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                              You
                            </Badge>
                          )}
                          {agent.role && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                              {agent.role}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="size-3" />
                          <span className="truncate">{email || "No email"}</span>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="size-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Check className="size-3.5 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="size-6 rounded-full border-2 border-muted-foreground/20 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Stats */}
          {filteredAgents.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-emerald-500" />
                Online
              </span>
              <span className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-muted" />
                Offline
              </span>
              <span className="flex items-center gap-1 ml-2">
                <Badge variant="outline" className="text-[9px]">
                  {filteredAgents?.filter((a: any) => a.role === "SupportAdmin").length} Admins
                </Badge>
              </span>
              <span className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[9px]">
                  {filteredAgents?.filter((a: any) => a.role === "SupportAgent").length} Agents
                </Badge>
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isAssigning}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedAssigneeId || isAssigning}
            className="gap-1.5"
          >
            {isAssigning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                {currentAssigneeId ? "Reassign" : "Assign"} Ticket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Ticket Detail Sheet ──────────────────────────────────────────────── */

interface TicketDetailSheetProps {
  ticket: NormalizedTicketRow | null;
  rawTicket?: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusUpdate: (id: string, status: string) => Promise<any>;
  onAssign: (id: string, assigneeId: string) => Promise<any>;
  onEscalate: (id: string) => Promise<any>;
  onReply: (id: string, body: string) => Promise<any>;
}

export function TicketDetailSheet(props: TicketDetailSheetProps) {
  const {
    ticket,
    rawTicket,
    open,
    onOpenChange,
    isExpanded,
    onToggleExpand,
    onStatusUpdate,
    onAssign,
    onEscalate,
    onReply,
  } = props;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  // ── Fetch Agents ──
  const { data: agentData } = useQuery({
    queryKey: ["support-agents"],
    queryFn: () => getSupportAgents(),
    staleTime: 60_000,
    enabled: open,
  });

  const agents = agentData?.data || [];

  // ── State ──
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [escalateLoading, setEscalateLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [nextStatus, setNextStatus] = useState<string>("");

  // ── Assignment Search Animation States ──
  const [isSearchBouncing, setIsSearchBouncing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const statusCfg = ticket ? STATUS_CONFIG[ticket.status] : null;
  const priorityCfg = ticket ? PRIORITY_CONFIG[ticket.priority] : null;

  // ── Focus search input when dialog opens ──
  useEffect(() => {
    if (assignOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [assignOpen]);

  // ── Cleanup typing timeout ──
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // ── Actions ──
  const handleSendReply = async () => {
    if (!replyText.trim() || !ticket) return;
    setReplyLoading(true);
    try {
      await onReply(ticket.id, replyText.trim());
      toast.success("Reply sent");
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["support-tickets-v2"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send reply");
    } finally {
      setReplyLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!ticket) return;
    setStatusLoading(true);
    try {
      await onStatusUpdate(ticket.id, status);
      toast.success(`Status updated to ${STATUS_CONFIG[status]?.label ?? status}`);
      setNextStatus("");
      queryClient.invalidateQueries({ queryKey: ["support-tickets-v2"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!ticket) return;
    setEscalateLoading(true);
    try {
      await onEscalate(ticket.id);
      toast.success("Ticket escalated");
      queryClient.invalidateQueries({ queryKey: ["support-tickets-v2"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to escalate");
    } finally {
      setEscalateLoading(false);
    }
  };

  // ── Enhanced Assignment Handlers ──
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAssigneeSearch(value);
    setIsTyping(true);

    // Clear previous typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Clear typing indicator after delay
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 300);
  }, []);

  // ── Trigger bounce animation ──
  const triggerBounce = useCallback(() => {
    setIsSearchBouncing(true);
    setTimeout(() => setIsSearchBouncing(false), 500);
  }, []);

  // ── Filter agents with search and role ──
  // ─── Updated Assignment Dialog with Enhanced Security ───

  const visibleAgents = useMemo(() => {
    const actorRole = (currentUser as any)?.role ?? "User";

    // ─── Build ticket context for filtering ───
    const ticketContext = ticket ? {
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      isEscalated: ticket.status === "ESCALATED",
      requesterId: (currentUser as any)?.id,
    } : undefined;

    const roleFiltered = filterAssignableAgents({
      agents: agents as any[],
      actorRole,
      search: "",
      ticketContext,
    });

    if (!assigneeSearch.trim()) return roleFiltered;

    const query = assigneeSearch.toLowerCase().trim();
    const words = query.split(/\s+/);

    const filtered = roleFiltered.filter((agent: any) => {
      const name = agent.user?.name?.toLowerCase() || "";
      const email = agent.user?.email?.toLowerCase() || "";
      const handle = agent.user?.handle?.toLowerCase() || "";
      const searchableText = [name, email, handle].join(" ");

      return words.every((word) => searchableText.includes(word));
    });

    // Trigger bounce if search yields no results
    if (assigneeSearch.trim().length > 0 && filtered.length === 0) {
      triggerBounce();
    }

    return filtered;
  }, [agents, currentUser, assigneeSearch, ticket, triggerBounce]);

  const canAssign = canAssignTo({
    actorRole: (currentUser as any)?.role ?? "User",
    targetRole: "SupportAgent",
  });

  // ─── Enhanced assignment handler with security checks ───

  const handleConfirmAssign = async () => {
    if (!selectedAssigneeId || !ticket) return;

    // ─── Get the target agent ───
    const targetAgent = agents.find((a: any) => a.userId === selectedAssigneeId);
    if (!targetAgent) {
      toast.error("Selected agent not found");
      return;
    }

    // ─── Build assigner context ───
    const assigner: AssignerContext = {
      userId: (currentUser as any)?.id,
      userRole: (currentUser as any)?.role ?? "User",
      isTicketOwner: ticket.assigneeId === (currentUser as any)?.id,
      isTicketAssignee: ticket.assigneeId === (currentUser as any)?.id,
      hasWritePermission: true, // Assume true for now, check actual permissions
    };

    // ─── Build ticket context ───
    const ticketContext = {
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      isEscalated: ticket.status === "ESCALATED",
    };

    // ─── Build target agent context ───
    const targetAgentContext = {
      userId: targetAgent.userId,
      isActive: targetAgent.isActive !== false,
      maxTickets: targetAgent.maxTickets || 10,
      activeTickets: targetAgent.activeTickets || 0,
      role: targetAgent.user?.role ?? "SupportAgent",
    };

    // ─── Check assignment permissions ───
    const { allowed, reason } = canAssignTicket(
      assigner,
      ticketContext,
      targetAgentContext
    );

    if (!allowed) {
      toast.error(reason || "You don't have permission to assign this ticket");
      return;
    }

    // ─── Proceed with assignment ───
    setAssignLoading(true);
    try {
      await onAssign(ticket.id, selectedAssigneeId);
      toast.success("Ticket assigned successfully");
      setAssignOpen(false);
      setSelectedAssigneeId("");
      setAssigneeSearch("");
      setIsSearchBouncing(false);
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ["support-tickets-v2"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Assignment failed");
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Derived data ──
  const conversation = rawTicket?.messages ?? rawTicket?.replies ?? [];
  const attachments = rawTicket?.attachments ?? [];
  const tags = rawTicket?.tags ?? [];
  const auditTrail = rawTicket?.auditLogs ?? rawTicket?.history ?? [];
  const relatedTickets = rawTicket?.relatedTickets ?? [];
  const sla = rawTicket?.sla ?? null;

  if (!ticket) return null;

  // ── Helper to get agent initials ──
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* ─── Ticket Detail Sheet ─── */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {/* ── Sheet Header ── */}
          <SheetHeader className="space-y-1 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {ticket.ticketNumber}
                </span>
                {priorityCfg && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      priorityCfg.bg,
                      priorityCfg.text
                    )}
                  >
                    {priorityCfg.label}
                  </span>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canAssign && (
                    <DropdownMenuItem onClick={() => setAssignOpen(true)}>
                      <User className="mr-2 size-3.5" /> Assign
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleEscalate} disabled={escalateLoading}>
                    <AlertTriangle className="mr-2 size-3.5" />
                    {escalateLoading ? "Escalating..." : "Escalate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      navigate({
                        to: "/support/tickets/$ticketId",
                        params: { ticketId: ticket.id },
                      })
                    }
                  >
                    <ExternalLink className="mr-2 size-3.5" /> View Full Details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <SheetTitle className="text-lg font-semibold leading-tight">
              {ticket.subject}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2 text-xs">
              <Clock className="size-3.5" />
              Opened {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
              <span className="text-muted-foreground/60">·</span>
              Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
            </SheetDescription>
          </SheetHeader>

          {/* ── Sheet Content ── */}
          <div className="space-y-4">
            {/* Status & quick actions */}
            <div className="flex flex-wrap items-center gap-2">
              {statusCfg && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                    statusCfg.bg,
                    statusCfg.text,
                    statusCfg.border
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", statusCfg.dot)} />
                  {statusCfg.label}
                </span>
              )}
              {ticket.categoryName && ticket.categoryName !== "—" && (
                <Badge variant="outline" className="text-[10px]">
                  <Tag className="mr-1 size-3" />
                  {ticket.categoryName}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Select
                  value={nextStatus}
                  onValueChange={(v) => {
                    setNextStatus(v);
                    handleStatusChange(v);
                  }}
                  disabled={statusLoading}
                >
                  <SelectTrigger className="h-7 text-xs w-[140px]">
                    {statusLoading ? (
                      <Loader2 className="size-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3 mr-1 text-muted-foreground" />
                    )}
                    Change Status
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_CONFIG).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canAssign && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setAssignOpen(true)}
                  >
                    <User className="size-3" />
                    Assign
                  </Button>
                )}
              </div>
            </div>

            {/* Customer */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Customer
              </div>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl(ticket.customerAvatar || "")} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {ticket.customerName?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ticket.customerName}
                    {ticket.customerHandle && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        @{ticket.customerHandle}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{ticket.customerEmail}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignee */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Assignee
                </span>
                {canAssign && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAssignOpen(true)}
                    className="h-6 text-xs gap-1"
                  >
                    <User className="size-3" />
                    {ticket.assigneeName ? "Reassign" : "Assign"}
                  </Button>
                )}
              </div>
              {ticket.assigneeName ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl(ticket.assigneeAvatar || "")} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {ticket.assigneeName.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{ticket.assigneeName}</p>
                    {ticket.assigneeEmail && (
                      <p className="text-xs text-muted-foreground">{ticket.assigneeEmail}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Unassigned</p>
              )}
            </div>

            {/* Original message */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Message
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {ticket.message || (
                  <em className="text-muted-foreground text-xs">No message body</em>
                )}
              </p>
              {attachments && attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {attachments.map((att: any, i: number) => (
                    <div
                      key={att.id ?? i}
                      className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs"
                    >
                      <Paperclip className="size-3.5 text-muted-foreground" />
                      <span className="max-w-[160px] truncate">
                        {att.name ?? att.filename ?? `Attachment ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag: any, i: number) => {
                  const label = typeof tag === "string" ? tag : tag.name ?? tag.key;
                  return (
                    <Badge
                      key={`${label}-${i}`}
                      variant="secondary"
                      className="text-[10px] font-normal"
                    >
                      <Tag className="mr-1 size-3" />
                      {label}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Expand/Collapse toggle */}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-between gap-2"
              onClick={onToggleExpand}
            >
              <span className="inline-flex items-center gap-1.5">
                <Settings className="size-3.5" />
                {isExpanded ? "Hide advanced details" : "Show advanced details"}
              </span>
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>

            {/* ── Expanded Details ── */}
            {isExpanded && (
              <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2">
                {/* Conversation history */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MessageSquare className="size-3.5" />
                        Conversation
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {conversation.length} message{conversation.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {conversation.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No replies yet — be the first.
                    </p>
                  ) : (
                    <ul className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                      {conversation.map((msg: any, i: number) => (
                        <li
                          key={msg.id ?? i}
                          className="rounded-md border bg-muted/20 p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium">
                              {msg.author?.name ?? msg.senderName ?? "Agent"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {msg.createdAt
                                ? format(new Date(msg.createdAt), "MMM d, HH:mm")
                                : ""}
                            </span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap leading-relaxed">
                            {msg.body ?? msg.content ?? msg.message ?? ""}
                          </p>
                          {msg.isInternal && (
                            <Badge variant="outline" className="text-[10px] mt-1">
                              Internal note
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Grid: Internal notes, SLA, Audit trail, Related tickets */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <FileText className="size-3.5" />
                      Internal notes
                    </div>
                    {(rawTicket?.notes ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No notes added.</p>
                    ) : (
                      <ul className="space-y-2 max-h-40 overflow-y-auto">
                        {(rawTicket.notes as any[]).slice(0, 10).map((n: any, i: number) => (
                          <li key={n.id ?? i} className="text-xs border-l-2 border-primary/30 pl-2">
                            <div className="text-[10px] text-muted-foreground">
                              {n.author?.name ?? "Agent"} ·{" "}
                              {n.createdAt && format(new Date(n.createdAt), "MMM d")}
                            </div>
                            <div className="mt-0.5 whitespace-pre-wrap">{n.body ?? n.content}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <Shield className="size-3.5" />
                      SLA
                    </div>
                    {sla ? (
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Policy</span>
                          <span className="font-medium">{sla.policyName ?? "Standard"}</span>
                        </div>
                        {sla.firstResponseDueAt && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">First response by</span>
                            <span className="font-medium">
                              {format(new Date(sla.firstResponseDueAt), "MMM d HH:mm")}
                            </span>
                          </div>
                        )}
                        {sla.isBreached !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <Badge
                              variant={sla.isBreached ? "destructive" : "outline"}
                              className="text-[10px]"
                            >
                              {sla.isBreached ? "Breached" : "On track"}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No SLA policy attached.</p>
                    )}
                  </div>

                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <History className="size-3.5" />
                      Audit trail
                    </div>
                    {auditTrail.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No activity yet.</p>
                    ) : (
                      <ol className="text-xs space-y-1.5 max-h-40 overflow-y-auto">
                        {auditTrail.slice(0, 15).map((a: any, i: number) => (
                          <li key={a.id ?? i} className="grid grid-cols-[auto_1fr] gap-2">
                            <span className="size-1.5 mt-1.5 rounded-full bg-primary/40" />
                            <div>
                              <div>
                                <span className="font-medium">
                                  {a.actor?.name ?? a.user?.name ?? "System"}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {a.action ?? a.event ?? "updated ticket"}
                                </span>
                                {a.from && a.to ? (
                                  <span className="text-muted-foreground">
                                    {" "}· {String(a.from)} → {String(a.to)}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {a.createdAt && format(new Date(a.createdAt), "MMM d, HH:mm")}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <Ticket className="size-3.5" />
                      Related tickets
                    </div>
                    {relatedTickets.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No related tickets.</p>
                    ) : (
                      <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                        {relatedTickets.map((r: any) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-2 border-l-2 border-muted-foreground/20 pl-2 py-1"
                          >
                            <Link
                              to="/support/tickets/$ticketId"
                              params={{ ticketId: r.id }}
                              onClick={() => onOpenChange(false)}
                              className="truncate hover:underline"
                            >
                              <span className="font-mono mr-2 text-muted-foreground">
                                {r.ticketNumber}
                              </span>
                              <span className="truncate">{r.subject}</span>
                            </Link>
                            {r.status && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {STATUS_CONFIG[r.status]?.label ?? r.status}
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Customer metadata */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Customer metadata
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Plan</span>
                      <p className="font-medium">
                        {(rawTicket?.user?.planName ?? rawTicket?.customer?.planName) || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location</span>
                      <p className="font-medium">
                        {(rawTicket?.user?.location ?? rawTicket?.customer?.location) || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Signup</span>
                      <p className="font-medium">
                        {(rawTicket?.user?.createdAt ?? rawTicket?.customer?.createdAt)
                          ? format(
                            new Date(
                              rawTicket?.user?.createdAt ?? rawTicket?.customer?.createdAt
                            ),
                            "MMM d, yyyy"
                          )
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tickets (user)</span>
                      <p className="font-medium">
                        {(rawTicket?.user?.ticketCount ?? rawTicket?.customer?.ticketCount) ??
                          "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full gap-1.5"
                  onClick={() =>
                    navigate({
                      to: "/support/tickets/$ticketId",
                      params: { ticketId: ticket.id },
                    })
                  }
                >
                  <ExternalLink className="size-4" />
                  View Full Details
                </Button>
              </div>
            )}

            <Separator />

            {/* Reply composer */}
            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Reply
              </div>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your response..."
                rows={4}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" type="button">
                    <Paperclip className="size-3.5" />
                    Attach
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || replyLoading}
                >
                  {replyLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  {replyLoading ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </div>
          </div>

          <SheetFooter className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
              <span className="font-mono">ID: {ticket.id.slice(0, 10)}…</span>
              <span>
                Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Enhanced Assignment Dialog with Search Animation ─── */}
      <Dialog open={assignOpen} onOpenChange={(v) => {
        setAssignOpen(v);
        if (!v) {
          setAssigneeSearch("");
          setSelectedAssigneeId("");
          setIsSearchBouncing(false);
          setIsTyping(false);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" />
              Assign Ticket
            </DialogTitle>
            <DialogDescription>
              Search and assign this ticket to a support agent.
              {ticket.assigneeId && " Current assignee will be replaced."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Search Input with Bounce Animation ── */}
            <div className="space-y-1.5">
              <Label htmlFor="assign-search" className="text-xs font-medium text-muted-foreground">
                Search Agents
              </Label>
              <div className={cn(
                "relative transition-all duration-300",
                isSearchBouncing && "animate-flash-bounce"
              )}>
                <Search className={cn(
                  "absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-300",
                  isSearchBouncing ? "text-destructive" : "text-muted-foreground"
                )} />
                <Input
                  ref={searchInputRef}
                  id="assign-search"
                  placeholder="Search by name, email, or handle..."
                  className={cn(
                    "pl-9 h-10 transition-all duration-300",
                    isSearchBouncing && "border-destructive ring-2 ring-destructive/20",
                    isTyping && "border-primary/50 ring-1 ring-primary/20"
                  )}
                  value={assigneeSearch}
                  onChange={handleSearchChange}
                />
                {assigneeSearch && (
                  <button
                    onClick={() => {
                      setAssigneeSearch("");
                      setIsSearchBouncing(false);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* Typing indicator */}
                {isTyping && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    <span className="flex gap-0.5">
                      <span className="size-1.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="size-1.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="size-1.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                )}
              </div>
              {assigneeSearch && visibleAgents.length === 0 && (
                <p className="text-xs text-destructive animate-pulse flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  No agents found matching "{assigneeSearch}"
                </p>
              )}
            </div>

            {/* ── Results List with Animation ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">
                  {visibleAgents.length} agent{visibleAgents.length !== 1 ? "s" : ""} available
                </Label>
                {visibleAgents.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {selectedAssigneeId ? "1 selected" : "None selected"}
                  </span>
                )}
              </div>

              <div
                ref={resultsRef}
                className={cn(
                  "rounded-md border divide-y max-h-64 overflow-y-auto transition-all duration-300",
                  isSearchBouncing && "border-destructive"
                )}
              >
                {visibleAgents.length === 0 ? (
                  <div className={cn(
                    "flex flex-col items-center justify-center py-8 text-center transition-all duration-300",
                    isSearchBouncing && "scale-95"
                  )}>
                    <div className="size-12 rounded-full bg-muted/30 flex items-center justify-center mb-2">
                      <Users className="size-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {assigneeSearch ? "No matching agents" : "No agents available"}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                      {assigneeSearch
                        ? "Try adjusting your search terms"
                        : "Contact an admin to add support agents"}
                    </p>
                  </div>
                ) : (
                  visibleAgents.map((agent: any) => {
                    const isSelected = agent.userId === selectedAssigneeId;
                    const isCurrentUser = agent.userId === currentUser?.id;
                    const name = agent.user?.name || "Unknown Agent";
                    const email = agent.user?.email || "";
                    const initials = getInitials(name);

                    return (
                      <button
                        key={agent.userId}
                        type="button"
                        onClick={() => setSelectedAssigneeId(agent.userId)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 text-left transition-all duration-200",
                          "hover:bg-muted/70",
                          isSelected && "bg-primary/10 hover:bg-primary/15",
                          "focus:outline-none focus:ring-2 focus:ring-primary/30"
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="size-9">
                            <AvatarImage src={avatarUrl(agent.user?.avatar || "")} />
                            <AvatarFallback className={cn(
                              "text-xs font-medium",
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                              {initials || "?"}
                            </AvatarFallback>
                          </Avatar>
                          {agent.user?.isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{name}</span>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                You
                              </Badge>
                            )}
                            {agent.role && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                {agent.role}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="size-3" />
                            <span className="truncate">{email || "No email"}</span>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="size-6 rounded-full bg-primary flex items-center justify-center shrink-0 animate-in zoom-in-50">
                            <Check className="size-3.5 text-primary-foreground" />
                          </div>
                        ) : (
                          <div className="size-6 rounded-full border-2 border-muted-foreground/20 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Quick Stats ── */}
            {visibleAgents.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  Online
                </span>
                <span className="flex items-center gap-1">
                  <div className="size-2 rounded-full bg-muted" />
                  Offline
                </span>
                <span className="flex items-center gap-1 ml-2">
                  <Badge variant="outline" className="text-[9px]">
                    {visibleAgents?.filter((a: any) => a.role === "SupportAdmin").length} Admins
                  </Badge>
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[9px]">
                    {visibleAgents?.filter((a: any) => a.role === "SupportAgent").length} Agents
                  </Badge>
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAssignOpen(false);
                setAssigneeSearch("");
                setSelectedAssigneeId("");
                setIsSearchBouncing(false);
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
              }}
              disabled={assignLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAssign}
              disabled={!selectedAssigneeId || assignLoading}
              className="gap-1.5"
            >
              {assignLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  {ticket.assigneeId ? "Reassign" : "Assign"} Ticket
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────── */

function TicketsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ── Current user / role checks ── */
  const { data: currentUser } = useCurrentUser();
  const actorRole: string = (currentUser as any)?.role ?? "User";
  const listCanAssign = canAssignTo({ actorRole, targetRole: "SupportAgent" });

  /* ── State ── */
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTicketId, setAssignTicketId] = useState<string | null>(null);
  const [assignAssignee, setAssignAssignee] = useState("");
  const [assignSearch, setAssignSearch] = useState("");

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(search.status ?? "");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortParam, setSortParam] = useState<SortParam>("createdAt-desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(search.unassigned === "true");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  /* ── Sheet reducer ── */
  const [sheetState, sheetDispatch] = useReducer(sheetReducer, undefined, initSheetState);
  const [rawSelection, setRawSelection] = useState<any>(null);

  /* ── Debounced search ── */
  const debouncedSet = useCallback((next: string) => {
    const id = setTimeout(() => {
      setDebouncedSearch(next);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, []);

  const onSearchChange = (next: string) => {
    setSearchQuery(next);
    void debouncedSet(next);
  };

  /* ── Data queries ── */
  const orderByArgs = mapSortParamToApiOrderBy(sortParam);

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: [
      "support-tickets-v2",
      page,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      categoryFilter,
      debouncedSearch,
      showUnassignedOnly,
      dateFrom,
      dateTo,
      orderByArgs.orderBy,
      orderByArgs.orderDir,
    ],
    queryFn: () =>
      getSupportTicketsV2({
        page,
        limit: 15,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        assigneeId: assigneeFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: debouncedSearch || undefined,
        unassigned: showUnassignedOnly,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        ...orderByArgs,
      }),
  });

  const { data: dashboardRes, isLoading: dashboardLoading } = useQuery({
    queryKey: ["support-dashboard-summary"],
    queryFn: () => getSupportDashboard(),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: agentsRes } = useQuery({
    queryKey: ["support-agents"],
    queryFn: () => getSupportAgents(),
    staleTime: 60_000,
  });

  /* ── Derived data ── */
  const rawTickets: any[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 15));
  const rows: NormalizedTicketRow[] = useMemo(
    () => rawTickets.map((t) => normalizeTicketRow(t)),
    [rawTickets]
  );
  const rawById = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of rawTickets) m.set(t.id, t);
    return m;
  }, [rawTickets]);

  const agents = agentsRes?.data ?? [];
  const stats: SupportStatCards = statsFromDashboard(dashboardRes?.summary ?? null);

  /* ── Mutations ── */
  const statusMutation = useMutation({
    mutationFn: (p: { id: string; status: string }) =>
      updateTicketStatusV2(p.id, p.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets-v2"] });
      queryClient.invalidateQueries({ queryKey: ["support-dashboard-summary"] });
    },
  });
  const assignMutation = useMutation({
    mutationFn: (p: { id: string; assigneeId: string }) =>
      assignTicket(p.id, p.assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets-v2"] });
      queryClient.invalidateQueries({ queryKey: ["support-dashboard-summary"] });
    },
  });
  const escalateMutation = useMutation({
    mutationFn: (p: { id: string }) => escalateTicket(p.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets-v2"] });
      queryClient.invalidateQueries({ queryKey: ["support-dashboard-summary"] });
    },
  });
  const replyMutation = useMutation({
    mutationFn: (p: { id: string; body: string }) =>
      addTicketMessage(p.id, p.body, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets-v2"] });
    },
  });

  /* ── Action handlers ── */
  const handleStatusUpdate = async (id: string, status: string) =>
    statusMutation.mutateAsync({ id, status });
  const handleAssign = async (id: string, assigneeId: string) =>
    assignMutation.mutateAsync({ id, assigneeId });
  const handleEscalate = async (id: string) => escalateMutation.mutateAsync({ id });
  const handleReply = async (id: string, body: string) =>
    replyMutation.mutateAsync({ id, body });

  /* ── List-level assign dialog ── */
  const openListAssign = (row: NormalizedTicketRow) => {
    setAssignTicketId(row.id);
    setAssignAssignee(row.assigneeId || "");
    setAssignSearch("");
    setAssignOpen(true);
  };


  const openTicket = useCallback(
    (row: NormalizedTicketRow) => {
      const raw = rawById.get(row.id) ?? null;
      setRawSelection(raw);
      sheetDispatch({ type: "OPEN_TICKET", ticketId: row.id });
    },
    [rawById]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["support-dashboard-summary"] }),
      ]);
      toast.success("Tickets refreshed");
    } catch {
      toast.error("Failed to refresh tickets");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    setIsExporting(true);
    try {
      const csv = [
        ["Ticket", "Subject", "Priority", "Status", "Customer", "Assignee", "Category", "Created", "Updated"],
        ...rows.map((r) => [
          r.ticketNumber,
          `"${r.subject.replace(/"/g, '""')}"`,
          r.priority,
          r.status,
          r.customerName,
          r.assigneeName ?? "Unassigned",
          r.categoryName,
          r.createdAt,
          r.updatedAt,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} tickets`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const getPageNumbers = () => {
    const nums: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else if (page <= 3) {
      nums.push(1, 2, 3, "...", totalPages);
    } else if (page >= totalPages - 2) {
      nums.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
    } else {
      nums.push(1, "...", page, "...", totalPages);
    }
    return nums;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setAssigneeFilter("");
    setCategoryFilter("");
    setShowUnassignedOnly(false);
    setDateFrom("");
    setDateTo("");
    setSortParam("createdAt-desc");
    setPage(1);
  };

  const hasAnyFilter = Boolean(
    debouncedSearch ||
    statusFilter ||
    priorityFilter ||
    assigneeFilter ||
    categoryFilter ||
    showUnassignedOnly ||
    dateFrom ||
    dateTo
  );

  const selectedRow: NormalizedTicketRow | null = sheetState.openTicketId
    ? rows.find((r) => r.id === sheetState.openTicketId) ??
    (rawById.get(sheetState.openTicketId)
      ? normalizeTicketRow(rawById.get(sheetState.openTicketId))
      : null)
    : null;


  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        <PageHeader
          title="Support Tickets"
          description="Manage and respond to customer support requests"
          actions={
            <div className="flex items-center gap-2">
        
              {/* Deleted Tickets */}
              { canVisit(actorRole as any, "/support/tickets/deleted") && (
                <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="link"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => navigate({
                      to: "/support/tickets/deleted",
                      replace: true,
                    })}
                  >
                    <ListIcon className="size-4" />
                    <span className="hidden sm:inline">Deleted Tickets</span>
                  </Button>
                </TooltipTrigger>
              </Tooltip>)}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh tickets</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleExport}
                    disabled={isExporting || rows.length === 0}
                  >
                    {isExporting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    <span className="hidden sm:inline">
                      {isExporting ? "Exporting..." : "Export"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export tickets CSV</TooltipContent>
              </Tooltip>
            </div>
          }
        />

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Tickets"
            value={stats.totalTickets}
            icon={Ticket}
            tone="primary"
            loading={dashboardLoading}
          />
          <StatCard
            label="New (24h)"
            value={stats.newLast24h}
            icon={AlertCircle}
            tone="info"
            loading={dashboardLoading}
          />
          <StatCard
            label="Escalated"
            value={stats.escalated}
            icon={AlertTriangle}
            tone="destructive"
            loading={dashboardLoading}
          />
          <StatCard
            label="Unassigned"
            value={stats.unassigned}
            icon={User}
            tone="warning"
            loading={dashboardLoading}
          />
          <StatCard
            label="Resolved Today"
            value={stats.resolvedToday}
            icon={CheckCircle2}
            tone="success"
            loading={dashboardLoading}
          />
          <StatCard
            label="Avg Response"
            value={`${stats.avgResponseMinutes}m`}
            icon={Clock}
            tone="default"
            loading={dashboardLoading}
          />
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-2 w-full">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search #, subject, customer, content..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedSearch("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[170px] h-9">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                {Object.keys(STATUS_CONFIG).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", STATUS_CONFIG[s].dot)} />
                      {STATUS_CONFIG[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(v) => {
                setPriorityFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                {Object.keys(PRIORITY_CONFIG).map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", PRIORITY_CONFIG[p].dot)} />
                      {PRIORITY_CONFIG[p].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={assigneeFilter}
              onValueChange={(v) => {
                setAssigneeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[170px] h-9">
                <Users className="mr-2 size-4 opacity-70" />
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Assignees</SelectItem>
                {(agents as any).map((a: any) => (
                  <SelectItem key={a.userId} value={a.userId}>
                    <span className="truncate">{a.user?.name ?? "Unknown agent"}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortParam}
              onValueChange={(v) => setSortParam(v as SortParam)}
            >
              <SelectTrigger className="w-[180px] h-9">
                <ArrowUpDown className="mr-2 size-4 opacity-70" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Newest first</SelectItem>
                <SelectItem value="createdAsc">Oldest first</SelectItem>
                <SelectItem value="updatedDesc">Recently updated</SelectItem>
                <SelectItem value="updatedAsc">Least recently updated</SelectItem>
                <SelectItem value="priorityDesc">Highest priority</SelectItem>
                <SelectItem value="statusAsc">Status (A → Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex items-end gap-1.5">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  From
                </Label>
                <Input
                  type="date"
                  className="h-9"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  To
                </Label>
                <Input
                  type="date"
                  className="h-9"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Switch
                id="unassigned-filter"
                checked={showUnassignedOnly}
                onCheckedChange={(v) => {
                  setShowUnassignedOnly(v);
                  setPage(1);
                }}
              />
              <Label htmlFor="unassigned-filter" className="text-xs font-medium cursor-pointer">
                Unassigned only
              </Label>
            </div>
            {(hasAnyFilter || sortParam !== "createdAt-desc") && (
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={clearFilters}>
                <X className="size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Tickets Table */}
        <SectionCard
          title={`${total.toLocaleString()} Tickets`}
          description="Click a row to view details"
          padded={false}
        >
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="size-12 text-destructive/50 mb-4" />
              <p className="text-sm font-medium text-destructive">Failed to load tickets</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-5">
              <ChartSkeleton />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 grid size-16 place-items-center rounded-full bg-primary/10">
                <Ticket className="size-8 text-primary/50" />
              </div>
              <p className="text-sm font-medium">No tickets found</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {hasAnyFilter
                  ? "Try adjusting your search or filters to find what you're looking for."
                  : "All support tickets will appear here."}
              </p>
              {hasAnyFilter && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5"
                  onClick={clearFilters}
                >
                  <X className="size-3.5" />
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                      Ticket
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[180px]">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-36">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-40">
                      Assignee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-16">
                      <ArrowUpDown className="size-3.5 inline opacity-50" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const priorityCfg = PRIORITY_CONFIG[row.priority];
                    const canAssign = listCanAssign;
                    
                    return (
                      <tr
                        key={row.id}
                        className="group hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => openTicket(row)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.ticketNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[12px] truncate max-w-[260px]">{row.subject}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {row.message}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {priorityCfg && (
                            <span
                              className={cn(
                                "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                priorityCfg.bg,
                                priorityCfg.text
                              )}
                            >
                              {priorityCfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={avatarUrl(row.customerAvatar || "")} />
                              <AvatarFallback className="text-[10px]">
                                {row.customerName?.charAt(0) ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate max-w-[110px]">
                                {row.customerName}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                                {row.customerEmail}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.assigneeName ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={avatarUrl(row.assigneeAvatar || "")} />
                                <AvatarFallback className="text-[10px]">
                                  {row.assigneeName.charAt(0) ?? "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs truncate max-w-[100px]">
                                {row.assigneeName}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Unassigned
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="font-normal text-[10px]">
                            {row.categoryName}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {canAssign && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 opacity-100 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openListAssign(row);
                                    }}
                                    title={row.assigneeName ? "Reassign ticket" : "Assign ticket"}
                                  >
                                    <UserPlus className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {row.assigneeName ? "Reassign" : "Assign"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 opacity-100 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTicket(row);
                                  }}
                                >
                                  <Eye className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open details</TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 opacity-100 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTicket(row);
                                  }}
                                >
                                  <Eye className="size-4 mr-2" /> Open Details
                                </DropdownMenuItem>
                                {canAssign && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openListAssign(row);
                                    }}
                                  >
                                    <UserPlus className="size-4 mr-2" />
                                    {row.assigneeName ? "Reassign…" : "Assign…"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate({
                                      to: "/support/tickets/$ticketId",
                                      params: { ticketId: row.id },
                                    });
                                  }}
                                >
                                  <ExternalLink className="size-4 mr-2" /> View Full Details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 15 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <span>
                  {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                    >
                      <ChevronFirst className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>First page</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous page</TooltipContent>
                </Tooltip>
                {getPageNumbers().map((num, idx) =>
                  num === "..." ? (
                    <span key={idx} className="px-2 text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={idx}
                      variant="outline"
                      size="icon"
                      className={cn(
                        "size-8",
                        page === num
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : ""
                      )}
                      onClick={() => setPage(num as number)}
                    >
                      {num}
                    </Button>
                  )
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next page</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                    >
                      <ChevronLast className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Last page</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* List-level Assign Dialog */}
      <AssignTicketDialog
        open={assignOpen}
        onOpenChange={(v) => {
          setAssignOpen(v);
          if (!v) {
            setAssignTicketId(null);
            setAssignAssignee("");
            setAssignSearch("");
          }
        }}
        ticketId={assignTicketId}
        currentAssigneeId={assignAssignee}
        onAssign={handleAssign}
        agents={agents}
        currentUser={currentUser}
        actorRole={actorRole}
      />

      {/* Ticket Detail Sheet */}
      <TicketDetailSheet
        ticket={selectedRow}
        rawTicket={rawSelection ?? (selectedRow ? rawById.get(selectedRow.id) : undefined)}
        open={sheetState.openTicketId !== null}
        onOpenChange={(v) => {
          if (!v) sheetDispatch({ type: "CLOSE_TICKET" });
        }}
        isExpanded={sheetState.isExpanded}
        onToggleExpand={() => sheetDispatch({ type: "TOGGLE_EXPAND" })}
        onStatusUpdate={handleStatusUpdate}
        onAssign={handleAssign}
        onEscalate={handleEscalate}
        onReply={handleReply}
      />
    </PermissionGuard>
  );
}
// routes/_app/support/tickets/$ticketId.tsx

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Send,
  MessageSquare,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Zap,
  CornerDownLeft,
  X,
  Hash,
  Building2,
  Users2,
  Shield,
  ShieldPlus,
  LockKeyhole,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Image,
  Code,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Strikethrough,
  Minus,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PermissionGuard, PermissionGate } from "@/components/dashboard/permission-guard";
import {
  getSupportTicketV2,
  updateTicketStatusV2,
  addTicketMessage,
  addTicketNote,
  escalateTicket,
  getSupportAgents,
  listSupportDepartments,
  listSupportTeams,
  type CannedResponse,
  type SupportAgent,
  type SupportDepartment,
  type SupportTeam,
} from "@/lib/api/services";
import { type Paginated, ApiError } from "@/lib/api/client";
import {
  useCannedResponses,
  useMarkCannedResponseUsed,
  useRouteTicket,
  useTicketAccessCheck,
} from "@/lib/api/hooks";
import { RequestTicketAccessDialog } from "@/components/support/request-ticket-access-dialog";
import { resolveAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { interpolateCannedVariables, RICH_TEXT_FORMATS, type RichTextFormat, type VariableContext } from "@/lib/support/variable-engine";
import { getSmartTextareaRows } from "@/lib/utils/textarea-utils";

export const Route = createFileRoute("/_app/support/tickets/$ticketId")({
  head: () => ({ meta: [{ title: "Ticket Detail · Vellbase Admin" }] }),
  component: TicketDetailPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  closing: "Closing",
  account: "Account",
  billing: "Billing",
  internal: "Internal",
  technical: "Technical",
};

/* ─── Rich Text Formatting Component ─── */

function RichTextToolbar({
  onApplyFormat,
  disabled,
}: {
  onApplyFormat: (format: RichTextFormat) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/20 p-2">
      {RICH_TEXT_FORMATS.map((format) => {
        const IconMap = {
          bold: Bold,
          italic: Italic,
          underline: Underline,
          strikethrough: Strikethrough,
          code: Code,
          link: Link2,
          image: Image,
          quote: Quote,
          heading1: Heading1,
          heading2: Heading2,
          heading3: Heading3,
          bulletList: List,
          numberList: ListOrdered,
          horizontalRule: Minus,
        };
        const Icon = IconMap[format.type as keyof typeof IconMap] || FileText;
        return (
          <Tooltip key={format.type}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => onApplyFormat(format)}
                disabled={disabled}
                className="h-8 w-8 p-0"
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span className="text-xs capitalize">
                {format.type.replace(/([A-Z])/g, " $1").trim()}
              </span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* ─── Canned Response Picker ─── */

function CannedResponsePicker({
  open,
  onOpenChange,
  groupedCanned,
  categoryKeys,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedCanned: Record<string, CannedResponse[]>;
  categoryKeys: string[];
  onSelect: (response: CannedResponse) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button" className="gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          Canned replies
          <kbd className="ml-1 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            /
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command className="rounded-lg border-0" filter={(value, search) => {
          const v = value.toLowerCase();
          const s = search.toLowerCase().trim();
          if (!s) return 1;
          if (v.includes(s)) return 1;
          return 0;
        }}>
          <CommandInput placeholder="Search canned responses, titles, shortcuts..." />
          <CommandList>
            <CommandEmpty>No canned responses found.</CommandEmpty>
            {categoryKeys.map((catKey) => {
              const items = groupedCanned[catKey];
              if (!items || items.length === 0) return null;
              return (
                <CommandGroup
                  key={catKey}
                  heading={CATEGORY_LABELS[catKey] ?? catKey.charAt(0).toUpperCase() + catKey.slice(1)}
                >
                  {items.map((cr) => (
                    <CommandItem
                      key={cr.id}
                      value={`${cr.title} ${cr.shortcut ?? ""} ${cr.body}`}
                      onSelect={() => onSelect(cr)}
                      className="flex-col items-start py-2.5 gap-1"
                    >
                      <div className="flex items-center w-full gap-2">
                        <FileText className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{cr.title}</span>
                        {cr.shortcut && (
                          <span className="ml-auto text-[10px] font-mono bg-muted rounded px-1.5 py-0.5 text-muted-foreground shrink-0">
                            {cr.shortcut}
                          </span>
                        )}
                        {cr.usageCount && cr.usageCount > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            used {cr.usageCount}x
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2 pl-5">
                        {cr.body.length > 140 ? cr.body.slice(0, 140) + "…" : cr.body}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Main Component ─── */

function TicketDetailPage() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [replyRows, setReplyRows] = useState(5);
  const [noteRows, setNoteRows] = useState(3);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [setWaitingOnCustomer, setSetWaitingOnCustomer] = useState(true);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user: authUser } = useAuth();

  // ─── Query data ───
  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ["support-ticket-v2", ticketId],
    queryFn: () => getSupportTicketV2(ticketId),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 403) return false;
      return failureCount < 2;
    },
  });

  const isForbidden = error instanceof ApiError && error.status === 403;
  const { data: accessCheck } = useTicketAccessCheck(isForbidden ? ticketId : undefined);

  const { data: agentsRes } = useQuery<Paginated<SupportAgent>>({
    queryKey: ["support-agents"],
    queryFn: () => getSupportAgents(),
  });

  const { data: departmentsRes } = useQuery<Paginated<SupportDepartment>>({
    queryKey: ["support-departments", { isActive: true, limit: 100 }],
    queryFn: () => listSupportDepartments({ isActive: true, limit: 100 }),
  });

  const { data: teamsRes } = useQuery<Paginated<SupportTeam>>({
    queryKey: ["support-teams", { isActive: true, limit: 200 }],
    queryFn: () => listSupportTeams({ isActive: true, limit: 200 }),
  });

  const { data: cannedResponses = [] } = useCannedResponses();
  const markUsed = useMarkCannedResponseUsed();

  // ─── Group canned responses ───
  const groupedCanned = useMemo(() => {
    const groups: Record<string, CannedResponse[]> = { uncategorized: [] };
    for (const cr of cannedResponses) {
      const key = cr.category && CATEGORY_LABELS[cr.category] ? cr.category : "uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(cr);
    }
    return groups;
  }, [cannedResponses]);

  const categoryKeys = useMemo(() => {
    return Object.keys(groupedCanned).sort((a, b) => {
      const order = ["general", "account", "billing", "technical", "internal", "closing", "uncategorized"];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [groupedCanned]);

  // ─── Keyboard shortcut for canned responses ───
  useEffect(() => {
    const el = replyTextareaRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && reply.length === 0 && !showFormatting) {
        e.preventDefault();
        setCannedOpen(true);
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [reply.length, showFormatting]);



  // ─── Add effect to update rows when reply changes ───
  useEffect(() => {
    const newRows = getSmartTextareaRows(reply, 'reply', {
      minRows: 3,
      maxRows: 25,
      charsPerRow: 55,
      paddingRows: 2,
    });
    setReplyRows(newRows);
  }, [reply]);

  useEffect(() => {
    const newRows = getSmartTextareaRows(note, 'note', {
      minRows: 2,
      maxRows: 15,
      charsPerRow: 50,
      paddingRows: 1,
    });
    setNoteRows(newRows);
  }, [note]);

  // ─── Insert canned response with rich text support ───
  const insertCannedResponse = useCallback((cr: CannedResponse) => {
    markUsed.mutate(cr.id, { onError: () => { } });

    // ─── Build comprehensive variable context ───
    const ctx: VariableContext = {
      ticketNumber: ticket?.ticketNumber,
      ticketId: ticket?.id,
      subject: ticket?.subject,
      description: ticket?.description,
      message: ticket?.message,
      status: ticket?.status,
      priority: ticket?.priority,
      type: ticket?.type,
      userName: ticket?.user?.name,
      userEmail: ticket?.user?.email,
      userHandle: ticket?.user?.handle,
      userPlan: ticket?.user?.plan,
      userRole: ticket?.user?.role,
      userJoinedAt: ticket?.user?.createdAt,
      agentName: authUser?.name,
      agentEmail: authUser?.email,
      agentId: authUser?.id,
      agentRole: authUser?.role,
      departmentName: ticket?.department?.name,
      teamName: ticket?.team?.name,
      ticketUrl: typeof window !== "undefined" ? window.location.href : undefined,
      ticketCreatedAt: ticket?.createdAt,
      ticketUpdatedAt: ticket?.updatedAt,
      workspaceName: "Vellbase",
      companyName: "Vellbase",
      supportEmail: "support@vellbase.com",
    };

    // ─── Apply comprehensive variable substitution ───
    const body = interpolateCannedVariables(cr.body, ctx);

    // Pre-calculate rows for the template
    const templateRows = getSmartTextareaRows(cr.body, 'template');
    setReplyRows(Math.max(templateRows, 5));

    // ─── Insert at cursor position ───
    const el = replyTextareaRef.current;
    if (el) {
      const start = el.selectionStart ?? reply.length;
      const end = el.selectionEnd ?? reply.length;
      const prefix = reply[start - 1] === "/" ? reply.slice(0, start - 1) : reply.slice(0, start);
      const suffix = reply.slice(end);
      const next = prefix + body + suffix;
      setReply(next);
      requestAnimationFrame(() => {
        const pos = prefix.length + body.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    } else {
      setReply((prev) => (prev ? prev + "\n\n" + body : body));
    }
    setCannedOpen(false);
  }, [reply, ticket, authUser, markUsed]);

  // ─── Apply rich text formatting to selected text ───
  const applyFormat = useCallback((format: RichTextFormat) => {
    const el = replyTextareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selectedText = reply.substring(start, end);

    if (start === end) {
      // No selection - insert a preview
      const newText = reply.slice(0, start) + format.preview + reply.slice(start);
      setReply(newText);
      requestAnimationFrame(() => {
        el.focus();
        const newPos = start + format.preview.length;
        el.setSelectionRange(newPos, newPos);
      });
      return;
    }

    // Wrap selected text
    let formatted = selectedText;
    if (format.type === 'link') {
      formatted = `[${selectedText}](url)`;
    } else if (format.type === 'image') {
      formatted = `![${selectedText}](image-url)`;
    } else if (format.type === 'bulletList') {
      formatted = selectedText.split('\n').map(line => `- ${line}`).join('\n');
    } else if (format.type === 'numberList') {
      formatted = selectedText.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
    } else if (format.type === 'horizontalRule') {
      formatted = '---';
    } else {
      formatted = format.prefix + selectedText + format.suffix;
    }

    const newText = reply.slice(0, start) + formatted + reply.slice(end);
    setReply(newText);
    requestAnimationFrame(() => {
      el.focus();
      const newPos = start + formatted.length;
      el.setSelectionRange(newPos, newPos);
    });
  }, [reply]);

  // ─── Mutations ───
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
      updateTicketStatusV2(ticketId, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket-v2", ticketId] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update status"),
  });

  const replyMutation = useMutation({
    mutationFn: async (body: string) => {
      const msg = await addTicketMessage(ticketId, body, false);
      if (setWaitingOnCustomer && ticket && ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_INTERNAL", "ESCALATED", "REOPENED"].includes(ticket.status)) {
        try {
          await updateTicketStatusV2(ticketId, "WAITING_ON_CUSTOMER", "Awaiting customer response after agent reply");
        } catch {
          /* ignore */
        }
      }
      return msg;
    },
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["support-ticket-v2", ticketId] });
      toast.success("Reply sent");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to send reply"),
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) => addTicketNote(ticketId, body),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["support-ticket-v2", ticketId] });
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to add note"),
  });

  const routeMutation = useRouteTicket();
  const [routingState, setRoutingState] = useState<{
    departmentId: string;
    teamId: string;
    agentId: string;
    reason: string;
  }>(() => ({
    departmentId: "",
    teamId: "",
    agentId: "",
    reason: "",
  }));

  useEffect(() => {
    if (ticket) {
      setRoutingState((s) => ({
        ...s,
        departmentId: s.departmentId || ticket.departmentId || "",
        teamId: s.teamId || ticket.teamId || "",
        agentId: s.agentId || ticket.assigneeId || "",
      }));
    }
  }, [ticket?.id]);

  const escalateMutation = useMutation({
    mutationFn: () => escalateTicket(ticketId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket-v2", ticketId] });
      toast.success("Ticket escalated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to escalate"),
  });

  const submitRoute = () => {
    const { departmentId, teamId, agentId, reason } = routingState;
    if (!departmentId && !teamId && !agentId) {
      toast.error("Select at least one of department, team, or agent");
      return;
    }
    routeMutation.mutate(
      {
        ticketId,
        routing: {
          departmentId: departmentId || undefined,
          teamId: teamId || undefined,
          agentId: agentId || undefined,
          reason: reason || undefined,
        },
      },
      {
        onSuccess: () => toast.success("Routing updated"),
        onError: (e: Error) => toast.error(e.message || "Failed to route"),
      },
    );
  };

  const teamsForDept = useMemo(() => {
    const list = teamsRes?.data ?? [];
    if (routingState.departmentId) {
      return list.filter((t) => t.departmentId === routingState.departmentId);
    }
    return list;
  }, [teamsRes, routingState.departmentId]);

  const agentsForTeam = useMemo(() => {
    const agents = agentsRes?.data ?? [];
    if (routingState.teamId) {
      return agents.filter((a) => a.team?.id === routingState.teamId);
    }
    if (routingState.departmentId) {
      return agents.filter((a) => a.department?.id === routingState.departmentId);
    }
    return agents;
  }, [agentsRes, routingState.teamId, routingState.departmentId]);

  if (isLoading) return <ChartSkeleton />;

  if (isForbidden || (!ticket && error)) {
    return (
      <PermissionGuard resource="support" action="read">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/support/tickets">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
            </Button>
          </div>

          <div className="mx-auto max-w-md rounded-lg border border-amber-500/30 bg-amber-500/5 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <LockKeyhole className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Access required
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You don't have permission to view this ticket. Tickets are
              restricted to the user who created them, the assigned agent, and
              team members. Submit an access request below to ask an admin for
              view access.
            </p>
            {accessCheck && !accessCheck.hasAccess && (
              <p className="mt-2 text-xs text-muted-foreground">
                Access reason: <code className="rounded bg-muted px-1 py-0.5">{accessCheck.reason}</code>
              </p>
            )}
            <Button className="mt-6" onClick={() => setAccessDialogOpen(true)}>
              <LockKeyhole className="mr-2 h-4 w-4" />
              Request access
            </Button>
          </div>

          <RequestTicketAccessDialog
            ticketId={ticketId}
            open={accessDialogOpen}
            onOpenChange={setAccessDialogOpen}
            onRequested={() => { }}
          />
        </div>
      </PermissionGuard>
    );
  }

  if (!ticket) return <div className="p-8 text-center text-muted-foreground">Ticket not found</div>;

  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/support/tickets">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>

        <PageHeader
          title={ticket.subject}
          description={`${ticket.ticketNumber} · Created ${format(new Date(ticket.createdAt), "MMM d, yyyy")}`}
          actions={
            <div className="flex gap-2">
              <PermissionGate resource="support" action="moderate">
                <Select
                  value={ticket.status}
                  onValueChange={(status) => statusMutation.mutate({ status })}
                  disabled={statusMutation.isPending}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "WAITING_ON_INTERNAL", "ESCALATED", "RESOLVED", "CLOSED", "REOPENED"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PermissionGate>
              <PermissionGate resource="support" action="moderate">
                <Button
                  variant="outline"
                  onClick={() => escalateMutation.mutate()}
                  disabled={escalateMutation.isPending}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" /> Escalate
                </Button>
              </PermissionGate>
            </div>
          }
        />

        <div className="flex flex-wrap gap-2">
          <Badge>{ticket.priority}</Badge>
          <Badge variant="outline">{ticket.status.replace(/_/g, " ")}</Badge>
          {ticket.type && <Badge variant="secondary">{ticket.type.replace(/_/g, " ")}</Badge>}
          {ticket.category && <Badge variant="secondary">{ticket.category.name}</Badge>}
          {ticket.department && <Badge variant="outline">{ticket.department.name}</Badge>}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ─── Main Content ─── */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard
              title="Conversation"
              description="Public messages visible to the customer"
              actions={
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hash className="size-3.5" />
                  {ticket.messages?.length ?? 0} replies
                </div>
              }
            >
              {/* Customer Message */}
              <div className="mb-4 rounded-lg bg-muted/50 p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={resolveAvatar(ticket.user?.avatar, ticket.user?.name ?? "customer")} />
                    <AvatarFallback>
                      <User className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{ticket.user?.name ?? "Unknown user"}</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                    Customer
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
              </div>

              {/* Messages */}
              {ticket.messages?.length === 0 && (
                <div className="my-4 text-center text-sm text-muted-foreground py-4">
                  No replies yet. Send the first response below.
                </div>
              )}

              {ticket.messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "mb-4 rounded-lg border p-4",
                    msg.isInternal
                      ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
                      : "",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={resolveAvatar(msg.author.avatar, msg.author.name || "agent")} />
                      <AvatarFallback>
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{msg.author.name}</span>
                    {msg.isInternal ? (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        Internal
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        Team
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                </div>
              ))}

              {/* ─── Reply Section with Rich Text Formatting ─── */}
              <PermissionGate resource="support_tickets" action="write">
                <div className="space-y-3 pt-5 border-t mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Canned Responses Button */}
                      <CannedResponsePicker
                        open={cannedOpen}
                        onOpenChange={setCannedOpen}
                        groupedCanned={groupedCanned}
                        categoryKeys={categoryKeys}
                        onSelect={insertCannedResponse}
                      />

                      {/* Rich Text Formatting Toggle */}
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setShowFormatting(!showFormatting)}
                        className={cn("gap-1.5", showFormatting && "bg-muted/50")}
                      >
                        <Bold className="h-3.5 w-3.5" />
                        <span className="text-xs">Format</span>
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="woc"
                        checked={setWaitingOnCustomer}
                        onCheckedChange={(v) => setSetWaitingOnCustomer(Boolean(v))}
                      />
                      <Label
                        htmlFor="woc"
                        className="text-xs text-muted-foreground font-normal cursor-pointer select-none"
                      >
                        Mark as waiting on customer after send
                      </Label>
                    </div>
                  </div>

                  {/* ─── Rich Text Formatting Toolbar ─── */}
                  {showFormatting && (
                    <RichTextToolbar
                      onApplyFormat={applyFormat}
                      disabled={replyMutation.isPending}
                    />
                  )}

                  {/* ─── Reply Textarea ─── */}
                  <div className="relative">
                    <Textarea
                      ref={replyTextareaRef}
                      placeholder="Type your reply… Type / to open canned responses. Use the Format toolbar for rich text."
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={replyRows}
                      className="min-h-[150px] resize-y pr-20 pb-10 font-mono text-sm"
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground pointer-events-none">
                      <CornerDownLeft className="size-3" />
                      <span>Enter · {reply.length} chars</span>
                    </div>
                    {reply.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setReply("")}
                        className="absolute top-2 right-2 size-7 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
                        title="Clear message"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReply("")}
                      disabled={!reply.trim() || replyMutation.isPending}
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={() => replyMutation.mutate(reply)}
                      disabled={!reply.trim() || replyMutation.isPending}
                    >
                      {replyMutation.isPending ? (
                        <>Sending…</>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" /> Send Reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </PermissionGate>
            </SectionCard>

            {/* ─── Internal Notes ─── */}
            <SectionCard
              title="Internal Notes"
              description="Visible only to support agents and admins"
            >
              {ticket.internalNotes?.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No internal notes yet.
                </div>
              )}
              {ticket.internalNotes?.map((n) => (
                <div
                  key={n.id}
                  className="mb-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 p-3 border border-yellow-200 dark:border-yellow-900"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={resolveAvatar(n.author.avatar, n.author.name || "agent")} />
                      <AvatarFallback>{n.author.name?.[0] ?? "?"}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{n.author.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
              <PermissionGate resource="support_tickets" action="write">
                <div className="space-y-2 mt-4">
                  <Textarea
                    placeholder="Add an internal note (never visible to the customer)..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => noteMutation.mutate(note)}
                      disabled={!note.trim() || noteMutation.isPending}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" /> Add Note
                    </Button>
                  </div>
                </div>
              </PermissionGate>
            </SectionCard>
          </div>

          {/* ─── Sidebar ─── */}
          <div className="space-y-6">
            <SectionCard title="Customer">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={resolveAvatar(ticket.user?.avatar, ticket.user?.name ?? "customer")} />
                  <AvatarFallback>{ticket.user?.name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{ticket.user?.name ?? "Unknown"}</p>
                  <p className="text-sm text-muted-foreground truncate">{ticket.user?.email ?? "—"}</p>
                  {ticket.user?.handle && (
                    <p className="text-xs text-muted-foreground">@{ticket.user.handle}</p>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Ownership & Routing"
              description="Route the ticket to a department, team, and/or agent"
            >
              <div className="space-y-2.5 mb-4">
                {ticket.department && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Dept</span>
                    <Badge variant="outline" className="ml-auto font-normal">
                      {ticket.department.name}
                    </Badge>
                  </div>
                )}
                {ticket.team && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Team</span>
                    <Badge variant="outline" className="ml-auto font-normal">
                      {ticket.team.name}
                    </Badge>
                  </div>
                )}
                {ticket.assignee ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={resolveAvatar(ticket.assignee.avatar, ticket.assignee.name || "agent")} />
                      <AvatarFallback className="text-[10px]">
                        {ticket.assignee.name?.[0] ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">Agent</span>
                    <span className="ml-auto font-medium truncate max-w-[140px]">
                      {ticket.assignee.name}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Agent</span>
                    <span className="ml-auto text-destructive italic text-xs">
                      Unassigned
                    </span>
                  </div>
                )}
              </div>

              <PermissionGate resource="support" action="moderate">
                <div className="space-y-3 pt-3 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> Department
                    </Label>
                    <Select
                      value={routingState.departmentId}
                      onValueChange={(v) =>
                        setRoutingState((s) => ({ ...s, departmentId: v, teamId: "", agentId: "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No department override" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">
                          <em className="text-muted-foreground not-italic">Clear department</em>
                        </SelectItem>
                        {(departmentsRes?.data ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Users2 className="h-3.5 w-3.5" /> Team
                    </Label>
                    <Select
                      value={routingState.teamId}
                      onValueChange={(v) =>
                        setRoutingState((s) => ({ ...s, teamId: v, agentId: "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No team override" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">
                          <em className="text-muted-foreground not-italic">Clear team</em>
                        </SelectItem>
                        {teamsForDept.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <ShieldPlus className="h-3.5 w-3.5" /> Agent
                    </Label>
                    <Select
                      value={routingState.agentId}
                      onValueChange={(v) => setRoutingState((s) => ({ ...s, agentId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No assignee override" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">
                          <em className="text-muted-foreground not-italic">Unassign agent</em>
                        </SelectItem>
                        {agentsForTeam.map((a) => (
                          <SelectItem key={a.userId} value={a.userId}>
                            <div className="flex items-center justify-between w-full gap-3">
                              <span className="truncate">{a.user.name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {a.activeTickets}/{a.maxTickets}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Reason (optional)</Label>
                    <Input
                      placeholder="e.g. Escalated from billing, transfer to on-call team"
                      value={routingState.reason}
                      onChange={(e) =>
                        setRoutingState((s) => ({ ...s, reason: e.target.value }))
                      }
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={submitRoute}
                      disabled={routeMutation.isPending}
                      className="flex-1"
                    >
                      {routeMutation.isPending ? "Saving…" : "Update routing"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => escalateMutation.mutate()}
                      disabled={escalateMutation.isPending}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" /> Escalate
                    </Button>
                  </div>
                </div>
              </PermissionGate>
            </SectionCard>

            <SectionCard title="SLA & Timestamps">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opened</span>
                  <span className="font-mono text-xs">
                    {format(new Date(ticket.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
                {ticket.firstResponseAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">First response</span>
                    <span className="font-mono text-xs">
                      {format(new Date(ticket.firstResponseAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                )}
                {ticket.resolvedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolved</span>
                    <span className="font-mono text-xs">
                      {format(new Date(ticket.resolvedAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                )}
                {ticket.closedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closed</span>
                    <span className="font-mono text-xs">
                      {format(new Date(ticket.closedAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                )}
                {ticket.dueAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span
                      className={cn(
                        "font-mono text-xs",
                        new Date(ticket.dueAt) < new Date() &&
                          !["RESOLVED", "CLOSED"].includes(ticket.status)
                          ? "text-red-600 font-semibold"
                          : "",
                      )}
                    >
                      {format(new Date(ticket.dueAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Activity Timeline"
              description="Status, assignments and routing events"
            >
              <div className="space-y-3">
                {(() => {
                  const events: Array<{
                    id: string;
                    time: Date;
                    icon: React.ReactNode;
                    by: string;
                    title: string;
                    reason?: string | null;
                  }> = [];
                  for (const h of ticket.statusHistory ?? []) {
                    events.push({
                      id: "s-" + h.id,
                      time: new Date(h.createdAt ?? ""),
                      icon: <Clock className="h-4 w-4 text-sky-600" />,
                      by: h.changedBy?.name ?? "System",
                      title: h.fromStatus
                        ? `${h.fromStatus.replace(/_/g, " ")}  →  ${h.toStatus.replace(/_/g, " ")}`
                        : `Status set to ${h.toStatus.replace(/_/g, " ")}`,
                      reason: h.reason,
                    });
                  }
                  for (const a of ticket.assignments ?? []) {
                    const parts = [];
                    if (a.agent) parts.push(`agent: ${a.agent.name}`);
                    if (parts.length === 0) parts.push("assignment record created");
                    events.push({
                      id: "a-" + a.id,
                      time: new Date(a.assignedAt),
                      icon: a.isActive ? (
                        <Shield className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      ),
                      by: a.assignedBy?.name ?? "System",
                      title: a.isActive
                        ? `Assigned → ${parts.join(", ")}`
                        : `Assignment ended → ${parts.join(", ")}`,
                      reason: a.reason,
                    });
                  }
                  events.sort((x, y) => y.time.getTime() - x.time.getTime());

                  if (events.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground py-2 text-center">
                        No activity yet.
                      </p>
                    );
                  }

                  return events.map((e) => (
                    <div key={e.id} className="flex gap-3 text-sm">
                      <div className="shrink-0 mt-0.5">{e.icon}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          {e.title}
                          <span className="text-muted-foreground"> by {e.by}</span>
                        </p>
                        {e.reason && (
                          <p className="text-xs text-muted-foreground italic">"{e.reason}"</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(
                            isNaN(e.time.getTime()) ? new Date() : e.time,
                            { addSuffix: true },
                          )}
                        </p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </SectionCard>

            {ticket.resolvedAt && (
              <SectionCard title="Resolution">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">
                    Resolved {formatDistanceToNow(new Date(ticket.resolvedAt), { addSuffix: true })}
                  </span>
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
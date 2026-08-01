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
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  assignTicket,
  getSupportAgents,
  type CannedResponse,
} from "@/lib/api/services";
import { useCannedResponses, useMarkCannedResponseUsed } from "@/lib/api/hooks";
import { resolveAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/support/tickets/$ticketId")({
  head: () => ({ meta: [{ title: "Ticket Detail · Vellum Admin" }] }),
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

function TicketDetailPage() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [cannedOpen, setCannedOpen] = useState(false);
  const [setWaitingOnCustomer, setSetWaitingOnCustomer] = useState(true);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["support-ticket-v2", ticketId],
    queryFn: () => getSupportTicketV2(ticketId),
  });

  const { data: agents } = useQuery({
    queryKey: ["support-agents"],
    queryFn: getSupportAgents,
  });

  const { data: cannedResponses = [] } = useCannedResponses();

  const markUsed = useMarkCannedResponseUsed();

  // Group canned responses by category for the picker
  const groupedCanned = useMemo(() => {
    const groups: Record<string, CannedResponse[]> = { uncategorized: [] };
    for (const cr of cannedResponses) {
      const key = cr.category && CATEGORY_LABELS[cr.category] ? cr.category : "uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(cr);
    }
    return groups;
  }, [cannedResponses]);

  // Keyboard shortcut: type "/" in reply area to trigger canned picker
  useEffect(() => {
    const el = replyTextareaRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && reply.length === 0) {
        e.preventDefault();
        setCannedOpen(true);
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [reply.length]);

  const insertCannedResponse = (cr: CannedResponse) => {
    // Mark used for analytics
    markUsed.mutate(cr.id, {
      onError: () => {},
    });

    // Apply simple variable substitution
    let body = cr.body
      .replace(/\{agent_name\}/g, "Support Agent")
      .replace(/\{user_name\}/g, ticket?.user?.name ?? "there");

    const el = replyTextareaRef.current;
    if (el) {
      const start = el.selectionStart ?? reply.length;
      const end = el.selectionEnd ?? reply.length;
      // If we're opening with "/" don't leave the slash behind
      const prefix = reply[start - 1] === "/" ? reply.slice(0, start - 1) : reply.slice(0, start);
      const suffix = reply.slice(end);
      const next = prefix + body + suffix;
      setReply(next);
      // Move caret after inserted text
      requestAnimationFrame(() => {
        const pos = prefix.length + body.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    } else {
      setReply((prev) => (prev ? prev + "\n\n" + body : body));
    }
    setCannedOpen(false);
  };

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
      // Optionally bump status to WAITING_ON_CUSTOMER after a public reply
      if (
        setWaitingOnCustomer &&
        ticket &&
        ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_INTERNAL", "ESCALATED", "REOPENED"].includes(ticket.status)
      ) {
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

  const assignMutation = useMutation({
    mutationFn: (agentId: string) => assignTicket(ticketId, agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket-v2", ticketId] });
      toast.success("Ticket assigned");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to assign ticket"),
  });

  const escalateMutation = useMutation({
    mutationFn: () => escalateTicket(ticketId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket-v2", ticketId] });
      toast.success("Ticket escalated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to escalate"),
  });

  if (isLoading) return <ChartSkeleton />;
  if (!ticket) return <div className="p-8 text-center text-muted-foreground">Ticket not found</div>;

  const categoryKeys = Object.keys(groupedCanned).sort((a, b) => {
    const order = ["general", "account", "billing", "technical", "internal", "closing", "uncategorized"];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/support/tickets"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
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
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PermissionGate>
              <PermissionGate resource="support" action="moderate">
                <Button variant="outline" onClick={() => escalateMutation.mutate()} disabled={escalateMutation.isPending}>
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
              <div className="mb-4 rounded-lg bg-muted/50 p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={resolveAvatar(ticket.user?.avatar, ticket.user?.name ?? "customer")} />
                    <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{ticket.user?.name ?? "Unknown user"}</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">Customer</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
              </div>

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
                    msg.isInternal ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900" : "",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={resolveAvatar(msg.author.avatar, msg.author.name || "agent")} />
                      <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{msg.author.name}</span>
                    {msg.isInternal ? (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">Internal</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Team</Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                </div>
              ))}

              <PermissionGate resource="support" action="write">
                <div className="space-y-3 pt-5 border-t mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Popover open={cannedOpen} onOpenChange={setCannedOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            className="gap-1.5"
                          >
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
                                        onSelect={() => insertCannedResponse(cr)}
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
                                          {cr.usageCount > 0 && (
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
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="woc"
                        checked={setWaitingOnCustomer}
                        onCheckedChange={(v) => setSetWaitingOnCustomer(Boolean(v))}
                      />
                      <Label htmlFor="woc" className="text-xs text-muted-foreground font-normal cursor-pointer select-none">
                        Mark as waiting on customer after send
                      </Label>
                    </div>
                  </div>

                  <div className="relative">
                    <Textarea
                      ref={replyTextareaRef}
                      placeholder="Type your reply… Type / to open canned responses."
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={5}
                      className="min-h-[120px] resize-y pr-20 pb-10"
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
                <div key={n.id} className="mb-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 p-3 border border-yellow-200 dark:border-yellow-900">
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
              <PermissionGate resource="support" action="write">
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

            <SectionCard title="Assignment">
              {ticket.assignee ? (
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={resolveAvatar(ticket.assignee.avatar, ticket.assignee.name || "agent")} />
                    <AvatarFallback>{ticket.assignee.name?.[0] ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ticket.assignee.name}</p>
                    <p className="text-xs text-muted-foreground">Assigned agent</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">Not assigned</p>
              )}
              <PermissionGate resource="support" action="moderate">
                <Select
                  onValueChange={(agentId) => assignMutation.mutate(agentId)}
                  disabled={assignMutation.isPending}
                  value={ticket.assignee?.id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign to agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(agents ?? []).map((agent) => (
                      <SelectItem key={agent.userId} value={agent.userId}>
                        <div className="flex items-center justify-between w-full gap-3">
                          <span className="truncate">{agent.user.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {agent.activeTickets}/{agent.maxTickets}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PermissionGate>
            </SectionCard>

            <SectionCard
              title="SLA & Timestamps"
            >
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opened</span>
                  <span className="font-mono text-xs">{format(new Date(ticket.createdAt), "MMM d, HH:mm")}</span>
                </div>
                {ticket.firstResponseAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">First response</span>
                    <span className="font-mono text-xs">{format(new Date(ticket.firstResponseAt), "MMM d, HH:mm")}</span>
                  </div>
                )}
                {ticket.resolvedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolved</span>
                    <span className="font-mono text-xs">{format(new Date(ticket.resolvedAt), "MMM d, HH:mm")}</span>
                  </div>
                )}
                {ticket.closedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closed</span>
                    <span className="font-mono text-xs">{format(new Date(ticket.closedAt), "MMM d, HH:mm")}</span>
                  </div>
                )}
                {ticket.dueAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span className={cn(
                      "font-mono text-xs",
                      new Date(ticket.dueAt) < new Date() && !["RESOLVED", "CLOSED"].includes(ticket.status)
                        ? "text-red-600 font-semibold"
                        : "",
                    )}>{format(new Date(ticket.dueAt), "MMM d, HH:mm")}</span>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Activity Timeline">
              <div className="space-y-3">
                {(!ticket.statusHistory || ticket.statusHistory.length === 0) && (
                  <p className="text-sm text-muted-foreground py-2 text-center">No activity yet.</p>
                )}
                {ticket.statusHistory?.map((h) => (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        {h.fromStatus ? `${h.fromStatus.replace(/_/g, " ")} → ${h.toStatus.replace(/_/g, " ")}` : h.toStatus.replace(/_/g, " ")}
                        <span className="text-muted-foreground"> by {h.changedBy.name}</span>
                      </p>
                      {h.reason && (
                        <p className="text-xs text-muted-foreground italic">"{h.reason}"</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(h.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {ticket.resolvedAt && (
              <SectionCard title="Resolution">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Resolved {formatDistanceToNow(new Date(ticket.resolvedAt), { addSuffix: true })}</span>
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}

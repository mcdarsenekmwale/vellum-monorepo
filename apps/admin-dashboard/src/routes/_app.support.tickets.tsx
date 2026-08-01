import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  Filter,
  Ticket,
  User,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  Eye,
  Mail,
  Phone,
  Tag,
  Calendar,
  ArrowUpRight,
  MoreHorizontal,
  Send,
  Paperclip,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { getSupportTicketsV2 } from "@/lib/api/services";
import { avatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/support/tickets")({
  head: () => ({ meta: [{ title: "Support Tickets · Vellum Admin" }] }),
  component: TicketsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    status: (search.status as string) || undefined,
    unassigned: (search.unassigned as string) || undefined,
  }),
});

/* ----------------- Status Config ----------------- */

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
  { label: string; bg: string; text: string }
> = {
  EMERGENCY: { label: "Emergency", bg: "bg-red-600", text: "text-white" },
  CRITICAL: { label: "Critical", bg: "bg-orange-600", text: "text-white" },
  HIGH: { label: "High", bg: "bg-yellow-600", text: "text-white" },
  MEDIUM: { label: "Medium", bg: "bg-blue-600", text: "text-white" },
  LOW: { label: "Low", bg: "bg-gray-600", text: "text-white" },
};

/* ----------------- Ticket Detail Sheet ----------------- */

function TicketDetailSheet({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const statusCfg = ticket ? STATUS_CONFIG[ticket.status] : null;
  const priorityCfg = ticket ? PRIORITY_CONFIG[ticket.priority] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {ticket && (
          <>
            <SheetHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
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
              <SheetTitle className="text-lg font-semibold leading-tight">
                {ticket.subject}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 text-xs">
                <Clock className="size-3.5" />
                Opened {formatDistanceToNow(new Date(ticket.createdAt), {
                  addSuffix: true,
                })}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5">
              {/* Status & Meta */}
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
              </div>

              {/* Customer */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Customer
                </div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={avatarUrl(ticket.customer?.avatar || "")} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {ticket.customer?.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{ticket.customer?.name || "Unknown"}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {ticket.customer?.email || "No email"}
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
                  {!ticket.assignee && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1">
                      <User className="size-3" />
                      Assign
                    </Button>
                  )}
                </div>
                {ticket.assignee ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarUrl(ticket.assignee.avatar || "")} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {ticket.assignee.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{ticket.assignee.name}</p>
                      <p className="text-xs text-muted-foreground">{ticket.assignee.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Unassigned</p>
                )}
              </div>

              {/* Original Message */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Message
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {ticket.message}
                </p>
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {ticket.attachments.map((att: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs"
                      >
                        <Paperclip className="size-3.5 text-muted-foreground" />
                        {att.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              {ticket.tags && ticket.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ticket.tags.map((tag: string) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[10px] font-normal"
                    >
                      <Tag className="mr-1 size-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <Separator />

              {/* Reply Composer */}
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
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                      <Paperclip className="size-3.5" />
                      Attach
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={!replyText.trim()}
                  >
                    <Send className="size-3.5" />
                    Send Reply
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ----------------- Main Page ----------------- */

function TicketsPage() {
  const search = Route.useSearch();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(search.status ?? "");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(
    search.unassigned === "true"
  );
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [
      "support-tickets-v2",
      page,
      statusFilter,
      priorityFilter,
      searchQuery,
      showUnassignedOnly,
    ],
    queryFn: () =>
      getSupportTicketsV2({
        page,
        limit: 15,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchQuery || undefined,
        unassigned: showUnassignedOnly,
      }),
  });

  const tickets = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 15));

  const openTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setSheetOpen(true);
  };

  // Stats
  const newCount = tickets.filter((t: any) => t.status === "NEW").length;
  const escalatedCount = tickets.filter((t: any) => t.status === "ESCALATED").length;
  const unassignedCount = tickets.filter((t: any) => !t.assignee).length;
  const resolvedToday = tickets.filter(
    (t: any) =>
      t.status === "RESOLVED" &&
      new Date(t.updatedAt).toDateString() === new Date().toDateString()
  ).length;

  const getPageNumbers = () => {
    const nums: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      if (page <= 3) nums.push(1, 2, 3, "...", totalPages);
      else if (page >= totalPages - 2)
        nums.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
      else nums.push(1, "...", page, "...", totalPages);
    }
    return nums;
  };

  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        <PageHeader
          title="Support Tickets"
          description="Manage and respond to customer support requests"
        />

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <Ticket className="size-3.5" />
              New Tickets
            </div>
            <p className="text-2xl font-semibold">{newCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <AlertCircle className="size-3.5" />
              Escalated
            </div>
            <p className="text-2xl font-semibold">{escalatedCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <User className="size-3.5" />
              Unassigned
            </div>
            <p className="text-2xl font-semibold">{unassignedCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <CheckCircle2 className="size-3.5" />
              Resolved Today
            </div>
            <p className="text-2xl font-semibold">{resolvedToday}</p>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
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
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                {Object.keys(PRIORITY_CONFIG).map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", PRIORITY_CONFIG[p].bg)} />
                      {PRIORITY_CONFIG[p].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Switch
                id="unassigned-filter"
                checked={showUnassignedOnly}
                onCheckedChange={(v) => {
                  setShowUnassignedOnly(v);
                  setPage(1);
                }}
              />
              <Label
                htmlFor="unassigned-filter"
                className="text-xs font-medium cursor-pointer"
              >
                Unassigned only
              </Label>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <SectionCard
          title={`${total.toLocaleString()} Tickets`}
          description="Click a row to view details"
          padded={false}
        >
          {isLoading ? (
            <div className="p-5">
              <ChartSkeleton />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 grid size-16 place-items-center rounded-full bg-primary/10">
                <Ticket className="size-8 text-primary/50" />
              </div>
              <p className="text-sm font-medium">No tickets found</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Try adjusting your search or filters to find what you're looking for.
              </p>
              {(searchQuery || statusFilter || priorityFilter || showUnassignedOnly) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("");
                    setPriorityFilter("");
                    setShowUnassignedOnly(false);
                    setPage(1);
                  }}
                >
                  <XCircle className="size-3.5" />
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-32">
                      Ticket
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-32">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-40">
                      Assignee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-32">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tickets.map((ticket: any) => {
                    const statusCfg = STATUS_CONFIG[ticket.status];
                    const priorityCfg = PRIORITY_CONFIG[ticket.priority];

                    return (
                      <tr
                        key={ticket.id}
                        className="group hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => openTicket(ticket)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {ticket.ticketNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium truncate max-w-[300px]">
                            {ticket.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {ticket.message}
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
                          {statusCfg && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                                statusCfg.bg,
                                statusCfg.text,
                                statusCfg.border
                              )}
                            >
                              <span
                                className={cn("size-1.5 rounded-full", statusCfg.dot)}
                              />
                              {statusCfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ticket.assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src={avatarUrl(ticket.assignee.avatar || "")}
                                />
                                <AvatarFallback className="text-[10px]">
                                  {ticket.assignee.name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs truncate max-w-[100px]">
                                {ticket.assignee.name}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Unassigned
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            {formatDistanceToNow(new Date(ticket.createdAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTicket(ticket);
                            }}
                          >
                            <Eye className="size-4" />
                          </Button>
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
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronFirst className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
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
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronLast className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Ticket Detail Sheet */}
      <TicketDetailSheet
        ticket={selectedTicket}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </PermissionGuard>
  );
}
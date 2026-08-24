import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  XCircle,
  Clock,
  LockKeyhole,
  RefreshCw,
  Ticket as TicketIcon,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import {
  useTicketAccessRequests,
  useApproveTicketAccessRequest,
  useRejectTicketAccessRequest,
} from "@/lib/api/hooks";
import { resolveAvatar } from "@/lib/avatar";
import type { TicketAccessRequest, TicketAccessRequestStatus } from "@/lib/api/services";

export const Route = createFileRoute("/_app/support/tickets/access-requests")({
  head: () => ({ meta: [{ title: "Ticket Access Requests · Vellum Admin" }] }),
  component: TicketAccessRequestsPage,
});

function TicketAccessRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<TicketAccessRequestStatus | "ALL">("PENDING");
  const [reviewingRequest, setReviewingRequest] = useState<{
    request: TicketAccessRequest;
    action: "approve" | "reject";
  } | null>(null);
  const [justification, setJustification] = useState("");

  const { data, isLoading, refetch, isFetching } = useTicketAccessRequests({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    limit: 50,
  });

  const approveMutation = useApproveTicketAccessRequest();
  const rejectMutation = useRejectTicketAccessRequest();

  const requests = data?.data ?? [];

  const handleSubmit = () => {
    if (!reviewingRequest) return;
    const trimmed = justification.trim();
    if (trimmed.length < 3) {
      toast.error("Justification must be at least 3 characters");
      return;
    }
    const mutation =
      reviewingRequest.action === "approve" ? approveMutation : rejectMutation;
    mutation.mutate(
      { requestId: reviewingRequest.request.id, adminJustification: trimmed },
      {
        onSuccess: () => {
          toast.success(
            reviewingRequest.action === "approve"
              ? "Access request approved"
              : "Access request rejected",
          );
          setReviewingRequest(null);
          setJustification("");
        },
        onError: (e: Error) => {
          toast.error(e.message || "Failed to update access request");
        },
      },
    );
  };

  const closeDialog = () => {
    setReviewingRequest(null);
    setJustification("");
  };

  return (
    <PermissionGuard resource="support" action="moderate">
      <div className="space-y-6">
        

        <PageHeader
          eyebrow="Access"
          title="Ticket access requests"
          description="Review and approve requests from users who need view access to tickets they did not create and are not assigned to."
          actions={
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        <SectionCard>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {data?.total ?? 0} request{(data?.total ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as TicketAccessRequestStatus | "ALL")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <ChartSkeleton />
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <LockKeyhole className="mx-auto mb-2 h-8 w-8 opacity-50" />
              No access requests for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <AccessRequestRow
                  key={req.id}
                  request={req}
                  onApprove={() => {
                    setReviewingRequest({ request: req, action: "approve" });
                    setJustification("");
                  }}
                  onReject={() => {
                    setReviewingRequest({ request: req, action: "reject" });
                    setJustification("");
                  }}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Approve / reject dialog */}
        <Dialog open={!!reviewingRequest} onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {reviewingRequest?.action === "approve" ? "Approve" : "Reject"} access request
              </DialogTitle>
              <DialogDescription>
                {reviewingRequest?.action === "approve"
                  ? "The requester will be granted view access to this ticket."
                  : "The requester will be notified that their request was rejected."}
              </DialogDescription>
            </DialogHeader>

            {reviewingRequest && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TicketIcon className="h-3 w-3" />
                  <span>Ticket ID: {reviewingRequest.request.resourceId ?? "—"}</span>
                </div>
                <p className="mt-2 font-medium">Requester reason:</p>
                <p className="mt-1 text-muted-foreground">
                  {reviewingRequest.request.justification}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-justification">
                {reviewingRequest?.action === "approve" ? "Approval" : "Rejection"} reason
              </Label>
              <Textarea
                id="admin-justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder={
                  reviewingRequest?.action === "approve"
                    ? "e.g. Access granted for the duration of the escalation..."
                    : "e.g. This ticket contains confidential info that cannot be shared..."
                }
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {justification.trim().length}/500 characters · minimum 3
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                variant={reviewingRequest?.action === "approve" ? "default" : "destructive"}
                onClick={handleSubmit}
                disabled={
                  approveMutation.isPending ||
                  rejectMutation.isPending ||
                  justification.trim().length < 3
                }
              >
                {reviewingRequest?.action === "approve" ? (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                {(approveMutation.isPending || rejectMutation.isPending)
                  ? "Submitting..."
                  : reviewingRequest?.action === "approve"
                    ? "Approve"
                    : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}

interface AccessRequestRowProps {
  request: TicketAccessRequest;
  onApprove: () => void;
  onReject: () => void;
}

function AccessRequestRow({ request, onApprove, onReject }: AccessRequestRowProps) {
  const isPending = request.status === "PENDING";
  const submittedAt = new Date(request.createdAt);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={resolveAvatar(request.requester?.avatar, request.requester?.handle ?? request.requester?.id ?? "guest")} />
              <AvatarFallback>
                {request.requester?.name?.[0]?.toUpperCase() ?? <UserIcon className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {request.requester?.name ?? "Unknown user"}
                </span>
                <StatusBadge status={request.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TicketIcon className="h-3 w-3" />
                  {request.resourceId ? (
                    <Link
                      to="/support/tickets/$ticketId"
                      params={{ ticketId: request.resourceId }}
                      className="underline-offset-2 hover:underline"
                    >
                      View ticket
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
                <span>·</span>
                <span>Submitted {formatDistanceToNow(submittedAt, { addSuffix: true })}</span>
                <span>·</span>
                <span title={format(submittedAt, "PPpp")}>
                  {format(submittedAt, "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </div>

          {isPending && (
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={onApprove}>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={onReject}>
                <XCircle className="mr-1 h-3 w-3" />
                Reject
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
          <p className="font-medium">Requester justification:</p>
          <p className="mt-1 text-muted-foreground">{request.justification}</p>
        </div>

        {request.adminJustification && !isPending && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Admin response:</span>{" "}
            {request.adminJustification}
            {request.reviewer && (
              <span className="ml-1">
                · by {request.reviewer.name ?? request.reviewer.email}
              </span>
            )}
            {request.reviewedAt && (
              <span className="ml-1">
                · {formatDistanceToNow(new Date(request.reviewedAt), { addSuffix: true })}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: TicketAccessRequestStatus }) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
          <Clock className="mr-1 h-3 w-3" /> Pending
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
          <XCircle className="mr-1 h-3 w-3" /> Rejected
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/30">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

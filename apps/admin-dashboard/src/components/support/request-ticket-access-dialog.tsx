"use client";

import { useEffect, useState } from "react";
import { LockKeyhole, Send, Clock, CheckCircle2, XCircle, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useRequestTicketAccess,
  useTicketAccessRequestsForTicket,
  useCancelTicketAccessRequest,
} from "@/lib/api/hooks";
import type { TicketAccessRequest } from "@/lib/api/services";

interface RequestTicketAccessDialogProps {
  ticketId: string;
  ticketNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called after an access request has been submitted and acknowledged by
   * the user (dialog closed). Lets the parent refresh any dependent UI.
   */
  onRequested?: () => void;
}

/**
 * Dialog shown to a non-admin user who attempted to view a ticket they do not
 * have access to. Lets them submit a ticket-view access request, or shows the
 * status of an existing request (pending / approved / rejected).
 */
export function RequestTicketAccessDialog({
  ticketId,
  ticketNumber,
  open,
  onOpenChange,
  onRequested,
}: RequestTicketAccessDialogProps) {
  const [justification, setJustification] = useState("");

  // Surface any existing requests for this ticket + current user. The backend
  // only returns the caller's own requests for non-admins, so this is safe.
  const { data: existingRes } = useTicketAccessRequestsForTicket(ticketId, {
    limit: 10,
  });
  const existingRequests = existingRes?.data ?? [];

  const requestMutation = useRequestTicketAccess();
  const cancelMutation = useCancelTicketAccessRequest();

  // Reset the justification whenever the dialog opens.
  useEffect(() => {
    if (open) setJustification("");
  }, [open, ticketId]);

  const pendingRequest = existingRequests.find((r) => r.status === "PENDING");
  const approvedRequest = existingRequests.find((r) => r.status === "APPROVED");
  const rejectedRequests = existingRequests.filter((r) => r.status === "REJECTED");

  const handleSubmit = () => {
    const trimmed = justification.trim();
    if (trimmed.length < 5) {
      toast.error("Justification must be at least 5 characters");
      return;
    }
    requestMutation.mutate(
      { ticketId, justification: trimmed },
      {
        onSuccess: () => {
          toast.success("Access request submitted", {
            description: "An admin will review your request.",
          });
          onRequested?.();
        },
        onError: (e: Error) => {
          toast.error(e.message || "Failed to submit access request");
        },
      },
    );
  };

  const handleCancel = (requestId: string) => {
    cancelMutation.mutate(requestId, {
      onSuccess: () => {
        toast.success("Access request cancelled");
      },
      onError: (e: Error) => {
        toast.error(e.message || "Failed to cancel access request");
      },
    });
  };

  const ticketLabel = ticketNumber ? `Ticket ${ticketNumber}` : "this ticket";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-amber-500" />
            Access required
          </DialogTitle>
          <DialogDescription>
            You don't have permission to view {ticketLabel}. Submit a request
            below — an admin will review it and grant you access.
          </DialogDescription>
        </DialogHeader>

        {/* Existing request status */}
        {pendingRequest && (
          <RequestStatusRow
            request={pendingRequest}
            status="PENDING"
            onCancel={() => handleCancel(pendingRequest.id)}
            isCancelling={cancelMutation.isPending}
          />
        )}
        {approvedRequest && (
          <RequestStatusRow request={approvedRequest} status="APPROVED" />
        )}
        {rejectedRequests.length > 0 && (
          <RequestStatusRow request={rejectedRequests[0]} status="REJECTED" />
        )}

        {/* Submit new request form — hidden if a PENDING request already exists */}
        {!pendingRequest && !approvedRequest && (
          <div className="space-y-2">
            <Label htmlFor="justification">
              Why do you need access to this ticket?
            </Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="e.g. I'm covering for the assigned agent while they're on PTO..."
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {justification.trim().length}/500 characters · minimum 5
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!pendingRequest && !approvedRequest && (
            <Button
              onClick={handleSubmit}
              disabled={
                requestMutation.isPending || justification.trim().length < 5
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {requestMutation.isPending ? "Submitting..." : "Submit request"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RequestStatusRowProps {
  request: TicketAccessRequest;
  status: "PENDING" | "APPROVED" | "REJECTED";
  onCancel?: () => void;
  isCancelling?: boolean;
}

function RequestStatusRow({
  request,
  status,
  onCancel,
  isCancelling,
}: RequestStatusRowProps) {
  const icon = {
    PENDING: <Clock className="h-4 w-4 text-amber-500" />,
    APPROVED: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    REJECTED: <XCircle className="h-4 w-4 text-red-500" />,
  }[status];

  const badge = {
    PENDING: <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pending</Badge>,
    APPROVED: <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Approved</Badge>,
    REJECTED: <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejected</Badge>,
  }[status];

  const submittedAt = new Date(request.createdAt).toLocaleString();

  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          {icon}
          <span>Existing request</span>
          {badge}
        </div>
        {status === "PENDING" && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling}
          >
            <X className="mr-1 h-3 w-3" />
            {isCancelling ? "Cancelling..." : "Cancel"}
          </Button>
        )}
      </div>
      <p className="mt-2 text-muted-foreground">
        <span className="font-medium text-foreground">Reason:</span>{" "}
        {request.justification}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Submitted {submittedAt}
      </p>
      {status === "REJECTED" && request.adminJustification && (
        <p className="mt-1 text-xs text-red-600">
          Admin response: {request.adminJustification}
        </p>
      )}
      {status === "APPROVED" && (
        <p className="mt-1 text-xs text-emerald-600">
          Access granted — close and reopen the ticket to view it.
        </p>
      )}
    </div>
  );
}

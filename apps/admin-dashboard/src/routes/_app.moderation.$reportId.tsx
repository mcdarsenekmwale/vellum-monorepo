import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Flag,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Gavel,
  RefreshCw,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useReport, useUpdateReportStatus, useDeleteReport } from "@/lib/api/hooks";
import { avatarUrl } from "@/lib/avatar";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/moderation/$reportId")({
  head: () => ({ meta: [{ title: "Review Report · Vellum Admin" }] }),
  component: ReportDetailPage,
});

const PRIORITY_CONFIG: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = {
  critical: { label: "Critical", className: "text-destructive bg-destructive/10 border-destructive/20", icon: AlertTriangle },
  high: { label: "High", className: "text-orange-500 bg-orange-500/10 border-orange-500/20", icon: Shield },
  medium: { label: "Medium", className: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: Flag },
  low: { label: "Low", className: "text-muted-foreground bg-muted border-transparent", icon: Flag },
};

function ReportDetailPage() {
  const { reportId } = Route.useParams();
  const navigate = useNavigate();
  const { data: report, isLoading, error } = useReport(reportId);
  const updateStatus = useUpdateReportStatus();
  const deleteReport = useDeleteReport();

  const [note, setNote] = React.useState("");
  const [showResolveDialog, setShowResolveDialog] = React.useState(false);
  const [showDismissDialog, setShowDismissDialog] = React.useState(false);

  if (isLoading) {
    return <ReportDetailSkeleton />;
  }

  if (error || !report) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Moderation"
          title="Report not found"
          description="This report could not be loaded or may have been deleted."
          actions={
            <Button variant="outline" asChild>
              <Link to="/moderation">
                <ArrowLeft className="size-4 mr-2" />
                Back to queue
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const priorityConfig = PRIORITY_CONFIG[report.priority] ?? PRIORITY_CONFIG.low;
  const PriorityIcon = priorityConfig.icon;

  const aiScore = report.aiScore ?? 0;

  const handleResolve = () => {
    updateStatus.mutate(
      { id: report.id, status: "resolved", note: note || undefined },
      {
        onSuccess: () => {
          toast.success("Report resolved");
          setShowResolveDialog(false);
          navigate({ to: "/moderation" });
        },
        onError: () => toast.error("Failed to resolve report"),
      }
    );
  };

  const handleDismiss = () => {
    updateStatus.mutate(
      { id: report.id, status: "dismissed", note: note || undefined },
      {
        onSuccess: () => {
          toast.success("Report dismissed");
          setShowDismissDialog(false);
          navigate({ to: "/moderation" });
        },
        onError: () => toast.error("Failed to dismiss report"),
      }
    );
  };

  const handleReopen = () => {
    updateStatus.mutate(
      { id: report.id, status: "open" },
      {
        onSuccess: () => toast.success("Report reopened"),
        onError: () => toast.error("Failed to reopen report"),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this report? This action cannot be undone.")) return;
    deleteReport.mutate(report.id, {
      onSuccess: () => {
        toast.success("Report deleted");
        navigate({ to: "/moderation" });
      },
      onError: () => toast.error("Failed to delete report"),
    });
  };

  const handleViewContent = () => {
    navigate({ to: `/${report.targetType}s/${report.targetId}` as any });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Moderation"
        title={report.reason}
        description={`Target: ${report.targetType} • ${report.targetId}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/moderation">
                <ArrowLeft className="size-4 mr-2" />
                Back to queue
              </Link>
            </Button>
            {report.status === "open" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowDismissDialog(true)}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="size-4" />
                  Dismiss
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600"
                  onClick={() => setShowResolveDialog(true)}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="size-4" />
                  Resolve
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard title="Report details">
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn("gap-1.5 text-sm py-1", priorityConfig.className)}
                >
                  <PriorityIcon className="size-4" />
                  {priorityConfig.label}
                </Badge>
                <StatusBadge status={report.status} />
                <Badge variant="secondary" className="text-sm">
                  {report.targetType}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleViewContent}
                >
                  <Eye className="size-4" />
                  View reported content
                </Button>
              </div>

              {report.notes && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <MessageSquare className="size-4 text-muted-foreground" />
                    Notes from reporter
                  </div>
                  <p className="text-sm text-muted-foreground">{report.notes}</p>
                </div>
              )}

              {report.description && (
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-medium mb-2">Description</div>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
              )}

              {report.moderationNote && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2 text-primary">
                    <Gavel className="size-4" />
                    Moderation note
                  </div>
                  <p className="text-sm text-muted-foreground">{report.moderationNote}</p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Reporter">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage
                  src={report.reporter?.avatarUrl ?? avatarUrl(report.reporter?.handle ?? report.reporterId)}
                  alt={report.reporter?.name ?? "Unknown"}
                />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {report.reporter?.name?.[0]?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{report.reporter?.name ?? "Unknown user"}</div>
                {report.reporter?.handle && (
                  <div className="text-sm text-muted-foreground">@{report.reporter.handle}</div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  ID: {report.reporterId}
                </div>
              </div>
            </div>
          </SectionCard>

          {report.status !== "open" && (
            <SectionCard title="Resolution">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {report.status === "resolved" ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <XCircle className="size-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium">
                      {report.status === "resolved" ? "Resolved" : "Dismissed"}
                    </div>
                    {report.resolvedAt && (
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(report.resolvedAt), "PPpp")}
                      </div>
                    )}
                  </div>
                </div>
                {report.status === "open" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleReopen}
                    disabled={updateStatus.isPending}
                  >
                    <RefreshCw className="size-4" />
                    Reopen report
                  </Button>
                )}
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title="AI risk assessment" padded={false}>
            <div className="p-4">
              <div className="flex items-center justify-center mb-4">
                <div
                  className={cn(
                    "grid size-24 place-items-center rounded-2xl text-3xl font-bold border-4",
                    aiScore >= 80
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : aiScore >= 50
                      ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  )}
                >
                  {aiScore}%
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {aiScore >= 80
                  ? "High risk — immediate attention required"
                  : aiScore >= 50
                  ? "Moderate risk — review recommended"
                  : "Low risk — likely safe"}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Metadata" padded={false}>
            <dl className="divide-y text-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Clock className="size-3.5" />
                  Created
                </dt>
                <dd className="text-right">
                  <div className="font-medium">{format(new Date(report.createdAt), "PPp")}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                  </div>
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Shield className="size-3.5" />
                  Target type
                </dt>
                <dd className="font-medium capitalize">{report.targetType}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground">Target ID</dt>
                <dd className="font-mono text-xs">{report.targetId}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground">Report ID</dt>
                <dd className="font-mono text-xs">{report.id}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Admin actions" padded={false}>
            <div className="p-4 flex flex-col gap-2">
              {report.status === "open" ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600"
                    onClick={() => setShowResolveDialog(true)}
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle2 className="size-4" />
                    Resolve report
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full border-muted-foreground/30 hover:bg-muted"
                    onClick={() => setShowDismissDialog(true)}
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="size-4" />
                    Dismiss report
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={handleReopen}
                  disabled={updateStatus.isPending}
                >
                  <RefreshCw className="size-4" />
                  Reopen report
                </Button>
              )}
              <Separator className="my-2" />
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteReport.isPending}
              >
                <Trash2 className="size-4" />
                Delete report
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-500" />
              Resolve report
            </DialogTitle>
            <DialogDescription>
              Mark this report as resolved. Add an optional note with your decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-note">Moderation note (optional)</Label>
            <Textarea
              id="resolve-note"
              placeholder="Explain why you resolved this report..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={updateStatus.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {updateStatus.isPending ? "Resolving..." : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDismissDialog} onOpenChange={setShowDismissDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-muted-foreground" />
              Dismiss report
            </DialogTitle>
            <DialogDescription>
              Dismiss this report without taking action. Add an optional note explaining why.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dismiss-note">Reason for dismissal (optional)</Label>
            <Textarea
              id="dismiss-note"
              placeholder="Why are you dismissing this report?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDismissDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDismiss}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Dismissing..." : "Dismiss"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
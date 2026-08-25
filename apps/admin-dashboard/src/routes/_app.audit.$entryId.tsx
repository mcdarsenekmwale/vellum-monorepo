import * as React from "react";
import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Shield,
  Key,
  MapPin,
  Clock,
  Monitor,
  CheckCircle2,
  XCircle,
  User,
  FileJson,
  Download,
  Copy,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuditLogById } from "@/lib/api/hooks";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/avatar";
import { toast } from "sonner";

// Separate component for changes to avoid type inference issues
function AuditChanges({ changes }: { changes: Record<string, { old: any; new: any }> }): React.ReactElement | null {
  if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
    return null;
  }

  const safeChanges: { field: string; old: unknown; new: unknown }[] = [];
  for (const [field, change] of Object.entries(changes)) {
    if (change && typeof change === 'object') {
      safeChanges.push({ field, old: (change as any).old, new: (change as any).new });
    }
  }

  if (safeChanges.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Changes" description="Fields that were modified">
      <div className="space-y-3">
        {safeChanges.map(({ field, old: oldVal, new: newVal }) => (
          <div key={field} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <div className="font-mono text-sm font-medium">{field}</div>
            <div className="flex-1 flex items-center gap-2 text-sm">
              <span className="text-rose-500 line-through">{String(oldVal)}</span>
              <span>→</span>
              <span className="text-emerald-500">{String(newVal)}</span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function AuditChangesWrapper({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== 'object') return null;
  return <AuditChanges changes={changes as Record<string, { old: any; new: any }>} />;
}

function ChangesBlock({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== 'object') return null;
  return <AuditChanges changes={changes as Record<string, { old: any; new: any }>} />;
}

export const Route = createFileRoute("/_app/audit/$entryId")({
  head: () => ({ meta: [{ title: "Audit Log · Vellbase Admin" }] }),
  component: AuditLogDetailPage,
});

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  login: "Logged in",
  logout: "Logged out",
  password_change: "Changed password",
  role_change: "Changed role",
  view: "Viewed",
  export: "Exported",
  import: "Imported",
  settings_change: "Changed settings",
  api_key_create: "Created API key",
  api_key_revoke: "Revoked API key",
  user_suspend: "Suspended user",
  user_activate: "Activated user",
  user_invite: "Invited user",
  mfa_enabled: "Enabled MFA",
  mfa_disabled: "Disabled MFA",
};

function AuditLogDetailPage() {
  const { entryId } = Route.useParams();
  const { data: entry, isLoading, error } = useAuditLogById(entryId);

  if (isLoading) {
    return <AuditLogDetailSkeleton />;
  }

  if (error || !entry) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Audit"
          title="Log not found"
          description="This audit log entry could not be found."
        />
        <Button variant="outline" asChild>
          <Link to="/audit">
            <ArrowLeft className="size-4 mr-2" />
            Back to audit logs
          </Link>
        </Button>
      </div>
    );
  }

  const actionLabel = ACTION_LABELS[entry.action] ?? entry.action;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    toast.success("Copied to clipboard");
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${entry.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded audit log");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Audit"
        title={actionLabel}
        description={`${entry.resource} ${entry.resourceId ? `• ${entry.resourceId.slice(0, 12)}...` : ""}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/audit">
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Link>
          </Button>
        }
      />

      {/* Status Banner */}
      <div
        className={cn(
          "flex items-center gap-3 p-4 rounded-lg border",
          entry.success
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-rose-500/5 border-rose-500/20"
        )}
      >
        {entry.success ? (
          <CheckCircle2 className="size-5 text-emerald-500" />
        ) : (
          <XCircle className="size-5 text-rose-500" />
        )}
        <div>
          <div className={cn("font-medium", entry.success ? "text-emerald-600" : "text-rose-600")}>
            {entry.success ? "Action completed successfully" : "Action failed"}
          </div>
          <div className="text-sm text-muted-foreground">
            {format(new Date(entry.createdAt), "PPP 'at' p")}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Actor */}
          <SectionCard title="Actor" description="Who performed this action">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage
                  src={entry.user?.handle ? avatarUrl(entry.user.handle) : undefined}
                  alt={entry.user?.name ?? "System"}
                />
                <AvatarFallback
                  className={cn(
                    "font-bold",
                    entry.userId ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {entry.user?.name?.[0]?.toUpperCase() ?? "S"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{entry.user?.name ?? "System"}</div>
                {entry.user?.role && (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {entry.user.role}
                  </Badge>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Changes */}
          {entry.changes ? (React.createElement(ChangesBlock, { changes: entry.changes })) : null}

          {/* Metadata */}
          {entry.metadata && (
            <SectionCard title="Metadata" description="Additional information">
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                {JSON.stringify(entry.metadata as unknown, null, 2)}
              </pre>
            </SectionCard>
          )}

          {/* Details */}
          {entry.details && (
            <SectionCard title="Details" description="Full action details">
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                {JSON.stringify(entry.details as unknown, null, 2)}
              </pre>
            </SectionCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <SectionCard title="Quick info" padded={false}>
            <dl className="divide-y text-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Shield className="size-3.5" />
                  Action
                </dt>
                <dd className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Key className="size-3.5" />
                  Resource
                </dt>
                <dd className="font-medium capitalize">{entry.resource}</dd>
              </div>
              {entry.resourceId && (
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-muted-foreground">Resource ID</dt>
                  <dd className="font-mono text-xs">{entry.resourceId}</dd>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Clock className="size-3.5" />
                  When
                </dt>
                <dd className="text-right">
                  <div className="font-medium">{format(new Date(entry.createdAt), "PPp")}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </div>
                </dd>
              </div>
            </dl>
          </SectionCard>

          {/* Origin */}
          <SectionCard title="Origin" padded={false}>
            <dl className="divide-y text-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <MapPin className="size-3.5" />
                  IP Address
                </dt>
                <dd className="font-mono text-xs">{entry.ipAddress ?? "—"}</dd>
              </div>
              {entry.location && (
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>{entry.location}</dd>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Monitor className="size-3.5" />
                  User Agent
                </dt>
                <dd className="text-xs text-right max-w-[180px] truncate">{entry.userAgent ?? "—"}</dd>
              </div>
            </dl>
          </SectionCard>

          {/* Actions */}
          <SectionCard title="Actions" padded={false}>
            <div className="p-4 flex flex-col gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyJson}>
                <Copy className="size-3.5" />
                Copy JSON
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadJson}>
                <Download className="size-3.5" />
                Download JSON
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function AuditLogDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
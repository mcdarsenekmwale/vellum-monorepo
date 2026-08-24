// routes/_app/users/deleted.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ListPage, type Column } from "@/components/dashboard/list-page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDeletedUsers,
  useRestoreUser,
  usePurgeUser,
  type User,
} from "@/lib/api/hooks";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/users/deleted")({
  head: () => ({ meta: [{ title: "Deleted Users · Vellum Admin" }] }),
  component: DeletedUsersList,
});

function DeletedUsersList() {
  const { data, isLoading, refetch, isFetching } = useDeletedUsers({ page: 1, limit: 100 });
  const restoreUser = useRestoreUser();
  const purgeUser = usePurgeUser();

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  // Purge confirmation dialog state
  const [purgeTarget, setPurgeTarget] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const handleRestore = (id: string, name: string) => {
    restoreUser.mutate(id, {
      onSuccess: () => {
        toast.success(`User "${name}" restored successfully`);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to restore user");
      },
    });
  };

  const handlePurge = () => {
    if (!purgeTarget) return;
    purgeUser.mutate(purgeTarget.id, {
      onSuccess: () => {
        toast.success(`User "${purgeTarget.name}" permanently deleted`);
        setPurgeTarget(null);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to permanently delete user");
      },
    });
  };

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "User",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={u.avatar ?? undefined} />
            <AvatarFallback>
              {u.name?.charAt(0)?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{u.name}</span>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                DELETED
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {u.email} · @{u.handle}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => (
        <Badge variant="outline" className="font-mono text-xs">
          {u.role}
        </Badge>
      ),
    },
    {
      key: "deletedAt",
      header: "Deleted",
      cell: (u) => (
        <div className="text-sm">
          <div>{u.deletedAt ? format(new Date(u.deletedAt), "MMM d, yyyy") : "—"}</div>
          <div className="text-xs text-muted-foreground">
            {u.deletedAt
              ? formatDistanceToNow(new Date(u.deletedAt), { addSuffix: true })
              : ""}
          </div>
        </div>
      ),
    },
    {
      key: "autoPurge",
      header: "Auto-Purge",
      cell: (u) => {
        if (!u.deletedAt) return <span className="text-muted-foreground">—</span>;
        const deletedDate = new Date(u.deletedAt);
        const purgeDate = new Date(deletedDate);
        purgeDate.setDate(purgeDate.getDate() + 30);
        const daysLeft = Math.ceil(
          (purgeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const overdue = daysLeft <= 0;
        return (
          <div className="text-sm">
            {overdue ? (
              <span className="text-destructive font-medium">
                Overdue — will purge next sweep
              </span>
            ) : (
              <span
                className={cn(
                  daysLeft <= 7
                    ? "text-amber-600 font-medium"
                    : "text-muted-foreground"
                )}
              >
                {format(purgeDate, "MMM d, yyyy")} ({daysLeft}d left)
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      cell: (u) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={restoreUser.isPending}
            onClick={() => handleRestore(u.id, u.name)}
            className="h-8 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={purgeUser.isPending}
            onClick={() =>
              setPurgeTarget({ id: u.id, name: u.name, email: u.email })
            }
            className="h-8 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Purge
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/30 ">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="text-sm">
          <p className="font-medium text-sm text-amber-900 dark:text-amber-200">
            Soft-Deleted Users
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            These users have been soft-deleted and are excluded from the active
            users list. They will be{" "}
            <strong>permanently deleted after 30 days</strong> unless restored.
            You can manually restore or permanently delete them at any time.
          </p>
        </div>
      </div>

      <ListPage
        title="Deleted Users"
        description={`${total} soft-deleted user${total !== 1 ? "s" : ""}`}
        eyebrow="People"
        rows={rows}
        columns={columns}
        searchKeys={["name", "email", "handle", "role"]}
        pageSize={15}
        isLoading={isLoading}
        enablePagination={true}
        enableSearch={true}
        searchPlaceholder="Search deleted users..."
        emptyTitle="No soft-deleted users"
        emptyDescription="Deleted users will appear here for 30 days before automatic permanent deletion."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog
        open={!!purgeTarget}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete User
            </DialogTitle>
            <DialogDescription>
              You are about to{" "}
              <strong>irreversibly delete</strong>{" "}
              <span className="font-medium text-foreground">
                {purgeTarget?.name}
              </span>{" "}
              ({purgeTarget?.email}) and all associated data including articles,
              comments, highlights, and activity logs. This action{" "}
              <strong>cannot be undone</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPurgeTarget(null)}
              disabled={purgeUser.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={purgeUser.isPending}
            >
              {purgeUser.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Trash2,
  Plus,
  X,
  Search,
  Clock,
  Star,
} from "lucide-react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { AreaSpark } from "@/components/dashboard/charts";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { resolveAvatar } from "@/lib/avatar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useUserById,
  useArticles,
  useAnalyticsTimeseries,
  useAuditLogs,
  useUpdateUserRole,
  useToggleUserStatus,
  useRbacRoles,
  useUserRbacRoles,
  useAssignUserRbacRole,
  useRemoveUserRbacRole,
  usePermissionGroups,
  useUserEffectivePermissions,
  useSetPermissionOverride,
  useRemovePermissionOverride,
  useUserRoleHistory,
  type Article,
  type AuditLogEntry,
  type TimeseriesPoint,
  type RbacRole,
  type PermissionGroup,
} from "@/lib/api/hooks";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/users/$userId")({
  head: ({ params }) => ({ meta: [{ title: `User ${params.userId} · Vellum Admin` }] }),
  component: UserDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">User not found.</div>
  ),
});

const LEGACY_ROLE_OPTIONS = ["ADMIN", "MODERATOR", "CREATOR", "USER", "GUEST"];

function UserDetail() {
  const { userId } = Route.useParams();
  const { data: user, isLoading, isError } = useUserById(userId);
  const { data: articlesData } = useArticles({ pageSize: 100 });
  const { data: tsData } = useAnalyticsTimeseries(30);
  const { data: auditData } = useAuditLogs({ pageSize: 50 });
  const updateUserRole = useUpdateUserRole();
  const toggleUserStatus = useToggleUserStatus();

  // RBAC data
  const { data: allRoles = [] } = useRbacRoles({ includeInactive: true });
  const { data: userRoles = [] } = useUserRbacRoles(userId);
  const { data: permGroups = [] } = usePermissionGroups();
  const { data: effectivePerms } = useUserEffectivePermissions(userId);
  const { data: roleHistoryRaw = [] } = useUserRoleHistory(userId);
  type RoleHistoryEntry = {
    id: string;
    createdAt: string;
    action: "assigned" | "removed";
    role?: { name: string } | null;
    reason?: string | null;
    assignedBy?: string | null;
  };
  const roleHistory = roleHistoryRaw as RoleHistoryEntry[];
  const assignRole = useAssignUserRbacRole();
  const removeRole = useRemoveUserRbacRole();
  const setOverride = useSetPermissionOverride();
  const removeOverride = useRemovePermissionOverride();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link to="/users"><ArrowLeft className="size-4" /> All users</Link>
        </Button>
        <ChartSkeleton height={200} />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link to="/users"><ArrowLeft className="size-4" /> All users</Link>
        </Button>
        <SectionCard>
          <div className="p-10 text-center text-sm text-muted-foreground">
            Couldn&apos;t load this user. They may have been removed.
          </div>
        </SectionCard>
      </div>
    );
  }

  const userArticles: Article[] = (articlesData?.data ?? []).filter((a) => a.authorId === user.id);
  const userAudit: AuditLogEntry[] = (auditData?.data ?? []).filter((a) => a.userId === user.id);
  const spark = (tsData ?? []).map((p: TimeseriesPoint) => ({ date: p.date, value: p.users }));
  const handle = user.handle.startsWith("@") ? user.handle : `@${user.handle}`;
  const status = user.isActive ? "active" : "suspended";

  const assignedRoleIds = new Set(userRoles.map((r) => r.roleId));
  const effectivePermSet = new Set(effectivePerms?.permissions ?? []);
  const overridesByPermId = new Map(
    (effectivePerms?.overrides ?? []).map((o) => [o.permission.id, o]),
  );

  const handleAssignRole = (roleId: string) => {
    assignRole.mutate(
      { userId: user.id, roleId, isPrimary: userRoles.length === 0 },
      {
        onError: (e: any) => toast.error("Failed to assign role", { description: e?.message }),
      },
    );
  };
  const handleRemoveRole = (roleId: string) => {
    removeRole.mutate(
      { userId: user.id, roleId },
      {
        onError: (e: any) => toast.error("Failed to remove role", { description: e?.message }),
      },
    );
  };
  const handleSetPrimary = (roleId: string) => {
    assignRole.mutate({ userId: user.id, roleId, isPrimary: true });
  };
  const handleSetOverride = (permissionId: string, granted: boolean, reason?: string) => {
    setOverride.mutate(
      { userId: user.id, permissionId, granted, reason },
      {
        onError: (e: any) => toast.error("Failed to set override", { description: e?.message }),
      },
    );
  };
  const handleRemoveOverride = (permissionId: string) => {
    removeOverride.mutate({ userId: user.id, permissionId });
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link to="/users"><ArrowLeft className="size-4" /> All users</Link>
      </Button>

      <div className="surface-card overflow-hidden">
        <div className="relative h-28 gradient-primary" />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-6 pb-5 -mt-7">
          <div className="flex min-w-0 items-end gap-4">
            <Avatar className="size-20 shrink-0 ring-4 ring-card">
              <AvatarImage src={resolveAvatar(user.avatar, user.handle)} />
              <AvatarFallback>{user.name?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="truncate text-xl font-semibold">{user.name}</h2>
                <StatusBadge status={status} />
                {userRoles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {userRoles.slice(0, 3).map((a) => (
                      <Badge key={a.id} variant="secondary" className="gap-1">
                        {a.isPrimary && <Star className="size-3 fill-amber-400 text-amber-500" />}
                        {a.role.name}
                      </Badge>
                    ))}
                    {userRoles.length > 3 && (
                      <Badge variant="outline">+{userRoles.length - 3}</Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-mono">{handle}</span> · {user.email}
              </div>
            </div>
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5"><Mail className="size-4" /> Message</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Shield className="size-4" /> Change legacy role
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-2 space-y-1">
                <div className="text-xs text-muted-foreground px-2 py-1">Legacy Role · {user.role}</div>
                {LEGACY_ROLE_OPTIONS.filter((r) => r !== user.role).map((r) => (
                  <Button
                    key={r}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => updateUserRole.mutate({ id: user.id, role: r })}
                    disabled={updateUserRole.isPending}
                  >
                    Promote to {r}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-warning"
              onClick={() => toggleUserStatus.mutate(user.id)}
              disabled={toggleUserStatus.isPending}
            >
              <Ban className="size-4" /> {user.isActive ? "Suspend" : "Reactivate"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive"><Trash2 className="size-4" /> Delete</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Articles" value={userArticles.length.toString()} tone="info" />
        <StatCard label="Published" value={userArticles.filter((a) => a.isPublished).length.toString()} tone="success" />
        <StatCard label="Total views" value={userArticles.reduce((s, a) => s + a.views, 0).toLocaleString()} tone="primary" />
        <StatCard label="Roles" value={userRoles.length.toString()} tone="warning" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {["overview", "access", "activity", "content"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard title="Account" className="lg:col-span-1">
            <dl className="grid grid-cols-3 gap-y-3 text-sm">
              <Info k="Legacy role" v={<Badge variant="outline">{user.role}</Badge>} />
              <Info k="Status" v={<StatusBadge status={status} />} />
              <Info k="Joined" v={format(new Date(user.createdAt), "MMM d, yyyy")} />
              <Info k="ID" v={<span className="font-mono text-xs">{user.id}</span>} />
              <Info k="Updated" v={format(new Date(user.updatedAt), "MMM d, yyyy")} />
              <Info k="Publication" v={user.publication ?? "—"} />
              {user.bio && <Info k="Bio" v={<span className="text-xs">{user.bio}</span>} />}
            </dl>
          </SectionCard>

          <SectionCard title="30-day activity" className="lg:col-span-2">
            {spark.length > 0 ? <AreaSpark data={spark} /> : <ChartSkeleton height={120} />}
            <div className="mt-4 grid grid-cols-3 gap-4 text-center text-xs">
              <Kpi label="Audit events" v={userAudit.length.toString()} />
              <Kpi label="Articles" v={userArticles.length.toString()} />
              <Kpi label="Published" v={userArticles.filter((a) => a.isPublished).length.toString()} />
            </div>
          </SectionCard>

          {userAudit.length > 0 && (
            <SectionCard title="Recent activity" className="lg:col-span-3" padded={false}>
              <ol className="divide-y">
                {userAudit.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex gap-4 px-5 py-3">
                    <div className="w-32 shrink-0 text-xs text-muted-foreground">
                      {format(new Date(a.createdAt), "MMM d, HH:mm")}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{a.action}</span> on {a.resource}
                    </div>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="access" className="mt-6 space-y-6">
          {/* Roles assignment */}
          <SectionCard
            title="Roles"
            description="Assign one or more RBAC roles. The primary role is used for display and default rank."
            actions={
              <AssignRolePopover
                allRoles={allRoles}
                assignedRoleIds={assignedRoleIds}
                onAssign={handleAssignRole}
                disabled={assignRole.isPending}
              />
            }
          >
            {userRoles.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No RBAC roles assigned yet. Click &quot;Assign role&quot; to add one.
              </div>
            ) : (
              <ul className="divide-y">
                {userRoles.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-2 py-3"
                  >
                    <div className="grid size-10 place-items-center rounded-md bg-muted">
                      <ShieldCheck className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{assignment.role.name}</span>
                        {assignment.isPrimary && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="size-3 fill-amber-400 text-amber-500" /> Primary
                          </Badge>
                        )}
                        {assignment.role.isSystem && (
                          <Badge variant="outline" className="text-xs">System</Badge>
                        )}
                        {!assignment.role.isActive && (
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">key: {assignment.role.key}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Rank {assignment.role.rank}
                        {assignment.expiresAt && (
                          <> · expires {format(new Date(assignment.expiresAt), "MMM d, yyyy")}</>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!assignment.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetPrimary(assignment.roleId)}
                          className="text-xs"
                        >
                          Make primary
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleRemoveRole(assignment.roleId)}
                        disabled={removeRole.isPending}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Permission overrides */}
          <SectionCard
            title="Permission overrides"
            description="Explicitly grant or deny permissions for this user, overriding role-level permissions."
          >
            <PermissionOverrideTable
              groups={permGroups}
              effectivePermSet={effectivePermSet}
              overridesByPermId={overridesByPermId}
              onGrant={(pid, reason) => handleSetOverride(pid, true, reason)}
              onDeny={(pid, reason) => handleSetOverride(pid, false, reason)}
              onClear={handleRemoveOverride}
              disabled={setOverride.isPending || removeOverride.isPending}
            />
          </SectionCard>

          {/* Effective permissions summary */}
          <SectionCard
            title="Effective permissions"
            description={`${effectivePerms?.permissions.length ?? 0} permissions currently granted (after roles + overrides)`}
          >
            <EffectivePermissionSummary groups={permGroups} effectivePermSet={effectivePermSet} />
          </SectionCard>

          {/* Role history */}
          <SectionCard title="Role history">
            {roleHistory.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No changes recorded yet.
              </div>
            ) : (
              <ul className="divide-y">
                {roleHistory.map((h: any) => (
                  <li key={h.id} className="grid grid-cols-[140px_1fr_auto] items-center gap-4 px-2 py-3 text-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      {format(new Date(h.createdAt), "MMM d, HH:mm")}
                    </div>
                    <div>
                      <span className={cn("mr-2", h.action === "assigned" ? "text-success" : "text-destructive")}>
                        {h.action === "assigned" ? "Assigned" : "Removed"}
                      </span>
                      role <strong>{h.role?.name ?? "—"}</strong>
                      {h.reason && (
                        <span className="text-xs text-muted-foreground ml-2">({h.reason})</span>
                      )}
                    </div>
                    {h.assignedBy && (
                      <Badge variant="outline" className="text-xs">by {String(h.assignedBy).slice(0, 8)}…</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <SectionCard title="Activity log" padded={false}>
            {userAudit.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No activity recorded.</div>
            ) : (
              <ol className="divide-y">
                {userAudit.map((a) => (
                  <li key={a.id} className="grid grid-cols-[120px_1fr_100px] gap-4 px-5 py-3 text-sm">
                    <span className="text-xs text-muted-foreground">{format(new Date(a.createdAt), "MMM d, HH:mm")}</span>
                    <span><span className="font-medium">{a.action}</span> on {a.resource}</span>
                    <span className="text-right text-xs text-muted-foreground truncate">{a.ipAddress ?? "—"}</span>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <SectionCard title="Uploaded content" padded={false}>
            {userArticles.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No content from this user yet.</div>
            ) : (
              <ul className="divide-y">
                {userArticles.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="grid size-10 place-items-center rounded-md bg-muted text-xs font-medium">A</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">article · {c.views.toLocaleString()} views</div>
                    </div>
                    <StatusBadge status={c.isPublished ? "active" : "draft"} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Smaller helper components ───────────────────────────────────────────────

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="col-span-1 text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="col-span-2 text-sm">{v}</dd>
    </>
  );
}

function Kpi({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-lg font-semibold tabular-nums">{v}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function AssignRolePopover({
  allRoles,
  assignedRoleIds,
  onAssign,
  disabled,
}: {
  allRoles: RbacRole[];
  assignedRoleIds: Set<string>;
  onAssign: (roleId: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = allRoles.filter((r) => {
    if (assignedRoleIds.has(r.id)) return false;
    if (!search) return true;
    return (
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.key.toLowerCase().includes(search.toLowerCase())
    );
  });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-1.5" disabled={disabled}>
          <Plus className="size-4" /> Assign role
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles…"
              className="pl-8"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No more roles available to assign.
            </div>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                className="w-full text-left rounded-md px-3 py-2 hover:bg-muted transition-colors"
                onClick={() => onAssign(r.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.name}</span>
                    {r.isSystem && <Badge variant="outline" className="text-[10px] px-1.5">System</Badge>}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">rank {r.rank}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.key}</div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PermissionOverrideTable({
  groups,
  effectivePermSet,
  overridesByPermId,
  onGrant,
  onDeny,
  onClear,
  disabled,
}: {
  groups: PermissionGroup[];
  effectivePermSet: Set<string>;
  overridesByPermId: Map<string, { id: string; granted: boolean; reason?: string | null }>;
  onGrant: (permissionId: string, reason?: string) => void;
  onDeny: (permissionId: string, reason?: string) => void;
  onClear: (permissionId: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter permissions…"
            className="pl-8"
          />
        </div>
      </div>
      <div className="space-y-4">
        {groups.map((g) => {
          const perms = g.permissions.filter(
            (p) =>
              !search ||
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              p.key.toLowerCase().includes(search.toLowerCase()),
          );
          if (perms.length === 0) return null;
          return (
            <div key={g.id} className="rounded-md border">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="font-medium text-sm">{g.name}</div>
                <div className="text-xs text-muted-foreground">
                  {perms.filter((p) => effectivePermSet.has(p.key)).length}/{perms.length} effective
                </div>
              </div>
              <div className="divide-y">
                {perms.map((p) => {
                  const override = overridesByPermId.get(p.id);
                  const isEffective = effectivePermSet.has(p.key);
                  return (
                    <div
                      key={p.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{p.name}</span>
                          {override?.granted === true && (
                            <Badge variant="secondary" className="text-success-foreground bg-success/20 gap-1">
                              <ShieldCheck className="size-3" /> Explicitly granted (override)
                            </Badge>
                          )}
                          {override?.granted === false && (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldX className="size-3" /> Explicitly denied (override)
                            </Badge>
                          )}
                          {!override && isEffective && (
                            <Badge variant="outline" className="gap-1">
                              <ShieldCheck className="size-3 text-success" /> Granted by role
                            </Badge>
                          )}
                          {!override && !isEffective && (
                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                              <ShieldAlert className="size-3" /> Not granted
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">{p.key}</div>
                        {override?.reason && (
                          <div className="text-xs text-muted-foreground mt-1">Reason: {override.reason}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Checkbox
                          id={`grant-${p.id}`}
                          checked={override?.granted === true}
                          onCheckedChange={() => onGrant(p.id)}
                          disabled={disabled}
                        />
                        <Label htmlFor={`grant-${p.id}`} className="text-xs cursor-pointer text-success">
                          Grant
                        </Label>
                        <Checkbox
                          id={`deny-${p.id}`}
                          checked={override?.granted === false}
                          onCheckedChange={() => onDeny(p.id)}
                          disabled={disabled}
                        />
                        <Label htmlFor={`deny-${p.id}`} className="text-xs cursor-pointer text-destructive">
                          Deny
                        </Label>
                        {override && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onClear(p.id)}
                            disabled={disabled}
                            title="Remove override"
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EffectivePermissionSummary({
  groups,
  effectivePermSet,
}: {
  groups: PermissionGroup[];
  effectivePermSet: Set<string>;
}) {
  if (effectivePermSet.size === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No effective permissions — no roles or explicit grants applied.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {groups.map((g) => {
        const granted = g.permissions.filter((p) => effectivePermSet.has(p.key));
        if (granted.length === 0) return null;
        return (
          <li key={g.id} className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">{g.name}</div>
            <div className="flex flex-wrap gap-1.5">
              {granted.map((p) => (
                <Badge key={p.id} variant="secondary" className="font-mono text-[11px]">
                  {p.key}
                </Badge>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

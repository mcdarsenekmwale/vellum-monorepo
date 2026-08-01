import { createFileRoute } from "@tanstack/react-router";
import { 
  Copy, 
  Pencil, 
  Plus, 
  Search, 
  Shield, 
  Trash2,
  Users,
  Key,
  MoreVertical,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Users as UsersIcon,
  Check,
  X,
  Filter,
  LayoutGrid,
  List,
  Star,
  Clock,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageState } from "@/components/dashboard/page-state";
import { SectionCard } from "@/components/dashboard/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useAssignRolePermissions,
  useCreateRbacRole,
  useDeleteRbacRole,
  useDuplicateRbacRole,
  usePermissionGroups,
  useRbacRoles,
  useUpdateRbacRole,
} from "@/lib/api/hooks";
import type { RbacRole } from "@/lib/api/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/roles")({
  head: () => ({ meta: [{ title: "Roles · Vellum Admin" }] }),
  component: RolesPage,
});

type RoleFormState = {
  key: string;
  name: string;
  description: string;
  permissionIds: string[];
};

const EMPTY_FORM: RoleFormState = {
  key: "",
  name: "",
  description: "",
  permissionIds: [],
};

function keyFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Role color mapping for consistent visual identity
const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20" },
  moderator: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  editor: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  creator: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
  developer: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" },
  user: { bg: "bg-muted", text: "text-muted-foreground", border: "border-transparent" },
};

const DEFAULT_COLOR = { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" };

function getRoleColor(key: string) {
  return ROLE_COLORS[key.toLowerCase()] ?? DEFAULT_COLOR;
}

function RolesPage() {
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RbacRole | null>(null);
  const [deleteRole, setDeleteRole] = useState<RbacRole | null>(null);
  const [duplicateRole, setDuplicateRole] = useState<RbacRole | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const roleQuery = useRbacRoles({ search, includeInactive });
  const groupQuery = usePermissionGroups();
  const createRole = useCreateRbacRole();
  const updateRole = useUpdateRbacRole();
  const deleteRoleMutation = useDeleteRbacRole();
  const duplicateRoleMutation = useDuplicateRbacRole();
  const assignPermissions = useAssignRolePermissions();

  const roles = roleQuery.data ?? [];
  const groups = groupQuery.data ?? [];
  const allPermissionIds = useMemo(
    () => new Set(groups.flatMap((group) => group.permissions.map((permission) => permission.id))),
    [groups],
  );

  const resetForm = () => setForm(EMPTY_FORM);

  const openCreate = (open: boolean) => {
    setCreateOpen(open);
    if (!open) resetForm();
  };

  const openEdit = (role: RbacRole) => {
    setEditRole(role);
    setForm({
      key: role.key,
      name: role.name,
      description: role.description ?? "",
      permissionIds: role.permissions?.filter((p) => p.granted).map((p) => p.permissionId) ?? [],
    });
  };

  const togglePermission = (permissionId: string) => {
    setForm((current) => {
      const selected = new Set(current.permissionIds);
      if (selected.has(permissionId)) selected.delete(permissionId);
      else selected.add(permissionId);
      return { ...current, permissionIds: Array.from(selected) };
    });
  };

  const handleCreate = async () => {
    const name = form.name.trim();
    const key = form.key.trim() || keyFromName(name);
    if (!name || !key) return;

    try {
      await createRole.mutateAsync({
        key,
        name,
        description: form.description.trim() || undefined,
        permissionIds: form.permissionIds,
      });
      toast.success("Role created");
      openCreate(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create role");
    }
  };

  const handleUpdate = async () => {
    if (!editRole) return;
    try {
      await updateRole.mutateAsync({
        id: editRole.id,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      await assignPermissions.mutateAsync({ roleId: editRole.id, permissionIds: form.permissionIds });
      toast.success("Role updated");
      setEditRole(null);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  };

  const handleDelete = async () => {
    if (!deleteRole) return;
    try {
      await deleteRoleMutation.mutateAsync(deleteRole.id);
      toast.success("Role deleted");
      setDeleteRole(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete role");
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateRole) return;
    const key = form.key.trim() || keyFromName(form.name);
    if (!key || !form.name.trim()) return;
    try {
      await duplicateRoleMutation.mutateAsync({
        id: duplicateRole.id,
        key,
        name: form.name.trim(),
      });
      toast.success("Role duplicated");
      setDuplicateRole(null);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate role");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Roles"
        description="Manage platform roles, membership counts, and permission grants from the RBAC API."
        actions={
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      viewMode === "grid"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      viewMode === "list"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent>Toggle view mode</TooltipContent>
            </Tooltip>

            <Dialog open={createOpen} onOpenChange={openCreate}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> New role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <RoleDialogHeader title="Create role" description="Create a custom role and assign its starting permissions." />
                <RoleForm
                  form={form}
                  groups={groups}
                  allPermissionIds={allPermissionIds}
                  onChange={setForm}
                  onTogglePermission={togglePermission}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => openCreate(false)} disabled={createRole.isPending}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createRole.isPending || !form.name.trim()}>
                    {createRole.isPending ? "Creating..." : "Create role"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Roles</span>
            <div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
              <Shield className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">{roles.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Roles</span>
            <div className="grid size-8 place-items-center rounded-md bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">{roles.filter(r => r.isActive).length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">System Roles</span>
            <div className="grid size-8 place-items-center rounded-md bg-amber-500/10 text-amber-500">
              <Star className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">{roles.filter(r => r.isSystem).length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Members</span>
            <div className="grid size-8 place-items-center rounded-md bg-blue-500/10 text-blue-500">
              <UsersIcon className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {roles.reduce((sum, r) => sum + (r.userCount ?? 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 h-9"
            placeholder="Search roles..."
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Checkbox 
              checked={includeInactive} 
              onCheckedChange={(checked) => setIncludeInactive(Boolean(checked))} 
            />
            Include inactive roles
          </label>
          {(search || includeInactive) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setIncludeInactive(false);
              }}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Filter className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Roles Grid/List */}
      <PageState
        data={roles}
        isLoading={roleQuery.isLoading || groupQuery.isLoading}
        isError={roleQuery.isError || groupQuery.isError}
        error={roleQuery.error ?? groupQuery.error}
        onRetry={() => {
          roleQuery.refetch();
          groupQuery.refetch();
        }}
        emptyTitle="No roles found"
        emptyDescription="Create a role or adjust the search filter."
      >
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => {
              const colors = getRoleColor(role.key);
              return (
                <SectionCard key={role.id} className="group transition-all hover:shadow-md hover:border-foreground/20">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-md border",
                      colors.bg,
                      colors.text,
                      colors.border
                    )}>
                      <Shield className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">{role.name}</div>
                        {role.isSystem && (
                          <Badge variant="secondary" className="text-[9px] gap-1">
                            <Star className="size-2.5" />
                            System
                          </Badge>
                        )}
                        {!role.isActive && (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{role.key}</div>
                      {role.description && (
                        <div className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{role.description}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-xs">
                    <div>
                      <div className="text-lg font-semibold tabular-nums">{role.userCount ?? 0}</div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Users className="size-3" />
                        Members
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold tabular-nums">{role.permissionCount ?? 0}</div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Key className="size-3" />
                        Permissions
                      </div>
                    </div>
                    <div className="flex items-end justify-end gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:text-primary"
                            onClick={() => openEdit(role)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit role</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:text-primary"
                            onClick={() => {
                              setDuplicateRole(role);
                              setForm({ ...EMPTY_FORM, key: `${role.key}_copy`, name: `${role.name} Copy` });
                            }}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate role</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "size-7",
                              role.isSystem 
                                ? "text-muted-foreground cursor-not-allowed opacity-50" 
                                : "hover:text-destructive"
                            )}
                            disabled={role.isSystem}
                            onClick={() => setDeleteRole(role)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {role.isSystem ? "System roles cannot be deleted" : "Delete role"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        ) : (
          /* List View */
          <SectionCard padded={false} className="overflow-hidden">
            <div className="divide-y">
              {roles.map((role) => {
                const colors = getRoleColor(role.key);
                return (
                  <div
                    key={role.id}
                    className="group flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-md border",
                      colors.bg,
                      colors.text,
                      colors.border
                    )}>
                      <Shield className="size-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">{role.name}</span>
                        {role.isSystem && (
                          <Badge variant="secondary" className="text-[9px] gap-1">
                            <Star className="size-2.5" />
                            System
                          </Badge>
                        )}
                        {!role.isActive && (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground ml-1">{role.key}</span>
                      </div>
                      {role.description && (
                        <p className="text-sm text-muted-foreground truncate">{role.description}</p>
                      )}
                    </div>

                    <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Users className="size-3" />
                        {role.userCount ?? 0} members
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Key className="size-3" />
                        {role.permissionCount ?? 0} permissions
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:text-primary"
                            onClick={() => openEdit(role)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit role</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:text-primary"
                            onClick={() => {
                              setDuplicateRole(role);
                              setForm({ ...EMPTY_FORM, key: `${role.key}_copy`, name: `${role.name} Copy` });
                            }}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate role</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "size-7",
                              role.isSystem 
                                ? "text-muted-foreground cursor-not-allowed opacity-50" 
                                : "hover:text-destructive"
                            )}
                            disabled={role.isSystem}
                            onClick={() => setDeleteRole(role)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {role.isSystem ? "System roles cannot be deleted" : "Delete role"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
      </PageState>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editRole)} onOpenChange={(open) => !open && setEditRole(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <RoleDialogHeader title="Edit role" description="Update role details and permission grants." />
          <RoleForm
            form={form}
            groups={groups}
            allPermissionIds={allPermissionIds}
            onChange={setForm}
            onTogglePermission={togglePermission}
            lockKey
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)} disabled={updateRole.isPending || assignPermissions.isPending}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateRole.isPending || assignPermissions.isPending || !form.name.trim()}>
              {updateRole.isPending || assignPermissions.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={Boolean(duplicateRole)} onOpenChange={(open) => !open && setDuplicateRole(null)}>
        <DialogContent className="sm:max-w-md">
          <RoleDialogHeader title="Duplicate role" description={`Create a copy of ${duplicateRole?.name ?? "this role"}.`} />
          <div className="space-y-4 py-4">
            <Field label="Role name" id="duplicate-name">
              <Input
                id="duplicate-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </Field>
            <Field label="Role key" id="duplicate-key">
              <Input
                id="duplicate-key"
                value={form.key}
                onChange={(event) => setForm((current) => ({ ...current, key: keyFromName(event.target.value) }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateRole(null)} disabled={duplicateRoleMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={duplicateRoleMutation.isPending || !form.name.trim()}>
              {duplicateRoleMutation.isPending ? "Duplicating..." : "Duplicate role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={Boolean(deleteRole)} onOpenChange={(open) => !open && setDeleteRole(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              Delete role
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteRole?.name}</strong>? 
              This will remove the role from all users and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteRole?.userCount && deleteRole.userCount > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
              <div className="flex items-center gap-2">
                <Users className="size-4" />
                <span>This role is assigned to {deleteRole.userCount} user{deleteRole.userCount !== 1 ? "s" : ""}.</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRole(null)} disabled={deleteRoleMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRoleMutation.isPending}>
              {deleteRoleMutation.isPending ? "Deleting..." : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleDialogHeader({ title, description }: { title: string; description: string }) {
  return (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  );
}

function RoleForm({
  form,
  groups,
  allPermissionIds,
  onChange,
  onTogglePermission,
  lockKey = false,
}: {
  form: RoleFormState;
  groups: Array<{ id: string; name: string; permissions: Array<{ id: string; key: string; name: string }> }>;
  allPermissionIds: Set<string>;
  onChange: (form: RoleFormState) => void;
  onTogglePermission: (permissionId: string) => void;
  lockKey?: boolean;
}) {
  const selected = new Set(form.permissionIds);
  const allSelected = allPermissionIds.size > 0 && form.permissionIds.length === allPermissionIds.size;

  return (
    <div className="space-y-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role name" id="role-name">
          <Input
            id="role-name"
            value={form.name}
            onChange={(event) =>
              onChange({
                ...form,
                name: event.target.value,
                key: lockKey || form.key ? form.key : keyFromName(event.target.value),
              })
            }
            autoFocus
          />
        </Field>
        <Field label="Role key" id="role-key">
          <Input
            id="role-key"
            value={form.key}
            disabled={lockKey}
            onChange={(event) => onChange({ ...form, key: keyFromName(event.target.value) })}
          />
        </Field>
      </div>
      <Field label="Description" id="role-description">
        <Textarea
          id="role-description"
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          rows={3}
        />
      </Field>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Permissions</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {form.permissionIds.length} of {allPermissionIds.size} selected
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...form, permissionIds: allSelected ? [] : Array.from(allPermissionIds) })}
            >
              {allSelected ? "Clear all" : "Select all"}
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-lg border bg-card/50 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {group.permissions.length} permissions
                </Badge>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.name}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {group.permissions.map((permission) => (
                  <label
                    key={permission.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md p-2 text-sm transition-colors cursor-pointer",
                      selected.has(permission.id)
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={selected.has(permission.id)}
                      onCheckedChange={() => onTogglePermission(permission.id)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block font-medium text-sm">{permission.name}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground">{permission.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
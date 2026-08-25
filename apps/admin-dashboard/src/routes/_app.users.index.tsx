// routes/_app/users/index.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Mail,
  UserPlus,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  X,
  Check,
  Shield,
  Users,
  UserCheck,
  UserX,
  Calendar,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  useUsers,
  useDashboardStats,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type User,
  useRbacRoles,
  useRoles,
  type RoleKey,
  VALID_LEGACY_ROLES,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CreateUserSheet,
  EditUserDialog,
  DeleteUserDialog,
  BulkDeleteDialog,
  EmailDialog,
} from "@/components/dashboard/users_action_components";
import { canVisit } from "@/lib/auth/rbac";

export const Route = createFileRoute("/_app/users/")({
  head: () => ({ meta: [{ title: "Users · Vellbase Admin" }] }),
  component: UsersList,
});

type RoleFilter =
  | "all"
  | "GUEST"
  | "USER"
  | "CREATOR"
  | "MODERATOR"
  | "SUPPORT_ADMIN"
  | "ADMIN"
  | "PLATFORM_ADMIN"
  | "SUPER_ADMIN";
type StatusFilter = "all" | "active" | "suspended";
type TwoFAFilter = "all" | "enabled" | "disabled";

function UsersList() {
  const { data, isLoading, refetch } = useUsers();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { can, user: currentUser } = useAuth();
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  // Enterprise RBAC roles list (role definitions + permission assignments)
  const roleQuery = useRbacRoles({ search: "", includeInactive: false });
  const roles = roleQuery.data ?? [];

  // Assignable roles list — union of legacy enum values and custom RbacRole rows,
  // used to populate the role picker in create/edit user dialogs.
  const assignableRolesQuery = useRoles();
  const assignableRoles = assignableRolesQuery.data ?? { legacy: [], custom: [] };
  const allAssignableRoleKeys: RoleKey[] = [
    ...assignableRoles.legacy.map((r) => r.key),
    ...assignableRoles.custom.map((r) => r.key),
  ];

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [twoFAFilter, setTwoFAFilter] = useState<TwoFAFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Form states
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createHandle, setCreateHandle] = useState("");
  const [createRole, setCreateRole] = useState<RoleKey>("USER");
  const [createPassword, setCreatePassword] = useState("");
  const [createPermissions, setCreatePermissions] = useState<string[]>([]);

  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editRole, setEditRole] = useState<RoleKey>("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  // UI states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const navigate = useNavigate();

  // Filter and search logic
  const filteredRows = useMemo(() => {
    let result = rows;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.handle.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query),
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      result = result.filter((user) => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((user) =>
        statusFilter === "active" ? user.isActive : !user.isActive,
      );
    }

    // 2FA filter
    if (twoFAFilter !== "all") {
      result = result.filter((user) => {
        const has2FA = (user as any).twoFactorEnabled || false;
        return twoFAFilter === "enabled" ? has2FA : !has2FA;
      });
    }

    return result;
  }, [rows, searchQuery, roleFilter, statusFilter, twoFAFilter]);

  const hasActiveFilters =
    searchQuery || roleFilter !== "all" || statusFilter !== "all" || twoFAFilter !== "all";

  // Stats
  const activeUsers = stats?.activeUsers ?? 0;
  const inactiveUsers = total - activeUsers;
  const newUsersThisWeek = stats?.newUsersThisWeek ?? 0;

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      await refetchStats();
      toast.success("Users refreshed");
    } catch (error) {
      toast.error("Failed to refresh users");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, refetchStats]);

  const handleExport = useCallback(async () => {
    const dataToExport = filteredRows.length > 0 ? filteredRows : rows;
    if (dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);
    try {
      const headers = [
        "ID",
        "Name",
        "Email",
        "Handle",
        "Role",
        "Status",
        "2FA",
        "Created At",
        "Last Login",
      ];
      const csvRows = [headers.join(",")];

      for (const user of dataToExport) {
        const row = [
          user.id,
          `"${user.name.replace(/"/g, '""')}"`,
          user.email,
          user.handle,
          user.role,
          user.isActive ? "Active" : "Suspended",
          (user as any).twoFactorEnabled ? "Enabled" : "Disabled",
          format(new Date(user.createdAt), "yyyy-MM-dd HH:mm:ss"),
          user.lastLoginAt ? format(new Date(user.lastLoginAt), "yyyy-MM-dd HH:mm:ss") : "",
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `users-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${dataToExport.length} users`);
    } catch (error) {
      toast.error("Failed to export users");
    } finally {
      setIsExporting(false);
    }
  }, [filteredRows, rows]);

  const handleCreate = useCallback(() => {
    if (
      !createEmail.trim() ||
      !createName.trim() ||
      !createHandle.trim() ||
      !createPassword.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    createUser.mutate(
      {
        email: createEmail.trim(),
        name: createName.trim(),
        handle: createHandle.trim(),
        role: createRole,
        password: createPassword,
        permissions: createPermissions,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetCreateForm();
          refetch();
          refetchStats();
          toast.success("User created successfully");
        },
        onError: (error) => {
          toast.error("Failed to create user: " + (error.message || "Unknown error"));
        },
      },
    );
  }, [
    createEmail,
    createName,
    createHandle,
    createRole,
    createPassword,
    createPermissions,
    createUser,
    refetch,
    refetchStats,
  ]);

  const resetCreateForm = () => {
    setCreateEmail("");
    setCreateName("");
    setCreateHandle("");
    setCreateRole("USER");
    setCreatePassword("");
    setCreatePermissions([]);
  };

  const handleEdit = useCallback(() => {
    if (!selectedUser) return;
    if (!editEmail.trim() || !editName.trim() || !editHandle.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    updateUser.mutate(
      {
        id: selectedUser.id,
        email: editEmail.trim(),
        name: editName.trim(),
        handle: editHandle.trim(),
        role: editRole,
        permissions: editPermissions,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setSelectedUser(null);
          setEditPermissions([]);
          refetch();
          refetchStats();
          toast.success("User updated successfully");
        },
        onError: (error) => {
          toast.error("Failed to update user: " + (error.message || "Unknown error"));
        },
      },
    );
  }, [
    selectedUser,
    editEmail,
    editName,
    editHandle,
    editRole,
    editPermissions,
    updateUser,
    refetch,
    refetchStats,
  ]);

  const handleDelete = useCallback(() => {
    if (!selectedUser) return;

    deleteUser.mutate(selectedUser.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setSelectedUser(null);
        refetch();
        refetchStats();
        toast.success("User deleted successfully");
      },
      onError: (error) => {
        toast.error("Failed to delete user: " + (error.message || "Unknown error"));
      },
    });
  }, [selectedUser, deleteUser, refetch, refetchStats]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      toast.loading(`Deleting ${selectedIds.length} users...`);
      const deletePromises = selectedIds.map(
        (id) =>
          new Promise<void>((resolve, reject) => {
            deleteUser.mutate(id, {
              onSuccess: () => resolve(),
              onError: () => reject(),
            });
          }),
      );
      await Promise.all(deletePromises);
      toast.success(`${selectedIds.length} users deleted`);
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
      refetch();
      refetchStats();
    } catch {
      toast.error("Failed to delete some users");
    }
  }, [selectedIds, deleteUser, refetch, refetchStats]);

  const handleSendEmail = useCallback(async () => {
    if (!selectedUser) return;
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Please fill in subject and body");
      return;
    }

    setIsSendingEmail(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success(`Email sent to ${selectedUser.name}`);
      setIsEmailDialogOpen(false);
      setEmailSubject("");
      setEmailBody("");
      setSelectedUser(null);
    } catch {
      toast.error("Failed to send email");
    } finally {
      setIsSendingEmail(false);
    }
  }, [selectedUser, emailSubject, emailBody]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setTwoFAFilter("all");
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setEditEmail(user.email);
    setEditName(user.name);
    setEditHandle(user.handle);
    // Preserve the raw role value exactly as it was returned by the API.
    // The backend now accepts legacy enum values OR a valid RbacRole.key
    // (e.g. "support_admin") — do NOT coerce custom roles to USER here,
    // otherwise admins lose the ability to see/edit a user's custom role.
    setEditRole(user.role);
    setEditPermissions((user as any).permissions ?? []);
    setIsEditOpen(true);
  };

  const openDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  const openEmailDialog = (user: User) => {
    setSelectedUser(user);
    setEmailSubject(`Message from Vellbase Admin`);
    setEmailBody(`Hello ${user.name},\n\n`);
    setIsEmailDialogOpen(true);
  };

  // Render header with stats
  const renderHeader = () => (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mt-5 mb-10">
      <StatCard
        loading={isLoading}
        label="Total users"
        value={total.toLocaleString()}
        icon={Users}
        delta={12.4}
      />
      <StatCard
        loading={statsLoading}
        label="Active users"
        value={activeUsers.toLocaleString()}
        icon={UserCheck}
        delta={4.1}
        tone="success"
      />
      <StatCard
        loading={statsLoading}
        label="New this week"
        value={newUsersThisWeek.toLocaleString()}
        icon={Calendar}
        delta={-2.3}
        tone="info"
      />
      <StatCard
        loading={isLoading}
        label="Inactive"
        value={inactiveUsers.toLocaleString()}
        icon={UserX}
        delta={0.6}
        tone="warning"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Create User Dialog */}
      <CreateUserSheet
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        createEmail={createEmail}
        setCreateEmail={setCreateEmail}
        createName={createName}
        setCreateName={setCreateName}
        createHandle={createHandle}
        setCreateHandle={setCreateHandle}
        createRole={createRole}
        setCreateRole={setCreateRole}
        createPassword={createPassword}
        setCreatePassword={setCreatePassword}
        handleCreate={handleCreate}
        createUserPending={createUser.isPending}
        roles={roles}
        selectedPermissions={createPermissions}
        onPermissionsChange={setCreatePermissions}
      />

      <EditUserDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        editEmail={editEmail}
        setEditEmail={setEditEmail}
        editName={editName}
        setEditName={setEditName}
        editHandle={editHandle}
        setEditHandle={setEditHandle}
        editRole={editRole}
        setEditRole={setEditRole}
        handleEdit={handleEdit}
        updateUserPending={updateUser.isPending}
        roles={roles}
        selectedPermissions={editPermissions}
        onPermissionsChange={setEditPermissions}
        disableRoleAssignment={
          !!(currentUser && selectedUser && selectedUser.id === currentUser.id)
        }
      />

      {/* Delete Confirmation Dialog */}
      <DeleteUserDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        selectedUser={selectedUser}
        currentUser={currentUser}
        handleDelete={handleDelete}
        deleteUserPending={deleteUser.isPending}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        selectedIds={selectedIds}
        handleBulkDelete={handleBulkDelete}
      />

      {/* Email Dialog */}
      <EmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        user={selectedUser}
        onSend={handleSendEmail}
      />

      {/* Main List */}
      <ListPage
        title="User Management"
        description="Everyone with a Vellbase account across web and mobile."
        eyebrow="People"
        rows={filteredRows}
        searchKeys={["name", "email", "handle", "role"]}
        pageSize={15}
        isLoading={isLoading}
        enableSelection={true}
        onSelectionChange={(selected) => setSelectedIds(Array.from(selected))}
        enableExport={true}
        enablePagination={true}
        searchPlaceholder="Search users... (⌘K)"
        actions={
          <div className="flex items-center gap-2">
            {/* Deleted Users */}
            {canVisit((currentUser as any).role.toLowerCase(), "/users/deleted") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 "
                    onClick={() => navigate({
                      to: "/users/deleted",
                      replace: true,
                    })}
                  >
                    <Trash2 className="size-4" />
                    <span className="hidden sm:inline">Deleted Users</span>
                  </Button>
                </TooltipTrigger>
              </Tooltip>)}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh user list</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExport}
                  disabled={isExporting || rows.length === 0}
                >
                  {isExporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isExporting ? "Exporting..." : "Export"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export users to CSV</TooltipContent>
            </Tooltip>

            {selectedIds.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setIsBulkDeleteOpen(true)}
                      disabled={
                        !can("users", "delete") || selectedIds.includes(currentUser?.id ?? "")
                      }
                    >
                      <Trash2 className="size-4" />
                      <span className="hidden sm:inline">Delete {selectedIds.length}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedIds.includes(currentUser?.id ?? "")
                    ? "You can't bulk-delete your own account. Deselect yourself first."
                    : `Permanently delete ${selectedIds.length} selected account(s)`}
                </TooltipContent>
              </Tooltip>
            )}

            {can("users", "write") && (
              <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
                <UserPlus className="size-4" /> Invite
              </Button>
            )}
          </div>
        }
        renderHeader={renderHeader()}
        filters={
          <>
            {!hasActiveFilters && !showFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowFilters(true)}
              >
                + Add filter
              </Button>
            )}

            {(hasActiveFilters || showFilters) && (
              <>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showFilters ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 h-8"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? "Hide filters" : "More filters"}
                  </Button>
                </div>

                {showFilters && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 h-8">
                          <Shield className="size-3.5" />
                          Role
                          <ChevronDown className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Filter by role</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(["all", ...VALID_LEGACY_ROLES] as const).map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onClick={() => setRoleFilter(role)}
                            className={cn(roleFilter === role && "bg-accent")}
                          >
                            {role === "all"
                              ? "All roles"
                              : role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            {roleFilter === role && <Check className="ml-2 size-3.5" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 h-8">
                          <UserCheck className="size-3.5" />
                          Status
                          <ChevronDown className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(["all", "active", "suspended"] as const).map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(statusFilter === status && "bg-accent")}
                          >
                            {status === "all"
                              ? "All statuses"
                              : status.charAt(0).toUpperCase() + status.slice(1)}
                            {statusFilter === status && <Check className="ml-2 size-3.5" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 h-8">
                          <Shield className="size-3.5" />
                          2FA
                          <ChevronDown className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Filter by 2FA</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(["all", "enabled", "disabled"] as const).map((twoFA) => (
                          <DropdownMenuItem
                            key={twoFA}
                            onClick={() => setTwoFAFilter(twoFA)}
                            className={cn(twoFAFilter === twoFA && "bg-accent")}
                          >
                            {twoFA === "all"
                              ? "All"
                              : twoFA.charAt(0).toUpperCase() + twoFA.slice(1)}
                            {twoFAFilter === twoFA && <Check className="ml-2 size-3.5" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}

                {hasActiveFilters && (
                  <>
                    <div className="h-6 w-px bg-border" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Active filters:</span>
                      {roleFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted"
                          onClick={() => setRoleFilter("all")}
                        >
                          Role: {roleFilter}
                          <X className="size-3" />
                        </Badge>
                      )}
                      {statusFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted"
                          onClick={() => setStatusFilter("all")}
                        >
                          Status: {statusFilter}
                          <X className="size-3" />
                        </Badge>
                      )}
                      {twoFAFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted"
                          onClick={() => setTwoFAFilter("all")}
                        >
                          2FA: {twoFAFilter}
                          <X className="size-3" />
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={clearFilters}
                      >
                        Clear all
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        }
        columns={[
          {
            key: "user",
            header: "User",
            cell: (u) => (
              <Link
                to="/users/$userId"
                params={{ userId: u.id }}
                className="flex min-w-0 items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarImage src={u.avatar ?? ""} alt={u.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {u.name?.[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
              </Link>
            ),
          },
          {
            key: "handle",
            header: "Handle",
            cell: (u) => (
              <span className="font-mono text-xs text-muted-foreground">@{u.handle}</span>
            ),
          },
          {
            key: "role",
            header: "Role",
            cell: (u) => (
              <Badge variant="outline" className="text-xs capitalize rounded-sm">
                {u.role.toLocaleUpperCase()}
              </Badge>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (u) => <StatusBadge status={u.isActive ? "active" : "suspended"} />,
          },
          {
            key: "2fa",
            header: "2F Auth",
            cell: (u) => (
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
                  (u as any).twoFactorEnabled
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {(u as any).twoFactorEnabled ? "Enabled" : "Disabled"}
              </span>
            ),
          },
          {
            key: "joined",
            header: "Joined",
            cell: (u) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{format(new Date(u.createdAt), "PPP p")}</TooltipContent>
              </Tooltip>
            ),
          },
        ]}
        renderRowActions={(u) => (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => openEmailDialog(u)}
                >
                  <Mail className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send email</TooltipContent>
            </Tooltip>

            {can("users", "write") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-8",
                      u.id === currentUser?.id ? "hover:text-amber-600" : "hover:text-primary",
                    )}
                    onClick={() => openEdit(u)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {u.id === currentUser?.id
                    ? "Edit profile (role & permissions are disabled for your own account)"
                    : "Edit user"}
                </TooltipContent>
              </Tooltip>
            )}

            {can("users", "delete") && u.id !== currentUser?.id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-destructive"
                    onClick={() => openDelete(u)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete user</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      />
    </div>
  );
}

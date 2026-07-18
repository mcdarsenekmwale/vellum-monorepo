// routes/_app/users/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, UserPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUsers,
  useDashboardStats,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type User,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/users/")({
  head: () => ({ meta: [{ title: "Users · Vellum Admin" }] }),
  component: UsersList,
});

function UsersList() {
  const { data, isLoading, refetch } = useUsers();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { can } = useAuth();
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createHandle, setCreateHandle] = useState("");
  const [createRole, setCreateRole] = useState("USER");
  const [createPassword, setCreatePassword] = useState("");

  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editRole, setEditRole] = useState("");

  const openCreate = () => {
    setCreateEmail("");
    setCreateName("");
    setCreateHandle("");
    setCreateRole("USER");
    setCreatePassword("");
    setIsCreateOpen(true);
  };

  const handleCreate = () => {
    if (!createEmail.trim() || !createName.trim() || !createHandle.trim() || !createPassword.trim()) return;
    createUser.mutate(
      {
        email: createEmail.trim(),
        name: createName.trim(),
        handle: createHandle.trim(),
        role: createRole,
        password: createPassword,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          refetch();
        },
      }
    );
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setEditEmail(user.email);
    setEditName(user.name);
    setEditHandle(user.handle);
    setEditRole(user.role);
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!selectedUser) return;
    updateUser.mutate(
      {
        id: selectedUser.id,
        email: editEmail.trim(),
        name: editName.trim(),
        handle: editHandle.trim(),
        role: editRole,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setSelectedUser(null);
          refetch();
        },
      }
    );
  };

  const openDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteUser.mutate(selectedUser.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setSelectedUser(null);
        refetch();
      },
    });
  };

  const renderHeader = () => {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mt-5 mb-10">
        <StatCard
          loading={isLoading}
          label="Total users"
          value={total.toLocaleString()}
          delta={12.4}
        />
        <StatCard
          loading={statsLoading}
          label="Active users"
          value={stats?.activeUsers?.toLocaleString() ?? "0"}
          delta={4.1}
          tone="success"
        />
        <StatCard
          loading={statsLoading}
          label="New this week"
          value={stats?.newUsersThisWeek?.toLocaleString() ?? "0"}
          delta={-2.3}
          tone="info"
        />
        <StatCard
          loading={isLoading}
          label="Inactive"
          value={(total - (stats?.activeUsers ?? 0)).toLocaleString()}
          delta={0.6}
          tone="warning"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Users Table */}
      <ListPage
        title="User Management"
        description="Everyone with a Vellum account across web and mobile."
        eyebrow="People"
        rows={rows}
        searchKeys={["name", "email", "handle", "role"]}
        pageSize={15}
        isLoading={isLoading}
        enableSelection={true}
        enableExport={true}
        enablePagination={true}
        actions={
          can("users", "write") ? (
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <UserPlus className="size-4" /> Invite
            </Button>
          ) : null
        }
        renderHeader={renderHeader()}
        filters={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className="text-muted-foreground">◎</span>
              Role
              <span className="rotate-90 text-xs">›</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className="text-muted-foreground">◎</span>
              2F Auth
              <span className="rotate-90 text-xs">›</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              + Add filter
            </Button>
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
            cell: (u) => <span className="font-mono text-xs text-muted-foreground">@{u.handle}</span>
          },
          {
            key: "role",
            header: "Role",
            cell: (u) => <span className="text-sm capitalize">{u.role}</span>
          },
          {
            key: "status",
            header: "Status",
            cell: (u) => <StatusBadge status={u.isActive ? "active" : "suspended"} />
          },
          {
            key: "2fa",
            header: "2F Auth",
            cell: (u) => (
              <span className={cn(
                "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
                (u as any).twoFactorEnabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {(u as any).twoFactorEnabled ? "Enabled" : "Disabled"}
              </span>
            ),
          },
          {
            key: "joined",
            header: "Joined",
            cell: (u) => (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
              </span>
            ),
          },
        ]}
        renderRowActions={(u) => (
          <div className="flex items-center justify-end gap-1">

            <Button variant="ghost" size="icon" className="size-8 cursor-pointer" aria-label="Email">
              <Mail className="size-4" />
            </Button>

            {can("users", "write") && (
              <Button variant="ghost" size="icon" className="size-8 hover:text-primary" aria-label="Edit" onClick={() => openEdit(u)}>
                <Pencil className="size-4" />
              </Button>
            )}
            {can("users", "delete") && (
              <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" aria-label="Delete" onClick={() => openDelete(u)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
      />

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              Create a new user account with the specified role and credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="user@example.com"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-handle">Handle</Label>
              <Input
                id="create-handle"
                value={createHandle}
                onChange={(e) => setCreateHandle(e.target.value)}
                placeholder="johndoe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger id="create-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MODERATOR">Moderator</SelectItem>
                  <SelectItem value="CREATOR">Creator</SelectItem>
                  <SelectItem value="DEVELOPER">Developer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createUser.isPending || !createEmail.trim() || !createName.trim() || !createHandle.trim() || !createPassword.trim()}
            >
              {createUser.isPending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update user details and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-handle">Handle</Label>
              <Input
                id="edit-handle"
                value={editHandle}
                onChange={(e) => setEditHandle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="MODERATOR">Moderator</SelectItem>
                  <SelectItem value="CREATOR">Creator</SelectItem>
                  <SelectItem value="DEVELOPER">Developer</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateUser.isPending || !editEmail.trim() || !editName.trim() || !editHandle.trim()}
            >
              {updateUser.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

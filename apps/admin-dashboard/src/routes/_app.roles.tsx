import { createFileRoute } from "@tanstack/react-router";
import { Plus, Shield, Pencil, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRoles, type RoleWithCount } from "@/lib/api/hooks";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/roles")({
  head: () => ({ meta: [{ title: "Roles · Vellum Admin" }] }),
  component: RolesPage,
});

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Full access to manage users, content, moderation, and settings",
  MODERATOR: "Review reports and manage community content",
  CREATOR: "Create and manage own content",
  USER: "Standard user with read access to published content",
  GUEST: "Limited read-only access",
};

const ROLE_TONES: Record<string, string> = {
  ADMIN: "var(--chart-1)",
  MODERATOR: "var(--chart-4)",
  CREATOR: "var(--chart-5)",
  USER: "var(--chart-2)",
  GUEST: "var(--chart-3)",
};

type SimulatedRole = RoleWithCount & { description: string; isCustom?: boolean };

function RolesPage() {
  const { data, isLoading } = useRoles();
  const apiRoles = data ?? [];

  const [customRoles, setCustomRoles] = useState<SimulatedRole[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<SimulatedRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<SimulatedRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const allRoles: SimulatedRole[] = useMemo(() => {
    const apiMapped = apiRoles.map((r) => ({
      ...r,
      description: ROLE_DESCRIPTIONS[r.role] ?? "Custom role",
    }));
    return [...apiMapped, ...customRoles];
  }, [apiRoles, customRoles]);

  const handleCreate = () => {
    const trimmed = createName.trim();
    if (!trimmed) return;
    setIsCreating(true);
    setTimeout(() => {
      const newRole: SimulatedRole = {
        role: trimmed.toUpperCase().replace(/\s+/g, "_"),
        count: 0,
        description: createDescription.trim() || "Custom role",
        isCustom: true,
      };
      setCustomRoles((prev) => [...prev, newRole]);
      setIsCreating(false);
      setIsCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      toast.success("Role created successfully (simulated)");
    }, 500);
  };

  const openEdit = (role: SimulatedRole) => {
    setEditingRole(role);
    setEditName(role.role);
    setEditDescription(role.description);
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingRole) return;
    setIsEditing(true);
    setTimeout(() => {
      if (editingRole.isCustom) {
        setCustomRoles((prev) =>
          prev.map((r) =>
            r.role === editingRole.role
              ? { ...r, role: editName.trim().toUpperCase().replace(/\s+/g, "_"), description: editDescription.trim() }
              : r
          )
        );
      }
      setIsEditing(false);
      setIsEditOpen(false);
      setEditingRole(null);
      setEditName("");
      setEditDescription("");
      toast.success("Role updated successfully (simulated)");
    }, 500);
  };

  const openDelete = (role: SimulatedRole) => {
    setDeletingRole(role);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingRole) return;
    setIsDeleting(true);
    setTimeout(() => {
      if (deletingRole.isCustom) {
        setCustomRoles((prev) => prev.filter((r) => r.role !== deletingRole.role));
      }
      setIsDeleting(false);
      setIsDeleteOpen(false);
      setDeletingRole(null);
      toast.success("Role deleted successfully (simulated)");
    }, 500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Roles"
        description="User roles and their distribution across the platform."
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" /> New role
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create role</DialogTitle>
                <DialogDescription>
                  Add a new role with custom permissions and description.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Role name</Label>
                  <Input
                    id="create-name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Editor"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-description">Description</Label>
                  <Textarea
                    id="create-description"
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Brief description of what this role can do..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isCreating || !createName.trim()}>
                  {isCreating ? "Creating..." : "Create role"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {isLoading ? (
        <ChartSkeleton height={200} />
      ) : allRoles.length === 0 ? (
        <SectionCard><div className="p-6 text-center text-sm text-muted-foreground">No roles found.</div></SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allRoles.map((r) => {
            const tone = ROLE_TONES[r.role] ?? "var(--chart-1)";
            return (
              <SectionCard key={r.role}>
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in oklab, ${tone} 15%, transparent)` }}>
                    <Shield className="size-5" style={{ color: tone }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold capitalize">{r.role}</div>
                    <div className="text-xs text-muted-foreground">{r.description}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-xs">
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{r.count.toLocaleString()}</div>
                    <div className="text-muted-foreground">Members</div>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 hover:text-primary"
                      onClick={() => openEdit(r)}
                      title="Edit role"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 hover:text-destructive"
                      onClick={() => openDelete(r)}
                      title="Delete role"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit role</DialogTitle>
            <DialogDescription>Update the role name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Role name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isEditing}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isEditing || !editName.trim()}>
              {isEditing ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingRole?.role}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

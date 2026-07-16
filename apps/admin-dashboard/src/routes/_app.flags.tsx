import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Pencil, Flag, ToggleLeft, ToggleRight, Percent } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  useFeatureFlags,
  useCreateFeatureFlag,
  useUpdateFeatureFlag,
  useDeleteFeatureFlag,
  type FeatureFlag,
} from "@/lib/api/hooks";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/flags")({
  head: () => ({ meta: [{ title: "Feature Flags · Vellum Admin" }] }),
  component: FlagsPage,
});

function FlagsPage() {
  const { data, isLoading, refetch } = useFeatureFlags();
  const createFlag = useCreateFeatureFlag();
  const updateFlag = useUpdateFeatureFlag();
  const deleteFlag = useDeleteFeatureFlag();
  const flags = data ?? [];

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [newKey, setNewKey] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEnabled, setNewEnabled] = useState(false);
  const [newRollout, setNewRollout] = useState(0);

  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEnabled, setEditEnabled] = useState(false);
  const [editRollout, setEditRollout] = useState(0);

  const [deletingFlag, setDeletingFlag] = useState<FeatureFlag | null>(null);

  const stats = useMemo(() => {
    const flagList = data ?? [];
    const total = flagList.length;
    const enabled = flagList.filter((f) => f.enabled).length;
    const disabled = total - enabled;
    const avgRollout =
      total > 0 ? Math.round(flagList.reduce((acc, f) => acc + f.rollout, 0) / total) : 0;
    return { total, enabled, disabled, avgRollout };
  }, [data]);

  const openCreate = () => {
    setNewKey("");
    setNewDescription("");
    setNewEnabled(false);
    setNewRollout(0);
    setIsCreateOpen(true);
  };

  const handleCreate = () => {
    const trimmedKey = newKey.trim();
    if (!trimmedKey) return;
    createFlag.mutate(
      {
        key: trimmedKey,
        description: newDescription.trim(),
        enabled: newEnabled,
        rollout: newRollout,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setNewKey("");
          setNewDescription("");
          setNewEnabled(false);
          setNewRollout(0);
          refetch();
        },
      },
    );
  };

  const openEdit = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setEditKey(flag.key);
    setEditDescription(flag.description);
    setEditEnabled(flag.enabled);
    setEditRollout(flag.rollout);
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingFlag || !editKey.trim()) return;
    updateFlag.mutate(
      {
        id: editingFlag.id,
        enabled: editEnabled,
        rollout: editRollout,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingFlag(null);
          setEditKey("");
          setEditDescription("");
          setEditEnabled(false);
          setEditRollout(0);
          refetch();
        },
      },
    );
  };

  const openDelete = (flag: FeatureFlag) => {
    setDeletingFlag(flag);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingFlag) return;
    deleteFlag.mutate(deletingFlag.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingFlag(null);
        refetch();
      },
    });
  };

  const handleToggle = (flag: FeatureFlag, enabled: boolean) => {
    updateFlag.mutate({ id: flag.id, enabled });
  };

  const handleRolloutChange = (flag: FeatureFlag, rollout: number) => {
    updateFlag.mutate({ id: flag.id, rollout });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Feature flags"
        description="Toggle features and control rollout percentage."
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="size-4" /> New flag
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create feature flag</DialogTitle>
                <DialogDescription>
                  Add a new feature flag to control feature visibility and rollout.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-key">Flag key</Label>
                  <Input
                    id="create-key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="e.g. new_search"
                    className="font-mono"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-description">Description</Label>
                  <Textarea
                    id="create-description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of what this flag controls"
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">Enabled</div>
                    <div className="text-xs text-muted-foreground">
                      Whether the feature is active
                    </div>
                  </div>
                  <Switch checked={newEnabled} onCheckedChange={setNewEnabled} />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Rollout percentage</Label>
                    <span className="text-sm font-semibold tabular-nums">{newRollout}%</span>
                  </div>
                  <Slider
                    value={[newRollout]}
                    onValueChange={(v) => setNewRollout(v[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setNewRollout(0)}
                    >
                      0%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setNewRollout(50)}
                    >
                      50%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setNewRollout(100)}
                    >
                      100%
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createFlag.isPending || !newKey.trim()}>
                  {createFlag.isPending ? "Creating..." : "Create flag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Total flags</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10">
              <Flag className="size-5 text-primary" />
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Enabled</div>
              <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {stats.enabled}
              </div>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-500/10">
              <ToggleRight className="size-5 text-emerald-500" />
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Disabled</div>
              <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {stats.disabled}
              </div>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-rose-500/10">
              <ToggleLeft className="size-5 text-rose-500" />
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Avg rollout</div>
              <div className="text-2xl font-semibold tabular-nums">{stats.avgRollout}%</div>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-500/10">
              <Percent className="size-5 text-sky-500" />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard padded={false}>
        {isLoading ? (
          <div className="p-5">
            <ChartSkeleton height={200} />
          </div>
        ) : flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Flag className="size-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-foreground mb-1">No feature flags yet</p>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Create your first feature flag to start controlling feature rollouts.
            </p>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="size-4" /> Create flag
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {flags.map((f) => (
              <li
                key={f.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{f.key}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {f.enabled ? "on" : "off"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{f.description}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-xs text-muted-foreground">Rollout</div>
                  <div className="flex items-center gap-2">
                    <div className="w-24">
                      <Slider
                        value={[f.rollout]}
                        onValueChange={(v) => handleRolloutChange(f, v[0])}
                        min={0}
                        max={100}
                        step={1}
                        disabled={updateFlag.isPending}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">
                      {f.rollout}%
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:text-primary"
                  onClick={() => openEdit(f)}
                  title="Edit flag"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:text-destructive"
                  onClick={() => openDelete(f)}
                  title="Delete flag"
                  disabled={deleteFlag.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
                <Switch
                  checked={f.enabled}
                  onCheckedChange={(v) => handleToggle(f, v)}
                  disabled={updateFlag.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit feature flag</DialogTitle>
            <DialogDescription>
              Update the feature flag settings and rollout percentage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-key">Flag key</Label>
              <Input
                id="edit-key"
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                className="font-mono"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                disabled
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Enabled</div>
                <div className="text-xs text-muted-foreground">Whether the feature is active</div>
              </div>
              <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Rollout percentage</Label>
                <span className="text-sm font-semibold tabular-nums">{editRollout}%</span>
              </div>
              <Slider
                value={[editRollout]}
                onValueChange={(v) => setEditRollout(v[0])}
                min={0}
                max={100}
                step={1}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditRollout(0)}
                >
                  0%
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditRollout(50)}
                >
                  50%
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditRollout(100)}
                >
                  100%
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateFlag.isPending}>
              {updateFlag.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete feature flag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong className="font-mono">{deletingFlag?.key}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteFlag.isPending}>
              {deleteFlag.isPending ? "Deleting..." : "Delete flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

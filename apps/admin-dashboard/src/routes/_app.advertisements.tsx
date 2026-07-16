import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  Eye,
  MousePointerClick,
  DollarSign,
  Pause,
  Play,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdvertisements,
  useCreateAdvertisement,
  useUpdateAdvertisement,
  useDeleteAdvertisement,
  type Advertisement,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/advertisements")({
  head: () => ({ meta: [{ title: "Advertisements · Vellum Admin" }] }),
  component: AdvertisementsPage,
});

function AdvertisementsPage() {
  const { data, isLoading, error, refetch } = useAdvertisements({ pageSize: 50 });
  const createAdvertisement = useCreateAdvertisement();
  const updateAdvertisement = useUpdateAdvertisement();
  const deleteAdvertisement = useDeleteAdvertisement();
  const { can } = useAuth();
  const rows = data?.data ?? [];

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [deletingAd, setDeletingAd] = useState<Advertisement | null>(null);

  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState("draft");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((a) => a.status === "active").length;
    const paused = rows.filter((a) => a.status === "paused").length;
    const totalImpressions = rows.reduce((sum, a) => sum + a.impressions, 0);
    const totalClicks = rows.reduce((sum, a) => sum + a.clicks, 0);
    const totalSpend = rows.reduce((sum, a) => sum + a.spend, 0);
    return { total, active, paused, totalImpressions, totalClicks, totalSpend };
  }, [rows]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const resetForm = () => {
    setFormName("");
    setFormStatus("draft");
    setFormStartsAt("");
    setFormEndsAt("");
  };

  const handleCreate = () => {
    if (!formName.trim()) return;
    createAdvertisement.mutate(
      {
        name: formName.trim(),
        status: formStatus,
        startsAt: formStartsAt || null,
        endsAt: formEndsAt || null,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetForm();
          refetch();
        },
      },
    );
  };

  const openEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormName(ad.name);
    setFormStatus(ad.status);
    setFormStartsAt(ad.startsAt ? ad.startsAt.slice(0, 16) : "");
    setFormEndsAt(ad.endsAt ? ad.endsAt.slice(0, 16) : "");
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingAd || !formName.trim()) return;
    updateAdvertisement.mutate(
      {
        id: editingAd.id,
        name: formName.trim(),
        status: formStatus,
        startsAt: formStartsAt || null,
        endsAt: formEndsAt || null,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingAd(null);
          resetForm();
          refetch();
        },
      },
    );
  };

  const openDelete = (ad: Advertisement) => {
    setDeletingAd(ad);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingAd) return;
    deleteAdvertisement.mutate(deletingAd.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingAd(null);
        refetch();
      },
    });
  };

  const toggleStatus = (ad: Advertisement) => {
    const newStatus = ad.status === "active" ? "paused" : "active";
    updateAdvertisement.mutate(
      {
        id: ad.id,
        status: newStatus,
      },
      {
        onSuccess: () => {
          refetch();
        },
      },
    );
  };

  const renderHeader = () => (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Total ads</div>
            <div className="text-2xl font-semibold">{stats.total}</div>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10">
            <Megaphone className="size-5 text-primary" />
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-2xl font-semibold">{stats.active}</div>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-500/10">
            <Play className="size-5 text-emerald-500" />
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Paused</div>
            <div className="text-2xl font-semibold">{stats.paused}</div>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-500/10">
            <Pause className="size-5 text-amber-500" />
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Impressions</div>
            <div className="text-2xl font-semibold">
              {stats.totalImpressions.toLocaleString()}
            </div>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-500/10">
            <Eye className="size-5 text-sky-500" />
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Clicks</div>
            <div className="text-2xl font-semibold">{stats.totalClicks.toLocaleString()}</div>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-violet-500/10">
            <MousePointerClick className="size-5 text-violet-500" />
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Total spend</div>
            <div className="text-2xl font-semibold">{formatCurrency(stats.totalSpend)}</div>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-rose-500/10">
            <DollarSign className="size-5 text-rose-500" />
          </div>
        </div>
      </SectionCard>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Stats Overview */}

        <ListPage<Advertisement>
          title="Advertisements"
          description="Campaigns running across the network."
          eyebrow="Growth"
          rows={rows}
          isLoading={isLoading}
          error={error}
          searchKeys={["name", "status"]}
          renderHeader={renderHeader()}
          actions={
            can("advertisements", "write") ? (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="size-4" /> New campaign
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create advertisement</DialogTitle>
                    <DialogDescription>
                      Create a new ad campaign to run across the network.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-name">Campaign name</Label>
                      <Input
                        id="create-name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Summer Sale 2025"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-status">Status</Label>
                      <Select value={formStatus} onValueChange={setFormStatus}>
                        <SelectTrigger id="create-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-starts-at">Start date</Label>
                      <Input
                        id="create-starts-at"
                        type="datetime-local"
                        value={formStartsAt}
                        onChange={(e) => setFormStartsAt(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-ends-at">End date</Label>
                      <Input
                        id="create-ends-at"
                        type="datetime-local"
                        value={formEndsAt}
                        onChange={(e) => setFormEndsAt(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={createAdvertisement.isPending || !formName.trim()}
                    >
                      {createAdvertisement.isPending ? "Creating..." : "Create campaign"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
          columns={[
            {
              key: "name",
              header: "Campaign",
              cell: (a) => <span className="font-medium">{a.name}</span>,
            },
            {
              key: "status",
              header: "Status",
              cell: (a) => <StatusBadge status={a.status} />,
            },
            {
              key: "impressions",
              header: "Impressions",
              cell: (a) => <span className="tabular-nums">{a.impressions.toLocaleString()}</span>,
            },
            {
              key: "clicks",
              header: "Clicks",
              cell: (a) => <span className="tabular-nums">{a.clicks.toLocaleString()}</span>,
            },
            {
              key: "ctr",
              header: "CTR",
              cell: (a) => (
                <span className="tabular-nums">
                  {a.impressions > 0 ? ((a.clicks / a.impressions) * 100).toFixed(2) : "0"}%
                </span>
              ),
            },
            {
              key: "spend",
              header: "Spend",
              cell: (a) => <span className="tabular-nums">{formatCurrency(a.spend)}</span>,
            },
            {
              key: "startsAt",
              header: "Starts",
              cell: (a) => (
                <span className="text-xs text-muted-foreground">
                  {a.startsAt ? format(new Date(a.startsAt), "MMM d, yyyy") : "—"}
                </span>
              ),
            },
          ]}
          renderRowActions={(a) => (
            <div className="flex items-center justify-end gap-1">
              {can("advertisements", "write") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:text-primary"
                  onClick={() => toggleStatus(a)}
                  title={a.status === "active" ? "Pause" : "Activate"}
                  disabled={updateAdvertisement.isPending}
                >
                  {a.status === "active" ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </Button>
              )}
              {can("advertisements", "write") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:text-primary"
                  onClick={() => openEdit(a)}
                  aria-label="Edit"
                >
                  <Pencil className="size-4" />
                </Button>
              )}
              {can("advertisements", "delete") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:text-destructive"
                  onClick={() => openDelete(a)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          )}
        />
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit advertisement</DialogTitle>
            <DialogDescription>Update campaign details and settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Campaign name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Summer Sale 2025"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-starts-at">Start date</Label>
              <Input
                id="edit-starts-at"
                type="datetime-local"
                value={formStartsAt}
                onChange={(e) => setFormStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ends-at">End date</Label>
              <Input
                id="edit-ends-at"
                type="datetime-local"
                value={formEndsAt}
                onChange={(e) => setFormEndsAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false);
                setEditingAd(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateAdvertisement.isPending || !formName.trim()}
            >
              {updateAdvertisement.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete advertisement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingAd?.name}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false);
                setDeletingAd(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteAdvertisement.isPending}
            >
              {deleteAdvertisement.isPending ? "Deleting..." : "Delete campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

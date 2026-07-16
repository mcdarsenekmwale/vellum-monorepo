import { createFileRoute } from "@tanstack/react-router";
import { Plus, PlayCircle, KeyRound, Pencil, Trash2, Copy, Check, Webhook } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  type WebhookConfig,
} from "@/lib/api/hooks";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

const SUGGESTED_EVENTS = [
  "article.created",
  "article.updated",
  "article.deleted",
  "user.created",
  "user.updated",
  "comment.created",
];

export const Route = createFileRoute("/_app/webhooks")({
  head: () => ({ meta: [{ title: "Webhooks · Vellum Admin" }] }),
  component: WebhooksPage,
});

function WebhooksPage() {
  const { data, isLoading, refetch } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const webhooks = data ?? [];

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createUrl, setCreateUrl] = useState("");
  const [createEvents, setCreateEvents] = useState("");
  const [createIsActive, setCreateIsActive] = useState(true);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookConfig | null>(null);

  const [isSecretOpen, setIsSecretOpen] = useState(false);
  const [secretWebhook, setSecretWebhook] = useState<WebhookConfig | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [isTestOpen, setIsTestOpen] = useState(false);
  const [testWebhook, setTestWebhook] = useState<WebhookConfig | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [logsWebhook, setLogsWebhook] = useState<WebhookConfig | null>(null);

  const parseEvents = (eventsStr: string): string[] => {
    return eventsStr
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  };

  const handleCreate = () => {
    const name = createName.trim();
    const url = createUrl.trim();
    const events = parseEvents(createEvents);
    if (!name || !url || events.length === 0) return;

    createWebhook.mutate(
      { name, url, events, isActive: createIsActive },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setCreateName("");
          setCreateUrl("");
          setCreateEvents("");
          setCreateIsActive(true);
          refetch();
        },
      },
    );
  };

  const openEdit = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setEditName(webhook.name);
    setEditUrl(webhook.url);
    setEditEvents(webhook.events.join(", "));
    setEditIsActive(webhook.isActive);
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingWebhook) return;
    const name = editName.trim();
    const url = editUrl.trim();
    const events = parseEvents(editEvents);
    if (!name || !url || events.length === 0) return;

    updateWebhook.mutate(
      { id: editingWebhook.id, name, url, events, isActive: editIsActive },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingWebhook(null);
          refetch();
        },
      },
    );
  };

  const openDelete = (webhook: WebhookConfig) => {
    setDeletingWebhook(webhook);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingWebhook) return;
    deleteWebhook.mutate(deletingWebhook.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingWebhook(null);
        refetch();
      },
    });
  };

  const openSecret = (webhook: WebhookConfig) => {
    setSecretWebhook(webhook);
    setCopiedSecret(false);
    setIsSecretOpen(true);
  };

  const copySecret = () => {
    if (!secretWebhook) return;
    navigator.clipboard.writeText(secretWebhook.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const openTest = (webhook: WebhookConfig) => {
    setTestWebhook(webhook);
    setTestSuccess(false);
    setTestSending(false);
    setIsTestOpen(true);
  };

  const handleTest = () => {
    setTestSending(true);
    setTimeout(() => {
      setTestSending(false);
      setTestSuccess(true);
    }, 1200);
  };

  const openLogs = (webhook: WebhookConfig) => {
    setLogsWebhook(webhook);
    setIsLogsOpen(true);
  };

  const logs = logsWebhook?.webhookLogs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Webhooks"
        description="Outbound HTTP callbacks with delivery logs and retry policies."
        actions={
          <>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> New webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create webhook</DialogTitle>
                  <DialogDescription>
                    Configure a new outbound webhook endpoint to receive event notifications.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-name">Webhook name</Label>
                    <Input
                      id="create-name"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g. Article sync"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-url">Endpoint URL</Label>
                    <Input
                      id="create-url"
                      value={createUrl}
                      onChange={(e) => setCreateUrl(e.target.value)}
                      placeholder="https://api.example.com/webhook"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-events">Events (comma-separated)</Label>
                    <Input
                      id="create-events"
                      value={createEvents}
                      onChange={(e) => setCreateEvents(e.target.value)}
                      placeholder="article.created, article.updated"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {SUGGESTED_EVENTS.map((event) => (
                        <button
                          key={event}
                          type="button"
                          onClick={() => {
                            const current = parseEvents(createEvents);
                            if (current.includes(event)) {
                              setCreateEvents(current.filter((e) => e !== event).join(", "));
                            } else {
                              setCreateEvents([...current, event].join(", "));
                            }
                          }}
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-colors ${
                            parseEvents(createEvents).includes(event)
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/30"
                          }`}
                        >
                          {event}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="create-active">Active</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable this webhook to start sending events.
                      </p>
                    </div>
                    <Switch
                      id="create-active"
                      checked={createIsActive}
                      onCheckedChange={setCreateIsActive}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={
                      createWebhook.isPending ||
                      !createName.trim() ||
                      !createUrl.trim() ||
                      parseEvents(createEvents).length === 0
                    }
                  >
                    {createWebhook.isPending ? "Creating..." : "Create webhook"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <SectionCard padded={false}>
        {isLoading ? (
          <div className="p-5">
            <ChartSkeleton height={200} />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 grid size-16 place-items-center rounded-full bg-muted/50">
              <Webhook className="size-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">No webhooks configured</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first webhook to start receiving event notifications.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setIsCreateOpen(true)}>
              <Plus className="size-4" /> Create webhook
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {webhooks.map((w) => (
              <li key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{w.name}</span>
                    <StatusBadge status={w.isActive ? "active" : "paused"} />
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {w.url}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {w.events.map((e) => (
                      <Badge key={e} variant="secondary" className="font-mono text-[10px]">
                        {e}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                  <div>
                    Last delivery{" "}
                    {w.webhookLogs?.[0]
                      ? formatDistanceToNow(new Date(w.webhookLogs[0].createdAt), {
                          addSuffix: true,
                        })
                      : "never"}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => openTest(w)}>
                      <PlayCircle className="size-3.5" />
                      Test
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openLogs(w)}>
                      Logs
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => openSecret(w)}
                    >
                      <KeyRound className="size-3.5" /> Secret
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(w)}
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => openDelete(w)}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit webhook</DialogTitle>
            <DialogDescription>Update the webhook configuration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Webhook name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-url">Endpoint URL</Label>
              <Input id="edit-url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-events">Events (comma-separated)</Label>
              <Input
                id="edit-events"
                value={editEvents}
                onChange={(e) => setEditEvents(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED_EVENTS.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => {
                      const current = parseEvents(editEvents);
                      if (current.includes(event)) {
                        setEditEvents(current.filter((e) => e !== event).join(", "));
                      } else {
                        setEditEvents([...current, event].join(", "));
                      }
                    }}
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-colors ${
                      parseEvents(editEvents).includes(event)
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Enable this webhook to start sending events.
                </p>
              </div>
              <Switch id="edit-active" checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={
                updateWebhook.isPending ||
                !editName.trim() ||
                !editUrl.trim() ||
                parseEvents(editEvents).length === 0
              }
            >
              {updateWebhook.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingWebhook?.name}</strong>? This action
              cannot be undone and no more events will be delivered to this endpoint.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteWebhook.isPending}>
              {deleteWebhook.isPending ? "Deleting..." : "Delete webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Dialog */}
      <Dialog open={isSecretOpen} onOpenChange={setIsSecretOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Webhook secret</DialogTitle>
            <DialogDescription>
              Use this secret to verify that incoming webhook requests are sent by Vellum.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <code className="font-mono text-sm break-all pr-3">{secretWebhook?.secret}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copySecret}
                  className="shrink-0 gap-1.5"
                >
                  {copiedSecret ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Keep this secret secure. Anyone with access to it can forge webhook requests to your
              endpoint.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSecretOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test webhook</DialogTitle>
            <DialogDescription>
              Send a test ping to <strong>{testWebhook?.name}</strong> to verify the endpoint is
              reachable.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {testSuccess ? (
              <div className="flex items-center gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/20">
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Test ping sent successfully
                  </p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                    The webhook endpoint responded with a 200 OK.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">
                  A test event with a sample payload will be sent to:
                </p>
                <code className="mt-2 block truncate font-mono text-xs">{testWebhook?.url}</code>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestOpen(false)}>
              {testSuccess ? "Close" : "Cancel"}
            </Button>
            {!testSuccess && (
              <Button onClick={handleTest} disabled={testSending}>
                {testSending ? "Sending..." : "Send test ping"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Delivery logs</DialogTitle>
            <DialogDescription>
              Recent delivery attempts for <strong>{logsWebhook?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No delivery logs yet.</p>
              </div>
            ) : (
              <ul className="divide-y">
                {logs.map((log) => (
                  <li key={log.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`font-mono text-[10px] ${
                            log.statusCode && log.statusCode >= 200 && log.statusCode < 300
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : log.error
                                ? "bg-destructive/10 text-destructive"
                                : ""
                          }`}
                        >
                          {log.statusCode ? `${log.statusCode}` : "Failed"}
                        </Badge>
                        <span className="font-mono text-xs">{log.event}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {log.error && <p className="mt-1.5 text-xs text-destructive">{log.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsLogsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

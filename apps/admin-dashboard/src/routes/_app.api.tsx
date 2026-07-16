import { createFileRoute } from "@tanstack/react-router";
import { Plus, BookOpen, Zap, Copy, Eye, EyeOff, Check, Key } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApiKeys, useCreateApiKey, useDeleteApiKey, type ApiKey } from "@/lib/api/hooks";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/api")({
  head: () => ({ meta: [{ title: "API · Vellum Admin" }] }),
  component: ApiPage,
});

function ApiPage() {
  const { data, isLoading, refetch } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();

  const keys = data ?? [];

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null);
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedFullKey, setCopiedFullKey] = useState(false);

  const [name, setName] = useState("");
  const [scopesInput, setScopesInput] = useState("");
  const [userId, setUserId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [hasUserId, setHasUserId] = useState(false);

  const commonScopes = ["read", "write", "admin", "articles:read", "articles:write", "users:read", "users:write"];

  const resetCreateForm = () => {
    setName("");
    setScopesInput("");
    setUserId("");
    setExpiresAt("");
    setHasExpiry(false);
    setHasUserId(false);
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const scopes = scopesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (scopes.length === 0) return;

    createApiKey.mutate(
      {
        name: trimmedName,
        scopes,
        userId: hasUserId && userId.trim() ? userId.trim() : null,
        expiresAt: hasExpiry && expiresAt ? expiresAt : null,
      },
      {
        onSuccess: (newKey) => {
          setCreatedKey(newKey);
          setIsCreateOpen(false);
          setIsSuccessOpen(true);
          resetCreateForm();
          refetch();
        },
      }
    );
  };

  const openDelete = (key: ApiKey) => {
    setDeletingKey(key);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingKey) return;
    deleteApiKey.mutate(deletingKey.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingKey(null);
        refetch();
      },
    });
  };

  const copyKeyPrefix = (key: ApiKey) => {
    navigator.clipboard.writeText(key.key.slice(0, 12));
    setCopiedKeyId(key.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const copyFullKey = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    setCopiedFullKey(true);
    setTimeout(() => setCopiedFullKey(false), 2000);
  };

  const toggleReveal = (keyId: string) => {
    setRevealedKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const addScope = (scope: string) => {
    const current = scopesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!current.includes(scope)) {
      setScopesInput([...current, scope].join(", "));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="API management"
        description="Keys, usage, rate limits and monitoring."
        actions={
          <>
            <Dialog open={isDocsOpen} onOpenChange={setIsDocsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BookOpen className="size-4" /> Docs
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>API Documentation</DialogTitle>
                  <DialogDescription>
                    Learn how to use the Vellum API to integrate with your applications.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Base URL</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs">
                        https://api.vellum.example.com/v1
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          navigator.clipboard.writeText("https://api.vellum.example.com/v1");
                        }}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Authentication</Label>
                    <p className="text-xs text-muted-foreground">
                      Use the <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Authorization</code> header with your API key:
                    </p>
                    <pre className="rounded bg-muted p-3 text-xs">
                      <code>Authorization: Bearer YOUR_API_KEY</code>
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <Label>Available endpoints</Label>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      <li><code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">GET /articles</code> — List articles</li>
                      <li><code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">POST /articles</code> — Create article</li>
                      <li><code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">GET /articles/:id</code> — Get article</li>
                      <li><code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">GET /users</code> — List users</li>
                      <li><code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">GET /tags</code> — List tags</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <Label>Scopes</Label>
                    <p className="text-xs text-muted-foreground">
                      API keys require scopes to access specific resources. Common scopes include:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {commonScopes.map((s) => (
                        <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsDocsOpen(false)}>Got it</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> Create key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create API key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for programmatic access. Store it securely — it's only shown once.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key name</Label>
                    <Input
                      id="key-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      placeholder="e.g. Production API key"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="key-scopes">Scopes (comma-separated)</Label>
                    <Input
                      id="key-scopes"
                      value={scopesInput}
                      onChange={(e) => setScopesInput(e.target.value)}
                      placeholder="read, write, articles:read"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {commonScopes.map((s) => {
                        const current = scopesInput.split(",").map((x) => x.trim()).filter(Boolean);
                        const isActive = current.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => addScope(s)}
                            className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                              isActive
                                ? "bg-primary/10 border-primary/30 text-primary"
                                : "bg-muted border-transparent hover:bg-muted/70"
                            }`}
                          >
                            + {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="has-user" className="cursor-pointer">
                        Assign to user
                      </Label>
                      <Switch id="has-user" checked={hasUserId} onCheckedChange={setHasUserId} />
                    </div>
                    {hasUserId && (
                      <div className="space-y-2">
                        <Input
                          value={userId}
                          onChange={(e) => setUserId(e.target.value)}
                          placeholder="User ID"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="has-expiry" className="cursor-pointer">
                        Set expiration
                      </Label>
                      <Switch id="has-expiry" checked={hasExpiry} onCheckedChange={setHasExpiry} />
                    </div>
                    {hasExpiry && (
                      <div className="space-y-2">
                        <Input
                          type="date"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      resetCreateForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={
                      createApiKey.isPending ||
                      !name.trim() ||
                      scopesInput.split(",").map((s) => s.trim()).filter(Boolean).length === 0
                    }
                  >
                    {createApiKey.isPending ? "Creating..." : "Create key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active keys" value={keys.filter((k) => k.isActive).length} icon={Zap} tone="primary" />
        <StatCard label="Total keys" value={keys.length} tone="info" />
      </div>

      <SectionCard title="API keys" padded={false}>
        {isLoading ? (
          <div className="p-5"><ChartSkeleton height={200} /></div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 mb-3">
              <Key className="size-6 text-primary" />
            </div>
            <p className="text-sm font-medium">No API keys yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first API key to get started with the API.
            </p>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="size-4" /> Create key
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Key</th>
                <th className="px-5 py-3 text-left">Scopes</th>
                <th className="px-5 py-3 text-left">Owner</th>
                <th className="px-5 py-3 text-left">Expires</th>
                <th className="px-5 py-3 text-left">Last used</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const isRevealed = revealedKeys[k.id];
                const isCopied = copiedKeyId === k.id;
                return (
                  <tr key={k.id} className="border-t">
                    <td className="px-5 py-3 font-medium">{k.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs">
                          {isRevealed ? k.key : `${k.key.slice(0, 12)}••••`}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 hover:text-primary"
                          onClick={() => toggleReveal(k.id)}
                          title={isRevealed ? "Hide key" : "Reveal key"}
                        >
                          {isRevealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 hover:text-primary"
                          onClick={() => copyKeyPrefix(k)}
                          title="Copy key prefix"
                        >
                          {isCopied ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs">{k.user?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {k.expiresAt ? format(new Date(k.expiresAt), "MMM d, yyyy") : "Never"}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {k.lastUsedAt ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true }) : "Never"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={k.isActive ? "active" : "revoked"} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDelete(k)}
                        disabled={deleteApiKey.isPending && deletingKey?.id === k.id}
                      >
                        {deleteApiKey.isPending && deletingKey?.id === k.id
                          ? "Revoking..."
                          : "Revoke"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Success Dialog - shows full key only once */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Key created</DialogTitle>
            <DialogDescription>
              Your API key has been created. Copy it now — you won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Key name</Label>
              <p className="text-sm font-medium">{createdKey?.name}</p>
            </div>
            <div className="space-y-2">
              <Label>API key</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
                <code className="flex-1 font-mono text-xs break-all">
                  {createdKey?.key}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 hover:text-primary"
                  onClick={() => createdKey && copyFullKey(createdKey.key)}
                >
                  {copiedFullKey ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Save this key in a secure location. It will not be shown again.
              </p>
            </div>
            {createdKey?.scopes && createdKey.scopes.length > 0 && (
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="flex flex-wrap gap-1">
                  {createdKey.scopes.map((s) => (
                    <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsSuccessOpen(false);
                setCreatedKey(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke API key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke <strong>{deletingKey?.name}</strong>? Any applications
              using this key will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteApiKey.isPending}
            >
              {deleteApiKey.isPending ? "Revoking..." : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ClipboardList,
  X,
  Copy,
  Check,
  Tag,
  Sparkles,
  Eye,
  Clock,
  TrendingUp,
  Power,
  PowerOff,
  Hash,
  Filter,
  PlusCircle,
  AtSign,
  Hash as HashIcon,
  Link2,
  ChevronDown,
  ListChevronsUpDown,
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import {
  useCannedResponses,
  useCreateCannedResponse,
  useUpdateCannedResponse,
  useDeleteCannedResponse,
  useMarkCannedResponseUsed,
  type CannedResponse,
} from "@/lib/api/hooks";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/support/canned-responses")({
  head: () => ({ meta: [{ title: "Canned Responses · Vellbase Admin" }] }),
  component: CannedResponsesPage,
});

/* ─── Default categories ─── */

const DEFAULT_CATEGORIES = [
  "General",
  "Greeting",
  "Billing",
  "Technical",
  "Account",
  "Refund",
  "Escalation",
  "Follow-up",
  "Closing",
  "Welcome",
  "Feedback",
  "Feature",
  "Bug",
];

/* ─── Helpers ─── */

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim());
}


/* ─── Collapsible Section Component ─── */

function CollapsibleSection({
  icon: Icon,
  label,
  badge,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  label: string;
  badge?: string | number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          {badge !== undefined && (
            <Badge variant="secondary" className="text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isOpen ? "Hide" : "Show"}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}

/* ─── Category Input Component ─── */

function CategoryInput({
  value,
  onChange,
  categories,
  placeholder = "Select or type a category...",
}: {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isPredefined = categories.includes(value);

  const handleSelectChange = (selected: string) => {
    if (selected === "__custom__") {
      setIsCustom(true);
      setCustomValue("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setIsCustom(false);
      onChange(selected);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomValue(val);
    onChange(val);
  };

  const handleCustomBlur = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
    } else {
      setIsCustom(false);
      onChange("");
    }
  };

  if (isCustom || (value && !isPredefined)) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={isCustom ? customValue : value}
              onChange={handleCustomChange}
              onBlur={handleCustomBlur}
              placeholder="Enter custom category..."
              className="pr-8"
            />
            {value && (
              <button
                onClick={() => {
                  setIsCustom(false);
                  setCustomValue("");
                  onChange("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCustom(false);
              setCustomValue("");
              onChange(categories[0] || "");
            }}
            className="shrink-0"
          >
            <X className="size-3.5 mr-1" />
            Cancel
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Type a new category name. It will be saved with the template.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select value={value || ""} onValueChange={handleSelectChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
          <SelectItem value="__custom__" className="text-primary">
            <div className="flex items-center gap-2">
              <PlusCircle className="size-3.5" />
              <span>Add custom category...</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        Select an existing category or choose "Add custom category" to create a new one.
      </p>
    </div>
  );
}

/* ─── Tags Input Component ─── */

function TagsInput({
  value,
  onChange,
  placeholder = "Type a tag and press Enter...",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = input.trim();
      if (tag && !value.includes(tag)) {
        onChange([...value, tag]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-lg border items-center">
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 pl-2 pr-1 py-1 text-xs"
          >
            <Tag className="size-3" />
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="border-0 bg-transparent  min-w-[120px] flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Press Enter or comma to add a tag. Tags help organize and search templates.
      </p>
    </div>
  );
}

/* ─── Variables Input Component ─── */

function VariablesInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (vars: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const variable = input.trim();
      if (variable && !value.includes(variable)) {
        onChange([...value, variable]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeVariable = (variable: string) => {
    onChange(value.filter((v) => v !== variable));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-lg border items-center">
        {value.map((variable) => (
          <Badge
            key={variable}
            variant="outline"
            className="gap-1 pl-2 pr-1 py-1 text-xs font-mono"
          >
            <AtSign className="size-3" />
            {variable}
            <button
              onClick={() => removeVariable(variable)}
              className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Type variable and press Enter..." : ""}
          className="border-0 bg-transparent  min-w-[120px] flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Variables will be replaced with dynamic values. Use <code className="font-mono bg-muted rounded px-1">{'{{variable}}'}</code> in the message.
      </p>
    </div>
  );
}

/* ─── Shortcuts Input Component ─── */

function ShortcutsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (shortcuts: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const shortcut = input.trim().replace(/^\/+/, "").toLowerCase();
      if (shortcut && !value.includes(shortcut)) {
        onChange([...value, shortcut]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeShortcut = (shortcut: string) => {
    onChange(value.filter((s) => s !== shortcut));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-lg border  items-center">
        {value.map((shortcut) => (
          <Badge
            key={shortcut}
            variant="secondary"
            className="gap-1 pl-2 pr-1 py-1 text-xs font-mono"
          >
            <Link2 className="size-3" />
            /{shortcut}
            <button
              onClick={() => removeShortcut(shortcut)}
              className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Type shortcut and press Enter..." : ""}
          className="border-0 bg-transparent  min-w-[120px] flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Shortcuts let agents quickly insert templates by typing <code className="font-mono bg-muted rounded px-1">/shortcut</code>.
      </p>
    </div>
  );
}

/* ─── Main Page ─── */

function CannedResponsesPage() {
  const { data, isLoading, isError, error, refetch } = useCannedResponses();
  const createMutation = useCreateCannedResponse();
  const updateMutation = useUpdateCannedResponse();
  const deleteMutation = useDeleteCannedResponse();
  const markUsedMutation = useMarkCannedResponseUsed();
  const { can } = useAuth();

  const items = (data ?? []) as CannedResponse[];

  // Filter UI state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CannedResponse | null>(null);
  const [deletingItem, setDeletingItem] = useState<CannedResponse | null>(null);
  const [previewItem, setPreviewItem] = useState<CannedResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formShortcut, setFormShortcut] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formVariables, setFormVariables] = useState<string[]>([]);
  const [formShortcuts, setFormShortcuts] = useState<string[]>([]);

  // Derive unique categories from the data, fallback to defaults
  const categories = useMemo(() => {
    const fromData = [...new Set(items.map((c) => c.category).filter(Boolean) as string[])];
    return fromData.length > 0 ? fromData : DEFAULT_CATEGORIES;
  }, [items]);

  // Auto-detect variables from body
  const detectVariables = (body: string) => {
    const vars = extractVariables(body);
    setFormVariables(vars);
  };

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (statusFilter === "active" && !c.isActive) return false;
      if (statusFilter === "inactive" && c.isActive) return false;
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.body.toLowerCase().includes(q) ||
        (c.shortcut ?? "").toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q) ||
        (c.tags ?? []).some(t => t.toLowerCase().includes(q)) ||
        (c.shortcuts ?? []).some(s => s.toLowerCase().includes(q))
      );
    });
  }, [items, search, categoryFilter, statusFilter]);

  // Stats
  const totalCount = items.length;
  const activeCount = items.filter((c) => c.isActive).length;
  const totalUses = items.reduce((s, c) => s + (c.usageCount ?? 0), 0);
  const mostUsed = [...items].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))[0];

  /* ─── Dialog openers ─── */

  const openCreate = () => {
    setFormTitle("");
    setFormBody("");
    setFormCategory(categories[0] ?? "");
    setFormShortcut("");
    setFormIsActive(true);
    setFormTags([]);
    setFormVariables([]);
    setFormShortcuts([]);
    setIsCreateOpen(true);
  };

  const openEdit = (c: CannedResponse) => {
    setEditingItem(c);
    setFormTitle(c.title);
    setFormBody(c.body);
    setFormCategory(c.category ?? "");
    setFormShortcut(c.shortcut ?? "");
    setFormIsActive(c.isActive);
    setFormTags(c.tags ?? []);
    setFormVariables(c.variables ?? []);
    setFormShortcuts(c.shortcuts ?? []);
    setIsEditOpen(true);
  };

  const openDelete = (c: CannedResponse) => {
    setDeletingItem(c);
    setIsDeleteOpen(true);
  };

  const openPreview = (c: CannedResponse) => {
    setPreviewItem(c);
    setIsPreviewOpen(true);
    markUsedMutation.mutate(c.id);
  };

  /* ─── Form handlers ─── */

  const handleBodyChange = (value: string) => {
    setFormBody(value);
    // Auto-detect variables
    const vars = extractVariables(value);
    setFormVariables(vars);
  };

  const handleCreate = () => {
    if (!formTitle.trim() || !formBody.trim()) {
      toast.error("Please fill in both title and message");
      return;
    }

    createMutation.mutate(
      {
        title: formTitle.trim(),
        body: formBody,
        category: formCategory.trim() || undefined,
        shortcut: formShortcut.trim() || undefined,
        isActive: formIsActive,
        tags: formTags.length > 0 ? formTags : undefined,
        variables: formVariables.length > 0 ? formVariables : undefined,
        shortcuts: formShortcuts.length > 0 ? formShortcuts : undefined,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          refetch();
          toast.success("Canned response created successfully");
        },
        onError: (error: any) => {
          toast.error("Failed to create: " + (error.message || "Unknown error"));
        },
      }
    );
  };

  const handleEdit = () => {
    if (!editingItem || !formTitle.trim() || !formBody.trim()) {
      toast.error("Please fill in both title and message");
      return;
    }

    updateMutation.mutate(
      {
        id: editingItem.id,
        data: {
          title: formTitle.trim(),
          body: formBody,
          category: formCategory.trim() || undefined,
          shortcut: formShortcut.trim() || undefined,
          isActive: formIsActive,
          tags: formTags.length > 0 ? formTags : undefined,
          variables: formVariables.length > 0 ? formVariables : undefined,
          shortcuts: formShortcuts.length > 0 ? formShortcuts : undefined,
        },
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingItem(null);
          refetch();
          toast.success("Canned response updated successfully");
        },
        onError: (error: any) => {
          toast.error("Failed to update: " + (error.message || "Unknown error"));
        },
      }
    );
  };

  const handleToggleActive = (c: CannedResponse) => {
    updateMutation.mutate(
      { id: c.id, data: { isActive: !c.isActive } },
      {
        onSuccess: () => {
          refetch();
          toast.success(`Template ${c.isActive ? "deactivated" : "activated"}`);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deletingItem) return;
    deleteMutation.mutate(deletingItem.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingItem(null);
        refetch();
        toast.success("Canned response deleted successfully");
      },
      onError: (error: any) => {
        toast.error("Failed to delete: " + (error.message || "Unknown error"));
      },
    });
  };

  const handleCopyBody = (c: CannedResponse) => {
    navigator.clipboard.writeText(c.body);
    setCopiedId(c.id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter(undefined);
    setStatusFilter("all");
  };
  const hasFilters = !!(search || categoryFilter || statusFilter !== "all");

  /* ─── Render ─── */

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Support"
          title="Canned Responses"
          description="Reusable message templates for support agents"
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <X className="size-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load canned responses</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard resource="support" action="read" showReadOnlyBanner>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="Support"
          title="Canned Responses"
          description="Create and manage reusable message templates for faster ticket replies."
          actions={
            can("support", "write") ? (
              <Button onClick={openCreate} className="gap-1.5">
                <Plus className="size-4" />
                New Response
              </Button>
            ) : null
          }
        />

        {/* Stats Overview */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Templates"
            value={totalCount}
            icon={ClipboardList}
            tone="primary"
          />
          <StatCard
            label="Active"
            value={activeCount}
            icon={Power}
            tone="success"
          />
          <StatCard
            label="Inactive"
            value={totalCount - activeCount}
            icon={PowerOff}
            tone="warning"
          />
          <StatCard
            label="Total Uses"
            value={totalUses.toLocaleString()}
            icon={TrendingUp}
            tone="info"
          />
        </div>

        {/* Quick Info Card */}
        {mostUsed && totalUses > 0 && (
          <SectionCard>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground mb-0.5">Most-used template</div>
                  <div className="font-semibold truncate">{mostUsed.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="size-3" />
                      {mostUsed.usageCount?.toLocaleString() ?? 0} uses
                    </span>
                    {mostUsed.category && (
                      <span className="flex items-center gap-1">
                        <Tag className="size-3" />
                        {mostUsed.category}
                      </span>
                    )}
                    {mostUsed.tags && mostUsed.tags.length > 0 && (
                      <span className="flex items-center gap-1">
                        <HashIcon className="size-3" />
                        {mostUsed.tags.length} tags
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(mostUsed)}
                      className="gap-1.5"
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View template content</TooltipContent>
                </Tooltip>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyBody(mostUsed)}
                  className="gap-1.5"
                >
                  {copiedId === mostUsed.id ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Filters Bar */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, content, tags, shortcuts..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            {/* Status Filter */}
            <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shrink-0">
              {([
                { v: "all", l: "All" },
                { v: "active", l: "Active" },
                { v: "inactive", l: "Inactive" },
              ] as const).map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    statusFilter === v
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Filter className="size-3" />
              Categories
            </span>
            <button
              onClick={() => setCategoryFilter(undefined)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all border cursor-pointer",
                !categoryFilter
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              )}
            >
              All
            </button>
            {categories.map((cat) => {
              const count = items.filter((c) => c.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? undefined : cat)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-all border cursor-pointer inline-flex items-center gap-1.5",
                    categoryFilter === cat
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  {cat}
                  <Badge variant="secondary" className={cn(
                    "text-[9px] h-4 px-1 border-none",
                    categoryFilter === cat ? "bg-background/20 text-background" : "bg-muted"
                  )}>
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content list */}
        {isLoading ? (
          <ChartSkeleton height={300} />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onClear={clearFilters}
            onCreate={openCreate}
            canWrite={can("support", "write")}
          />
        ) : (
          <div className="space-y-4">
            {/* Results meta */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
                <span className="font-medium text-foreground">{totalCount}</span> templates
                {hasFilters && " (filtered)"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Hash className="size-3" />
                {new Set(filtered.map((c) => c.category).filter(Boolean)).size} categories
              </span>
            </div>

            {/* Response cards grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <ResponseCard
                  key={c.id}
                  item={c}
                  copiedId={copiedId}
                  canWrite={can("support", "write")}
                  canDelete={can("support", "delete")}
                  onEdit={() => openEdit(c)}
                  onDelete={() => openDelete(c)}
                  onPreview={() => openPreview(c)}
                  onCopy={() => handleCopyBody(c)}
                  onToggle={() => handleToggleActive(c)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Create Dialog ─── */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create canned response</DialogTitle>
              <DialogDescription>
                Build a reusable template. Support agents can insert these into ticket replies instantly.
              </DialogDescription>
            </DialogHeader>
            <CannedForm
              title={formTitle}
              body={formBody}
              category={formCategory}
              shortcut={formShortcut}
              isActive={formIsActive}
              tags={formTags}
              variables={formVariables}
              shortcuts={formShortcuts}
              categories={categories}
              showActive={false}
              onChange={{
                title: setFormTitle,
                body: handleBodyChange,
                category: setFormCategory,
                shortcut: setFormShortcut,
                isActive: setFormIsActive,
                tags: setFormTags,
                variables: setFormVariables,
                shortcuts: setFormShortcuts,
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  createMutation.isPending || !formTitle.trim() || !formBody.trim()
                }
              >
                {createMutation.isPending ? "Creating..." : "Create template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Edit Dialog ─── */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit canned response</DialogTitle>
              <DialogDescription>
                Update this template. Changes take effect immediately.
              </DialogDescription>
            </DialogHeader>
            <CannedForm
              title={formTitle}
              body={formBody}
              category={formCategory}
              shortcut={formShortcut}
              isActive={formIsActive}
              tags={formTags}
              variables={formVariables}
              shortcuts={formShortcuts}
              categories={categories}
              showActive
              onChange={{
                title: setFormTitle,
                body: handleBodyChange,
                category: setFormCategory,
                shortcut: setFormShortcut,
                isActive: setFormIsActive,
                tags: setFormTags,
                variables: setFormVariables,
                shortcuts: setFormShortcuts,
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={
                  updateMutation.isPending || !formTitle.trim() || !formBody.trim()
                }
              >
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Delete Confirmation ─── */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete canned response</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong className="text-foreground">{deletingItem?.title}</strong>? This
                action cannot be undone. Agents will no longer see it in their template
                library.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Preview Dialog ─── */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {previewItem?.title}
                {previewItem?.category && (
                  <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                    <Tag className="size-2.5" />
                    {previewItem.category}
                  </Badge>
                )}
                {previewItem?.shortcuts && previewItem.shortcuts.length > 0 && (
                  <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                    <Link2 className="size-2.5" />
                    /{previewItem.shortcuts[0]}
                    {previewItem.shortcuts.length > 1 && ` +${previewItem.shortcuts.length - 1}`}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {previewItem && (
                  <span className="text-xs">
                    Used {(previewItem.usageCount ?? 0).toLocaleString()} times · Updated{" "}
                    {formatDate(previewItem.updatedAt)}
                    {previewItem.tags && previewItem.tags.length > 0 && (
                      <span className="ml-3 inline-flex items-center gap-1">
                        <Tag className="size-3" />
                        {previewItem.tags.join(", ")}
                      </span>
                    )}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {previewItem && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {previewItem.body}
                </pre>
                {previewItem.variables && previewItem.variables.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 pt-3 border-t">
                    <span className="text-[10px] text-muted-foreground">Variables:</span>
                    {previewItem.variables.map((v) => (
                      <Badge key={v} variant="outline" className="text-[10px] font-mono">
                        <AtSign className="size-2.5 mr-1" />
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                Close
              </Button>
              {previewItem && (
                <Button
                  onClick={() => handleCopyBody(previewItem)}
                  className="gap-1.5"
                >
                  {copiedId === previewItem.id ? (
                    <>
                      <Check className="size-4 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copy to clipboard
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}

/* ─── Empty State ─── */

function EmptyState({
  hasFilters,
  onClear,
  onCreate,
  canWrite,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onCreate: () => void;
  canWrite: boolean;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 p-8 text-center">
      <div className="relative mb-6">
        <div className="size-24 rounded-full bg-primary/5 flex items-center justify-center">
          <ClipboardList className="size-12 text-primary/40" />
        </div>
        {!hasFilters && canWrite && (
          <div className="absolute -bottom-2 -right-2 rounded-full bg-primary p-1.5 shadow-lg">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
        )}
      </div>

      <h3 className="text-xl font-semibold">
        {hasFilters ? "No matching templates" : "No templates yet"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Try adjusting your search or filters."
          : "Create reusable reply templates to help your support team respond faster and more consistently."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {hasFilters ? (
          <Button variant="outline" onClick={onClear} className="gap-2">
            <X className="size-4" />
            Clear filters
          </Button>
        ) : canWrite ? (
          <Button onClick={onCreate} className="gap-2">
            <Plus className="size-4" />
            Create first template
          </Button>
        ) : null}
      </div>

      {!hasFilters && (
        <div className="mt-8 grid gap-3 sm:grid-cols-3 w-full max-w-lg">
          <div className="rounded-lg border bg-background p-3 text-center">
            <Sparkles className="size-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs font-medium">Faster replies</p>
            <p className="text-[10px] text-muted-foreground">Cut typing by 80%</p>
          </div>
          <div className="rounded-lg border bg-background p-3 text-center">
            <Check className="size-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs font-medium">Consistency</p>
            <p className="text-[10px] text-muted-foreground">Standard tone & answers</p>
          </div>
          <div className="rounded-lg border bg-background p-3 text-center">
            <Tag className="size-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs font-medium">Organized</p>
            <p className="text-[10px] text-muted-foreground">Grouped by category</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Response Card ─── */

function ResponseCard({
  item,
  copiedId,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
  onPreview,
  onCopy,
  onToggle,
}: {
  item: CannedResponse;
  copiedId: string | null;
  canWrite: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onCopy: () => void;
  onToggle: () => void;
}) {
  return (
    <SectionCard className="group flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-foreground/20">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg",
                item.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight truncate group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {formatDate(item.updatedAt)}
                {item.tags && item.tags.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Tag className="size-3" />
                      {item.tags.slice(0, 2).join(", ")}
                      {item.tags.length > 2 && ` +${item.tags.length - 2}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
            {item.shortcuts && item.shortcuts.length > 0 && (
              <Badge variant="outline" className="font-mono text-[10px] gap-1 px-1.5 py-0 h-5">
                <Link2 className="size-2.5" />
                /{item.shortcuts[0]}
              </Badge>
            )}
            <Badge
              variant={item.isActive ? "default" : "outline"}
              className={cn(
                "text-[10px]",
                item.isActive
                  ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20"
                  : "text-muted-foreground"
              )}
            >
              {item.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* Body preview */}
        <p className="text-sm text-muted-foreground line-clamp-4 mb-4 whitespace-pre-wrap">
          {item.body}
        </p>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            {item.category && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Tag className="size-3" />
                {item.category}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="size-3" />
              {item.usageCount?.toLocaleString() ?? 0}
            </span>
            {item.variables && item.variables.length > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <AtSign className="size-3" />
                {item.variables.length} vars
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="border-t bg-muted/30 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onPreview}
                className="gap-1.5 h-8 px-2 text-xs hover:bg-background"
              >
                <Eye className="size-3.5" />
                <span className="hidden sm:inline">View</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Preview template</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                className="gap-1.5 h-8 px-2 text-xs hover:bg-background"
              >
                {copiedId === item.id ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {copiedId === item.id ? "Copied" : "Copy"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy message body</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-0.5">
          {canWrite && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-background",
                    item.isActive ? "text-emerald-600" : "text-muted-foreground"
                  )}
                >
                  {item.isActive ? (
                    <Power className="size-3.5" />
                  ) : (
                    <PowerOff className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {item.isActive ? "Mark inactive" : "Mark active"}
              </TooltipContent>
            </Tooltip>
          )}

          {canWrite && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="h-8 w-8 p-0 hover:bg-background hover:text-primary"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit template</TooltipContent>
            </Tooltip>
          )}

          {canDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="h-8 w-8 p-0 hover:bg-background hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete template</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

/* ─── Shared form component ─── */

function CannedForm({
  title,
  body,
  category,
  shortcut,
  isActive,
  tags,
  variables,
  shortcuts,
  categories,
  showActive,
  onChange,
}: {
  title: string;
  body: string;
  category: string;
  shortcut: string;
  isActive: boolean;
  tags: string[];
  variables: string[];
  shortcuts: string[];
  categories: string[];
  showActive: boolean;
  onChange: {
    title: (v: string) => void;
    body: (v: string) => void;
    category: (v: string) => void;
    shortcut: (v: string) => void;
    isActive: (v: boolean) => void;
    tags: (v: string[]) => void;
    variables: (v: string[]) => void;
    shortcuts: (v: string[]) => void;
  };
}) {
  return (
    <div className="space-y-4 py-2">
      {/* Title & Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cr-title">Title *</Label>
          <Input
            id="cr-title"
            value={title}
            onChange={(e) => onChange.title(e.target.value)}
            placeholder="e.g. Welcome reply for new users"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Short, descriptive name agents will see in the template picker.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cr-category">Category</Label>
          <CategoryInput
            value={category}
            onChange={onChange.category}
            categories={categories}
            placeholder="Select or type a category..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cr-shortcut">Slash Shortcut</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
              /
            </span>
            <Input
              id="cr-shortcut"
              value={shortcut}
              onChange={(e) =>
                onChange.shortcut(
                  e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase()
                )
              }
              placeholder="e.g. welcome"
              className="pl-6 font-mono"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Optional. Agents type <code className="font-mono bg-muted rounded px-1">/{shortcut || "..."}</code> to insert.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="cr-body">Message *</Label>
          <span className="text-[11px] text-muted-foreground">
            {body.length} characters
          </span>
        </div>
        <Textarea
          id="cr-body"
          value={body}
          onChange={(e) => onChange.body(e.target.value)}
          placeholder={`Hi {{name}},

Thanks for reaching out! We've received your message and will get back to you shortly.

Best,
The Team`}
          rows={8}
          className="resize-y font-sans leading-relaxed"
        />
        <p className="text-[11px] text-muted-foreground">
          Use placeholders like <code className="font-mono bg-muted rounded px-1">{'{{name}}'}</code> for dynamic values.
        </p>
      </div>

      {/* ─── Collapsible Sections ─── */}
      <div className="space-y-3">
        {/* Tags Section */}
        <CollapsibleSection
          icon={ListChevronsUpDown}
          label="More"
        //badge={tags.length > 0 ? tags.length : undefined}
        >
          <div className="space-y-2 ms-4">
            {/* Tags */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="size-4" />
                Tags
              </Label>
              <TagsInput value={tags} onChange={onChange.tags} />
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AtSign className="size-4" />
                Variables
              </Label>
              <VariablesInput value={variables} onChange={onChange.variables} />
            </div>

            {/* Shortcuts */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="size-4" />
                Shortcuts
              </Label>
              <ShortcutsInput value={shortcuts} onChange={onChange.shortcuts} />
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Active toggle */}
      {showActive && (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Status</div>
            <div className="text-xs text-muted-foreground">
              Inactive templates are hidden from agents but preserved for history.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs font-medium",
                isActive ? "text-emerald-600" : "text-muted-foreground"
              )}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
            <Switch checked={isActive} onCheckedChange={onChange.isActive} />
          </div>
        </div>
      )}
    </div>
  );
}
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWebhookTemplates } from "@/lib/api/hooks";
import type { WebhookTemplate } from "@/lib/api/services";
import {
  LayoutGrid,
  Search,
  Sparkles,
  Check,
  MessageSquare,
  Globe,
  Users,
  FileText,
  Ticket,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplatesPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: WebhookTemplate) => void;
}

const DEFAULT_TEMPLATES: WebhookTemplate[] = [
  {
    id: "builtin-teams-alerts",
    name: "Microsoft Teams Alerts",
    description: "Send critical events to a Teams channel via Adaptive Cards.",
    type: "OUTGOING",
    events: ["ticket.created", "ticket.urgent", "user.deleted"],
    format: "JSON",
    teamsCardType: "ADAPTIVE",
    icon: "teams",
    category: "Messaging",
  },
  {
    id: "builtin-slack-notify",
    name: "Slack Notifications",
    description: "Route content and support events to Slack channels.",
    type: "OUTGOING",
    events: ["article.published", "comment.created", "ticket.replied"],
    format: "JSON",
    icon: "slack",
    category: "Messaging",
  },
  {
    id: "builtin-crm-sync",
    name: "CRM User Sync",
    description: "Mirror user lifecycle events into your CRM endpoint.",
    type: "OUTGOING",
    events: ["user.created", "user.updated", "user.deleted"],
    format: "JSON",
    icon: "crm",
    category: "Integration",
  },
  {
    id: "builtin-content-indexer",
    name: "Search Indexer Webhook",
    description: "Keep external search indices in sync with article changes.",
    type: "OUTGOING",
    events: ["article.published", "article.updated", "article.deleted"],
    format: "JSON",
    icon: "search",
    category: "Integration",
  },
  {
    id: "builtin-support-triage",
    name: "Support Ticket Triage",
    description: "Fan out ticket lifecycle events to triage tooling.",
    type: "OUTGOING",
    events: ["ticket.created", "ticket.assigned", "ticket.closed"],
    format: "JSON",
    icon: "ticket",
    category: "Support",
  },
  {
    id: "builtin-incoming-crm",
    name: "Incoming CRM Webhook",
    description: "Receive contact updates from your CRM as signed payloads.",
    type: "INCOMING",
    events: ["crm.contact.updated"],
    format: "JSON",
    icon: "incoming",
    category: "Integration",
  },
  {
    id: "builtin-incoming-forms",
    name: "Incoming Forms Submission",
    description: "Accept form submissions from marketing landing pages.",
    type: "INCOMING",
    events: ["forms.submitted"],
    format: "FORM",
    icon: "incoming",
    category: "Marketing",
  },
];

function IconFor({ icon, category }: { icon?: string; category: string }) {
  const cls = "size-5";
  switch (icon) {
    case "teams":
      return <Users className={cn(cls, "text-indigo-500")} />;
    case "slack":
      return <MessageSquare className={cn(cls, "text-rose-500")} />;
    case "crm":
      return <FileText className={cn(cls, "text-amber-500")} />;
    case "search":
      return <Search className={cn(cls, "text-sky-500")} />;
    case "ticket":
      return <Ticket className={cn(cls, "text-emerald-500")} />;
    case "incoming":
      return <Globe className={cn(cls, "text-blue-500")} />;
    default:
      return <LayoutGrid className={cn(cls, "text-slate-500")} />;
  }
}

export function TemplatesPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: TemplatesPickerDialogProps) {
  const apiQuery = useWebhookTemplates();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const remote = apiQuery.data ?? [];
  const list: WebhookTemplate[] = remote.length > 0 ? remote : DEFAULT_TEMPLATES;

  const categories = useMemo(() => {
    const set = new Set(list.map((t) => t.category));
    return ["all", ...Array.from(set)];
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.events.some((e) => e.toLowerCase().includes(q))
      );
    });
  }, [list, search, category]);

  const handleConfirm = (tpl: WebhookTemplate) => {
    onSelect(tpl);
    onOpenChange(false);
    setSelected(null);
    setSearch("");
    setCategory("all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            Use a Webhook Template
          </DialogTitle>
          <DialogDescription>
            Kickstart with a preconfigured webhook. You can fine-tune everything after selection.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates by name or event…"
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-44 h-9">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "all" ? "All categories" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {apiQuery.isFetching && (
            <Button variant="ghost" size="icon" disabled className="h-9 w-9">
              <Loader2 className="size-4 animate-spin" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2 pt-3 mt-1">
          {apiQuery.isLoading && !list.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground/60" />
              <p className="text-sm mt-3 text-muted-foreground">Loading templates…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <LayoutGrid className="size-8 text-muted-foreground/40" />
              <p className="text-sm mt-3 text-muted-foreground">No templates match</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
                className="mt-2 gap-1"
              >
                <RefreshCw className="size-3" />
                Reset filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((tpl) => {
                const isSelected = selected === tpl.id;
                return (
                  <Card
                    key={tpl.id}
                    className={cn(
                      "cursor-pointer transition-all select-none",
                      isSelected
                        ? "border-primary ring-1 ring-primary shadow-sm"
                        : "hover:border-muted-foreground/40 hover:shadow-sm",
                    )}
                    onClick={() => setSelected(tpl.id)}
                    onDoubleClick={() => handleConfirm(tpl)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "grid size-10 place-items-center rounded-lg shrink-0 relative",
                            isSelected ? "bg-primary/10" : "bg-muted/60",
                          )}
                        >
                          <IconFor icon={tpl.icon} category={tpl.category} />
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                              <Check className="size-2.5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{tpl.name}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                tpl.type === "INCOMING"
                                  ? "border-blue-500/30 text-blue-500"
                                  : "border-purple-500/30 text-purple-500",
                              )}
                            >
                              {tpl.type === "INCOMING" ? "Incoming" : "Outgoing"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {tpl.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tpl.events.slice(0, 4).map((ev) => (
                          <Badge key={ev} variant="secondary" className="font-mono text-[10px]">
                            {ev}
                          </Badge>
                        ))}
                        {tpl.events.length > 4 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{tpl.events.length - 4}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 mt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {filtered.length} template{filtered.length === 1 ? "" : "s"}
            {selected ? ` · ${selected ? "Selected" : ""}` : ""}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selected}
              onClick={() => {
                const tpl = list.find((t) => t.id === selected);
                if (tpl) handleConfirm(tpl);
              }}
            >
              Use template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

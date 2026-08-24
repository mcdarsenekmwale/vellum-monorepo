import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { WebhookConfig } from "@/lib/api/services";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PlayCircle,
  KeyRound,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Cloud,
  Server,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  MoreHorizontal,
  Copy,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

interface WebhookCardProps {
  webhook: WebhookConfig;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onEdit: (w: WebhookConfig) => void;
  onDelete: (w: WebhookConfig) => void;
  onTest: (w: WebhookConfig) => void;
  onShowSecret: (w: WebhookConfig) => void;
  onToggleActive?: (w: WebhookConfig, next: boolean) => void;
}

function computeSuccessRate(logs: WebhookConfig["logs"]): number | null {
  if (!logs || logs.length === 0) return null;
  const success = logs.filter(
    (l) => l.statusCode && l.statusCode >= 200 && l.statusCode < 300,
  ).length;
  return Math.round((success / logs.length) * 100);
}

export function WebhookCard({
  webhook,
  selected,
  onSelectChange,
  onEdit,
  onDelete,
  onTest,
  onShowSecret,
  onToggleActive,
}: WebhookCardProps) {
  const [copied, setCopied] = useState(false);
  const logs = webhook.logs ?? [];
  const rate = computeSuccessRate(logs);
  const lastLog = logs[0];

  const typeBadge = useMemo(() => {
    if (webhook.type === "INCOMING") {
      return {
        label: "Incoming",
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        icon: <Server className="size-3" />,
      };
    }
    return {
      label: "Outgoing",
      className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      icon: <Cloud className="size-3" />,
    };
  }, [webhook.type]);

  const statusBadge = webhook.isActive
    ? {
        label: "Active",
        className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      }
    : {
        label: "Paused",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(webhook.url);
    setCopied(true);
    toast.success("URL copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card
      className={cn(
        "group relative transition-all",
        selected && "border-primary ring-1 ring-primary shadow-sm",
      )}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          {onSelectChange && (
            <div className="pt-0.5">
              <input
                type="checkbox"
                className="size-4 accent-primary cursor-pointer"
                checked={!!selected}
                onChange={(e) => onSelectChange(e.target.checked)}
                aria-label={`Select ${webhook.name}`}
              />
            </div>
          )}

          <div
            className={cn(
              "grid size-11 place-items-center rounded-lg shrink-0",
              webhook.type === "INCOMING"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-purple-500/10 text-purple-600 dark:text-purple-400",
            )}
          >
            <ArrowRightLeft className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/webhooks/$id"
                params={{ id: webhook.id }}
                className="text-sm font-semibold hover:underline truncate min-w-0"
                title={webhook.name}
              >
                {webhook.name}
              </Link>
              <Badge variant="outline" className={cn("text-[10px] gap-1", typeBadge.className)}>
                {typeBadge.icon}
                {typeBadge.label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", statusBadge.className)}>
                {statusBadge.label}
              </Badge>
              {webhook.teamsCardType && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                >
                  <Users className="size-3" />
                  Teams
                </Badge>
              )}
              {webhook.requiresAuth && webhook.secret && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  title="HMAC signing enabled"
                >
                  <Shield className="size-3" />
                  Signed
                </Badge>
              )}
            </div>

            <button
              type="button"
              onClick={copyUrl}
              className="group/url mt-1 w-full text-left"
              title="Click to copy URL"
            >
              <code className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono truncate max-w-full group-hover/url:text-foreground">
                <span className="truncate">{webhook.url}</span>
                {copied ? (
                  <Check className="size-3 shrink-0 text-emerald-500" />
                ) : (
                  <Copy className="size-3 shrink-0 opacity-0 group-hover/url:opacity-100 transition-opacity" />
                )}
              </code>
            </button>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {webhook.events.slice(0, 4).map((ev) => (
                <Badge key={ev} variant="secondary" className="font-mono text-[10px]">
                  {ev}
                </Badge>
              ))}
              {webhook.events.length > 4 && (
                <Badge variant="outline" className="text-[10px]">
                  +{webhook.events.length - 4}
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 -mr-1">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onTest(webhook)}>
                <PlayCircle className="size-3.5 mr-2" />
                Send test
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(webhook)}>
                <Pencil className="size-3.5 mr-2" />
                Edit config
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShowSecret(webhook)}>
                <KeyRound className="size-3.5 mr-2" />
                View secret
              </DropdownMenuItem>
              {onToggleActive && (
                <DropdownMenuItem onClick={() => onToggleActive(webhook, !webhook.isActive)}>
                  {webhook.isActive ? (
                    <>
                      <XCircle className="size-3.5 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5 mr-2" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(webhook)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/20 p-3">
          <div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3" />
              Last run
            </div>
            <div className="mt-0.5 text-sm font-medium tabular-nums">
              {webhook.lastTriggeredAt
                ? formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })
                : lastLog
                  ? formatDistanceToNow(new Date(lastLog.createdAt), { addSuffix: true })
                  : "Never"}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {rate === null || rate >= 80 ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <XCircle className="size-3 text-rose-500" />
              )}
              Success rate
            </div>
            <div
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                rate === null && "text-muted-foreground",
                rate !== null && rate < 80 && "text-rose-600 dark:text-rose-400",
                rate !== null && rate >= 80 && rate < 95 && "text-amber-600 dark:text-amber-400",
                rate !== null && rate >= 95 && "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {rate === null ? "—" : `${rate}%`}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Failures
            </div>
            <div
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                (webhook.failureCount ?? 0) > 0 && "text-rose-600 dark:text-rose-400",
              )}
            >
              {webhook.failureCount ?? 0}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1"
            onClick={() => onTest(webhook)}
          >
            <PlayCircle className="size-3.5" />
            Test
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => onEdit(webhook)}
            asChild
          >
            <Link to="/webhooks/$id" params={{ id: webhook.id }}>
              Details
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

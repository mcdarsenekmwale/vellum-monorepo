import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "destructive" | "info" | "muted";

const TONE: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
  muted: "bg-muted text-muted-foreground",
};

const MAP: Record<string, Tone> = {
  active: "success",
  published: "success",
  success: "success",
  sent: "success",
  resolved: "success",
  visible: "success",
  running: "info",
  reviewing: "info",
  scheduled: "info",
  invited: "info",
  draft: "muted",
  paused: "warning",
  flagged: "warning",
  open: "warning",
  suspended: "warning",
  medium: "warning",
  high: "destructive",
  critical: "destructive",
  failed: "destructive",
  failing: "destructive",
  banned: "destructive",
  revoked: "destructive",
  hidden: "muted",
  dismissed: "muted",
  archived: "muted",
  completed: "muted",
  low: "muted",
};

export function StatusBadge({ status, size }: { status: string; size?: any; short?: boolean }) {
  const tone = MAP[status.toLowerCase()] ?? "default";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        TONE[tone],
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "destructive" && "bg-destructive",
          tone === "info" && "bg-info",
          tone === "muted" && "bg-muted-foreground/50",
          tone === "default" && "bg-foreground/40",
        )}
      />
      {status}
    </span>
  );
}

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolCallCardProps {
  name: string;
  arguments: Record<string, any>;
  requiresConfirmation: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  acknowledged?: boolean;
}

export function ToolCallCard({
  name,
  arguments: args,
  requiresConfirmation,
  onConfirm,
  onCancel,
  acknowledged,
}: ToolCallCardProps) {
  const prettyArgs = JSON.stringify(args, null, 2);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {requiresConfirmation ? (
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          )}
          <span className="text-sm font-medium">Tool call: {name}</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[10px] uppercase tracking-wider",
            requiresConfirmation
              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {acknowledged ? "Used" : requiresConfirmation ? "Awaiting approval" : "Auto-approved"}
        </Badge>
      </div>

      <pre className="overflow-x-auto rounded-md bg-background/60 border p-2.5 text-[11px] font-mono leading-relaxed text-muted-foreground max-h-40">
        {prettyArgs}
      </pre>

      {requiresConfirmation ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <X className="size-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <CheckCircle2 className="size-3.5" />
            Confirm
          </Button>
        </div>
      ) : (
        !acknowledged && (
          <div className="flex items-center justify-end pt-1">
            <Badge variant="secondary" className="text-[10px] gap-1">
              <CheckCircle2 className="size-3" />
              Used tool: {name} (ok)
            </Badge>
          </div>
        )
      )}
    </div>
  );
}

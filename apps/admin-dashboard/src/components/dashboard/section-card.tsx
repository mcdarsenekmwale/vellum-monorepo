import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  action,
  actions,
  children,
  className,
  padded = true,
  onClick,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  /** Convenience alias for `action` — typically a flex row of buttons. If both are set, `actions` wins. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  onClick?: () => void;
}) {
  const headerAction = actions ?? action;
  return (
    <div className={cn("surface-card", className)} >
      {(title || headerAction) && (
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" onClick={onClick}>
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold">{title}</div>}
            {description && (
              <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
            )}
          </div>
          {headerAction}
        </div>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </div>
  );
}

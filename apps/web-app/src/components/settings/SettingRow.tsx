import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingRow({
  icon: Icon,
  label,
  description,
  right,
  to,
  onClick,
  iconBgClass = "bg-muted text-foreground",
  dataTestId,
  interactive = true,
}: {
  icon?: LucideIcon;
  label: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  to?: string;
  onClick?: () => void;
  iconBgClass?: string;
  dataTestId?: string;
  interactive?: boolean;
}) {
  const body = (
    <div className="flex items-center gap-4 w-full px-4 py-3">
      {Icon && (
        <span
          className={cn(
            "size-10 shrink-0 grid place-items-center rounded-xl",
            iconBgClass,
          )}
        >
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 text-muted-foreground text-sm">
        {right}
        {(to || onClick) && (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
        )}
      </div>
    </div>
  );
  const className = cn(
    "w-full block text-left transition-colors border-b border-border/70 last:border-b-0",
    interactive && "hover:bg-muted/70 cursor-pointer",
  );

  const dataAttrs = { "data-testid": dataTestId };

  if (to) {
    return (
      <Link to={to} className={className} {...dataAttrs}>
        {body}
      </Link>
    );
  }
  // ─── onClick rendering: use <div role="button"> instead of native <button> ───
  // Rationale: rows often contain nested interactive children (RowSwitch toggles,
  // sheets, etc). HTML forbids <button> containing any other interactive element,
  // which triggers React hydration warnings: "<button> cannot be a descendant of
  // <button>". A div with ARIA role=button + keyboard affordances (Enter/Space) is
  // spec-compliant accessible and allows arbitrary interactive content inside.
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };
  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={handleKey}
      className={cn(className, !onClick && interactive && "cursor-default")}
      {...dataAttrs}
    >
      {body}
    </div>
  );
}

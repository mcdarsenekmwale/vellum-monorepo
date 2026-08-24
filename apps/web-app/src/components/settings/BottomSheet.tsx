import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
  dataTestId,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  dataTestId?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
      data-testid={dataTestId ?? "bottom-sheet"}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative z-10 w-full md:max-w-lg bg-background md:rounded-2xl rounded-t-2xl shadow-xl border border-border md:my-8 animate-in",
          className,
        )}
      >
        {(title || (typeof onClose === "function")) && (
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div className="flex-1 min-w-0 pr-3">
              {title && (
                <h3 className="font-semibold text-foreground text-lg">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="size-9 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
              aria-label="Close"
              data-testid="bottom-sheet-close"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

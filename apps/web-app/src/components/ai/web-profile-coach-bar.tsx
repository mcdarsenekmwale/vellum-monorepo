import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AISnapshot } from './use-ai-snapshot';

interface AiWebProfileCoachBarProps {
  snapshot: AISnapshot;
  snapshotLoading: boolean;
  isOwner: boolean;
  showInsightPill?: boolean;
  onOpenDrawer: () => void;
  className?: string;
}

/**
 * Compact vertical coach bar for narrow sidebars.
 * Stacks icon/title, insight pill, and CTA vertically to prevent overflow.
 */
export function AiWebProfileCoachBar({
  snapshot,
  snapshotLoading,
  isOwner,
  showInsightPill = false,
  onOpenDrawer,
  className,
}: AiWebProfileCoachBarProps) {
  const handleSecondaryClick = () => {
    const redirect = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    window.location.assign(`/login?redirect=${redirect}`);
  };

  return (
    <div
      role="region"
      aria-label="AI profile coach"
      className={cn(
        'relative flex flex-col gap-2.5 w-full rounded-lg border border-border/70',
        'bg-gradient-to-r from-emerald-500/5 via-card to-sky-500/5',
        'p-3 shadow-sm',
        className,
      )}
    >
      {/* Decorative top accent line */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent rounded-t-xl"
      />

      {/* ─── Top: icon + title ─── */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center size-8 rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">
          <Sparkles className="size-4" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="font-semibold text-sm text-foreground truncate">
            Vell AI Coach
          </span>
          <span className="text-[11px] text-muted-foreground truncate" title={snapshot.insightText}>
            Personalized growth insights
          </span>
        </div>
      </div>

      {/* ─── Middle: insight pill ─── */}
      {showInsightPill && (
        <>
          <hr />
          <div className="min-w-0">
            {snapshotLoading ? (
              <div
                aria-hidden
                className="h-5 w-full rounded-full bg-muted animate-pulse"
              />
            ) : (
              <div
                className={cn(
                  'inline-flex items-center w-full rounded-full',
                  'border border-sky-200/70 bg-sky-50',
                  'px-2.5 py-1',
                  'dark:bg-sky-950/30 dark:border-sky-800/50',
                )}
                title={snapshot.insightText}
              >
                <span className="inline-flex items-baseline gap-1.5 min-w-0">
                  <span className="not-italic font-semibold shrink-0 text-[11px] text-sky-700 dark:text-sky-300">
                    💡
                  </span>
                  <span className="truncate text-[11px] italic text-sky-700 dark:text-sky-300" title={snapshot.insightText}>
                    {snapshot.insightText}
                  </span>
                </span>
              </div>
            )}

            {!snapshotLoading && snapshot.freshnessLabel && (
              <div className="my-1 text-[8px] uppercase tracking-wider text-muted-foreground/80 truncate">
                {snapshot.freshnessLabel}
              </div>
            )}
          </div>

          {/* ─── Bottom: CTA ─── */}
          <div className="pt-0.5">
            {isOwner ? (
              <Button
                variant="default"
                size="sm"
                onClick={onOpenDrawer}
                className="w-full bg-emerald-600 hover:bg-emerald-600/90 text-white shadow-sm text-xs h-8"
              >
                <Sparkles className="size-3.5 mr-1.5" aria-hidden />
                Ask Coach
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSecondaryClick}
                className="w-full text-xs h-8"
              >
                <Sparkles className="size-3.5 mr-1.5" aria-hidden />
                Ask AI
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
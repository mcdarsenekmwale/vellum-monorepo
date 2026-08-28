import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AISnapshot } from './use-ai-snapshot';

interface AiWebProfileCoachBarProps {
  snapshot: AISnapshot;
  snapshotLoading: boolean;
  isOwner: boolean;
  onOpenDrawer: () => void;
  className?: string;
}

/**
 * Native inline coach bar placed *above* the profile name + settings row
 * (literal DOM-order requirement). Three horizontal zones:
 *   L : Sparkles icon + "Vell AI Coach" title + muted subtitle
 *   M : Insight pill (sky badge, truncating italic, skeleton on loading)
 *   R : CTA button (owner → Ask Coach / guest → login-required variant)
 */
export function AiWebProfileCoachBar({
  snapshot,
  snapshotLoading,
  isOwner,
  onOpenDrawer,
  className,
}: AiWebProfileCoachBarProps) {
  const handleSecondaryClick = () => {
    // Not the profile owner – send to login with return URL.
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?redirect=${redirect}`);
  };

  return (
    <div
      role="region"
      aria-label="AI profile coach"
      className={cn(
        'relative flex items-center gap-3 w-full rounded-xl border border-border/70 bg-gradient-to-r from-emerald-500/5 via-card to-sky-500/5 px-4 py-3 shadow-sm',
        className,
      )}
    >
      {/* Decorative top accent line */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent rounded-t-xl"
      />

      {/* ─── Left: icon + title + subtitle ─── */}
      <div className="flex items-center shrink-0 pr-2">
        <div className="flex items-center justify-center size-10 rounded-full bg-emerald-500/10 text-emerald-600 mr-3">
          <Sparkles className="size-5" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-[15px] text-foreground">
            Vell AI Coach
          </span>
          <span className="text-xs text-muted-foreground ml-0 mt-0.5">
            Personalized growth insights
          </span>
        </div>
      </div>

      {/* ─── Middle: insight pill ─── */}
      <div className="flex-1 min-w-0 px-2">
        {snapshotLoading ? (
          <div
            aria-hidden
            className="h-6 w-full max-w-[320px] rounded-full bg-muted animate-pulse"
          />
        ) : (
          <div
            className={cn(
              'inline-flex items-center max-w-full rounded-full border border-sky-200/70 bg-sky-50 px-3 py-1 dark:bg-sky-950/30 dark:border-sky-800/50',
            )}
            title={snapshot.insightText}
          >
            <span
              className={cn(
                'inline-flex items-baseline gap-1.5 text-[11px] italic text-sky-700 dark:text-sky-300',
              )}
            >
              <span className="not-italic font-semibold shrink-0">💡</span>
              <span className="truncate">{snapshot.insightText}</span>
            </span>
          </div>
        )}
        {!snapshotLoading && (
          <div className="mt-1 pl-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {snapshot.freshnessLabel}
          </div>
        )}
      </div>

      {/* ─── Right: CTA ─── */}
      <div className="shrink-0 pl-2">
        {isOwner ? (
          <Button
            variant="default"
            size="sm"
            onClick={onOpenDrawer}
            className="bg-emerald-600 hover:bg-emerald-600/90 text-white shadow-sm"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Ask Coach
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSecondaryClick}
          >
            <Sparkles className="size-3.5" aria-hidden />
            Ask AI about your content
          </Button>
        )}
      </div>
    </div>
  );
}

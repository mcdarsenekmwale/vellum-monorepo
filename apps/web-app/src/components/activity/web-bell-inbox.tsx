import { Bell } from 'lucide-react';
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  Component,
  type MutableRefObject,
  type RefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useActivitySse } from './web-activity-sse';
import {
  useMarkWebActivityRead,
  useWebActivityFeed,
  useWebActivityUnread,
} from '../../lib/api/hooks';
import { WebActivityCard } from './web-activity-card';
import type { WebActivityFeed, WebActivityGroup } from '../../lib/api/services';

/* ──────────────────────────────────────────────────────────────────
   WebBellInbox – global Instagram-style bell inbox panel.
   Mounted left of the header avatar in WebShell.tsx (far-right column
   of the top bar). Builds a CUSTOM popover shell because web-app's
   shadcn/ui ships without Popover/Dropdown/Badge primitives (matches
   Sub-project B's AiDrawerShell approach).

   CRITICAL RENDER GUARANTEE (P1 flow-F12 "Bell not visible" fix):
   Wrapped in <BellErrorBoundary> so ANY throw in the inbox data
   pipeline (hook, SSE, items iteration …) is caught and the bell
   icon button is still rendered in the WebShell header. Without this
   boundary React unmounts the entire WebBellInbox subtree on crash,
   leaving no bell button for the QA driver to find.
   ────────────────────────────────────────────────────────────────── */

class BellErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.warn('[BellErrorBoundary] caught render error, degrading to bell only:', err);
  }
  render() {
    if (this.state.hasError) {
      // ─── Degraded: bare bell icon (no inbox / badge) but still clickable ───
      return (
        <button
          type="button"
          aria-label="Notifications"
          aria-haspopup="dialog"
          onClick={() => toast.message('Notifications unavailable', { description: 'Refresh the page to try again.' })}
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-slate-600 hover:text-slate-900 hover:bg-accent/10 transition"
        >
          <Bell className="w-5 h-5" strokeWidth={1.8} />
        </button>
      );
    }
    return this.props.children;
  }
}

export function WebBellInbox() {
  const [open, setOpen] = useState(false);

  // ─── Unread count badge (polls every 15s when mounted) ───
  const { data: unreadData } = useWebActivityUnread({
    enabled: true,
    refetchInterval: 15_000,
  });
  const unread = unreadData?.unread ?? 0;

  // ─── Paginated feed (cursor-based) ───
  const feedQuery = useWebActivityFeed({ limit: 20 });
  const items = feedQuery.items ?? [];
  const hasMore = Boolean(feedQuery.hasMore);
  const isLoadingMore = Boolean(feedQuery.isLoadingMore) && items.length > 0;
  const isInitialLoading = Boolean(feedQuery.isLoading) && items.length === 0;

  // ─── Mark-all-read mutation (toasts on success) ───
  const markAll = useMarkWebActivityRead({
    onSuccess: () => toast.success('Marked all as read'),
  });
  const markSingle = useMarkWebActivityRead();

  // ─── SSE stream – only while panel is open (Saves bandwidth) ───
  const sse = useActivitySse(open);
  const lastSseTsRef = useRef(0);
  useEffect(() => {
    const latest = sse.events[0];
    if (!latest) return;
    // Debounce refetches: at most once per 750ms
    const now = Date.now();
    if (now - lastSseTsRef.current < 750) return;
    lastSseTsRef.current = now;

    // Refetch unread immediately, feed with a small delay to let BE persist
    if (latest.type === 'activity' || latest.type === 'unread' || latest.type === 'hello') {
      void feedQuery.refetch();
    }
  }, [sse.events[0], feedQuery]);

  // ─── IntersectionObserver for infinite scroll ───
  const lastObserverTarget = useRef<HTMLDivElement | null>(null);
  useIntersectionObserver(lastObserverTarget, (entry) => {
    if (entry.isIntersecting && hasMore && !isLoadingMore) {
      feedQuery.loadNext();
    }
  });

  const hasUnread = items.some((i) => !i.read) || unread > 0;
  const badgeText =
    unread >= 100 ? '99+' : unread > 0 ? String(unread) : null;

  const handleCardClick = useCallback(
    (item: WebActivityGroup) => {
      // 1) Optimistically mark single as read
      markSingle.mutate({ ids: [item.id] });

      // 2) Resolve deep-link target
      const target =
        item.linkHref ||
        (item.articleSlug ? `/article/${item.articleSlug}` : null) ||
        (item.highlightId ? `/h/${item.highlightId}` : null) ||
        (item.commentId && item.articleSlug
          ? `/article/${item.articleSlug}#comment-${item.commentId}`
          : null) ||
        '/notifications';

      // 3) Navigate after a tiny tick so the read mutation can fire
      window.setTimeout(() => {
        setOpen(false);
        window.location.assign(target);
      }, 50);
    },
    [markSingle],
  );

  // ─── Render ───────────────────────────────────────────────────
  // P1 flow-F12: wrap output in BellErrorBoundary so bell button always
  // renders in the header even if downstream data pipeline throws.
  return (
    <BellErrorBoundary>
      <>
        {/* ─── Bell Button ─────────────────────────────────────── */}
        <button
          type="button"
          aria-label={
            unread
              ? `Notifications (${unread} unread)`
              : 'Notifications'
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-slate-600 hover:text-slate-900 hover:bg-accent/10 transition"
        >
          <Bell
            className={cn(
              'w-5 h-5',
              unread > 0 && 'animate-[bell-ring_1.8s_ease-in-out_infinite]',
            )}
            strokeWidth={1.8}
          />
          {badgeText && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold ring-2 ring-white',
              )}
            >
              {badgeText}
            </span>
          )}
        </button>

        {/* ─── Popover Panel (portal to body for z-index) ──────── */}
        {open && typeof document !== 'undefined'
          ? createPortal(
              <InboxPanel
                items={items}
                totalUnread={unread}
                hasUnread={hasUnread}
                hasMore={hasMore}
                loadingMore={isLoadingMore}
                initialLoading={isInitialLoading}
                onMarkAll={() => markAll.mutate({ all: true })}
                onCardClick={handleCardClick}
                onClose={() => setOpen(false)}
                lastRef={lastObserverTarget}
              />,
              document.body,
            )
          : null}

        {/* Bell ring keyframes (Tailwind arbitrary animation name above) */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              '@keyframes bell-ring{0%,100%{transform:rotate(0)}10%,30%{transform:rotate(14deg)}20%,40%{transform:rotate(-14deg)}50%{transform:rotate(8deg)}60%{transform:rotate(-8deg)}70%{transform:rotate(4deg)}80%{transform:rotate(-4deg)}}',
          }}
        />
      </>
    </BellErrorBoundary>
  );
}

/* ─── Inbox Panel (custom popover shell, NO shadcn Popover) ──────── */

interface InboxPanelProps {
  items: WebActivityGroup[];
  totalUnread: number;
  hasUnread: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  initialLoading: boolean;
  onMarkAll: () => void;
  onCardClick: (item: WebActivityGroup) => void;
  onClose: () => void;
  lastRef: MutableRefObject<HTMLDivElement | null>;
}

function InboxPanel(props: InboxPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(panelRef, props.onClose);

  // Escape key closes the panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') props.onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props.onClose]);

  return (
    <div
      className="fixed inset-0 z-[100]"
      onClick={props.onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Transparent backdrop – close handled by useClickOutside + escape */}
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute right-4 sm:right-6 top-[68px] w-[320px] rounded-2xl shadow-2xl bg-white ring-1 ring-slate-200 overflow-hidden"
        style={{
          animation:
            'bellIn 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {/* ─── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Notifications
            </h3>
            {props.totalUnread > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-sky-50 text-sky-600 text-[10px] font-semibold">
                {props.totalUnread > 99 ? '99+' : props.totalUnread}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={!props.hasUnread}
            onClick={props.onMarkAll}
            className="text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Mark all read
          </button>
        </div>

        {/* ─── Scroll body (max 480px) ───────────────────── */}
        <div
          className="max-h-[480px] overflow-y-auto"
          // Snap: always start at top when opening
        >
          {props.initialLoading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <div className="inline-block w-5 h-5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin mb-3" />
              <div>Loading…</div>
            </div>
          ) : props.items.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {props.items.map((it, idx) => (
                <div
                  key={it.id}
                  ref={
                    idx === props.items.length - 1
                      ? (el: HTMLDivElement | null) => {
                          props.lastRef.current = el;
                        }
                      : undefined
                  }
                >
                  <WebActivityCard
                    item={it}
                    onClick={() => props.onCardClick(it)}
                  />
                  {idx < props.items.length - 1 && (
                    <div className="mx-3 h-px bg-slate-100" />
                  )}
                </div>
              ))}
              <div className="py-3 text-center text-[11px] text-slate-400">
                {props.loadingMore ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 border border-slate-200 border-t-slate-400 rounded-full animate-spin" />
                    Loading…
                  </span>
                ) : props.hasMore ? (
                  'Scroll for more'
                ) : (
                  '— End of feed —'
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Panel pop-in keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            '@keyframes bellIn{from{opacity:0;transform:translateY(-8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
        }}
      />
    </div>
  );
}

/* ─── Empty State (Instagram-style) ──────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4 ring-4 ring-emerald-50/50">
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          className="text-emerald-500"
        >
          <path
            d="M20 6L9 17L4 12"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-800">
        You&apos;re all caught up ✨
      </p>
      <p className="mt-1.5 text-xs text-slate-500 max-w-[240px] leading-relaxed">
        We&apos;ll let you know when something happens — likes, comments,
        follows, and mentions.
      </p>
    </div>
  );
}

/* ─── Helper Hooks ────────────────────────────────────────────────── */

/**
 * Close the panel when the user clicks outside its bounds.
 * Adapted from Sub-project B's AiDrawerShell + useClickOutside pattern.
 */
function useClickOutside(
  ref: RefObject<HTMLDivElement | null>,
  handler: () => void,
) {
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      // Only close if the mousedown is on a non-interactive backdrop area
      handler();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [ref, handler]);
}

/**
 * Fire a callback when the target element intersects the viewport by 50%.
 * Used for infinite-scroll cursor paging.
 */
function useIntersectionObserver(
  targetRef: MutableRefObject<HTMLDivElement | null>,
  onIntersect: (entry: IntersectionObserverEntry) => void,
) {
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry) onIntersect(entry);
      },
      { root: null, threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [targetRef.current, onIntersect]);
}

// Silence unused-import warning for WebActivityFeed type alias (kept for future)
export type { WebActivityFeed };

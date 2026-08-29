import type { WebActivityGroup } from '../../lib/api/services';
import { cn } from '../../lib/utils';

interface Props {
  item: WebActivityGroup;
  onClick?: () => void;
}

export function WebActivityCard({ item, onClick }: Props) {
  const timeRel = relativeTime(item.latestActivityAt);
  const upTo5 = (item.actors ?? []).slice(0, 5);
  const declaredExtra = item.extraActorCount ?? 0;
  const implicitExtra = Math.max(0, (item.actors?.length ?? 0) - 5);
  const extra = declaredExtra || implicitExtra;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors border-l-[8px] relative select-none',
        item.read
          ? 'border-transparent'
          : 'border-sky-100 bg-sky-50/30',
      )}
    >
      <AvatarCluster actors={upTo5} extra={extra} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug text-slate-900 line-clamp-2">
          {item.previewText || 'New activity'}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">{timeRel}</p>
      </div>
      {!item.read && (
        <span
          className="mt-1.5 w-2 h-2 rounded-full bg-sky-500 shrink-0"
          aria-label="unread"
        />
      )}
    </div>
  );
}

/* ─── Avatar Cluster (Instagram-style overlap with +N bubble) ─── */

function AvatarCluster({
  actors,
  extra,
}: {
  actors: Array<{
    avatar?: string | null;
    name?: string | null;
    handle?: string | null;
    id: string;
  }>;
  extra: number;
}) {
  return (
    <div className="flex items-center shrink-0 pl-0.5 min-w-[56px] h-9">
      {actors.map((a, i) => (
        <div
          key={a.id + '-' + i}
          className="rounded-full w-8 h-8 bg-slate-200 ring-2 ring-white overflow-hidden -ml-1.5 first:ml-0"
          style={{ zIndex: 10 - i }}
        >
          {a.avatar ? (
            <img
              src={a.avatar}
              className="w-full h-full object-cover"
              alt=""
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-[11px] text-slate-600 font-medium">
              {(
                (a.name || a.handle || '?')[0] || '?'
              ).toUpperCase()}
            </span>
          )}
        </div>
      ))}
      {extra > 0 && (
        <div
          className="rounded-full w-8 h-8 ring-2 ring-white -ml-1.5 bg-slate-900 text-white text-[11px] flex items-center justify-center font-semibold"
          style={{ zIndex: 0 }}
        >
          +{extra > 99 ? '99' : extra}
        </div>
      )}
    </div>
  );
}

/* ─── Helper ─── */

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!then || Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
}

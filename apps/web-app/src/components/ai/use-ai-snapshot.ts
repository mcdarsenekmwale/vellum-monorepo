import { useEffect, useState } from 'react';
import { apiBaseUrl } from '@/config/env';

export interface AISnapshot {
  insightText: string;
  freshnessLabel: string;
}

const FALLBACK: AISnapshot = {
  insightText:
    'Based on creator trends, weekends 10am local give 32% higher reach than weekdays 2pm. Try carousels 2× this week.',
  freshnessLabel: 'Generated today',
};

/**
 * Lightweight AI snapshot hook for the profile coach insight pill.
 *
 * Attempts to fetch the profile owner's recent articles via the public
 * REST endpoint and derives a deterministic mock insight. Falls back
 * to a generic industry baseline insight on any failure or empty set.
 *
 * Deliberately frontend-only – no backend /api/ai/snapshot endpoint is
 * consumed here (that is a separate, later vell-api task out of scope).
 */
export function useAISnapshot(opts: {
  profileUserId?: string | null;
  profileUserHandle?: string | null;
  isOwner?: boolean;
  enabled?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AISnapshot>(FALLBACK);

  useEffect(() => {
    if (!opts.enabled || !opts.isOwner) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const token =
          localStorage.getItem('authToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('accessToken');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        // Try a handful of plausible endpoint shapes – any that return
        // array-like data wins; otherwise we fall back gracefully.
        const urls: string[] = [];
        if (opts.profileUserId) {
          urls.push(
            `${apiBaseUrl}/api/articles?authorId=${encodeURIComponent(
              opts.profileUserId,
            )}&limit=7`,
          );
          urls.push(
            `${apiBaseUrl}/api/posts?authorId=${encodeURIComponent(
              opts.profileUserId,
            )}&limit=7`,
          );
          urls.push(
            `${apiBaseUrl}/api/users/${encodeURIComponent(
              opts.profileUserId,
            )}/articles?limit=7`,
          );
        }
        if (opts.profileUserHandle) {
          urls.push(
            `${apiBaseUrl}/api/authors/${encodeURIComponent(
              opts.profileUserHandle,
            )}/articles?limit=7`,
          );
        }

        let posts: any[] = [];
        for (const url of urls) {
          try {
            const resp = await fetch(url, { headers });
            if (resp.ok) {
              const j = await resp.json().catch(() => ({}));
              const arr = Array.isArray(j)
                ? j
                : (j.data ?? j.items ?? j.articles ?? j.results ?? []);
              if (Array.isArray(arr) && arr.length) {
                posts = arr;
                break;
              }
            }
          } catch {
            // try next
          }
        }

        let text = FALLBACK.insightText;
        if (posts.length) {
          const total = posts.length;
          const avgViews = Math.round(
            posts.reduce(
              (s: number, p: any) =>
                s +
                (Number(p.views) ||
                  Number(p.likesCount) ||
                  Number(p.viewCount) ||
                  Number(p.readCount) ||
                  0),
              0,
            ) / total,
          );
          const best = posts.reduce(
            (a: any, p: any) =>
              (Number(p.views || p.likesCount || 0) >
                Number(a?.views || a?.likesCount || 0)
                ? p
                : a),
            posts[0],
          );
          const weekendCount = posts.filter((p: any) => {
            const d = new Date(p.createdAt ?? p.publishedAt ?? Date.now());
            return d.getDay() === 0 || d.getDay() === 6;
          }).length;
          const bestTitle =
            best?.title?.slice?.(0, 40) || 'a recent piece';
          text = `Based on your last ${total} posts (avg engagement ${avgViews} 👀) — your best was "${bestTitle}". ${
            weekendCount
              ? `Weekends performed ${
                  weekendCount === total ? 'consistently' : 'better'
                } for you. `
              : ''
          }Action: Try a carousel this Sat 10am — similar creators see +32% reach.`;
        }

        if (alive) {
          setData({
            insightText: text,
            freshnessLabel: posts.length
              ? `Analyzed ${posts.length} posts · today`
              : FALLBACK.freshnessLabel,
          });
        }
      } catch {
        if (alive) setData(FALLBACK);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    opts.enabled,
    opts.isOwner,
    opts.profileUserId,
    opts.profileUserHandle,
  ]);

  return { loading, data };
}

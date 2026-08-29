// ============================================================================
// Sub-project C: Activity feed (web-app) — types + services
// ============================================================================

export type WebActivityKind =
  | 'LIKE'
  | 'COMMENT'
  | 'REPLY'
  | 'FOLLOW'
  | 'MENTION'
  | 'BOOKMARK'
  | 'SYSTEM'
  | 'SHARE';

export interface WebActivityActor {
  id: string;
  handle?: string | null;
  name?: string | null;
  avatar?: string | null;
}

export interface WebActivityGroup {
  id: string;
  kind: WebActivityKind;
  count: number;
  previewText: string | null;
  articleSlug: string | null;
  highlightId: string | null;
  commentId: string | null;
  linkHref: string | null;
  read: boolean;
  readAt: string | null;
  latestActivityAt: string;
  actors: WebActivityActor[];
  extraActorCount: number;
}

export interface WebActivityFeed {
  items: WebActivityGroup[];
  total: number;
  unread: number;
  pageInfo: { hasMore: boolean; nextBefore: string | null };
}

// === TOKEN HELPER: exactly matches vellbase_access_token priority (Sub-project B pattern, use-ai-snapshot.ts L44-49) ===
export function webActivityGetBearer(): string {
  // Copy of the chain used in src/components/ai/use-ai-snapshot.ts lines 44-49 (verbatim order):
  const token =
    (() => {
      try {
        return localStorage.getItem('vellbase_access_token');
      } catch {
        return null;
      }
    })() ||
    (() => {
      try {
        return localStorage.getItem('authToken');
      } catch {
        return null;
      }
    })() ||
    (() => {
      try {
        return localStorage.getItem('token');
      } catch {
        return null;
      }
    })() ||
    (() => {
      try {
        return localStorage.getItem('accessToken');
      } catch {
        return null;
      }
    })();

  return token || '';
}

function withBearer(
  headersInit: Record<string, string> = {},
): Record<string, string> {
  const token = webActivityGetBearer();
  if (!token) return headersInit;
  return { ...headersInit, Authorization: `Bearer ${token}` };
}

async function httpFetch<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, any>,
): Promise<T> {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV
      ? 'http://localhost:3001'
      : 'https://ffzjnfcr4yvv2rn311ybs5tf.ewr.prisma.build');
  const qs = query
    ? '?' + new URLSearchParams(query as any).toString()
    : '';
  const base = apiBaseUrl + '/api';
  const url = path.startsWith('http')
    ? path + qs
    : `${base}${path.startsWith('/') ? path : '/' + path}${qs}`;
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: withBearer((init?.headers as any) || {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json')
    ? res.json()
    : (res.text() as any);
}

export async function getWebActivityFeed(opts?: {
  limit?: number;
  before?: string;
  onlyUnread?: boolean;
}): Promise<WebActivityFeed> {
  return httpFetch<WebActivityFeed>('/activity/feed', {}, opts);
}

export async function getWebActivityUnread(): Promise<{ unread: number }> {
  return httpFetch<{ unread: number }>('/activity/unread-count');
}

export async function markWebActivityRead(opts: {
  ids?: string[];
  all?: boolean;
}): Promise<{ unread: number }> {
  return httpFetch<{ unread: number }>(
    '/activity/read',
    {
      method: 'POST',
      body: JSON.stringify(opts),
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export async function dismissWebActivitySingle(
  id: string,
): Promise<{ ok: boolean; unread: number }> {
  return httpFetch<{ ok: boolean; unread: number }>(`/activity/${id}`, {
    method: 'DELETE',
  });
}

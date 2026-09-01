import { useEffect, useRef, useState } from 'react';
import { webActivityGetBearer } from '../../lib/api/services';

export interface SseActivityEvent {
  type: 'activity';
  id: string;
  kind: string;
}
export interface SseUnreadEvent {
  type: 'unread';
  unread: number;
}
export type SseEvent =
  | SseActivityEvent
  | SseUnreadEvent
  | { type: 'hello'; unread: number }
  | { type: 'ping' };

/**
 * Browser-native EventSource hook for the activity SSE stream.
 *
 * Authentication priority:
 * 1. Bearer token from vellbase_access_token chain → passed as ?token query
 *    (EventSource cannot set custom headers, so query fallback is mandatory)
 * 2. withCredentials: true for session cookies (passthrough)
 */
export function useActivitySse(enabled: boolean) {
  const [events, setEvents] = useState<SseEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    const token = webActivityGetBearer();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      (import.meta.env.DEV
        ? 'http://localhost:3001'
        : 'https://ffzjnfcr4yvv2rn311ybs5tf.ewr.prisma.build');
    const url = `${apiBaseUrl}/api/activity/stream${
      token ? `?token=${encodeURIComponent(token)}` : ''
    }`;

    let alive = true;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (ev) => {
      if (!alive) return;
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed.event === 'activity') {
          setEvents((prev) =>
            [
              { type: 'activity', id: parsed.id, kind: parsed.kind } as SseActivityEvent,
              ...prev,
            ].slice(0, 20),
          );
        } else if (parsed.event === 'unread') {
          setEvents((prev) =>
            [{ type: 'unread', unread: parsed.unread } as SseUnreadEvent, ...prev].slice(0, 20),
          );
        } else if (parsed.event === 'hello') {
          setEvents((prev) =>
            [{ type: 'hello', unread: parsed.unread } as { type: 'hello'; unread: number }, ...prev].slice(0, 20),
          );
        } else if (parsed.event === 'ping') {
          setEvents((prev) => [{ type: 'ping' } as { type: 'ping' }, ...prev].slice(0, 20));
        }
      } catch {
        // ignore malformed frame
      }
    };

    es.onerror = () => {
      // auto reconnect handled by browser EventSource; no-op here to
      // suppress noisy console warnings from transient network blips.
    };

    return () => {
      alive = false;
      es.close();
      esRef.current = null;
    };
  }, [enabled]);

  return {
    events,
    lastActivity: events.find(
      (e) => e.type === 'activity',
    ) as SseActivityEvent | undefined,
    close: () => esRef.current?.close(),
  };
}

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  getWebActivityFeed,
  getWebActivityUnread,
  markWebActivityRead,
  type WebActivityFeed,
} from './services';

// ─── Web Activity Feed (cursor pagination with `before`) ───

export interface UseWebActivityFeedResult
  extends Omit<UseQueryResult<WebActivityFeed, Error>, 'data'> {
  feed: WebActivityFeed | undefined;
  items: WebActivityFeed['items'];
  loadNext: () => void;
  resetFeed: () => void;
  isLoadingMore: boolean;
  hasMore: boolean;
}

export function useWebActivityFeed(opts?: {
  enabled?: boolean;
  limit?: number;
  onlyUnread?: boolean;
}): UseWebActivityFeedResult {
  const [before, setBefore] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<WebActivityFeed['items']>([]);
  const loadingMoreRef = useRef(false);

  const query = useQuery({
    queryKey: [
      'web',
      'activity',
      'feed',
      before,
      opts?.limit,
      opts?.onlyUnread,
    ],
    queryFn: () =>
      getWebActivityFeed({
        limit: opts?.limit || 20,
        before,
        onlyUnread: opts?.onlyUnread,
      }),
    staleTime: 10_000,
    enabled: opts?.enabled ?? true,
    keepPreviousData: true,
    retry: 1,
  });

  // Append new page items to accumulated list
  useEffect(() => {
    if (!query.data) return;
    if (before === undefined) {
      // First page: replace
      setAccumulated(query.data.items);
    } else if (loadingMoreRef.current) {
      // Subsequent page: append only new items (dedup by id)
      setAccumulated((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const next = [...prev];
        for (const it of query.data!.items) {
          if (!seen.has(it.id)) next.push(it);
        }
        return next;
      });
      loadingMoreRef.current = false;
    }
  }, [query.data, before]);

  const feed: WebActivityFeed | undefined = query.data
    ? { ...query.data, items: accumulated }
    : undefined;

  const loadNext = useCallback(() => {
    if (!query.data?.pageInfo?.hasMore) return;
    loadingMoreRef.current = true;
    setBefore(query.data!.pageInfo.nextBefore || undefined);
  }, [query.data]);

  const resetFeed = useCallback(() => {
    setBefore(undefined);
    setAccumulated([]);
    void query.refetch();
  }, [query]);

  return {
    ...query,
    feed,
    items: accumulated,
    loadNext,
    resetFeed,
    isLoadingMore: loadingMoreRef.current || query.isFetching && before !== undefined,
    hasMore: !!query.data?.pageInfo?.hasMore,
  };
}

// ─── Unread Count ───

export function useWebActivityUnread(opts?: {
  enabled?: boolean;
  refetchInterval?: number;
}) {
  return useQuery({
    queryKey: ['web', 'activity', 'unread'],
    queryFn: () => getWebActivityUnread(),
    refetchInterval: opts?.refetchInterval ?? 30_000,
    staleTime: 5_000,
    enabled: opts?.enabled ?? true,
    retry: 1,
  });
}

// ─── Mark Read Mutation ───

export function useMarkWebActivityRead(opts?: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids?: string[]; all?: boolean }) =>
      markWebActivityRead(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['web', 'activity'] });
      opts?.onSuccess?.();
    },
  });
}

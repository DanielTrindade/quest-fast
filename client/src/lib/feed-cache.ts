import type { QueryClient } from '@tanstack/react-query';
import type { FeedResponse, SessionEvent } from '@quest-fast/shared';

/**
 * Merges one session event into the feed cache, where it came from the socket
 * push or from the HTTP answer that created it. Re-merging the same id is a
 * no-op, so both paths can run for the same event without duplicating a row.
 *
 * A roll also points back at a sheet, so the roster may have changed; Phase 2
 * events such as a token move must not trigger a characters refetch.
 */
export function mergeFeedEvent(queryClient: QueryClient, campaignId: string, event: SessionEvent): void {
  queryClient.setQueryData<FeedResponse>(['feed', campaignId], (current) => {
    if (!current) return { events: [event], nextCursor: null };
    if (current.events.some((existing) => existing.id === event.id)) return current;
    return { ...current, events: [...current.events, event] };
  });

  if (event.type === 'roll') {
    queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
  }
}

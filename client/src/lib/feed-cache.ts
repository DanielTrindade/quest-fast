import type { QueryClient } from '@tanstack/react-query';
import type { FeedResponse, RollSessionEvent, SessionEvent } from '@quest-fast/shared';

/**
 * Merges one session event into the feed cache, where it came from the socket
 * push or from the HTTP answer that created it. Re-merging the same id is a
 * no-op, so both paths can run for the same event without duplicating a row.
 *
 * A roll also points back at a sheet, so the roster may have changed; Phase 2
 * events such as a token move must not trigger a characters refetch.
 */
/**
 * A damage rolled after its attack: the attack, already in the feed, no
 * longer offers "Rolar dano" — the server marked it too, for the next read.
 */
function withDamageRolled(events: SessionEvent[], event: SessionEvent): SessionEvent[] {
  if (event.type !== 'roll') return events;
  const attackId = (event as RollSessionEvent).payload.damageOf;
  if (!attackId) return events;
  return events.map((existing) =>
    existing.id === attackId && existing.type === 'roll'
      ? ({ ...existing, payload: { ...(existing as RollSessionEvent).payload, damageRolled: true } } as SessionEvent)
      : existing,
  );
}

export function mergeFeedEvent(queryClient: QueryClient, campaignId: string, event: SessionEvent): void {
  queryClient.setQueryData<FeedResponse>(['feed', campaignId], (current) => {
    if (!current) return { events: [event], nextCursor: null };
    if (current.events.some((existing) => existing.id === event.id)) return current;
    return { ...current, events: [...withDamageRolled(current.events, event), event] };
  });

  if (event.type === 'roll') {
    queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
  }
}

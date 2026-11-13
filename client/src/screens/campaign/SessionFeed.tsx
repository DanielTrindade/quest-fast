import { DiceFive } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedResponse } from '@quest-fast/shared';
import { EmptyState } from '../../components/EmptyState';
import { FeedEventCard } from '../../components/FeedEventCard';
import { FeedFollow } from '../../components/FeedFollow';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { useCampaignSocketStatus } from '../../hooks/useCampaignSocket';
import { useNotify } from '../../hooks/use-notify';
import { ApiError, api } from '../../lib/api';
import { mergeFeedEvent } from '../../lib/feed-cache';
import { sectionHeading, stack } from '../../components/layout-styles';

function errorMessage(error: unknown, fallback = 'Não foi possível carregar eventos anteriores.') {
  return error instanceof ApiError ? error.message : fallback;
}

/** "ao vivo" while the campaign socket is up: the feed is live only then. */
function FeedHeading({ framed }: { framed: boolean }) {
  const status = useCampaignSocketStatus();
  const line = (
    <span data-slot="feed-status" className="data-[status=connected]:text-success-text" data-status={status} aria-live="polite">
      {status === 'connected' ? 'ao vivo' : status === 'connecting' ? 'conectando' : 'reconectando'}
    </span>
  );
  if (!framed) return <p className="m-0 text-small text-text-secondary">{line}</p>;
  return (
    <div className={sectionHeading}>
      <h2 id="feed-title">Sessão</h2>
      {line}
    </div>
  );
}

/**
 * The session as it happens. `framed={false}` drops the heading and the
 * surface for the table's panel, where the Feed tab names it; the live
 * status stays.
 */
export function SessionFeed({ campaignId, currentUserId, framed = true }: { campaignId: string; currentUserId: string; framed?: boolean }) {
  const queryClient = useQueryClient();
  const feed = useQuery({ queryKey: ['feed', campaignId], queryFn: () => api.feed(campaignId) });

  // Older pages are merged into the same cache the socket appends to, so the
  // live tail and the loaded past stay one list.
  const loadMore = useMutation({
    mutationFn: (cursor: string) => api.feed(campaignId, cursor),
    onSuccess: (page) => {
      queryClient.setQueryData<FeedResponse>(['feed', campaignId], (prev) => {
        if (!prev) return page;
        const existing = new Set(prev.events.map((event) => event.id));
        const older = page.events.filter((event) => !existing.has(event.id));
        return { events: [...older, ...prev.events], nextCursor: page.nextCursor };
      });
    },
  });

  // The damage of one's own attack made without a target. The new roll and
  // the attack it settles are both updated in the cache, as the socket does.
  // A failure is a toast: the button may sit deep in a scrolled history, where
  // an alert above the list would never be seen.
  const notify = useNotify();
  const rollDamage = useMutation({
    mutationFn: (eventId: string) => api.rollDamage(campaignId, eventId),
    onSuccess: ({ event }) => mergeFeedEvent(queryClient, campaignId, event),
    onError: (error) => notify({ variant: 'error', title: errorMessage(error, 'Não foi possível rolar o dano.') }),
  });

  const events = feed.data?.events ?? [];
  const nextCursor = feed.data?.nextCursor ?? null;

  const Frame = framed ? Surface : 'div';

  return (
    <section className="grid min-w-0 gap-2" aria-labelledby={framed ? 'feed-title' : undefined} aria-label={framed ? undefined : 'Sessão'}>
      <FeedHeading framed={framed} />

      <Frame className={framed ? 'py-0' : 'min-w-0'}>
        {feed.isPending && (
          <div className={stack} aria-busy="true" aria-label="Carregando a sessão">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} shape="line" width="80%" />
            ))}
          </div>
        )}

        {feed.isError && (
          <p role="alert" className="text-body text-danger-text">
            Não foi possível carregar a sessão.
          </p>
        )}

        {feed.isSuccess && events.length === 0 && (
          <EmptyState
            icon={DiceFive}
            title="A sessão ainda está em silêncio"
            description="Rolagens e eventos desta campanha aparecem aqui na hora, para toda a mesa."
            action={null}
          />
        )}

        {feed.isSuccess && events.length > 0 && (
          <FeedFollow
            ids={events.map((event) => event.id)}
            hasMore={nextCursor !== null}
            onLoadMore={() => nextCursor && !loadMore.isPending && loadMore.mutate(nextCursor)}
            loadingMore={loadMore.isPending}
            loadMoreError={loadMore.isError ? errorMessage(loadMore.error) : null}
          >
            <ol data-slot="feed-list" className="m-0 list-none p-0 [&>li]:py-3 [&>li+li]:border-t [&>li+li]:border-border">
              {events.map((event) => (
                <li key={event.id}>
                  <FeedEventCard event={event} pending={rollDamage.isPending}
                    onRollDamage={event.userId === currentUserId ? (eventId) => rollDamage.mutate(eventId) : undefined} />
                </li>
              ))}
            </ol>
          </FeedFollow>
        )}
      </Frame>
    </section>
  );
}

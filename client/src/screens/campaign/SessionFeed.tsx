import { DiceFive } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedResponse } from '@quest-fast/shared';
import { EmptyState } from '../../components/EmptyState';
import { FeedEventCard } from '../../components/FeedEventCard';
import { FeedFollow } from '../../components/FeedFollow';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { useCampaignSocket } from '../../hooks/useCampaignSocket';
import { ApiError, api } from '../../lib/api';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível carregar eventos anteriores.';
}

export function SessionFeed({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const status = useCampaignSocket(campaignId);
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

  const events = feed.data?.events ?? [];
  const nextCursor = feed.data?.nextCursor ?? null;

  return (
    <section className="feed-panel" aria-labelledby="feed-title">
      <div className="campaign-section-heading">
        <h2 id="feed-title">Sessão</h2>
        <span className="feed-status" data-status={status} aria-live="polite">
          {status === 'connected' ? 'ao vivo' : status === 'connecting' ? 'conectando' : 'reconectando'}
        </span>
      </div>

      <Surface className="feed-surface">
        {feed.isPending && (
          <div className="qf-stack" aria-busy="true" aria-label="Carregando a sessão">
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
            count={events.length}
            newestId={events[events.length - 1]!.id}
            hasMore={nextCursor !== null}
            onLoadMore={() => nextCursor && !loadMore.isPending && loadMore.mutate(nextCursor)}
            loadingMore={loadMore.isPending}
            loadMoreError={loadMore.isError ? errorMessage(loadMore.error) : null}
          >
            <ol className="feed-list">
              {events.map((event) => (
                <li key={event.id}>
                  <FeedEventCard event={event} />
                </li>
              ))}
            </ol>
          </FeedFollow>
        )}
      </Surface>
    </section>
  );
}

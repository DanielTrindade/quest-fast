import { EyeSlash } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { RollPayload, SessionEvent } from '@quest-fast/shared';
import { useCampaignSocket } from '../../hooks/useCampaignSocket';
import { ABILITY_LABELS } from '../../lib/5e';
import { api } from '../../lib/api';
import { formatTime } from '../../lib/format';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';

function rollSummary(payload: RollPayload): string {
  const kept = payload.dice.filter((die) => !die.discarded);
  const discarded = payload.dice.filter((die) => die.discarded);
  let text = kept.map((die) => `${die.value}`).join(' + ');
  if (discarded.length > 0) {
    text += ` (${discarded.map((die) => `${die.value}`).join(', ')} descartado${discarded.length > 1 ? 's' : ''})`;
  }
  if (payload.modifier !== 0) {
    text += ` ${payload.modifier > 0 ? '+' : '−'} ${Math.abs(payload.modifier)}`;
  }
  return `${text} = ${payload.total}`;
}

function rollAction(payload: RollPayload): string {
  if (payload.rollKind === 'attack') return `atacou com ${payload.attackName}`;
  if (payload.rollKind === 'check') return `teste de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  if (payload.rollKind === 'save') return `teste de resistência de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  return `rolou ${payload.expression}`;
}

function FeedRow({ event }: { event: SessionEvent }) {
  const payload = event.payload;
  const headline =
    payload.rollKind && payload.characterName
      ? `${payload.characterName} ${rollAction(payload)}`
      : `${event.userName} ${rollAction(payload)}`;
  const content = (
    <>
      <p className="feed-meta">
        <span>{event.userName}</span>
        <span aria-hidden="true">·</span>
        <time>{formatTime(event.createdAt)}</time>
        {event.secret && (
          <span className="feed-secret-tag">
            <EyeSlash size={14} weight="regular" aria-hidden="true" /> Secreta
          </span>
        )}
      </p>
      <p className="feed-line">{headline}</p>
      <p className="feed-breakdown">{rollSummary(payload)}</p>
    </>
  );
  return event.secret ? <div className="qf-feed__secret">{content}</div> : <>{content}</>;
}

export function SessionFeed({ campaignId }: { campaignId: string }) {
  const status = useCampaignSocket(campaignId);
  const feed = useQuery({ queryKey: ['feed', campaignId], queryFn: () => api.feed(campaignId) });

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

        {feed.isSuccess && feed.data.events.length === 0 && (
          <EmptyState
            title="A sessão ainda está em silêncio"
            description="Rolagens e eventos desta campanha aparecem aqui na hora, para toda a mesa."
            action={null}
          />
        )}

        {feed.isSuccess && feed.data.events.length > 0 && (
          <ol className="feed-list">
            {feed.data.events.map((event) => (
              <li key={event.id}>
                <FeedRow event={event} />
              </li>
            ))}
          </ol>
        )}
      </Surface>
    </section>
  );
}
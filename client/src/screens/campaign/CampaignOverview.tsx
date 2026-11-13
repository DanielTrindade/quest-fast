import { useState } from 'react';
import { MapTrifold, Skull, Sword, Users } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button as RetryButton } from '../../components/Button';
import { OpenScene } from '../../components/OpenScene';
import { PartyStrip } from '../../components/PartyStrip';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { encountersQuery } from '../../lib/combat-cache';
import { activeSceneQuery } from '../../lib/scene-cache';
import { CampaignPage } from './CampaignPage';
import { CharacterSheetDialog } from './CharacterSheetDialog';
import { useCampaignScreen } from './campaign-screen';
import { useInviteDialog } from './useInviteDialog';

function Retry({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div className="grid justify-items-start gap-3">
      <p role="alert" className="text-body text-danger-text">{message}</p>
      <RetryButton variant="secondary" loading={retrying} onClick={onRetry}>Tentar novamente</RetryButton>
    </div>
  );
}

type Members = ReturnType<typeof useMembers>;

function useMembers(campaignId: string) {
  return useQuery({ queryKey: ['members', campaignId], queryFn: () => api.members(campaignId) });
}

function membersLabel(members: Members) {
  const count = members.data?.members.length;
  if (count !== undefined) return count === 1 ? '1 jogador' : `${count} jogadores`;
  return members.isError ? 'Indisponível' : 'Carregando…';
}

/** Whether a fight is running, in one line, and the way to the table. */
function TableStatus({ campaignId }: { campaignId: string }) {
  const encounters = useQuery(encountersQuery(campaignId));
  // Data already in hand wins over a failed refetch; without data, loading and
  // failure are told apart, and "no fight" is said only after an answer.
  const active = encounters.data?.encounters.find((encounter) => encounter.status === 'active');
  return (
    <section aria-labelledby="overview-table-title" data-fight={active ? 'active' : undefined}
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-panel border border-border bg-card p-4 edge-raised data-[fight=active]:border-danger-text/50 data-[fight=active]:bg-danger/10">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border-strong bg-background text-text-secondary in-data-[fight=active]:border-danger-text/60 in-data-[fight=active]:text-danger-text">
        {active ? <Sword size={22} aria-hidden="true" /> : <Skull size={22} aria-hidden="true" />}
      </span>
      <div className="grid min-w-0 flex-[1_1_240px] gap-0.5">
        <h2 id="overview-table-title" className="m-0 font-display text-h2 font-semibold">
          {active ? `Combate: ${active.name}` : 'Mesa'}
        </h2>
        {encounters.data && (
          <p className="m-0 text-small text-text-secondary">
            {active
              ? `Rodada ${active.round}. A iniciativa, o dano e o feed estão na mesa.`
              : 'Nenhum combate em andamento. Dados, fichas e o histórico da sessão ficam na mesa.'}
          </p>
        )}
        {!encounters.data && encounters.isError && (
          <Retry message="Não foi possível verificar se há combate." retrying={encounters.isFetching} onRetry={() => encounters.refetch()} />
        )}
        {!encounters.data && !encounters.isError && <Skeleton width="70%" label="Verificando se há combate" />}
      </div>
      <Button asChild variant={active ? 'default' : 'secondary'}>
        <Link to="/campaigns/$campaignId/table" params={{ campaignId }}>{active ? 'Ir para o combate' : 'Abrir a mesa'}</Link>
      </Button>
    </section>
  );
}

/** The map open for the table, in short, and the way to it. */
function OverviewMap({ campaignId, isMaster }: { campaignId: string; isMaster: boolean }) {
  const map = useQuery(activeSceneQuery(campaignId));
  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="overview-map-title">
      <h2 id="overview-map-title" className="m-0 flex items-center gap-2 font-display text-h1 font-semibold">
        <MapTrifold size={22} aria-hidden="true" className="text-text-secondary" /> Mapa
      </h2>
      {map.isPending && <Skeleton shape="panel" label="Verificando se há mapa aberto" />}
      {map.isError && map.data === undefined && (
        <Surface>
          <Retry message="Não foi possível verificar se há mapa aberto." retrying={map.isFetching} onRetry={() => map.refetch()} />
        </Surface>
      )}
      {/* null is an answer: no map open. A failed refresh keeps the last one. */}
      {map.data !== undefined && (
        <OpenScene scene={map.data} isMaster={isMaster}
          action={map.data ? (
            <Button asChild>
              <Link to="/campaigns/$campaignId/table" params={{ campaignId }}>Ir para a Mesa</Link>
            </Button>
          ) : isMaster && (
            <Button asChild variant="secondary">
              <Link to="/campaigns/$campaignId/prep" params={{ campaignId }}>Ir para o Preparo</Link>
            </Button>
          )} />
      )}
    </section>
  );
}

/** The group: each player's active character, to look at, and the way to the players. */
function PartySection({ campaignId }: { campaignId: string }) {
  const { isMaster, currentUserId } = useCampaignScreen(campaignId);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => api.characters(campaignId) });
  const members = useMembers(campaignId);
  const party = characters.data?.characters.filter((character) => character.active) ?? [];

  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="overview-party-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="overview-party-title" className="m-0 font-display text-h1 font-semibold">O grupo</h2>
        <Link to="/campaigns/$campaignId/players" params={{ campaignId }}
          className="inline-flex min-h-11 items-center gap-2 text-small text-accent-text underline-offset-4 hover:underline">
          <Users size={18} aria-hidden="true" /> <span>{membersLabel(members)}</span>
        </Link>
      </div>
      {!members.data && members.isError && (
        <Retry message="Não foi possível carregar os jogadores." retrying={members.isFetching} onRetry={() => members.refetch()} />
      )}
      {!characters.data && characters.isError && (
        <Retry message="Não foi possível carregar o grupo." retrying={characters.isFetching} onRetry={() => characters.refetch()} />
      )}
      {!characters.data && !characters.isError && <Skeleton shape="panel" label="Carregando o grupo" />}
      {characters.data && party.length === 0 && (
        <Surface variant="base" className="border-dashed border-border-strong">
          <p className="m-0 text-body text-text-secondary">Ninguém trouxe um personagem ainda. Cada jogador ativa o seu em Meus personagens.</p>
        </Surface>
      )}
      {party.length > 0 && <PartyStrip characters={party} currentUserId={currentUserId} onOpen={(character) => setViewingId(character.id)} />}
      {viewingId && (
        <CharacterSheetDialog campaignId={campaignId} characterId={viewingId} currentUserId={currentUserId}
          isMaster={isMaster} context="read" open
          onOpenChange={(open) => { if (!open) setViewingId(null); }}
          onDeleted={() => { void characters.refetch(); }} />
      )}
    </section>
  );
}

/**
 * Where a campaign opens: whether a fight is running, the map open for the
 * table, then the group. The session summary arrives in a later step.
 */
export function CampaignOverview({ campaignId }: { campaignId: string }) {
  const { campaign, isMaster } = useCampaignScreen(campaignId);
  const invite = useInviteDialog(campaignId, campaign.data);

  return (
    <CampaignPage campaign={campaign} actions={invite.button}>
      <div className="grid gap-8">
        <TableStatus campaignId={campaignId} />
        <OverviewMap campaignId={campaignId} isMaster={isMaster} />
        <PartySection campaignId={campaignId} />
      </div>
      {invite.dialog}
    </CampaignPage>
  );
}

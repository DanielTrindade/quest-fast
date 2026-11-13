import { useState } from 'react';
import { ArrowRight, Skull, Sword, Users } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button as RetryButton } from '../../components/Button';
import { PartyStrip } from '../../components/PartyStrip';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { Button } from '../../components/ui/button';
import { sectionHeading } from '../../components/layout-styles';
import { api } from '../../lib/api';
import { encountersQuery } from '../../lib/combat-cache';
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

/** The group: each player's active character, to look at. */
function PartySection({ campaignId }: { campaignId: string }) {
  const { isMaster, currentUserId } = useCampaignScreen(campaignId);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => api.characters(campaignId) });
  const party = characters.data?.characters.filter((character) => character.active) ?? [];

  return (
    <section className="grid min-w-0 gap-3 @min-[1000px]:col-span-2" aria-labelledby="overview-party-title">
      <div className={sectionHeading}>
        <h2 id="overview-party-title">
          <Sword size={20} aria-hidden="true" /> O grupo
        </h2>
        {characters.data && <span>{party.length} na mesa</span>}
      </div>
      <Surface className="grid justify-items-start gap-3">
        {!characters.data && characters.isError && (
          <Retry message="Não foi possível carregar o grupo." retrying={characters.isFetching} onRetry={() => characters.refetch()} />
        )}
        {!characters.data && !characters.isError && <Skeleton width="60%" label="Carregando o grupo" />}
        {characters.data && party.length === 0 && (
          <p className="text-body text-text-secondary">Ninguém trouxe um personagem ainda. Cada jogador ativa o seu em Meus personagens.</p>
        )}
        {party.length > 0 && <PartyStrip characters={party} currentUserId={currentUserId} onOpen={(character) => setViewingId(character.id)} />}
      </Surface>
      {viewingId && (
        <CharacterSheetDialog campaignId={campaignId} characterId={viewingId} currentUserId={currentUserId}
          isMaster={isMaster} canRoll={false} open
          onOpenChange={(open) => { if (!open) setViewingId(null); }}
          onDeleted={() => { void characters.refetch(); }} />
      )}
    </section>
  );
}

/**
 * Where a campaign opens: what is happening now and the way to it. A fight in
 * progress leads, then the group; the session summary arrives in a later step.
 */
export function CampaignOverview({ campaignId }: { campaignId: string }) {
  const { campaign } = useCampaignScreen(campaignId);
  const invite = useInviteDialog(campaignId, campaign.data);
  const encounters = useQuery(encountersQuery(campaignId));
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.members(campaignId),
  });
  // Data already in hand wins over a failed refetch; without data, loading and
  // failure are told apart, and "no fight" is said only after an answer.
  const active = encounters.data?.encounters.find((encounter) => encounter.status === 'active');
  const memberCount = members.data?.members.length;
  const membersLabel = memberCount !== undefined ? `${memberCount} na mesa` : members.isError ? 'Indisponível' : 'Carregando…';

  return (
    <CampaignPage campaign={campaign} actions={invite.button}>
      <div className="grid gap-6 @min-[1000px]:grid-cols-2 @min-[1000px]:items-start">
        <section className="grid min-w-0 gap-3" aria-labelledby="overview-table-title">
          <div className={sectionHeading}>
            <h2 id="overview-table-title">
              <Skull size={20} aria-hidden="true" /> Mesa
            </h2>
            {active && <span className="text-danger-text">Rodada {active.round}</span>}
          </div>
          <Surface className="grid justify-items-start gap-3">
            {encounters.data && (
              <p className="text-body text-text-secondary">
                {active
                  ? `Combate em andamento: ${active.name}.`
                  : 'Nenhum combate em andamento. Dados, fichas e o histórico da sessão ficam na mesa.'}
              </p>
            )}
            {!encounters.data && encounters.isError && (
              <Retry message="Não foi possível verificar se há combate." retrying={encounters.isFetching} onRetry={() => encounters.refetch()} />
            )}
            {!encounters.data && !encounters.isError && (
              <Skeleton width="70%" label="Verificando se há combate" />
            )}
            <Button asChild variant={active ? 'default' : 'secondary'}>
              <Link to="/campaigns/$campaignId/table" params={{ campaignId }}>
                {active ? 'Ir para o combate' : 'Abrir a mesa'}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </Button>
          </Surface>
        </section>

        <section className="grid min-w-0 gap-3" aria-labelledby="overview-players-title">
          <div className={sectionHeading}>
            <h2 id="overview-players-title">
              <Users size={20} aria-hidden="true" /> Jogadores
            </h2>
            <span>{membersLabel}</span>
          </div>
          <Surface className="grid justify-items-start gap-3">
            {!members.data && members.isError && (
              <Retry message="Não foi possível carregar os jogadores." retrying={members.isFetching} onRetry={() => members.refetch()} />
            )}
            <p className="text-body text-text-secondary">
              {invite.available
                ? 'Membros, convite e quem foi removido da mesa.'
                : 'Quem participa desta campanha.'}
            </p>
            <Button asChild variant="secondary">
              <Link to="/campaigns/$campaignId/players" params={{ campaignId }}>
                Ver jogadores
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </Button>
          </Surface>
        </section>

        <PartySection campaignId={campaignId} />
      </div>
      {invite.dialog}
    </CampaignPage>
  );
}

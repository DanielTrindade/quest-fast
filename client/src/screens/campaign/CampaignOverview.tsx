import { ArrowRight, MapTrifold, Skull, Users } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button as RetryButton } from '../../components/Button';
import { OpenScene } from '../../components/OpenScene';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { Button } from '../../components/ui/button';
import { sectionHeading } from '../../components/layout-styles';
import { api } from '../../lib/api';
import { encountersQuery } from '../../lib/combat-cache';
import { activeSceneQuery } from '../../lib/scene-cache';
import { CampaignPage } from './CampaignPage';
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

/** The map open for the table, in short, and the way to it. */
function OverviewMap({ campaignId, isMaster }: { campaignId: string; isMaster: boolean }) {
  const map = useQuery(activeSceneQuery(campaignId));
  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="overview-map-title">
      <div className={sectionHeading}>
        <h2 id="overview-map-title">
          <MapTrifold size={20} aria-hidden="true" /> Mapa
        </h2>
      </div>
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
              <Link to="/campaigns/$campaignId/table" params={{ campaignId }}>
                Ir para a Mesa
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
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

/**
 * Where a campaign opens: what is happening now and the way to it. A fight in
 * progress leads, then the map open for the table; the group and the session
 * summary arrive in later steps.
 */
export function CampaignOverview({ campaignId }: { campaignId: string }) {
  const { campaign, isMaster } = useCampaignScreen(campaignId);
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

        <OverviewMap campaignId={campaignId} isMaster={isMaster} />

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
      </div>
      {invite.dialog}
    </CampaignPage>
  );
}

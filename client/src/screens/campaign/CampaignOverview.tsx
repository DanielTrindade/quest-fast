import { ArrowRight, Skull, Users } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Surface } from '../../components/Surface';
import { Button } from '../../components/ui/button';
import { sectionHeading } from '../../components/layout-styles';
import { api } from '../../lib/api';
import { encountersQuery } from '../../lib/combat-cache';
import { CampaignPage } from './CampaignPage';
import { useCampaignScreen } from './campaign-screen';
import { useInviteDialog } from './useInviteDialog';

/**
 * Where a campaign opens: what is happening now and the way to it. A fight in
 * progress leads; the group and the session summary arrive in later steps.
 */
export function CampaignOverview({ campaignId }: { campaignId: string }) {
  const { campaign } = useCampaignScreen(campaignId);
  const invite = useInviteDialog(campaignId, campaign.data);
  const encounters = useQuery(encountersQuery(campaignId));
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.members(campaignId),
  });
  const active = encounters.data?.encounters.find((encounter) => encounter.status === 'active');
  const memberCount = members.data?.members.length;

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
            <p className="text-body text-text-secondary">
              {active
                ? `Combate em andamento: ${active.name}.`
                : 'Nenhum combate em andamento. Dados, fichas e o histórico da sessão ficam na mesa.'}
            </p>
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
            <span>{memberCount === undefined ? 'Carregando…' : `${memberCount} na mesa`}</span>
          </div>
          <Surface className="grid justify-items-start gap-3">
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

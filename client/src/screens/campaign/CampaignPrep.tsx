import { Link } from '@tanstack/react-router';
import { EmptyState } from '../../components/EmptyState';
import { Surface } from '../../components/Surface';
import { Button } from '../../components/ui/button';
import { CampaignPage } from './CampaignPage';
import { useCampaignScreen } from './campaign-screen';
import { CombatSection } from './CombatSection';

/**
 * The master's preparation: encounters and the bestiary, away from the table.
 * A player gets "not found", as the server answers for what is not theirs;
 * the server still refuses every request behind this screen on its own.
 */
export function CampaignPrep({ campaignId }: { campaignId: string }) {
  const { campaign, isMaster, currentUserId } = useCampaignScreen(campaignId);

  if (campaign.isSuccess && !isMaster) {
    return (
      <CampaignPage campaign={campaign} title="Página não encontrada">
        <Surface>
          <EmptyState
            title="Esta página não existe"
            description="O endereço pode estar errado, ou ele não faz parte do que você vê nesta campanha."
            action={(
              <Button asChild variant="secondary">
                <Link to="/campaigns/$campaignId" params={{ campaignId }}>Voltar para a campanha</Link>
              </Button>
            )}
          />
        </Surface>
      </CampaignPage>
    );
  }

  return (
    <CampaignPage campaign={campaign} title="Preparo">
      {isMaster && <CombatSection campaignId={campaignId} isMaster currentUserId={currentUserId} view="prep" />}
    </CampaignPage>
  );
}

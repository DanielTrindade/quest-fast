import { CampaignPage } from './CampaignPage';
import { useCampaignScreen } from './campaign-screen';
import { CharactersSection } from './CharactersSection';
import { CombatSection } from './CombatSection';
import { DiceRoller } from './DiceRoller';
import { SessionFeed } from './SessionFeed';
import { TableMap } from './TableMap';

/**
 * Where the game is played: the sheets, the fight in progress, the dice and
 * the session feed, and the map open for the table.
 */
export function CampaignTable({ campaignId }: { campaignId: string }) {
  const { campaign, isMaster, currentUserId } = useCampaignScreen(campaignId);

  return (
    <CampaignPage campaign={campaign} title="Mesa">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @min-[1000px]:grid-cols-[minmax(0,1fr)_320px] @min-[1000px]:items-start">
        <div className="grid min-w-0 gap-8">
          <TableMap campaignId={campaignId} isMaster={isMaster} />
          <CharactersSection campaignId={campaignId} currentUserId={currentUserId} isMaster={isMaster} />
          <CombatSection campaignId={campaignId} isMaster={isMaster} currentUserId={currentUserId} view="table" />
        </div>

        <aside className="grid min-w-0 content-start gap-6" aria-label="Dados e sessão">
          <DiceRoller campaignId={campaignId} isMaster={isMaster} />
          <SessionFeed campaignId={campaignId} currentUserId={currentUserId} />
        </aside>
      </div>
    </CampaignPage>
  );
}

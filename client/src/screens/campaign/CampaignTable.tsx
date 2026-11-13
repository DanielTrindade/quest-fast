import { useQuery } from '@tanstack/react-query';
import { activeSceneQuery } from '../../lib/scene-cache';
import { CampaignPage } from './CampaignPage';
import { useCampaignScreen } from './campaign-screen';
import { CharactersSection } from './CharactersSection';
import { CombatSection } from './CombatSection';
import { SessionFeed } from './SessionFeed';
import { TableActionPanel } from './TableActionPanel';
import { TableMap } from './TableMap';

/**
 * Where the game is played: the map in the middle (the feed, while no map is
 * open), the side panel with the turn, each role's actions, the dice and the
 * feed, and below the middle the queue of the fight and the group. On a
 * narrow screen the panel comes right after the map, before the feed: the
 * history can be long, and the actions must not wait at the end of it. The
 * order in the markup is that one, so focus follows it too.
 */
export function CampaignTable({ campaignId }: { campaignId: string }) {
  const { campaign, isMaster, currentUserId } = useCampaignScreen(campaignId);
  const scene = useQuery(activeSceneQuery(campaignId));
  const feedInMiddle = scene.data === null;

  return (
    <CampaignPage campaign={campaign} title="Mesa">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @min-[860px]:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] @min-[860px]:items-start">
        <div className="min-w-0 @min-[860px]:col-start-1 @min-[860px]:row-start-1">
          <TableMap campaignId={campaignId} isMaster={isMaster} />
        </div>

        <TableActionPanel campaignId={campaignId} isMaster={isMaster} currentUserId={currentUserId} withFeed={!feedInMiddle}
          className="@min-[860px]:sticky @min-[860px]:top-4 @min-[860px]:col-start-2 @min-[860px]:row-span-3 @min-[860px]:row-start-1 @min-[860px]:max-h-[calc(100dvh-2rem)] @min-[860px]:overflow-y-auto @min-[860px]:overscroll-contain" />

        {feedInMiddle && (
          <div className="min-w-0 @min-[860px]:col-start-1 @min-[860px]:row-start-2">
            <SessionFeed campaignId={campaignId} currentUserId={currentUserId} />
          </div>
        )}

        <div className={feedInMiddle
          ? 'grid min-w-0 gap-8 @min-[860px]:col-start-1 @min-[860px]:row-start-3'
          : 'grid min-w-0 gap-8 @min-[860px]:col-start-1 @min-[860px]:row-start-2'}>
          <CombatSection campaignId={campaignId} isMaster={isMaster} currentUserId={currentUserId} view="table" />
          <CharactersSection campaignId={campaignId} currentUserId={currentUserId} isMaster={isMaster} />
        </div>
      </div>
    </CampaignPage>
  );
}

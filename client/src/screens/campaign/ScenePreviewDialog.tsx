import { useQuery } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { Skeleton } from '../../components/Skeleton';
import { dialogSheet } from '../../components/layout-styles';
import { sceneQuery } from '../../lib/scene-cache';
import { errorMessage } from './campaign-screen';
import { SceneStage } from './SceneStage';

/**
 * The master's look at a scene from prep, open for the table or not: the map
 * with pan and zoom, the grid to fit to the drawing and the table switch.
 */
export function ScenePreviewDialog({ campaignId, sceneId, name, onClose }: {
  campaignId: string; sceneId: string; name: string; onClose: () => void;
}) {
  const detail = useQuery(sceneQuery(campaignId, sceneId));
  const scene = detail.data?.scene;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} className={dialogSheet}
      title={scene?.name ?? name}
      description="Os jogadores só veem o mapa quando você abre a cena para a mesa.">
      {detail.isPending && <Skeleton shape="panel" label="Carregando o mapa…" />}
      {detail.isError && <p role="alert" className="text-body text-danger-text">{errorMessage(detail.error)}</p>}
      {scene && !detail.isError && (
        <SceneStage campaignId={campaignId} scene={scene} isMaster mapClassName="h-[min(55dvh,520px)] min-h-[280px]" />
      )}
    </Dialog>
  );
}

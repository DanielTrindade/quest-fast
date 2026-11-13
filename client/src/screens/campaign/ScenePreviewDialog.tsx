import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Skeleton } from '../../components/Skeleton';
import { dialogSheet } from '../../components/layout-styles';
import { ApiError } from '../../lib/api';
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
  // A 404 means the scene is gone; any other failed refresh keeps the map on screen.
  const gone = detail.error instanceof ApiError && detail.error.status === 404;
  const scene = gone ? undefined : detail.data?.scene;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} className={dialogSheet}
      title={scene?.name ?? name}
      description="Os jogadores só veem o mapa quando você abre a cena para a mesa.">
      {detail.isPending && <Skeleton shape="panel" label="Carregando o mapa…" />}
      {detail.isError && (
        <div className="mb-4 grid justify-items-start gap-3">
          <p role="alert" className="text-body text-danger-text">{gone ? 'Esta cena não existe mais.' : errorMessage(detail.error)}</p>
          {!gone && <Button variant="secondary" loading={detail.isFetching} onClick={() => { void detail.refetch(); }}>Tentar novamente</Button>}
        </div>
      )}
      {scene && (
        <SceneStage campaignId={campaignId} scene={scene} isMaster mapClassName="h-[min(55dvh,520px)] min-h-[280px]" />
      )}
    </Dialog>
  );
}

import { MapTrifold } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button as ActionButton } from '../../components/Button';
import { OpenScene } from '../../components/OpenScene';
import { Skeleton } from '../../components/Skeleton';
import { sectionHeading } from '../../components/layout-styles';
import { Button } from '../../components/ui/button';
import { activeSceneQuery } from '../../lib/scene-cache';
import { errorMessage } from './campaign-screen';
import { SceneStage } from './SceneStage';

/**
 * The map at the centre of the table: the scene open for everyone, with pan
 * and zoom, and for the master the table switch and the grid. When the master
 * closes it, it leaves every screen. Kept live by the campaign socket.
 */
export function TableMap({ campaignId, isMaster }: { campaignId: string; isMaster: boolean }) {
  const active = useQuery(activeSceneQuery(campaignId));
  const scene = active.data;

  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="table-map-title">
      <div className={sectionHeading}>
        <h2 id="table-map-title"><MapTrifold size={20} aria-hidden="true" /> {scene ? scene.name : 'Mapa'}</h2>
      </div>
      {active.isPending && <Skeleton shape="panel" label="Carregando o mapa…" />}
      {active.data === undefined && active.isError && (
        <div className="grid justify-items-start gap-3">
          <p role="alert" className="text-body text-danger-text">{errorMessage(active.error)}</p>
          <ActionButton variant="secondary" loading={active.isFetching} onClick={() => { void active.refetch(); }}>Tentar novamente</ActionButton>
        </div>
      )}
      {/* null is an answer: no map open. A failed refresh keeps the last one. */}
      {active.data === null && (
        <OpenScene scene={null} isMaster={isMaster}
          action={isMaster && (
            <Button asChild variant="secondary">
              <Link to="/campaigns/$campaignId/prep" params={{ campaignId }}>Ir para o Preparo</Link>
            </Button>
          )} />
      )}
      {scene && (
        <SceneStage key={scene.id} campaignId={campaignId} scene={scene} isMaster={isMaster}
          mapClassName="h-[min(70dvh,720px)] min-h-[320px]" />
      )}
    </section>
  );
}

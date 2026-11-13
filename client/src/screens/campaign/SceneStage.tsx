import { useId, useState } from 'react';
import { Broadcast, GridFour, XCircle } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GridSettings as Grid, SceneView } from '@quest-fast/shared';
import { Button } from '../../components/Button';
import { GridSettings } from '../../components/GridSettings';
import { MapCanvas } from '../../components/MapCanvas';
import { Surface } from '../../components/Surface';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { activeSceneQuery, mergeScene, sceneListQuery, sceneQuery } from '../../lib/scene-cache';
import { cn } from '../../lib/utils';
import { errorMessage } from './campaign-screen';

/** The master's bar over the map: the table switch and the grid panel's. */
function MasterBar({ campaignId, scene, gridOpen, gridPanelId, onToggleGrid }: {
  campaignId: string; scene: SceneView; gridOpen: boolean; gridPanelId: string; onToggleGrid: () => void;
}) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const table = useMutation({
    mutationFn: () => api.setActiveScene(campaignId, { sceneId: scene.active ? null : scene.id }),
    onSuccess: (opened) => {
      if (opened) mergeScene(queryClient, campaignId, opened);
      // Closing answers with nothing: the scene's new version comes by the socket,
      // or with the scene asked again when the socket is down.
      else void queryClient.invalidateQueries({ queryKey: sceneQuery(campaignId, scene.id).queryKey });
      void queryClient.invalidateQueries({ queryKey: activeSceneQuery(campaignId).queryKey });
      void queryClient.invalidateQueries({ queryKey: sceneListQuery(campaignId).queryKey });
    },
    onError: (error) => notify({ title: 'Não foi possível mudar o mapa da mesa', description: errorMessage(error), variant: 'error' }),
  });

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Ações do mestre">
      <Button variant={scene.active ? 'secondary' : 'primary'} loading={table.isPending} onClick={() => table.mutate()}>
        {scene.active
          ? <><XCircle size={18} aria-hidden="true" /> Fechar para a mesa</>
          : <><Broadcast size={18} aria-hidden="true" /> Abrir para a mesa</>}
      </Button>
      <Button variant="secondary" aria-expanded={gridOpen} aria-controls={gridPanelId} onClick={onToggleGrid}>
        <GridFour size={18} aria-hidden="true" /> {gridOpen ? 'Ocultar grid' : 'Ajustar grid'}
      </Button>
    </div>
  );
}

/** The grid panel beside the map; every valid change previews on it. */
function GridPanel({ id, campaignId, scene, onPreview }: {
  id: string; campaignId: string; scene: SceneView; onPreview: (grid: Grid | null) => void;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (grid: Grid) => api.updateScene(campaignId, scene.id, { grid }),
    onSuccess: ({ scene: saved }) => {
      mergeScene(queryClient, campaignId, saved);
      onPreview(null);
    },
  });

  return (
    <Surface id={id} className="min-w-0 self-start">
      <h3 className="mb-4 font-display text-h2 font-semibold">Grid</h3>
      {/* A new map has another width: the draft starts over from the saved grid. */}
      <GridSettings key={`${scene.id}:${scene.mapWidth}`} grid={scene.grid} mapWidth={scene.mapWidth} mapHeight={scene.mapHeight}
        onPreview={onPreview} onSave={(grid) => save.mutate(grid)} saving={save.isPending}
        serverError={save.isError ? errorMessage(save.error) : undefined} />
    </Surface>
  );
}

/**
 * The map with pan and zoom and, for the master, the table switch and the
 * grid panel. An unsaved grid previews on the map until it is saved or the
 * panel is hidden.
 */
export function SceneStage({ campaignId, scene, isMaster, mapClassName }: {
  campaignId: string; scene: SceneView; isMaster: boolean;
  /** The map's height where it is shown. */
  mapClassName: string;
}) {
  const gridPanelId = useId();
  const [gridOpen, setGridOpen] = useState(false);
  const [preview, setPreview] = useState<{ sceneId: string; grid: Grid } | null>(null);
  const shownGrid = preview?.sceneId === scene.id ? preview.grid : scene.grid;
  const toggleGrid = () => {
    if (gridOpen) setPreview(null);
    setGridOpen(!gridOpen);
  };

  return (
    <div className="grid min-w-0 gap-4">
      {isMaster && <MasterBar campaignId={campaignId} scene={scene} gridOpen={gridOpen} gridPanelId={gridPanelId} onToggleGrid={toggleGrid} />}
      <div className={cn('grid min-w-0 gap-4', gridOpen && '@min-[1000px]:grid-cols-[minmax(0,1fr)_20rem]')}>
        <div className={cn('min-w-0', mapClassName)}>
          <MapCanvas imageUrl={scene.mapUrl} mapWidth={scene.mapWidth} mapHeight={scene.mapHeight} grid={shownGrid} label={scene.name} />
        </div>
        {gridOpen && (
          <GridPanel id={gridPanelId} campaignId={campaignId} scene={scene}
            onPreview={(grid) => setPreview(grid ? { sceneId: scene.id, grid } : null)} />
        )}
      </div>
    </div>
  );
}

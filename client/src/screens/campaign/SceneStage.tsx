import { useId, useRef, useState } from 'react';
import { Broadcast, GridFour, MapPin, XCircle } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GridSettings as Grid, SceneView, TokenView } from '@quest-fast/shared';
import { Button } from '../../components/Button';
import { GridSettings } from '../../components/GridSettings';
import { MapCanvas, type MapCanvasHandle } from '../../components/MapCanvas';
import { Surface } from '../../components/Surface';
import { TokenList } from '../../components/TokenList';
import { useCampaignChannel } from '../../hooks/useCampaignSocket';
import { useFullscreenView } from '../../hooks/useFullscreenView';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { activeSceneQuery, mergeScene, sceneListQuery, sceneQuery } from '../../lib/scene-cache';
import { canMoveToken } from '../../lib/token-labels';
import { cn } from '../../lib/utils';
import { errorMessage } from './campaign-screen';
import { FightTurn } from './FightTurn';
import { TokenPickerPanel } from './TokenPickerPanel';
import { useFight } from './useFight';
import { useTokenMoves } from './useTokenMoves';

type Panel = 'grid' | 'tokens' | null;

/** The master's bar over the map: the table switch, the grid panel's and the token picker's. */
function MasterBar({ campaignId, scene, panel, gridPanelId, pickerId, onToggle }: {
  campaignId: string; scene: SceneView; panel: Panel; gridPanelId: string; pickerId: string; onToggle: (panel: 'grid' | 'tokens') => void;
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
      <Button variant="secondary" aria-expanded={panel === 'tokens'} aria-controls={pickerId} onClick={() => onToggle('tokens')}>
        <MapPin size={18} aria-hidden="true" /> {panel === 'tokens' ? 'Fechar tokens' : 'Pôr tokens'}
      </Button>
      <Button variant="secondary" aria-expanded={panel === 'grid'} aria-controls={gridPanelId} onClick={() => onToggle('grid')}>
        <GridFour size={18} aria-hidden="true" /> {panel === 'grid' ? 'Ocultar grid' : 'Ajustar grid'}
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
 * Where each part of the stage goes: in the page, or filling the window over
 * the app's bars (under dialogs and toasts), the map taking what is left.
 */
function stageLayout({ fullscreen, isMaster, mapClassName, name }: {
  fullscreen: boolean; isMaster: boolean; mapClassName: string; name: string;
}) {
  if (!fullscreen) {
    return {
      region: {},
      stage: '@container/stage grid min-w-0 gap-4',
      body: 'grid min-w-0 gap-4 @min-[52rem]/stage:grid-cols-[minmax(0,1fr)_18rem]',
      map: cn('min-w-0', mapClassName),
      side: 'grid min-w-0 content-start gap-4',
    };
  }
  return {
    region: { role: 'region', 'aria-label': `${name}, mapa em tela cheia` },
    stage: cn(
      '@container/stage fixed inset-0 z-30 grid min-w-0 gap-3 overflow-hidden bg-background p-3 pb-[calc(var(--spacing-3)+env(safe-area-inset-bottom,0px))]',
      isMaster ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]',
    ),
    body: 'grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-3 @min-[52rem]/stage:grid-cols-[minmax(0,1fr)_18rem] @min-[52rem]/stage:grid-rows-[minmax(0,1fr)]',
    map: 'min-h-0 min-w-0',
    side: 'grid max-h-[35dvh] min-h-0 min-w-0 content-start gap-4 overflow-y-auto overscroll-contain @min-[52rem]/stage:max-h-none',
  };
}

/**
 * The map with pan and zoom, its tokens and their list beside it (below on a
 * narrow screen) and, for the master, the table switch, the token picker and
 * the grid panel. An unsaved grid previews on the map until it is saved or
 * the panel is hidden. Whoever may move a token drags it on the map or moves
 * it with the arrows from the list.
 */
export function SceneStage({ campaignId, scene, isMaster, mapClassName, allowFullscreen = false }: {
  campaignId: string; scene: SceneView; isMaster: boolean;
  /** The map's height where it is shown. */
  mapClassName: string;
  /** The stage may fill the screen (not inside a dialog, whose frame would hold it). */
  allowFullscreen?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useFullscreenView(stageRef);
  const layout = stageLayout({ fullscreen, isMaster, mapClassName, name: scene.name });
  const gridPanelId = useId();
  const pickerId = useId();
  const mapRef = useRef<MapCanvasHandle>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const viewerId = me.data?.user.id ?? null;
  const { motion } = useCampaignChannel();
  const fight = useFight(campaignId);
  const fighterOfToken = (tokenId: string) => {
    const token = scene.tokens.find((candidate) => candidate.id === tokenId);
    return token && fight ? fight.fighterOf(token) : null;
  };
  // In a fight, a move of the combatant whose turn it is waits for confirmation: it spends the turn.
  const confirms = (tokenId: string) => fight !== null && fighterOfToken(tokenId)?.id === fight.encounter.activeCombatantId;
  const moves = useTokenMoves({ campaignId, scene, mapRef, confirms });
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedId = scene.tokens.some((token) => token.id === selected) ? selected : null;
  const [preview, setPreview] = useState<{ sceneId: string; grid: Grid } | null>(null);
  const shownGrid = preview?.sceneId === scene.id ? preview.grid : scene.grid;
  const toggle = (next: 'grid' | 'tokens') => {
    if (panel === 'grid') setPreview(null);
    setPanel(panel === next ? null : next);
  };
  // A token whose last drop is still unanswered waits for it before the next drag;
  // in a fight a player moves their own only on its turn (the server says the same).
  const canMove = (token: TokenView) => {
    if (!canMoveToken(token, viewerId, isMaster) || moves.settling(token.id)) return false;
    const fighter = fight?.fighterOf(token);
    return isMaster || !fighter || fighter.id === fight?.encounter.activeCombatantId;
  };
  const focus = selectedId ? fighterOfToken(selectedId) : null;

  return (
    <div ref={stageRef} {...layout.region} className={layout.stage}>
      {isMaster && (
        <MasterBar campaignId={campaignId} scene={scene} panel={panel} gridPanelId={gridPanelId} pickerId={pickerId} onToggle={toggle} />
      )}
      <div className={layout.body}>
        <div className={layout.map}>
          <MapCanvas ref={mapRef} imageUrl={scene.mapUrl} mapWidth={scene.mapWidth} mapHeight={scene.mapHeight} grid={shownGrid} label={scene.name}
            tokens={scene.tokens} viewerId={viewerId} selectedTokenId={selectedId} onSelect={setSelected} canMove={canMove}
            onGrab={moves.onGrab} onDrag={moves.onDrag} onDrop={moves.onDrop} onCancelDrag={moves.onCancelDrag} motion={motion}
            fullscreen={fullscreen} onFullscreenChange={allowFullscreen ? setFullscreen : undefined}
            pendingMove={moves.pending}
            moveConfirm={{
              onConfirm: () => moves.confirm(),
              onCancel: moves.cancel,
              onFree: isMaster ? () => moves.confirm({ free: true }) : undefined,
              busy: moves.confirming,
            }} />
        </div>
        <div className={layout.side}>
          {panel === 'grid' && (
            <GridPanel id={gridPanelId} campaignId={campaignId} scene={scene}
              onPreview={(grid) => setPreview(grid ? { sceneId: scene.id, grid } : null)} />
          )}
          {panel === 'tokens' && <TokenPickerPanel id={pickerId} campaignId={campaignId} scene={scene} mapRef={mapRef} />}
          {fight && <FightTurn campaignId={campaignId} fight={fight} focus={focus} viewerId={viewerId} isMaster={isMaster} />}
          <TokenList tokens={scene.tokens} viewerId={viewerId} master={isMaster} selectedId={selectedId} onSelect={setSelected}
            onStep={moves.onStep} busyIds={moves.busyIds}
            onToggleHidden={isMaster ? moves.onToggleHidden : undefined} onRemove={isMaster ? moves.onRemove : undefined} />
        </div>
      </div>
    </div>
  );
}

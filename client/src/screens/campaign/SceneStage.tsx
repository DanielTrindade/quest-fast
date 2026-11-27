import { useContext, useId, useMemo, useRef, useState, type RefObject } from 'react';
import { Broadcast, CaretDown, Cloud, GridFour, MapPin, Ruler, XCircle } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GridSettings as Grid, SceneView, TokenView } from '@quest-fast/shared';
import { AreaList } from '../../components/AreaList';
import { AreaToolbar } from '../../components/AreaToolbar';
import { Button } from '../../components/Button';
import { FogToolbar } from '../../components/FogToolbar';
import { GridSettings } from '../../components/GridSettings';
import { MapCanvas, type MapCanvasHandle } from '../../components/MapCanvas';
import { Surface } from '../../components/Surface';
import { TokenList } from '../../components/TokenList';
import { useCampaignChannel } from '../../hooks/useCampaignSocket';
import { useFullscreenView } from '../../hooks/useFullscreenView';
import { useStoredFlag } from '../../hooks/useStoredFlag';
import type { ActionPanelTab } from '../../components/ActionPanel';
import { StagePanel } from './StagePanel';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { areasForLook } from '../../lib/area-tool';
import { activeSceneQuery, mergeScene, sceneListQuery, sceneQuery } from '../../lib/scene-cache';
import { stopsAtLimit } from '../../lib/move-path';
import { AttackRangeContext, tokenOf } from '../../lib/attack-range-context';
import type { ShownRange } from '../../lib/reach-draw';
import { fightMarks, mayFight, moveRefusal, type MoveRefusal } from '../../lib/token-combat';
import { cn } from '../../lib/utils';
import { errorMessage } from './campaign-screen';
import { FightTurn } from './FightTurn';
import { TokenPickerPanel } from './TokenPickerPanel';
import { TokenVitalsPanel } from './TokenVitalsPanel';
import { useAreaControls, type AreaControls } from './useAreaControls';
import { useFogControls, type FogControls } from './useFogControls';
import { useFight, type Fight } from './useFight';
import { useTokenMoves } from './useTokenMoves';

type OpenPanel = 'grid' | 'tokens' | 'fog';
type Panel = OpenPanel | null;

/** The master's bar over the map: the table switch, the token picker's, the grid panel's and the fog's. */
function MasterBar({ campaignId, scene, panel, panelIds, onToggle }: {
  campaignId: string; scene: SceneView; panel: Panel; panelIds: Record<OpenPanel, string>; onToggle: (panel: OpenPanel) => void;
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
      <Button variant="secondary" aria-expanded={panel === 'tokens'} aria-controls={panelIds.tokens} onClick={() => onToggle('tokens')}>
        <MapPin size={18} aria-hidden="true" /> {panel === 'tokens' ? 'Fechar tokens' : 'Pôr tokens'}
      </Button>
      <Button variant="secondary" aria-expanded={panel === 'grid'} aria-controls={panelIds.grid} onClick={() => onToggle('grid')}>
        <GridFour size={18} aria-hidden="true" /> {panel === 'grid' ? 'Ocultar grid' : 'Ajustar grid'}
      </Button>
      <Button variant="secondary" aria-expanded={panel === 'fog'} aria-controls={panelIds.fog} onClick={() => onToggle('fog')}>
        <Cloud size={18} aria-hidden="true" /> {panel === 'fog' ? 'Fechar fog' : 'Fog of war'}
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

/** The fog panel beside the map: what the master draws with, and the whole map at once. */
function FogPanel({ id, scene, fog }: { id: string; scene: SceneView; fog: FogControls }) {
  return (
    <Surface id={id} className="min-w-0 self-start">
      <h3 className="mb-4 font-display text-h2 font-semibold">Fog of war</h3>
      <FogToolbar enabled={scene.fog.enabled} onEnabledChange={fog.setEnabled} tool={fog.tool} onToolChange={fog.setTool}
        areas={scene.fog.revealed.length} onWholeMap={(mode) => fog.apply({ mode, shape: { kind: 'all' } })}
        playerView={fog.playerView} onPlayerViewChange={fog.setPlayerView} busy={fog.busy} error={fog.error} />
    </Surface>
  );
}

/**
 * The area templates beside the map, for everyone at the table: the tools
 * behind a disclosure (most of the session nobody draws), and the list of
 * the scene's persistent areas.
 */
function AreasPanel({ scene, areas, isMaster, viewerId, selected, onDraw }: {
  scene: SceneView; areas: AreaControls; isMaster: boolean; viewerId: string | null;
  /** The selected token, when the viewer may anchor an area on it. */
  selected: TokenView | null;
  /** The tool came into hand: the fog's goes away. */
  onDraw: () => void;
}) {
  const [open, setOpen] = useState(false);
  const toolsId = useId();
  const look = useMemo(
    () => areasForLook(scene.areas, scene.tokens, { fog: scene.fog, look: 'master', master: isMaster, viewerId }),
    [scene.areas, scene.tokens, scene.fog, isMaster, viewerId],
  );
  return (
    <Surface className="grid min-w-0 gap-3 self-start">
      <Button variant="secondary" aria-expanded={open} aria-controls={toolsId} className="justify-between"
        onClick={() => {
          if (open) areas.putAway();
          setOpen(!open);
        }}>
        <span className="inline-flex items-center gap-2"><Ruler size={18} aria-hidden="true" /> Marcar área</span>
        <CaretDown size={16} aria-hidden="true" className={cn('transition-transform duration-(--duration-quick) ease-settle', open && 'rotate-180')} />
      </Button>
      <div id={toolsId} hidden={!open}>
        {open && (
          <AreaToolbar draft={areas.draft} onDraftChange={areas.setDraft} drawing={areas.drawing} master={isMaster}
            onDrawingChange={(drawing) => {
              if (drawing) onDraw();
              areas.setDrawing(drawing);
            }}
            anchor={selected?.name ?? null}
            onAnchor={selected ? () => areas.anchorOn(selected.id, selected) : undefined}
            busy={areas.busy} error={areas.error} />
        )}
      </div>
      <AreaList areas={scene.areas} tokens={scene.tokens} viewerId={viewerId} master={isMaster} fadedIds={look.faded}
        busyIds={areas.busyIds} onToggleHidden={isMaster ? areas.toggleHidden : undefined} onRemove={areas.remove} />
    </Surface>
  );
}

/** The master's open panel beside the map, if any. */
function MasterPanel({ panel, panelIds, campaignId, scene, mapRef, fog, onPreview }: {
  panel: Panel; panelIds: Record<OpenPanel, string>; campaignId: string; scene: SceneView;
  mapRef: RefObject<MapCanvasHandle | null>; fog: FogControls; onPreview: (grid: Grid | null) => void;
}) {
  if (panel === 'grid') return <GridPanel id={panelIds.grid} campaignId={campaignId} scene={scene} onPreview={onPreview} />;
  if (panel === 'tokens') return <TokenPickerPanel id={panelIds.tokens} campaignId={campaignId} scene={scene} mapRef={mapRef} />;
  if (panel === 'fog') return <FogPanel id={panelIds.fog} scene={scene} fog={fog} />;
  return null;
}

/**
 * The running fight's turn and health for the map and the list, kept while
 * the tokens and the encounter are the same: the map redraws when they change.
 */
function useFightMarks(tokens: readonly TokenView[], fight: Fight | null) {
  const encounter = fight?.encounter ?? null;
  return useMemo(() => fightMarks(tokens, encounter), [tokens, encounter]);
}

/**
 * What the viewer is told when a press on a token they may move does not
 * pick it up: without a word the gesture only pans the map (#109). A player
 * off their turn already sees whose turn it is, and a token not theirs is
 * not theirs to move: those say nothing.
 */
const REFUSAL_NOTICES: Partial<Record<MoveRefusal, { title: string; description: string }>> = {
  settling: {
    title: 'Este token ainda está sendo salvo',
    description: 'Espere o último movimento dele chegar à mesa e arraste de novo.',
  },
  'fight-unknown': {
    title: 'O combate ainda está carregando',
    description: 'Arraste de novo em instantes: sem ele, o movimento poderia gastar um turno.',
  },
};

/**
 * Whether a press picks a token up. When it does not for a reason the viewer
 * can wait out, they are told so; a fight still unknown is asked again, in
 * case its last request failed.
 */
function useMoveGate({ campaignId, viewerId, isMaster, settling, fight }: {
  campaignId: string; viewerId: string | null; isMaster: boolean;
  settling: (tokenId: string) => boolean; fight: Fight | null | undefined;
}) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  return (token: TokenView) => {
    const refusal = moveRefusal(token, {
      viewerId, master: isMaster, settling: settling(token.id), fight: fight === undefined ? undefined : fight?.encounter ?? null,
    });
    const notice = refusal ? REFUSAL_NOTICES[refusal] : undefined;
    if (notice) notify({ ...notice, variant: 'info' });
    if (refusal === 'fight-unknown') {
      void queryClient.invalidateQueries({ queryKey: ['encounters', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['encounter', campaignId] });
    }
    return refusal === null;
  };
}

/**
 * The attack range the Ações tab asked to see, around its attacker's token on
 * this scene; nothing when the attacker has none here. Kept while the token
 * and the range are the same: the map redraws when it changes.
 */
function useShownRange(tokens: readonly TokenView[]): ShownRange | null {
  const shown = useContext(AttackRangeContext)?.shown ?? null;
  const tokenId = shown ? tokenOf(tokens, shown.owner)?.id ?? null : null;
  const normal = shown?.range.normal ?? 0;
  const long = shown?.range.long ?? null;
  return useMemo(() => (tokenId ? { tokenId, normal, long } : null), [tokenId, normal, long]);
}

function stageClass(isMaster: boolean) {
  return cn(
    '@container/stage fixed inset-0 z-30 grid min-w-0 gap-3 overflow-hidden bg-background p-3 pb-[calc(var(--spacing-3)+env(safe-area-inset-bottom,0px))]',
    isMaster ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]',
  );
}

/** In the page, the map keeps its image's proportion. */
const mapAspect = (scene: SceneView) => ({ aspectRatio: `${scene.mapWidth} / ${scene.mapHeight}` });

/**
 * The table panel's state on the full screen: its tab (Mapa first), folded or
 * not (a preference of the browser, like the side menu) and the corner over
 * the map where it may show the chat while folded.
 */
function useTablePanel(staged: boolean) {
  const [tab, setTab] = useState<ActionPanelTab>('map');
  const [folded, setFolded] = useStoredFlag('quest-fast:stage-panel-collapsed');
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  // Counts the switches between the page and the full screen: the column
  // remounts on each, and what it held as a draft is gone for good.
  const [mode, setMode] = useState({ staged, switches: 0 });
  if (mode.staged !== staged) setMode({ staged, switches: mode.switches + 1 });
  return {
    staged,
    switches: mode.switches,
    layout: staged ? (folded ? 'folded' as const : 'open' as const) : null,
    setOverlay,
    /** Grid, tokens and fog live in Mapa: opening one (`opening`) brings the panel there. */
    showMap: (opening: boolean) => {
      if (!staged || !opening) return;
      setTab('map');
      setFolded(false);
    },
    state: { tab, onTabChange: setTab, collapsed: folded, onCollapsedChange: setFolded, overlay },
  };
}

/**
 * Where each part of the stage goes: in the page, or filling the window over
 * the app's bars (under dialogs and toasts), the map taking what is left.
 */
function stageLayout({ fullscreen, isMaster, mapClassName, name, panel }: {
  fullscreen: boolean; isMaster: boolean; mapClassName: string; name: string;
  /** On the full screen with the table panel: open, folded, or none (the stage's own column). */
  panel: 'open' | 'folded' | null;
}) {
  if (!fullscreen) {
    return {
      region: {},
      stage: '@container/stage grid min-w-0 gap-4',
      body: 'grid min-w-0 gap-4 @min-[52rem]/stage:grid-cols-[minmax(0,1fr)_18rem]',
      map: cn('w-full min-w-0', mapClassName),
      side: 'grid min-w-0 content-start gap-4',
    };
  }
  const region = { role: 'region', 'aria-label': `${name}, mapa em tela cheia` };
  if (panel) {
    // The table panel replaces the column: beside the map from 760 px, under it
    // on a phone (about 46% of the height), or a rail of icons when folded.
    return {
      region,
      stage: stageClass(isMaster),
      body: 'grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-3 @min-[47.5rem]/stage:grid-cols-[minmax(0,1fr)_auto] @min-[47.5rem]/stage:grid-rows-[minmax(0,1fr)]',
      map: 'relative min-h-0 min-w-0',
      side: panel === 'open'
        ? 'flex h-[46dvh] min-h-0 min-w-0 flex-col @min-[47.5rem]/stage:h-auto @min-[47.5rem]/stage:w-[21rem]'
        : 'flex min-w-0 @min-[47.5rem]/stage:min-h-0',
    };
  }
  return {
    region,
    stage: stageClass(isMaster),
    body: 'grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-3 @min-[52rem]/stage:grid-cols-[minmax(0,1fr)_18rem] @min-[52rem]/stage:grid-rows-[minmax(0,1fr)]',
    map: 'min-h-0 min-w-0',
    side: 'grid max-h-[35dvh] min-h-0 min-w-0 content-start gap-4 overflow-y-auto overscroll-contain @min-[52rem]/stage:max-h-none',
  };
}

/**
 * The two drawing tools of the stage, one in hand at a time: the fog's puts
 * the area's away, and the other way round. The area may follow the
 * selected token when the viewer may anchor on it (the master any, a player
 * their own character).
 */
function useDrawingTools(campaignId: string, scene: SceneView, isMaster: boolean, viewerId: string | null, selectedId: string | null) {
  const fog = useFogControls(campaignId, scene, isMaster);
  const areas = useAreaControls(campaignId, scene, isMaster);
  const fogControls: FogControls = {
    ...fog,
    setTool: (tool) => {
      if (tool) areas.putAway();
      fog.setTool(tool);
    },
  };
  const selected = scene.tokens.find((token) => token.id === selectedId) ?? null;
  const own = selected?.kind === 'character' && selected.ownerId === viewerId;
  return { fog, fogControls, areas, anchorable: selected && (isMaster || own) ? selected : null };
}

/**
 * The map with pan and zoom, its tokens and their list beside it (below on a
 * narrow screen) and, for the master, the table switch, the token picker and
 * the grid panel. An unsaved grid previews on the map until it is saved or
 * the panel is hidden. Whoever may move a token drags it on the map or moves
 * it with the arrows from the list.
 */
export function SceneStage({ campaignId, scene, isMaster, mapClassName, allowFullscreen = false, tablePanel = false }: {
  campaignId: string; scene: SceneView; isMaster: boolean;
  /** The bounds of the map's height where it is shown; within them it follows the image's proportion. */
  mapClassName: string;
  /** The stage may fill the screen (not inside a dialog, whose frame would hold it). */
  allowFullscreen?: boolean;
  /**
   * The Mesa's table panel goes along to the full screen, with the column's
   * content as its Mapa tab. Without it the full screen keeps the column.
   */
  tablePanel?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useFullscreenView(stageRef);
  const { staged, switches, layout: panelLayout, setOverlay, showMap, state: panelState } = useTablePanel(fullscreen && tablePanel);
  const layout = stageLayout({ fullscreen, isMaster, mapClassName, name: scene.name, panel: panelLayout });
  const panelIds = { grid: useId(), tokens: useId(), fog: useId() };
  const mapRef = useRef<MapCanvasHandle>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const viewerId = me.data?.user.id ?? null;
  const { motion } = useCampaignChannel();
  const fightState = useFight(campaignId);
  const fight = fightState ?? null;
  const fighterOfToken = (tokenId: string) => {
    const token = scene.tokens.find((candidate) => candidate.id === tokenId);
    return token && fight ? fight.fighterOf(token) : null;
  };
  // In a fight, a move of the combatant whose turn it is waits for confirmation: it spends the turn.
  const confirms = (tokenId: string) => fight !== null && fighterOfToken(tokenId)?.id === fight.encounter.activeCombatantId;
  // Whether a fight runs is not known yet: a token that may fight waits, or its move could spend a turn unasked.
  const waitsForFight = (token: TokenView) => fightState === undefined && mayFight(token);
  const moves = useTokenMoves({ campaignId, scene, mapRef, confirms });
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedId = scene.tokens.some((token) => token.id === selected) ? selected : null;
  // A draft belongs to the scene and to one mounting of the grid panel: going
  // full screen (or back) remounts the panel on the saved grid, and the map
  // drops the draft for good instead of keeping one the form no longer shows.
  const [preview, setPreview] = useState<{ key: string; grid: Grid } | null>(null);
  const previewKey = `${scene.id}:${switches}`;
  const shownGrid = preview?.key === previewKey ? preview.grid : scene.grid;
  const { fog, fogControls, areas, anchorable } = useDrawingTools(campaignId, scene, isMaster, viewerId, selectedId);
  const toggle = (next: OpenPanel) => {
    if (panel === 'grid') setPreview(null);
    if (panel === 'fog') fog.putAway();
    setPanel(panel === next ? null : next);
    showMap(panel !== next);
  };
  const canMove = useMoveGate({ campaignId, viewerId, isMaster, settling: moves.settling, fight: fightState });
  const focus = selectedId ? fighterOfToken(selectedId) : null;
  const marks = useFightMarks(scene.tokens, fight);
  const attackRange = useShownRange(scene.tokens);

  // The column beside the map: the master's open panel, the selected token,
  // its turn and the token list. On the full screen it is the panel's Mapa.
  const column = (
    <>
      <MasterPanel panel={panel} panelIds={panelIds} campaignId={campaignId} scene={scene} mapRef={mapRef} fog={fogControls}
        onPreview={(grid) => setPreview(grid ? { key: previewKey, grid } : null)} />
      <AreasPanel scene={scene} areas={areas} isMaster={isMaster} viewerId={viewerId} selected={anchorable} onDraw={() => fog.setTool(null)} />
      <TokenVitalsPanel key={selectedId} campaignId={campaignId} tokens={scene.tokens} selectedId={selectedId} isMaster={isMaster} viewerId={viewerId} />
      {fight && <FightTurn campaignId={campaignId} fight={fight} focus={focus} viewerId={viewerId} isMaster={isMaster} />}
      <TokenList tokens={scene.tokens} viewerId={viewerId} master={isMaster} fog={scene.fog} fightMarks={marks} selectedId={selectedId} onSelect={setSelected}
        onStep={(tokenId, direction) => {
          const token = scene.tokens.find((candidate) => candidate.id === tokenId);
          if (token && !waitsForFight(token)) moves.onStep(tokenId, direction);
        }}
        busyIds={moves.busyIds}
        onToggleHidden={isMaster ? moves.onToggleHidden : undefined} onRemove={isMaster ? moves.onRemove : undefined} />
    </>
  );

  return (
    <div ref={stageRef} {...layout.region} className={layout.stage}>
      {isMaster && (
        <MasterBar campaignId={campaignId} scene={scene} panel={panel} panelIds={panelIds} onToggle={toggle} />
      )}
      <div className={layout.body}>
        <div className={layout.map} style={fullscreen ? undefined : mapAspect(scene)}>
          <MapCanvas ref={mapRef} imageUrl={scene.mapUrl} mapWidth={scene.mapWidth} mapHeight={scene.mapHeight} grid={shownGrid} label={scene.name}
            tokens={scene.tokens} viewerId={viewerId} selectedTokenId={selectedId} onSelect={setSelected} canMove={canMove}
            onGrab={moves.onGrab} onDrag={moves.onDrag} onDrop={moves.onDrop} onCancelDrag={moves.onCancelDrag} motion={motion}
            fullscreen={fullscreen} onFullscreenChange={allowFullscreen ? setFullscreen : undefined}
            fog={scene.fog} fogLook={fog.look} fogTool={fog.tool} onFogShape={fog.apply}
            sceneId={scene.id} areas={scene.areas} areaTool={areas.tool} onAreaPreview={areas.preview} onAreaPlace={areas.place}
            areaPreviews={areas.previews} master={isMaster}
            pendingMove={moves.pending} fightMarks={marks} attackRange={attackRange}
            stopAtLimit={(token) => stopsAtLimit(isMaster, fight?.fighterOf(token)?.id, fight?.encounter.activeCombatantId)}
            moveConfirm={{
              onConfirm: () => moves.confirm(),
              onCancel: moves.cancel,
              onFree: isMaster ? () => moves.confirm({ free: true }) : undefined,
              busy: moves.confirming,
            }} />
          {/* Where the folded panel shows new chat lines; empty otherwise. */}
          <div ref={setOverlay} className="pointer-events-none absolute bottom-12 left-2 z-10" />
        </div>
        <div className={layout.side}>
          {staged ? <StagePanel campaignId={campaignId} isMaster={isMaster} {...panelState} map={column} /> : column}
        </div>
      </div>
    </div>
  );
}

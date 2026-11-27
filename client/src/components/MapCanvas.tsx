import { useEffect, useId, useImperativeHandle, useMemo, useRef, type KeyboardEvent, type Ref, type RefObject } from 'react';
import { ArrowsIn, ArrowsOut, CornersOut, MagnifyingGlassMinus, MagnifyingGlassPlus, Warning } from '@phosphor-icons/react';
import { FOG_LIMITS, formatMeters, squaresFor, type AreaGeometry, type AreaView, type FogOperation, type GridSettings, type SceneFog, type TokenView } from '@quest-fast/shared';
import { useMapAreas } from '../hooks/useAreaLayer';
import { useFogLayer, type PolygonProgress } from '../hooks/useFogLayer';
import { useMapViewport, ZOOM_STEP, type MapOverlay } from '../hooks/useMapViewport';
import { useTokenLayer, type TokenLayerOptions } from '../hooks/useTokenLayer';
import type { AreaPreviewSource } from '../lib/area-preview';
import { describeGeometry, type AreaTool } from '../lib/area-tool';
import { tokensForLook, type FogLook, type FogTool } from '../lib/fog-tool';
import { gridCells } from '../lib/map-view';
import { describeMove, type ShownRange } from '../lib/reach-draw';
import { turnName, type FightMarks } from '../lib/token-combat';
import { cn } from '../lib/utils';
import { MoveConfirm } from './MoveConfirm';
import { Button } from './ui/button';

export type MapCanvasProps = {
  /** The normalised map, drawn at `mapWidth` × `mapHeight`: the space of the grid. */
  imageUrl: string;
  mapWidth: number;
  mapHeight: number;
  grid: GridSettings;
  /** The scene's name, for the accessible label. */
  label: string;
  className?: string;
  /** Drawn over the map, the last on top. The list beside the map is their accessible form. */
  tokens?: readonly TokenView[];
  /** Who is looking: their own drag carries no "being moved by" label. */
  viewerId?: string | null;
  selectedTokenId?: string | null;
  /** Whether the map fills the screen; the screen decides how. */
  fullscreen?: boolean;
  /** Shows the full-screen switch among the map's controls. */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** A move in a fight waiting for confirmation, with what to do about it. */
  moveConfirm?: {
    onConfirm: () => void;
    onCancel: () => void;
    /** The master only: move without spending. */
    onFree?: () => void;
    busy?: boolean;
  };
  /** What the screen asks of the map: where the viewer is looking, and putting a refused drag back. */
  ref?: Ref<MapCanvasHandle>;
  /** The scene's fog, as the server sent it. */
  fog?: SceneFog | null;
  /**
   * How the fog looks. `player` on the master's screen is "ver como jogador":
   * opaque, and without the tokens a player would not receive.
   */
  fogLook?: FogLook;
  /** The master's fog tool in hand: one finger draws instead of panning. */
  fogTool?: FogTool | null;
  /** A shape the master finished drawing, to send to the server. */
  onFogShape?: (operation: FogOperation) => void;
  /**
   * The running fight's marks, by token id: the ring of whose turn it is and
   * each combatant's health arc. The list beside the map says both in words.
   */
  fightMarks?: FightMarks;
  /** The scene's id: the reference areas others draw are of one scene. */
  sceneId?: string;
  /** The persistent area templates the viewer receives. The list beside the map is their accessible form. */
  areas?: readonly AreaView[];
  /** The area tool in hand: one finger draws instead of panning. */
  areaTool?: AreaTool | null;
  /** The reference area the viewer is drawing, for the table: `null` clears it, `done` lets it go. */
  onAreaPreview?: (area: AreaGeometry | null, done: boolean) => void;
  /** A persistent area the viewer finished drawing, to save. */
  onAreaPlace?: (area: AreaGeometry) => void;
  /** The reference areas others draw, fed by the socket. */
  areaPreviews?: AreaPreviewSource;
  /** Whether the viewer is the master: their screen fades the areas the table does not get. */
  master?: boolean;
} & Pick<TokenLayerOptions, 'onSelect' | 'canMove' | 'onGrab' | 'onDrag' | 'onDrop' | 'onCancelDrag' | 'motion' | 'pendingMove' | 'stopAtLimit' | 'attackRange'>;

export type MapCanvasHandle = {
  /** The middle of the area in view, in map pixels: where a new token lands. */
  viewCentre: () => { x: number; y: number };
  /** The drag or drop of this token was refused: it goes back to its saved place. */
  cancelDrag: (tokenId: string) => void;
};

const NO_TOKENS: readonly TokenView[] = [];
const NO_AREAS: readonly AreaView[] = [];

type AreaProps = Pick<MapCanvasProps, 'sceneId' | 'areas' | 'areaTool' | 'onAreaPreview' | 'onAreaPlace' | 'areaPreviews' | 'master'>;

/** The area props as the area layer reads them, with their defaults. */
function areaOptions(props: AreaProps) {
  return {
    sceneId: props.sceneId ?? '',
    areas: props.areas ?? NO_AREAS,
    tool: props.areaTool ?? null,
    onPreview: props.onAreaPreview,
    onPlace: props.onAreaPlace,
    previews: props.areaPreviews,
    master: props.master ?? false,
  };
}

/** The tool in hand, if any: the map draws instead of panning, and its help says how. */
function toolInHand(fogTool: FogTool | null, areaTool: AreaTool | null | undefined): { drawing: boolean; help: keyof typeof MAP_HELP } {
  if (fogTool) return { drawing: true, help: fogTool.shape };
  return areaTool ? { drawing: true, help: 'area' } : { drawing: false, help: 'pan' };
}

/**
 * The areas, the tokens and the fog tools share the canvas. The areas lie on
 * the ground, under the tokens; what the fog tool draws goes on top. A fog
 * tool in hand takes every press; an area tool in hand takes the press next;
 * otherwise it is the tokens'. A press stays with the layer that took it
 * until it ends.
 */
function layered(areas: RefObject<MapOverlay | null>, tokens: RefObject<MapOverlay | null>, fog: RefObject<MapOverlay | null>): MapOverlay {
  let owner: MapOverlay | null = null;
  return {
    draw(context, view, now) {
      const drawingAreas = areas.current?.draw(context, view, now) ?? false;
      const moving = tokens.current?.draw(context, view, now) ?? false;
      fog.current?.draw(context, view, now);
      return moving || drawingAreas;
    },
    pointerDown(point, view) {
      if (fog.current) {
        owner = fog.current.pointerDown(point, view) ? fog.current : null;
        return owner !== null;
      }
      const layer = [areas.current, tokens.current].find((candidate) => candidate?.pointerDown(point, view)) ?? null;
      owner = layer;
      return owner !== null;
    },
    pointerMove(point, view) {
      owner?.pointerMove(point, view);
    },
    pointerUp(point, view) {
      owner?.pointerUp(point, view);
      owner = null;
    },
    cancel() {
      owner?.cancel();
      owner = null;
    },
  };
}

/** Loading the map, or failing to. */
function MapStatus({ status, onRetry }: { status: string; onRetry: () => void }) {
  if (status === 'loading') {
    return (
      <p role="status" className="absolute inset-0 m-0 grid place-items-center text-small text-text-secondary">
        Carregando o mapa…
      </p>
    );
  }
  if (status !== 'error') return null;
  return (
    <div role="alert" className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-4 text-center">
      <p className="m-0 flex items-center gap-2 text-small text-danger-text">
        <Warning size={18} weight="fill" aria-hidden="true" />
        Não foi possível carregar o mapa.
      </p>
      <Button variant="secondary" onClick={onRetry}>Tentar de novo</Button>
    </div>
  );
}

/**
 * The drawing tool hears a key first; what it does not take moves the map.
 * Only a key pressed on the map itself: Enter on "Cancelar" or on a zoom
 * button bubbles up here too, and must stay that button's.
 */
function keysFirst(tool: (key: string) => boolean, map: (event: KeyboardEvent<HTMLDivElement>) => void) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && tool(event.key)) event.preventDefault();
    else map(event);
  };
}

/** How to use the map, for the tool in hand. */
const MAP_HELP = {
  pan: 'Arraste para mover e use a roda do mouse ou dois dedos para aproximar. Pelo teclado, as setas movem o mapa, mais e menos aproximam e afastam, e zero enquadra o mapa inteiro.',
  rect: 'Arraste para desenhar o retângulo do fog; dois dedos movem o mapa. Esc cancela.',
  area: 'Pressione onde a área começa e arraste para apontá-la; uma esfera ou um cilindro segue o dedo. Ao soltar, a área fica no mapa. Dois dedos movem o mapa.',
  polygon: 'Clique para pôr cada ponto do polígono do fog e feche no primeiro ponto ou com Enter; Backspace tira o último ponto e Esc cancela. Dois dedos movem o mapa.',
} as const;

/** What the fog covers, for whoever cannot see the canvas. */
function describeFog(fog: SceneFog | null, look: FogLook): string {
  if (!fog?.enabled) return '';
  const areas = fog.revealed.length;
  const revealed = areas === 0 ? 'nada revelado' : areas === 1 ? '1 área revelada' : `${areas} áreas reveladas`;
  return look === 'player' ? ` Fog ligado, como os jogadores veem: ${revealed}.` : ` Fog ligado: ${revealed}.`;
}

function PolygonBar({ polygon }: { polygon: PolygonProgress }) {
  const enough = polygon.points >= FOG_LIMITS.minPoints;
  return (
    <div role="group" aria-label="Polígono do fog"
      className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-panel border border-border bg-card p-2 edge-raised">
      <p className="m-0 px-1 text-small text-text-secondary" aria-live="polite">
        <span className="font-mono tabular-nums text-foreground">{polygon.points}</span>
        {polygon.points === 1 ? ' ponto' : ' pontos'}
        {polygon.points >= FOG_LIMITS.maxPoints && ` (limite de ${FOG_LIMITS.maxPoints})`}
      </p>
      <Button variant="ghost" size="sm" onClick={polygon.undo}>Desfazer ponto</Button>
      <Button variant="ghost" size="sm" onClick={polygon.cancel}>Cancelar</Button>
      <Button size="sm" disabled={!enough} onClick={polygon.finish}>Concluir</Button>
    </div>
  );
}

/** The areas on the map, for whoever cannot see the canvas; the list beside the map has them whole. */
function describeAreas(areas: readonly AreaView[]): string {
  if (areas.length === 0) return '';
  const names = areas.slice(0, 5).map((area) => `${area.name} (${describeGeometry(area)})`).join(', ');
  const more = areas.length > 5 ? ` e mais ${areas.length - 5}` : '';
  return ` ${areas.length === 1 ? '1 área' : `${areas.length} áreas`} no mapa: ${names}${more}.`;
}

function describeTokens(tokens: readonly TokenView[], marks?: FightMarks): string {
  const turn = turnName(tokens, marks);
  const states = describeStates(tokens);
  return turn ? `${states} Vez de ${turn}.` : states;
}

function describeStates(tokens: readonly TokenView[]): string {
  const count = tokens.length;
  if (count === 0) return 'Nenhum token no mapa.';
  const total = count === 1 ? '1 token no mapa.' : `${count} tokens no mapa.`;
  const down = tokens.filter((token) => token.vitality === 'down').length;
  const defeated = tokens.filter((token) => token.vitality === 'defeated').length;
  const states = [
    down === 0 ? '' : down === 1 ? '1 caído' : `${down} caídos`,
    defeated === 0 ? '' : defeated === 1 ? '1 derrotado' : `${defeated} derrotados`,
  ].filter(Boolean);
  return states.length === 0 ? total : `${total} ${states.join(', ')}.`;
}

/** The range of an attack shown on the map, which the canvas draws as outlines. */
function describeAttackRange(tokens: readonly TokenView[], range: ShownRange | null | undefined): string {
  const token = range && tokens.find((candidate) => candidate.id === range.tokenId);
  if (!range || !token) return '';
  const long = range.long === null ? '' : ` e, com desvantagem, até ${formatMeters(range.long)}`;
  return ` Alcance do ataque de ${token.name}: ${formatMeters(range.normal)}${long}.`;
}

/** The selected token's reach, which the canvas draws as a tinted area. */
function describeReach(token: TokenView | undefined): string {
  if (!token?.reach) return '';
  const squares = squaresFor(token.reach.left);
  return ` ${token.name} ainda alcança ${formatMeters(token.reach.left)}, ${squares === 1 ? '1 casa' : `${squares} casas`} em qualquer direção.`;
}

function describeGrid(grid: GridSettings, mapWidth: number, mapHeight: number): string {
  if (!grid.enabled) return 'Sem grid.';
  const cells = gridCells(grid, { width: mapWidth, height: mapHeight });
  return `Grid de ${cells.columns} por ${cells.rows} casas, casa de ${Math.round(grid.cellSize * 10) / 10} pixels.`;
}

function FullscreenButton({ fullscreen = false, onFullscreenChange }: Required<Pick<MapCanvasProps, 'onFullscreenChange'>> & Pick<MapCanvasProps, 'fullscreen'>) {
  return (
    <Button variant="ghost" size="icon" aria-label={fullscreen ? 'Sair da tela cheia' : 'Mapa em tela cheia'}
      onClick={() => onFullscreenChange(!fullscreen)}>
      {fullscreen ? <ArrowsIn size={20} aria-hidden="true" /> : <ArrowsOut size={20} aria-hidden="true" />}
    </Button>
  );
}

function MapControls({ zoom, onZoom, onFrame, fullscreen, onFullscreenChange }: {
  zoom: number; onZoom: (factor: number) => void; onFrame: () => void;
} & Pick<MapCanvasProps, 'fullscreen' | 'onFullscreenChange'>) {
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
      <p className="pointer-events-auto m-0 rounded-control border border-border bg-card px-2 py-1 font-mono text-small tabular-nums text-text-secondary edge-raised">
        <span className="sr-only">Zoom </span>{zoom}%
      </p>
      <div className="pointer-events-auto flex gap-1 rounded-panel border border-border bg-card p-1 edge-raised" role="group" aria-label="Zoom do mapa">
        <Button variant="ghost" size="icon" aria-label="Afastar" onClick={() => onZoom(1 / ZOOM_STEP)}>
          <MagnifyingGlassMinus size={20} aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Aproximar" onClick={() => onZoom(ZOOM_STEP)}>
          <MagnifyingGlassPlus size={20} aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Enquadrar o mapa" onClick={onFrame}>
          <CornersOut size={20} aria-hidden="true" />
        </Button>
        {onFullscreenChange && <FullscreenButton fullscreen={fullscreen} onFullscreenChange={onFullscreenChange} />}
      </div>
    </div>
  );
}

/**
 * The map of a scene on a 2D canvas: drag to pan, wheel or two fingers to
 * zoom, "Enquadrar" to see it whole. The grid is drawn only over the visible
 * part of the map, crisp at any zoom and on any `devicePixelRatio`.
 * Presentational: the image, its size and the grid come by props.
 *
 * The canvas has no text of its own, so what it shows is also in the DOM:
 * the label, the map's size and grid, how to move it, and the zoom.
 */
export function MapCanvas({
  imageUrl, mapWidth, mapHeight, grid, label, className, tokens = NO_TOKENS, viewerId = null, selectedTokenId = null,
  onSelect, canMove, onGrab, onDrag, onDrop, onCancelDrag, motion, ref, fullscreen = false, onFullscreenChange,
  pendingMove = null, moveConfirm, stopAtLimit, fog = null, fogLook = 'master', fogTool = null, onFogShape, fightMarks, attackRange = null,
  ...areaProps
}: MapCanvasProps) {
  const inHand = toolInHand(fogTool, areaProps.areaTool);
  const tokenOverlayRef = useRef<MapOverlay | null>(null);
  const areaOverlayRef = useRef<MapOverlay | null>(null);
  const fogOverlayRef = useRef<MapOverlay | null>(null);
  /** What the viewport draws and hands presses to: both layers, joined once mounted. */
  const overlayRef = useRef<MapOverlay | null>(null);
  const moveLabelRef = useRef<HTMLParagraphElement>(null);
  const fogLayer = useMemo(() => (fog ? { fog, look: fogLook } : null), [fog, fogLook]);
  const shown = useMemo(() => tokensForLook(tokens, fog, fogLook), [tokens, fog, fogLook]);
  const map = useMemo(() => ({ width: mapWidth, height: mapHeight }), [mapWidth, mapHeight]);
  const {
    frameRef, canvasRef, status, zoom, dragging, retry, zoomBy, frameMap, frameHandlers, canvasHandlers, requestDraw, viewCentre,
  } = useMapViewport({ imageUrl, mapWidth, mapHeight, grid, fog: fogLayer, overlayRef });
  const { overlay: areaOverlay, dragged, areas: shownAreas } = useMapAreas({
    ...areaOptions(areaProps), tokens, shown, fog, look: fogLook, viewerId, grid, map, motion, pendingMove, requestDraw, themedRef: frameRef,
    drag: { onDrag, onDrop, onCancelDrag },
  });
  const { cancelDrag } = useTokenLayer({
    tokens: shown, grid, map, viewerId, selectedId: selectedTokenId,
    onSelect, canMove, onGrab, ...dragged, motion, pendingMove, stopAtLimit, marks: fightMarks, attackRange, overlayRef: tokenOverlayRef, requestDraw, themedRef: frameRef,
    labelRef: moveLabelRef,
  });
  useEffect(() => {
    areaOverlayRef.current = areaOverlay;
    requestDraw();
    return () => {
      areaOverlayRef.current = null;
    };
  }, [areaOverlay, requestDraw]);
  const drawing = useFogLayer({ tool: fogTool, grid, map, onShape: onFogShape, requestDraw, themedRef: frameRef });
  const fogOverlay = drawing.overlay;
  useEffect(() => {
    overlayRef.current = layered(areaOverlayRef, tokenOverlayRef, fogOverlayRef);
    requestDraw();
    return () => {
      overlayRef.current = null;
    };
  }, [requestDraw]);
  useEffect(() => {
    fogOverlayRef.current = fogOverlay;
    requestDraw();
    return () => {
      fogOverlayRef.current = null;
    };
  }, [fogOverlay, requestDraw]);
  const onKeyDown = keysFirst(drawing.onKeyDown, frameHandlers.onKeyDown);
  const pendingToken = pendingMove ? tokens.find((token) => token.id === pendingMove.tokenId) : undefined;
  const pendingCost = pendingToken && pendingMove ? describeMove(pendingToken, pendingMove, grid) : null;
  useImperativeHandle(ref, () => ({ viewCentre, cancelDrag }), [viewCentre, cancelDrag]);
  const helpId = useId();
  const summaryId = useId();

  return (
    <div
      ref={frameRef}
      role="group"
      aria-roledescription="mapa"
      aria-label={label}
      aria-describedby={`${summaryId} ${helpId}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-slot="map-canvas"
      data-status={status}
      className={cn('relative isolate h-full min-h-0 w-full overflow-hidden rounded-panel border border-border bg-surface-secret outline-ring focus-visible:outline-2 focus-visible:outline-offset-2', className)}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 size-full touch-none select-none not-data-[status=ready]:hidden data-[dragging=true]:cursor-grabbing data-[status=ready]:cursor-grab data-[status=ready]:data-[drawing=true]:cursor-crosshair"
        data-status={status}
        data-dragging={dragging}
        data-drawing={inHand.drawing}
        {...canvasHandlers}
      />

      {/* What the dragged move costs, beside the token; the layer writes it. The list beside the map is the accessible form. */}
      <p ref={moveLabelRef} hidden aria-hidden="true" data-slot="move-label"
        className="pointer-events-none absolute top-0 left-0 m-0 rounded-control border border-border bg-card w-max max-w-[calc(100%-0.5rem)] px-2.5 py-1 text-small text-balance text-foreground edge-raised data-[over=true]:border-danger data-[over=true]:text-danger-text" />

      <p id={summaryId} className="sr-only">Mapa de {mapWidth} por {mapHeight} pixels. {describeGrid(grid, mapWidth, mapHeight)} {describeTokens(shown, fightMarks)}{describeReach(shown.find((token) => token.id === selectedTokenId))}{describeAttackRange(shown, attackRange)}{describeAreas(shownAreas)}{describeFog(fog, fogLook)}</p>
      <p id={helpId} className="sr-only">
        {MAP_HELP[inHand.help]}
      </p>

      <MapStatus status={status} onRetry={retry} />
      {drawing.polygon && (
        <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-center">
          <PolygonBar polygon={drawing.polygon} />
        </div>
      )}
      {pendingToken && pendingCost && moveConfirm && (
        <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-center">
          <MoveConfirm name={pendingToken.name} cost={pendingCost.label} left={pendingToken.reach?.left ?? Number.POSITIVE_INFINITY}
            over={pendingCost.meters > (pendingToken.reach?.left ?? Number.POSITIVE_INFINITY) + 1e-6}
            onConfirm={moveConfirm.onConfirm} onCancel={moveConfirm.onCancel} onFree={moveConfirm.onFree} busy={moveConfirm.busy} />
        </div>
      )}
      {status === 'ready' && zoom !== null ? (
        <MapControls zoom={zoom} onZoom={(factor) => zoomBy(factor)} onFrame={() => frameMap(true)}
          fullscreen={fullscreen} onFullscreenChange={onFullscreenChange} />
      ) : fullscreen && onFullscreenChange && (
        // Loading a new map, or failing to: the way out of full screen stays.
        <div className="absolute right-2 bottom-2 rounded-panel border border-border bg-card p-1 edge-raised">
          <FullscreenButton fullscreen onFullscreenChange={onFullscreenChange} />
        </div>
      )}
    </div>
  );
}

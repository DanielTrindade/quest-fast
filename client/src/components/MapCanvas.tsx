import { useId, useRef } from 'react';
import { CornersOut, MagnifyingGlassMinus, MagnifyingGlassPlus, Warning } from '@phosphor-icons/react';
import type { GridSettings, TokenView } from '@quest-fast/shared';
import { useMapViewport, ZOOM_STEP, type MapOverlay } from '../hooks/useMapViewport';
import { useTokenLayer, type TokenLayerOptions } from '../hooks/useTokenLayer';
import { gridCells } from '../lib/map-view';
import { cn } from '../lib/utils';
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
} & Pick<TokenLayerOptions, 'onSelect' | 'canMove' | 'onGrab' | 'onDrag' | 'onDrop' | 'onCancelDrag' | 'motion'>;

const NO_TOKENS: readonly TokenView[] = [];

function describeTokens(count: number): string {
  if (count === 0) return 'Nenhum token no mapa.';
  return count === 1 ? '1 token no mapa.' : `${count} tokens no mapa.`;
}

function describeGrid(grid: GridSettings, mapWidth: number, mapHeight: number): string {
  if (!grid.enabled) return 'Sem grid.';
  const cells = gridCells(grid, { width: mapWidth, height: mapHeight });
  return `Grid de ${cells.columns} por ${cells.rows} casas, casa de ${Math.round(grid.cellSize * 10) / 10} pixels.`;
}

function MapControls({ zoom, onZoom, onFrame }: { zoom: number; onZoom: (factor: number) => void; onFrame: () => void }) {
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
  onSelect, canMove, onGrab, onDrag, onDrop, onCancelDrag, motion,
}: MapCanvasProps) {
  const overlayRef = useRef<MapOverlay | null>(null);
  const {
    frameRef, canvasRef, status, zoom, dragging, retry, zoomBy, frameMap, frameHandlers, canvasHandlers, requestDraw,
  } = useMapViewport({ imageUrl, mapWidth, mapHeight, grid, overlayRef });
  useTokenLayer({
    tokens, grid, map: { width: mapWidth, height: mapHeight }, viewerId, selectedId: selectedTokenId,
    onSelect, canMove, onGrab, onDrag, onDrop, onCancelDrag, motion, overlayRef, requestDraw, themedRef: frameRef,
  });
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
      {...frameHandlers}
      data-slot="map-canvas"
      data-status={status}
      className={cn('relative isolate h-full min-h-0 w-full overflow-hidden rounded-panel border border-border bg-surface-secret outline-ring focus-visible:outline-2 focus-visible:outline-offset-2', className)}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 size-full touch-none select-none not-data-[status=ready]:hidden data-[dragging=true]:cursor-grabbing data-[status=ready]:cursor-grab"
        data-status={status}
        data-dragging={dragging}
        {...canvasHandlers}
      />

      <p id={summaryId} className="sr-only">Mapa de {mapWidth} por {mapHeight} pixels. {describeGrid(grid, mapWidth, mapHeight)} {describeTokens(tokens.length)}</p>
      <p id={helpId} className="sr-only">
        Arraste para mover e use a roda do mouse ou dois dedos para aproximar. Pelo teclado, as setas movem o mapa, mais e menos aproximam e afastam, e zero enquadra o mapa inteiro.
      </p>

      {status === 'loading' && (
        <p role="status" className="absolute inset-0 m-0 grid place-items-center text-small text-text-secondary">
          Carregando o mapa…
        </p>
      )}
      {status === 'error' && (
        <div role="alert" className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-4 text-center">
          <p className="m-0 flex items-center gap-2 text-small text-danger-text">
            <Warning size={18} weight="fill" aria-hidden="true" />
            Não foi possível carregar o mapa.
          </p>
          <Button variant="secondary" onClick={retry}>Tentar de novo</Button>
        </div>
      )}
      {status === 'ready' && zoom !== null && (
        <MapControls zoom={zoom} onZoom={(factor) => zoomBy(factor)} onFrame={() => frameMap(true)} />
      )}
    </div>
  );
}

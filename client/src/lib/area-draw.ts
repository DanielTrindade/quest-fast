import {
  anchorReach,
  areaCells,
  areaOutline,
  type AreaCell,
  type AreaColor,
  type AreaGeometry,
  type GridSettings,
  type Size as CreatureSize,
} from '@quest-fast/shared';
import { AREA_COLOR_TOKENS } from './area-tool';
import type { MapView, Size } from './map-view';

function token(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/**
 * How an area is drawn. `saved`: a persistent area of the scene. `hidden`:
 * one the table does not see, faded and dashed like a hidden token.
 * `preview`: a reference area, or one still being drawn, dashed.
 */
export type AreaLook = 'saved' | 'hidden' | 'preview';

export type DrawnArea = {
  geometry: AreaGeometry;
  tint: AreaColor;
  look: AreaLook;
  /** The size of the token it follows: the area counts from its edge. */
  anchorSize?: CreatureSize | null;
  /** Written beside the origin: the area's name, or who is drawing it. */
  label?: string;
};

/** Squares already worked out, by geometry and grid: the canvas redraws 60 times a second while a token moves. */
const CELL_CACHE = new Map<string, AreaCell[]>();
const CELL_CACHE_SIZE = 256;

function cachedCells(geometry: AreaGeometry, grid: GridSettings, map: Size, reach: number): AreaCell[] {
  const { shape, size, width, x, y, angle } = geometry;
  const key = [shape, size, width, x, y, angle, reach, grid.enabled, grid.cellSize, grid.offsetX, grid.offsetY, map.width, map.height].join('|');
  const found = CELL_CACHE.get(key);
  if (found) return found;
  const cells = areaCells(geometry, grid, map, reach);
  if (CELL_CACHE.size >= CELL_CACHE_SIZE) CELL_CACHE.delete(CELL_CACHE.keys().next().value!);
  CELL_CACHE.set(key, cells);
  return cells;
}

/** Alpha of the squares an area takes, and of its outline's wash. */
const CELL_ALPHA = { saved: 0.28, hidden: 0.14, preview: 0.22 } as const;
const OUTLINE_ALPHA = { saved: 1, hidden: 0.55, preview: 0.9 } as const;

/**
 * Draws one area over the map: the squares it takes tinted (the rule of the
 * table, half a square or more), its true outline on top, and its label.
 * Without a grid only the outline shows.
 */
export function drawArea(context: CanvasRenderingContext2D, area: DrawnArea, scene: { view: MapView; grid: GridSettings; map: Size; themed: Element }) {
  const { view, grid, map, themed } = scene;
  const reach = anchorReach(area.anchorSize ?? null);
  const colour = token(themed, AREA_COLOR_TOKENS[area.tint]);
  const screen = (x: number, y: number) => [view.x + x * view.scale, view.y + y * view.scale] as const;
  context.save();
  context.fillStyle = colour;
  context.strokeStyle = colour;

  const cells = cachedCells(area.geometry, grid, map, reach);
  if (cells.length > 0) {
    context.globalAlpha = CELL_ALPHA[area.look];
    const side = grid.cellSize * view.scale;
    context.beginPath();
    for (const { column, row } of cells) {
      const [x, y] = screen(grid.offsetX + column * grid.cellSize, grid.offsetY + row * grid.cellSize);
      context.rect(x, y, side, side);
    }
    context.fill();
  }

  const outline = areaOutline(area.geometry, grid, reach);
  context.beginPath();
  outline.forEach(([x, y], index) => {
    const [sx, sy] = screen(x, y);
    if (index === 0) context.moveTo(sx, sy);
    else context.lineTo(sx, sy);
  });
  context.closePath();
  if (cells.length === 0) {
    context.globalAlpha = CELL_ALPHA[area.look];
    context.fill();
  }
  context.globalAlpha = OUTLINE_ALPHA[area.look];
  context.lineWidth = 2;
  if (area.look !== 'saved') context.setLineDash([6, 4]);
  context.stroke();
  context.setLineDash([]);

  if (area.label) {
    const [x, y] = screen(area.geometry.x, area.geometry.y);
    context.globalAlpha = 1;
    context.font = `600 12px ${token(themed, '--font-sans') || 'sans-serif'}`;
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.lineWidth = 3;
    context.strokeStyle = token(themed, '--color-surface-secret');
    context.strokeText(area.label, x, y - 6);
    context.fillStyle = token(themed, '--color-text-primary');
    context.fillText(area.label, x, y - 6);
  }
  context.restore();
}

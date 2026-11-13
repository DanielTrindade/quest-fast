import type { GridSettings } from '@quest-fast/shared';

/**
 * Where the map sits on the screen: a map pixel (mx, my) is drawn at
 * (x + mx * scale, y + my * scale) CSS pixels of the viewport.
 */
export type MapView = { x: number; y: number; scale: number };

export type Size = { width: number; height: number };

/** Map pixels per CSS pixel never go above this: 4× the map's own pixels. */
export const MAX_SCALE = 4;

/** At least this much of the map stays on screen while panning, in CSS pixels. */
const KEEP_VISIBLE = 48;

/** Below this many CSS pixels per cell the grid is a texture, not a grid, and is not drawn. */
export const MIN_GRID_CELL_ON_SCREEN = 6;

/** The whole map centred in the viewport, as large as it fits. */
export function fitView(map: Size, viewport: Size): MapView {
  const scale = Math.min(viewport.width / map.width, viewport.height / map.height);
  return {
    scale,
    x: (viewport.width - map.width * scale) / 2,
    y: (viewport.height - map.height * scale) / 2,
  };
}

/** From half the framed size (or 1:1, if smaller) up to `MAX_SCALE`. */
export function scaleBounds(map: Size, viewport: Size): { min: number; max: number } {
  const fit = fitView(map, viewport).scale;
  return { min: Math.min(fit / 2, 1), max: Math.max(MAX_SCALE, fit) };
}

/** Keeps the scale in bounds and a strip of the map on screen. */
export function clampView(view: MapView, map: Size, viewport: Size): MapView {
  const { min, max } = scaleBounds(map, viewport);
  const scale = Math.min(max, Math.max(min, view.scale));
  const keepX = Math.min(KEEP_VISIBLE, map.width * scale, viewport.width);
  const keepY = Math.min(KEEP_VISIBLE, map.height * scale, viewport.height);
  return {
    scale,
    x: Math.min(viewport.width - keepX, Math.max(keepX - map.width * scale, view.x)),
    y: Math.min(viewport.height - keepY, Math.max(keepY - map.height * scale, view.y)),
  };
}

/** Zooms by `factor` keeping the map point under (px, py) where it is. */
export function zoomAt(view: MapView, factor: number, px: number, py: number): MapView {
  const scale = view.scale * factor;
  return {
    scale,
    x: px - (px - view.x) * factor,
    y: py - (py - view.y) * factor,
  };
}

/**
 * Zooms by `factor` around (px, py), within the scale bounds: the anchor is
 * kept with the factor actually applied, so pushing past a bound does not
 * turn into a pan. `pan` then moves the result, as a pinch's midpoint does.
 */
export function zoomViewAt(
  view: MapView, factor: number, px: number, py: number, map: Size, viewport: Size, pan = { x: 0, y: 0 },
): MapView {
  const { min, max } = scaleBounds(map, viewport);
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  const zoomed = zoomAt(view, scale / view.scale, px, py);
  return clampView({ ...zoomed, x: zoomed.x + pan.x, y: zoomed.y + pan.y }, map, viewport);
}

/** The part of the map inside the viewport, in map pixels (empty when none is). */
export function visibleRect(view: MapView, map: Size, viewport: Size) {
  const left = Math.max(0, -view.x / view.scale);
  const top = Math.max(0, -view.y / view.scale);
  const right = Math.min(map.width, (viewport.width - view.x) / view.scale);
  const bottom = Math.min(map.height, (viewport.height - view.y) / view.scale);
  return { left, top, right: Math.max(left, right), bottom: Math.max(top, bottom) };
}

/**
 * The grid lines to draw, in map pixels: only those inside the visible part
 * of the map, so a 4096 px map at 400% draws a screenful, not the whole grid.
 * Empty when the grid is off or its cells are too small on screen.
 */
export function gridLines(grid: GridSettings, view: MapView, map: Size, viewport: Size): { xs: number[]; ys: number[] } {
  if (!grid.enabled || grid.cellSize * view.scale < MIN_GRID_CELL_ON_SCREEN) return { xs: [], ys: [] };
  const rect = visibleRect(view, map, viewport);
  const lines = (offset: number, from: number, to: number) => {
    const out: number[] = [];
    const first = offset + Math.ceil((from - offset) / grid.cellSize) * grid.cellSize;
    for (let at = first; at <= to; at += grid.cellSize) out.push(at);
    return out;
  };
  return { xs: lines(grid.offsetX, rect.left, rect.right), ys: lines(grid.offsetY, rect.top, rect.bottom) };
}

/** Cells across and down, counting a partial cell at the edges as one. */
export function gridCells(grid: GridSettings, map: Size): { columns: number; rows: number } {
  const count = (offset: number, length: number) =>
    (offset > 0 ? 1 : 0) + Math.ceil((length - offset) / grid.cellSize - 1e-9);
  return { columns: count(grid.offsetX, map.width), rows: count(grid.offsetY, map.height) };
}

import { FOG_LIMITS, type FogMode, type FogOperation, type GridSettings } from '@quest-fast/shared';
import type { MapView, Size } from './map-view';

export type Point = { x: number; y: number };

/** The shape the master draws with: a room is a rectangle, a cave a polygon. */
export type FogShapeKind = 'rect' | 'polygon';

/** A fog tool in hand: what it does and with which shape. */
export type FogTool = { mode: FogMode; shape: FogShapeKind };

/** How the fog looks: see-through for the master, opaque for a player (or the master viewing as one). */
export type FogLook = 'master' | 'player';

/** A screen point (CSS pixels of the canvas) in map pixels. */
export function toMap(point: Point, view: MapView): Point {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/**
 * The rectangle between two corners of a drag, in map pixels and inside the
 * map. With the grid on and snapping, it grows to the grid lines around it,
 * covering every cell the drag touched: rooms on the table's maps follow the
 * grid, and a drag inside one cell still reveals that cell.
 */
export function fogRect(a: Point, b: Point, grid: GridSettings, map: Size): { x: number; y: number; width: number; height: number } {
  let left = Math.min(a.x, b.x);
  let right = Math.max(a.x, b.x);
  let top = Math.min(a.y, b.y);
  let bottom = Math.max(a.y, b.y);
  if (grid.enabled && grid.snap) {
    const down = (value: number, offset: number) => offset + Math.floor((value - offset) / grid.cellSize) * grid.cellSize;
    const up = (value: number, offset: number) => offset + Math.ceil((value - offset) / grid.cellSize) * grid.cellSize;
    left = down(left, grid.offsetX);
    top = down(top, grid.offsetY);
    right = Math.max(up(right, grid.offsetX), left + grid.cellSize);
    bottom = Math.max(up(bottom, grid.offsetY), top + grid.cellSize);
  }
  const x = clamp(left, map.width);
  const y = clamp(top, map.height);
  return { x, y, width: clamp(right, map.width) - x, height: clamp(bottom, map.height) - y };
}

/** The operation a finished drag sends, or null when it covers less than a pixel of the map. */
export function rectOperation(mode: FogMode, rect: ReturnType<typeof fogRect>): FogOperation | null {
  if (rect.width < 1 || rect.height < 1) return null;
  return { mode, shape: { kind: 'rect', ...rect } };
}

/** How close to the first point, in CSS pixels, a press closes the polygon. */
export const CLOSE_RADIUS = 14;

/** Whether a press at this screen point closes a polygon of these map points. */
export function closesPolygon(points: readonly Point[], press: Point, view: MapView): boolean {
  const first = points[0];
  if (!first || points.length < FOG_LIMITS.minPoints) return false;
  const x = view.x + first.x * view.scale;
  const y = view.y + first.y * view.scale;
  return Math.hypot(press.x - x, press.y - y) <= CLOSE_RADIUS;
}

/** The operation a finished polygon sends, or null while it has too few points. */
export function polygonOperation(mode: FogMode, points: readonly Point[]): FogOperation | null {
  if (points.length < FOG_LIMITS.minPoints || points.length > FOG_LIMITS.maxPoints) return null;
  return { mode, shape: { kind: 'polygon', points: points.map(({ x, y }) => [x, y] as [number, number]) } };
}

/** A press that moved at most this far, in CSS pixels, is a click that places a point. */
export const TAP_SLOP = 6;

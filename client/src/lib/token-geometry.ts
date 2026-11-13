import { clampToMap, snapToCell, tokenDiameter, type GridSettings, type Size as CreatureSize } from '@quest-fast/shared';
import type { MapView, Size } from './map-view';

type Point = { x: number; y: number };

/** Below this radius on screen a token is drawn as a dot, with no initials. */
export const MIN_TOKEN_RADIUS = 4;
/** A finger or the mouse may miss a small token by this much, in CSS pixels. */
export const HIT_SLOP = 6;
/** How far the pointer moves before a press on a token becomes a drag, in CSS pixels. */
export const DRAG_THRESHOLD = 4;

/** A point on the screen (relative to the canvas) in map pixels. */
export function toMapPoint(view: MapView, point: Point): Point {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}

/** A map point on the screen. */
export function toScreenPoint(view: MapView, point: Point): Point {
  return { x: view.x + point.x * view.scale, y: view.y + point.y * view.scale };
}

/** A token's radius on screen, never below the dot it falls back to. */
export function screenRadius(size: CreatureSize, cellSize: number, scale: number): number {
  return Math.max(MIN_TOKEN_RADIUS, (tokenDiameter(size, cellSize) / 2) * scale);
}

/**
 * The token under a screen point: the one drawn last (on top) wins. Each
 * token is `{ id, x, y, size }` at its drawn position.
 */
export function tokenAt<T extends Point & { id: string; size: CreatureSize }>(
  tokens: readonly T[], point: Point, view: MapView, cellSize: number,
): T | null {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    const centre = toScreenPoint(view, token);
    const radius = screenRadius(token.size, cellSize, view.scale) + HIT_SLOP;
    if ((point.x - centre.x) ** 2 + (point.y - centre.y) ** 2 <= radius ** 2) return token;
  }
  return null;
}

/** Where a token dropped at a map point rests: on the grid, on the map. The server checks the same. */
export function restingPoint(point: Point, grid: GridSettings, size: CreatureSize, map: Size): Point {
  const snapped = snapToCell(point.x, point.y, grid, size);
  return clampToMap(snapped.x, snapped.y, map.width, map.height);
}

/** One cell away by the arrow keys: the next cell's centre (or junction), on the map. */
export function stepToken(point: Point, direction: Point, grid: GridSettings, size: CreatureSize, map: Size): Point {
  const moved = { x: point.x + direction.x * grid.cellSize, y: point.y + direction.y * grid.cellSize };
  return restingPoint(moved, grid, size, map);
}

/**
 * Pure rules of the fog of war. The fog stores what was revealed as a
 * multipolygon in map pixels; the server applies every operation of the
 * master with these rules and is the only one that writes the result.
 */
import clipping from 'polygon-clipping';
import type { MultiPolygon } from './battlefield.ts';

/** A scene's fog, the same for every viewer: the map image already arrives whole. */
export type SceneFog = {
  enabled: boolean;
  /** What the table sees; `[]` hides the whole map. */
  revealed: MultiPolygon;
};

export const FOG_MODES = ['reveal', 'hide'] as const;
export type FogMode = (typeof FOG_MODES)[number];

/** A shape the master reveals or hides, in map pixels. */
export type FogShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  /** Clicked point by point; closed by the rule, not by repeating the first point. */
  | { kind: 'polygon'; points: [number, number][] }
  /** The whole map: "revelar tudo" and "ocultar tudo". */
  | { kind: 'all' };

export type FogOperation = { mode: FogMode; shape: FogShape };

export const FOG_LIMITS = {
  minPoints: 3,
  maxPoints: 200,
  /**
   * Most vertices the revealed area may hold. The spike reached 577 after
   * 2000 operations; the cap guards the payload and the point checks.
   */
  maxVertices: 10_000,
} as const;

const FOG_TOO_COMPLEX = 'O fog ficou complexo demais. Use "revelar tudo" ou "ocultar tudo" para recomeçar.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
}

/**
 * Reads an operation sent by a client. What falls outside the map is not an
 * error: `applyFog` clips the shape to it.
 */
export function validateFogOperation(value: unknown): { operation: FogOperation } | { error: string } {
  if (!isRecord(value) || !(FOG_MODES as readonly unknown[]).includes(value.mode) || !isRecord(value.shape)) {
    return { error: 'Operação de fog inválida.' };
  }
  const mode = value.mode as FogMode;
  const shape = value.shape;
  if (shape.kind === 'all') return { operation: { mode, shape: { kind: 'all' } } };
  if (shape.kind === 'rect') {
    const { x, y, width, height } = shape;
    if (![x, y, width, height].every(Number.isFinite)) return { error: 'O retângulo do fog tem coordenadas inválidas.' };
    if ((width as number) < 1 || (height as number) < 1) return { error: 'O retângulo do fog precisa ter pelo menos 1 px de lado.' };
    return { operation: { mode, shape: { kind: 'rect', x: x as number, y: y as number, width: width as number, height: height as number } } };
  }
  if (shape.kind === 'polygon') {
    const { points } = shape;
    if (!Array.isArray(points) || !points.every(isPoint)) return { error: 'O polígono do fog tem coordenadas inválidas.' };
    if (points.length < FOG_LIMITS.minPoints || points.length > FOG_LIMITS.maxPoints) {
      return { error: `O polígono do fog precisa ter de ${FOG_LIMITS.minPoints} a ${FOG_LIMITS.maxPoints} pontos.` };
    }
    return { operation: { mode, shape: { kind: 'polygon', points: points.map(([px, py]) => [px, py]) } } };
  }
  return { error: 'Operação de fog inválida.' };
}

function mapRect(mapWidth: number, mapHeight: number): MultiPolygon {
  return [[[[0, 0], [mapWidth, 0], [mapWidth, mapHeight], [0, mapHeight], [0, 0]]]];
}

function shapeRing(shape: Exclude<FogShape, { kind: 'all' }>): [number, number][] {
  if (shape.kind === 'rect') {
    const { x, y, width, height } = shape;
    return [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]];
  }
  return [...shape.points, shape.points[0]!];
}

/** Twice the signed area of a closed ring. */
function ringArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 1; i < ring.length; i++) {
    const [x1, y1] = ring[i - 1]!;
    const [x2, y2] = ring[i]!;
    area += x1 * y2 - x2 * y1;
  }
  return area;
}

/**
 * Integer coordinates keep the stored state small and stable. Rounding can
 * repeat a point or flatten a sliver, so those are dropped; a polygon whose
 * outer ring flattens goes with its holes.
 */
function rounded(polygons: MultiPolygon): MultiPolygon {
  const result: MultiPolygon = [];
  for (const polygon of polygons) {
    const rings: [number, number][][] = [];
    for (const [index, ring] of polygon.entries()) {
      const points: [number, number][] = [];
      for (const [x, y] of ring) {
        const point: [number, number] = [Math.round(x), Math.round(y)];
        const last = points.at(-1);
        if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
      }
      const usable = points.length >= 4 && ringArea(points) !== 0;
      if (!usable && index === 0) break;
      if (usable) rings.push(points);
    }
    if (rings.length > 0) result.push(rings);
  }
  return result;
}

/** Points stored in the revealed area, the measure `FOG_LIMITS.maxVertices` caps. */
export function fogVertexCount(revealed: MultiPolygon): number {
  return revealed.reduce((total, polygon) => total + polygon.reduce((sum, ring) => sum + ring.length, 0), 0);
}

function onIntegers(polygons: MultiPolygon): boolean {
  return polygons.every((polygon) => polygon.every((ring) => ring.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))));
}

/**
 * Rounding each ring on its own can make a hole touch the outer ring or
 * another hole: a shape the library never returns, that `isRevealed` reads
 * one way now and the next operation, which normalises it, another. The
 * rounded rings go through the library once more, which merges those; when
 * that adds a crossing off the integers, it is rounded again. A shape that
 * never settles on integers is kept consistent rather than integer.
 */
function normalised(polygons: MultiPolygon): MultiPolygon {
  let current = rounded(polygons);
  for (let pass = 0; pass < 4; pass++) {
    const merged = current.length === 0 ? [] : clipping.union(current);
    if (onIntegers(merged)) return merged;
    current = rounded(merged);
  }
  return current.length === 0 ? [] : clipping.union(current);
}

function settled(polygons: MultiPolygon): { revealed: MultiPolygon } | { error: string } {
  const revealed = normalised(polygons);
  return fogVertexCount(revealed) > FOG_LIMITS.maxVertices ? { error: FOG_TOO_COMPLEX } : { revealed };
}

/**
 * The revealed area after one operation: the union when revealing, the
 * difference when hiding, the shape clipped to the map first.
 */
export function applyFog(
  revealed: MultiPolygon,
  operation: FogOperation,
  mapWidth: number,
  mapHeight: number,
): { revealed: MultiPolygon } | { error: string } {
  const { mode, shape } = operation;
  if (shape.kind === 'all') return { revealed: mode === 'reveal' ? mapRect(mapWidth, mapHeight) : [] };
  try {
    const area = clipping.intersection([[shapeRing(shape)]], mapRect(mapWidth, mapHeight));
    return settled(mode === 'reveal' ? clipping.union(revealed, area) : clipping.difference(revealed, area));
  } catch {
    // The library gives up on rare degenerate input; the stored fog stays as it was.
    return { error: 'Não foi possível aplicar essa forma ao fog. Tente desenhá-la de novo.' };
  }
}

/**
 * The fog of a scene whose map was swapped for one `ratio` times as wide:
 * it follows the grid, scaled and clipped to the new map.
 */
export function scaleFog(revealed: MultiPolygon, ratio: number, mapWidth: number, mapHeight: number): MultiPolygon {
  if (revealed.length === 0) return [];
  const scaled: MultiPolygon = revealed.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x * ratio, y * ratio])));
  try {
    const result = settled(clipping.intersection(scaled, mapRect(mapWidth, mapHeight)));
    return 'revealed' in result ? result.revealed : [];
  } catch {
    return [];
  }
}

/** Where a point sits against a closed ring: inside, outside, or on its edge. */
function ringSide(ring: [number, number][], x: number, y: number): 'in' | 'out' | 'edge' {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const [x1, y1] = ring[i - 1]!;
    const [x2, y2] = ring[i]!;
    const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (cross === 0 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) {
      return 'edge';
    }
    if (y1 > y !== y2 > y && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) inside = !inside;
  }
  return inside ? 'in' : 'out';
}

/** Whether a point of the map is revealed. The edge of an area counts as revealed. */
export function isRevealed(revealed: MultiPolygon, x: number, y: number): boolean {
  return revealed.some(([outer, ...holes]) => {
    const side = outer ? ringSide(outer, x, y) : 'out';
    if (side === 'out') return false;
    if (side === 'edge') return true;
    return holes.every((hole) => ringSide(hole, x, y) !== 'in');
  });
}

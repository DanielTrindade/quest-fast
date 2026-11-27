/**
 * Pure rules of the area templates on the map (#113): the 5e shapes in
 * squares of 1,5 m, the squares each one takes and who may see it. Areas
 * keep their measures in metres, so recalibrating the grid resizes them;
 * the origin is in map pixels, like a token's centre.
 */
import { isTokenVisible, tokenCells, type GridSettings, type TokenVisibility } from './battlefield.ts';
import { isRevealed, type SceneFog } from './fog.ts';
import type { Role } from './role.ts';
import type { Size } from './sheet.ts';
import { SQUARE_METERS } from './turn.ts';

/** A cylinder is drawn as its circle on the map: only the name changes. */
export const AREA_SHAPES = ['sphere', 'cylinder', 'cone', 'line', 'cube'] as const;
export type AreaShape = (typeof AREA_SHAPES)[number];

/** A closed palette: the client maps each name to a token of the design system. */
export const AREA_COLORS = ['crimson', 'amber', 'emerald', 'azure', 'violet', 'slate'] as const;
export type AreaColor = (typeof AREA_COLORS)[number];

export const AREA_LIMITS = {
  /** A table rarely keeps more than a handful on the map. */
  perScene: 50,
  name: 40,
  /** Radius, length or edge: 36 m is 24 squares, past the largest SRD area but a few. */
  maxMeters: 36,
  /** How long a reference area stays for the table after it is let go. */
  previewLingerMs: 5000,
} as const;

/** What the shape of an area is, wherever it is drawn. */
export type AreaGeometry = {
  shape: AreaShape;
  /** Metres: the radius of a sphere or cylinder, the length of a cone or line, the edge of a cube. */
  size: number;
  /** Metres across a line; 1,5 m for any other shape, where it means nothing. */
  width: number;
  /**
   * Origin in map pixels: the centre of a sphere, the tip of a cone, the
   * start of a line, a corner of a cube. On a grid intersection, unless the
   * area follows a token, whose centre it then is.
   */
  x: number;
  y: number;
  /**
   * Degrees clockwise from east (the map's y grows downwards). A cone and a
   * line point this way; a cube grows from its corner towards this side and
   * the one 90° after it, so it is a multiple of 90. A sphere ignores it.
   */
  angle: number;
};

/** A square of the grid, counted from the grid's offset. */
export type AreaCell = { column: number; row: number };

type Point = [number, number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAreaShape(value: unknown): value is AreaShape {
  return typeof value === 'string' && (AREA_SHAPES as readonly string[]).includes(value);
}

export function isAreaColor(value: unknown): value is AreaColor {
  return typeof value === 'string' && (AREA_COLORS as readonly string[]).includes(value);
}

/** A measure the table can draw: whole squares, from one up to the limit. */
export function isAreaMeasure(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const squares = value / SQUARE_METERS;
  return value > 0 && value <= AREA_LIMITS.maxMeters && Math.abs(squares - Math.round(squares)) < 1e-6;
}

/** The angle kept for a shape: in [0, 360), a quarter turn for a cube, 0 for a circle. */
export function normalizeAngle(shape: AreaShape, angle: number): number {
  if (shape === 'sphere' || shape === 'cylinder') return 0;
  const turned = shape === 'cube' ? Math.round(angle / 90) * 90 : angle;
  const wrapped = ((turned % 360) + 360) % 360;
  return Math.round(wrapped * 100) / 100 % 360;
}

/** The nearest grid intersection, where an area's origin rests; the point itself without a grid. */
export function snapAreaOrigin(x: number, y: number, grid: GridSettings): { x: number; y: number } {
  if (!grid.enabled) return { x, y };
  const snap = (value: number, offset: number) => offset + Math.round((value - offset) / grid.cellSize) * grid.cellSize;
  return { x: snap(x, grid.offsetX), y: snap(y, grid.offsetY) };
}

/** Map pixels in one metre on this grid. */
function pixelsPerMeter(grid: Pick<GridSettings, 'cellSize'>): number {
  return grid.cellSize / SQUARE_METERS;
}

/** Points a circle is drawn with: fine enough that a square's half is decided by the circle, not the polygon. */
const CIRCLE_SEGMENTS = 96;

/**
 * How far an area following a token reaches past its origin, in metres: an
 * emanation counts from the creature's edge, so a medium token adds half a
 * square. Zero for an area that does not follow one.
 */
export function anchorReach(size: Size | null): number {
  return size === null ? 0 : (tokenCells(size) / 2) * SQUARE_METERS;
}

/**
 * The outline of an area in map pixels, a convex ring (not closed by
 * repeating the first point). `reach` widens a circle by the token it
 * follows (`anchorReach`).
 */
export function areaOutline(area: AreaGeometry, grid: Pick<GridSettings, 'cellSize'>, reach = 0): Point[] {
  const scale = pixelsPerMeter(grid);
  const { x, y } = area;
  const length = area.size * scale;
  const radians = (area.angle * Math.PI) / 180;
  const along: Point = [Math.cos(radians), Math.sin(radians)];
  const across: Point = [-along[1], along[0]];
  const at = (forward: number, side: number): Point => [x + along[0] * forward + across[0] * side, y + along[1] * forward + across[1] * side];
  switch (area.shape) {
    case 'sphere':
    case 'cylinder': {
      const radius = (area.size + reach) * scale;
      return Array.from({ length: CIRCLE_SEGMENTS }, (_, index) => {
        const turn = (index / CIRCLE_SEGMENTS) * 2 * Math.PI;
        return [x + radius * Math.cos(turn), y + radius * Math.sin(turn)] as Point;
      });
    }
    case 'cone':
      // 5e: the cone is as wide at its end as it is long.
      return [at(0, 0), at(length, -length / 2), at(length, length / 2)];
    case 'line': {
      const half = (area.width * scale) / 2;
      return [at(0, -half), at(length, -half), at(length, half), at(0, half)];
    }
    case 'cube':
      return [at(0, 0), at(length, 0), at(length, length), at(0, length)];
  }
}

/** Twice the signed area of an open ring. */
function doubleArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

/** Sutherland–Hodgman against one side of an axis-aligned box. */
function clipSide(ring: Point[], inside: (point: Point) => boolean, cross: (a: Point, b: Point) => Point): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i]!;
    const previous = ring[(i + ring.length - 1) % ring.length]!;
    const currentIn = inside(current);
    if (currentIn !== inside(previous)) result.push(cross(previous, current));
    if (currentIn) result.push(current);
  }
  return result;
}

/** Area of a convex ring inside the box [left, right] × [top, bottom]. */
function coveredArea(ring: Point[], left: number, top: number, right: number, bottom: number): number {
  const atX = (edge: number) => (a: Point, b: Point): Point => [edge, a[1] + ((b[1] - a[1]) * (edge - a[0])) / (b[0] - a[0])];
  const atY = (edge: number) => (a: Point, b: Point): Point => [a[0] + ((b[0] - a[0]) * (edge - a[1])) / (b[1] - a[1]), edge];
  let clipped = clipSide(ring, ([px]) => px >= left, atX(left));
  clipped = clipSide(clipped, ([px]) => px <= right, atX(right));
  clipped = clipSide(clipped, ([, py]) => py >= top, atY(top));
  clipped = clipSide(clipped, ([, py]) => py <= bottom, atY(bottom));
  return clipped.length < 3 ? 0 : Math.abs(doubleArea(clipped)) / 2;
}

/**
 * The squares an area takes, by the DMG's grid rule: a square counts when
 * at least half of it is covered. Only squares whose centre lies on the map;
 * none without a grid, where the area is drawn but takes no squares.
 */
export function areaCells(
  area: AreaGeometry,
  grid: GridSettings,
  map: { width: number; height: number },
  reach = 0,
): AreaCell[] {
  if (!grid.enabled) return [];
  const ring = areaOutline(area, grid, reach);
  const { cellSize, offsetX, offsetY } = grid;
  const xs = ring.map(([px]) => px);
  const ys = ring.map(([, py]) => py);
  const firstColumn = Math.floor((Math.max(0, Math.min(...xs)) - offsetX) / cellSize);
  const lastColumn = Math.floor((Math.min(map.width, Math.max(...xs)) - offsetX) / cellSize);
  const firstRow = Math.floor((Math.max(0, Math.min(...ys)) - offsetY) / cellSize);
  const lastRow = Math.floor((Math.min(map.height, Math.max(...ys)) - offsetY) / cellSize);
  const half = (cellSize * cellSize) / 2;
  const cells: AreaCell[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    const top = offsetY + row * cellSize;
    const centreY = top + cellSize / 2;
    if (centreY < 0 || centreY > map.height) continue;
    for (let column = firstColumn; column <= lastColumn; column++) {
      const left = offsetX + column * cellSize;
      const centreX = left + cellSize / 2;
      if (centreX < 0 || centreX > map.width) continue;
      // A hair of tolerance: a square cut exactly in half by a cone's edge counts.
      if (coveredArea(ring, left, top, left + cellSize, top + cellSize) >= half - 1e-6 * cellSize * cellSize) {
        cells.push({ column, row });
      }
    }
  }
  return cells;
}

// --- Input --------------------------------------------------------------------

/** What a client sends to put a persistent area on a scene. */
export type AreaInput = Omit<AreaGeometry, 'width'> & {
  width?: number;
  name: string;
  color: AreaColor;
  /** Master only: never reaches a player. */
  hidden?: boolean;
  /** The token the area follows; its origin is then the token's centre. */
  anchorTokenId?: string | null;
};

/** A change to a persistent area: moving or turning it, renaming, recolouring, hiding (master). */
export type AreaPatch = {
  x?: number;
  y?: number;
  angle?: number;
  name?: string;
  color?: AreaColor;
  hidden?: boolean;
};

const INVALID = 'Área inválida.';

/** Reads the shape, measures, origin and angle of an area sent by a client. */
export function validateAreaGeometry(value: unknown): { geometry: AreaGeometry } | { error: string } {
  if (!isRecord(value) || !isAreaShape(value.shape)) return { error: INVALID };
  const { shape } = value;
  if (!isAreaMeasure(value.size)) {
    return { error: `A medida da área deve ser um múltiplo de 1,5 m, até ${AREA_LIMITS.maxMeters} m.` };
  }
  const width = value.width === undefined || shape !== 'line' ? SQUARE_METERS : value.width;
  if (!isAreaMeasure(width)) return { error: `A largura da linha deve ser um múltiplo de 1,5 m, até ${AREA_LIMITS.maxMeters} m.` };
  if (typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    return { error: 'A origem da área tem coordenadas inválidas.' };
  }
  const angle = value.angle ?? 0;
  if (typeof angle !== 'number' || !Number.isFinite(angle)) return { error: 'A direção da área é inválida.' };
  return { geometry: { shape, size: value.size, width, x: value.x, y: value.y, angle: normalizeAngle(shape, angle) } };
}

function validateName(value: unknown): { name: string } | { error: string } {
  if (typeof value !== 'string') return { error: 'Dê um nome à área.' };
  const name = value.trim();
  if (name.length === 0) return { error: 'Dê um nome à área.' };
  if (name.length > AREA_LIMITS.name) return { error: `O nome da área deve ter até ${AREA_LIMITS.name} caracteres.` };
  return { name };
}

const ANCHOR_ID_MAX = 64;

/** Reads a new persistent area. Who may hide or anchor it is the server's to check. */
export function validateAreaInput(value: unknown): { input: AreaInput & { width: number } } | { error: string } {
  if (!isRecord(value)) return { error: INVALID };
  const geometry = validateAreaGeometry(value);
  if ('error' in geometry) return geometry;
  const name = validateName(value.name);
  if ('error' in name) return name;
  if (!isAreaColor(value.color)) return { error: 'Escolha uma cor da lista.' };
  if (value.hidden !== undefined && typeof value.hidden !== 'boolean') return { error: INVALID };
  const anchor = value.anchorTokenId ?? null;
  if (anchor !== null && (typeof anchor !== 'string' || anchor.length === 0 || anchor.length > ANCHOR_ID_MAX)) {
    return { error: INVALID };
  }
  return {
    input: {
      ...geometry.geometry,
      name: name.name,
      color: value.color,
      hidden: value.hidden ?? false,
      anchorTokenId: anchor,
    },
  };
}

/** Reads a change to a persistent area; the angle is normalised for `shape`. */
export function validateAreaPatch(value: unknown, shape: AreaShape): { patch: AreaPatch } | { error: string } {
  if (!isRecord(value)) return { error: INVALID };
  const patch: AreaPatch = {};
  for (const key of ['x', 'y'] as const) {
    if (value[key] === undefined) continue;
    const coordinate = value[key];
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) return { error: 'A origem da área tem coordenadas inválidas.' };
    patch[key] = coordinate;
  }
  if ((patch.x === undefined) !== (patch.y === undefined)) return { error: 'Envie as duas coordenadas da origem.' };
  if (value.angle !== undefined) {
    if (typeof value.angle !== 'number' || !Number.isFinite(value.angle)) return { error: 'A direção da área é inválida.' };
    patch.angle = normalizeAngle(shape, value.angle);
  }
  if (value.name !== undefined) {
    const name = validateName(value.name);
    if ('error' in name) return name;
    patch.name = name.name;
  }
  if (value.color !== undefined) {
    if (!isAreaColor(value.color)) return { error: 'Escolha uma cor da lista.' };
    patch.color = value.color;
  }
  if (value.hidden !== undefined) {
    if (typeof value.hidden !== 'boolean') return { error: INVALID };
    patch.hidden = value.hidden;
  }
  if (Object.keys(patch).length === 0) return { error: 'Nada para mudar na área.' };
  return { patch };
}

// --- Visibility ---------------------------------------------------------------

/** What deciding an area's visibility needs. */
export type AreaVisibility = {
  /** Hidden by the master. */
  hidden: boolean;
  /** Made by the master: under the fog, it hides like a monster. */
  byMaster: boolean;
  /** The token it follows, as `isTokenVisible` reads it; null when it follows none. */
  anchor: TokenVisibility | null;
  /** Origin, where the fog is checked when it follows no token. */
  x: number;
  y: number;
};

/**
 * Whether a viewer receives an area at all, in any payload. The master sees
 * every one. A player never receives a hidden area, nor one following a
 * token they do not receive (it would give the token away), nor — with the
 * fog on — one the master made whose origin lies outside the revealed area.
 * A player's areas show even under the fog, like their characters.
 */
export function isAreaVisible(area: AreaVisibility, role: Role, fog: SceneFog | null = null): boolean {
  if (role === 'master') return true;
  if (area.hidden) return false;
  if (area.anchor) return isTokenVisible(area.anchor, role, fog);
  if (!area.byMaster || !fog?.enabled) return true;
  return isRevealed(fog.revealed, area.x, area.y);
}

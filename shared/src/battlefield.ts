/**
 * Pure rules of the battlefield (phase 4). Coordinates are in pixels of the
 * normalised map, the only space the server and every client share.
 */
import type { Role } from './role.ts';
import type { Size } from './sheet.ts';

/** How the grid sits on a scene's map. */
export type GridSettings = {
  enabled: boolean;
  /** Width and height of one cell, in map pixels. */
  cellSize: number;
  /** Where the first full cell starts, to match a grid drawn on the image. */
  offsetX: number;
  offsetY: number;
  /** A token dropped on the map goes to the centre of its cell. */
  snap: boolean;
};

/**
 * An area of the map as polygons with holes: each polygon is a list of rings
 * (outer first), each ring a list of `[x, y]` points. The fog stores what was
 * revealed in this shape; `[]` hides the whole map.
 */
export type MultiPolygon = [number, number][][][];

export type GridFieldErrors = Partial<Record<'cellSize' | 'offsetX' | 'offsetY', string>>;

/** Cells across the map when the master has not said yet. */
export const DEFAULT_GRID_COLUMNS = 30;

/** Bounds of a scene, shared by the server parser and the forms. */
export const SCENE_LIMITS = {
  name: 80,
  /** Smaller cells are unreadable and make the grid a texture. */
  minCellSize: 8,
} as const;

/**
 * Bounds of a map image. The server normalises every upload to JPEG no larger
 * than `maxOutputSide`; the form checks the same bounds before sending.
 */
export const MAP_LIMITS = {
  maxBytes: 25 * 1024 * 1024,
  /**
   * Smallest side accepted, in pixels. Keeps every map wide enough for a grid
   * cell of `SCENE_LIMITS.minCellSize`, so the default grid is always valid.
   */
  minSide: 64,
  /** Largest side accepted on input, in pixels. */
  maxInputSide: 8192,
  /** Largest side after normalisation, in pixels. */
  maxOutputSide: 4096,
  types: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export type MapType = (typeof MAP_LIMITS.types)[number];

export function isMapType(value: unknown): value is MapType {
  return typeof value === 'string' && (MAP_LIMITS.types as readonly string[]).includes(value);
}

/** The cell size that fits `columns` cells across a map `mapWidth` pixels wide. */
export function cellSizeFromColumns(mapWidth: number, columns: number): number {
  return mapWidth / columns;
}

/**
 * Most cells a map can hold across, with cells no smaller than the minimum.
 * Assumes a width of at least `MAP_LIMITS.minSide`.
 */
export function maxGridColumns(mapWidth: number): number {
  return Math.max(1, Math.floor(mapWidth / SCENE_LIMITS.minCellSize));
}

/** The grid of a new scene: on, snapping, `DEFAULT_GRID_COLUMNS` cells across. */
export function defaultGrid(mapWidth: number): GridSettings {
  const columns = Math.min(DEFAULT_GRID_COLUMNS, maxGridColumns(mapWidth));
  return { enabled: true, cellSize: cellSizeFromColumns(mapWidth, columns), offsetX: 0, offsetY: 0, snap: true };
}

/**
 * Empty when the grid fits the map: a cell from the minimum size up to the
 * map's width, and an offset within one cell (anything further is the same
 * grid shifted by whole cells).
 */
export function validateGrid(grid: Pick<GridSettings, 'cellSize' | 'offsetX' | 'offsetY'>, mapWidth: number): GridFieldErrors {
  const errors: GridFieldErrors = {};
  const { cellSize } = grid;
  const cellOk = Number.isFinite(cellSize) && cellSize >= SCENE_LIMITS.minCellSize && cellSize <= mapWidth;
  if (!cellOk) {
    errors.cellSize = `A casa deve ter entre ${SCENE_LIMITS.minCellSize} px e a largura do mapa (${mapWidth} px).`;
  }
  for (const key of ['offsetX', 'offsetY'] as const) {
    const offset = grid[key];
    if (!Number.isFinite(offset) || offset < 0 || (cellOk && offset >= cellSize)) {
      errors[key] = 'O deslocamento deve ficar dentro de uma casa.';
    }
  }
  return errors;
}

// --- Tokens ----------------------------------------------------------------

/**
 * Where a token comes from. A character's and a combatant's read their name
 * and size from the origin; a free one (typed, or copied from the bestiary)
 * keeps its own.
 */
export const TOKEN_KINDS = ['character', 'combatant', 'free'] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

export function isTokenKind(value: unknown): value is TokenKind {
  return typeof value === 'string' && (TOKEN_KINDS as readonly string[]).includes(value);
}

/** Bounds of the tokens of a scene. */
export const TOKEN_LIMITS = {
  /** A table rarely passes a few dozen; the cap keeps the canvas and the payload light. */
  perScene: 200,
  /** Name of a free token. */
  label: 40,
} as const;

/** Cells across a creature of each size takes on the grid (D&D 5e). */
const SIZE_CELLS: Record<Size, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

/** Cells across a token of this size covers: a tiny creature takes half a cell. */
export function tokenCells(size: Size): number {
  return SIZE_CELLS[size];
}

/** Diameter of the token in map pixels. */
export function tokenDiameter(size: Size, cellSize: number): number {
  return tokenCells(size) * cellSize;
}

/**
 * Where a token dropped at (x, y) rests. With the grid on and snapping, an
 * odd size (or a tiny creature) goes to the centre of the cell under the
 * point; an even size (2 or 4 cells) goes to the nearest junction, so it
 * covers whole cells. Otherwise the point is kept as is.
 */
export function snapToCell(x: number, y: number, grid: GridSettings, size: Size): { x: number; y: number } {
  if (!grid.enabled || !grid.snap) return { x, y };
  const cells = tokenCells(size);
  const even = cells >= 2 && cells % 2 === 0;
  const snap = (value: number, offset: number) => {
    const position = (value - offset) / grid.cellSize;
    const cell = even ? Math.round(position) : Math.floor(position) + 0.5;
    return offset + cell * grid.cellSize;
  };
  return { x: snap(x, grid.offsetX), y: snap(y, grid.offsetY) };
}

/** Keeps a token's centre on the map. */
export function clampToMap(x: number, y: number, mapWidth: number, mapHeight: number): { x: number; y: number } {
  return { x: Math.min(Math.max(x, 0), mapWidth), y: Math.min(Math.max(y, 0), mapHeight) };
}

/** How long a grabbed token stays locked without news from whoever holds it. */
export const LOCK_TTL_MS = 3000;

/** Who is moving a token, and until when the lock holds. */
export type TokenLock = { userId: string; expiresAt: number };

/**
 * Whether `userId` may grab (or keep moving) a token: it is free, its lock
 * ran out, or the lock is already theirs.
 */
export function canGrab(lock: TokenLock | null | undefined, userId: string, now: number): boolean {
  return !lock || lock.userId === userId || now >= lock.expiresAt;
}

/** The lock `userId` holds after grabbing, or after each move that renews it. */
export function lockFor(userId: string, now: number): TokenLock {
  return { userId, expiresAt: now + LOCK_TTL_MS };
}

/** What deciding a token's visibility needs. */
export type TokenVisibility = {
  kind: TokenKind;
  /** Hidden by the master on the map. */
  hidden: boolean;
  /** The combatant behind a combatant token is hidden in the encounter. */
  combatantHidden: boolean;
};

/**
 * Whether a viewer receives a token at all, in any payload. The master sees
 * every one. A player never receives a token hidden on the map, nor the token
 * of a combatant hidden in the encounter. The fog rule (a token outside the
 * revealed area, character tokens excepted) joins with the fog delivery.
 */
export function isTokenVisible(token: TokenVisibility, role: Role): boolean {
  if (role === 'master') return true;
  if (token.hidden) return false;
  return !(token.kind === 'combatant' && token.combatantHidden);
}

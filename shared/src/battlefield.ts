/**
 * Pure rules of the battlefield (phase 4). Coordinates are in pixels of the
 * normalised map, the only space the server and every client share.
 */

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

/** Most cells a map can hold across, with cells no smaller than the minimum. */
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

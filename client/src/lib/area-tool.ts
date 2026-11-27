import {
  formatMeters,
  isAreaVisible,
  normalizeAngle,
  snapAreaOrigin,
  type AreaColor,
  type AreaGeometry,
  type AreaShape,
  type AreaView,
  type GridSettings,
  type SceneFog,
  type TokenView,
} from '@quest-fast/shared';
import type { FogLook, Point } from './fog-tool';

/**
 * An area tool in hand. `reference` is only drawn for the table while held
 * and gone a moment after it is let go; `persistent` stays on the scene.
 */
export type AreaMode = 'reference' | 'persistent';

export type AreaTool = {
  mode: AreaMode;
  shape: AreaShape;
  /** Metres: radius, length or edge. */
  size: number;
  /** Metres across a line. */
  width: number;
};

export const AREA_SHAPE_LABELS: Record<AreaShape, string> = {
  sphere: 'Esfera',
  cylinder: 'Cilindro',
  cone: 'Cone',
  line: 'Linha',
  cube: 'Cubo',
};

/** What the size of each shape is called. */
export const AREA_SIZE_LABELS: Record<AreaShape, string> = {
  sphere: 'Raio',
  cylinder: 'Raio',
  cone: 'Comprimento',
  line: 'Comprimento',
  cube: 'Aresta',
};

export const AREA_COLOR_LABELS: Record<AreaColor, string> = {
  crimson: 'Vermelho',
  amber: 'Âmbar',
  emerald: 'Verde',
  azure: 'Azul',
  violet: 'Violeta',
  slate: 'Cinza',
};

/** The CSS token each colour of the palette is drawn with. */
export const AREA_COLOR_TOKENS: Record<AreaColor, string> = {
  crimson: '--color-area-crimson',
  amber: '--color-area-amber',
  emerald: '--color-area-emerald',
  azure: '--color-area-azure',
  violet: '--color-area-violet',
  slate: '--color-area-slate',
};

/** A circle grows from its centre; the other shapes point from their origin. */
export function aims(shape: AreaShape): boolean {
  return shape !== 'sphere' && shape !== 'cylinder';
}

/**
 * The geometry a press at `from` dragged to `to` draws, in map pixels. A
 * circle follows the pointer, its centre on an intersection; a cone, a line
 * or a cube keeps its origin where the press began and turns towards the
 * pointer (a cube by quarters).
 */
export function draftGeometry(tool: AreaTool, from: Point, to: Point, grid: GridSettings): AreaGeometry {
  const base = { shape: tool.shape, size: tool.size, width: tool.shape === 'line' ? tool.width : 1.5 };
  if (!aims(tool.shape)) return { ...base, ...snapAreaOrigin(to.x, to.y, grid), angle: 0 };
  const origin = snapAreaOrigin(from.x, from.y, grid);
  const dx = to.x - origin.x;
  const dy = to.y - origin.y;
  let degrees = Math.hypot(dx, dy) < 1 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  // A cube grows towards the pointer's quarter: its corner is the origin.
  if (tool.shape === 'cube') degrees -= 45;
  return { ...base, ...origin, angle: normalizeAngle(tool.shape, degrees) };
}

/** "Esfera de 6 m", "Linha de 9 m × 1,5 m". */
export function describeGeometry(area: Pick<AreaGeometry, 'shape' | 'size' | 'width'>): string {
  const width = area.shape === 'line' ? ` × ${formatMeters(area.width)}` : '';
  return `${AREA_SHAPE_LABELS[area.shape]} de ${formatMeters(area.size)}${width}`;
}

/** Who may change or remove an area: whoever made it, and the master. */
export function mayChangeArea(area: Pick<AreaView, 'createdBy'>, viewer: { id: string | null; master: boolean }): boolean {
  return viewer.master || (viewer.id !== null && area.createdBy.userId === viewer.id);
}

/** What the viewer is about to draw: the tool's settings, and what a persistent area is saved with. */
export type AreaDraft = AreaTool & {
  name: string;
  tint: AreaColor;
  /** The master only: the table never gets it. */
  hidden: boolean;
};

export const DEFAULT_AREA_DRAFT: AreaDraft = {
  mode: 'reference', shape: 'sphere', size: 6, width: 1.5, name: '', tint: 'crimson', hidden: false,
};

/** Sizes the toolbar offers, in metres: the SRD's areas are all among them. */
export const AREA_SIZES = [1.5, 3, 4.5, 6, 9, 12, 18, 24, 30, 36] as const;

/**
 * The areas as a look shows them on the master's screen, with the server's
 * rule whole (`isAreaVisible`). On the master's screen an area of their own
 * is the master's; a player's screen gets only what the server let through,
 * so it is shown as it came. As a player ("ver como jogador"), what the
 * table does not get is gone; on the master's own map it is faded.
 */
export function areasForLook(
  areas: readonly AreaView[],
  tokens: readonly TokenView[],
  context: { fog: SceneFog | null; look: FogLook; master: boolean; viewerId: string | null },
): { areas: readonly AreaView[]; faded: ReadonlySet<string> } {
  const faded = new Set<string>();
  if (!context.master) return { areas, faded };
  const reachesTable = (area: AreaView) => {
    const anchor = area.anchorTokenId ? tokens.find((token) => token.id === area.anchorTokenId) : undefined;
    return isAreaVisible({
      hidden: area.hidden,
      byMaster: area.createdBy.userId === context.viewerId,
      anchor: anchor
        ? { kind: anchor.kind, hidden: anchor.hidden, combatantHidden: anchor.combatantHidden, x: anchor.x, y: anchor.y, ownerId: anchor.ownerId }
        : null,
      x: area.x,
      y: area.y,
    }, 'player', context.fog);
  };
  if (context.look === 'player') return { areas: areas.filter(reachesTable), faded };
  for (const area of areas) if (!reachesTable(area)) faded.add(area.id);
  return { areas, faded };
}

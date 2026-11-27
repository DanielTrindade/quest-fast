import { AREA_COLORS, AREA_LIMITS, type AreaView } from '@quest-fast/shared';
import { PRINTED_CELL, PRINTED_OFFSET } from './maps';
import { MASTER_ID, PLAYER_ID } from './tokens';

/** The grid intersection (column, row) of the printed grid, where an area's origin rests. */
export function corner(column: number, row: number) {
  return { x: PRINTED_OFFSET + column * PRINTED_CELL, y: PRINTED_OFFSET + row * PRINTED_CELL };
}

const LIA = { userId: MASTER_ID, name: 'Lia Martins' };
const RAFAEL = { userId: PLAYER_ID, name: 'Rafael Costa' };

function area(id: string, fields: Partial<AreaView> & Pick<AreaView, 'name' | 'shape' | 'size' | 'x' | 'y'>): AreaView {
  return { id, width: 1.5, angle: 0, tint: 'crimson', createdBy: LIA, hidden: false, anchorTokenId: null, ...fields };
}

/**
 * One area of each shape around the tokens of the demo scene: a web of the
 * master's, a hidden glyph, the player's fog cloud and cone, a line and
 * Spirit Guardians on Kaelen.
 */
export function sceneAreas(): AreaView[] {
  return [
    area('teia', { name: 'Teia', shape: 'cube', size: 6, tint: 'slate', ...corner(21, 2) }),
    area('glifo', { name: 'Glifo de Proteção', shape: 'sphere', size: 3, tint: 'violet', hidden: true, ...corner(25, 9) }),
    area('nevoa', { name: 'Névoa Obscurecente', shape: 'cylinder', size: 6, tint: 'azure', createdBy: RAFAEL, ...corner(10, 8) }),
    area('cone', { name: 'Mãos Flamejantes', shape: 'cone', size: 4.5, tint: 'amber', createdBy: RAFAEL, ...corner(14, 3) }),
    area('raio', { name: 'Relâmpago', shape: 'line', size: 18, tint: 'azure', angle: 30, ...corner(4, 12) }),
    area('guardiao', { name: 'Espírito Guardião', shape: 'sphere', size: 4.5, tint: 'emerald', createdBy: RAFAEL, anchorTokenId: 'kaelen', ...corner(17, 4) }),
  ];
}

const SHAPES = ['sphere', 'cone', 'line', 'cube', 'cylinder'] as const;

/** The most a scene holds, with the longest names. */
export function manyAreas(): AreaView[] {
  return Array.from({ length: AREA_LIMITS.perScene }, (_, index) => area(`a-${index}`, {
    name: `Muralha de Fogo Prismática do Arquimago ${String(index).padStart(2, '0')}`.slice(0, AREA_LIMITS.name),
    shape: SHAPES[index % SHAPES.length]!,
    size: 3,
    tint: AREA_COLORS[index % AREA_COLORS.length]!,
    ...corner(2 + (index % 10) * 3, 2 + Math.floor(index / 10) * 3),
  }));
}

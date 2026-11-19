import type { MultiPolygon, SceneFog } from '@quest-fast/shared';
import { PRINTED_CELL, PRINTED_OFFSET } from './maps';

/** The corner of a printed cell, in map pixels. */
const at = (column: number, row: number): [number, number] => [PRINTED_OFFSET + column * PRINTED_CELL, PRINTED_OFFSET + row * PRINTED_CELL];

function room(left: number, top: number, right: number, bottom: number): [number, number][] {
  return [at(left, top), at(right, top), at(right, bottom), at(left, bottom), at(left, top)];
}

/**
 * What a session revealed of the synthetic map, as the server stores it:
 * the hall where the party stands (columns 14–19, so the goblins and the
 * ogre beyond it stay hidden), a crypt with a pillar left hidden in its
 * middle, and a winding corridor between them.
 */
export const REVEALED: MultiPolygon = [
  [room(14, 2, 20, 9)],
  [room(2, 10, 8, 17), room(4, 12, 6, 14)],
  [[at(9, 12), at(12, 9.5), at(13.5, 9.5), at(13.5, 10.5), at(12, 10.5), at(10, 13), at(9, 13), at(9, 12)]],
];

export const fogOn: SceneFog = { enabled: true, revealed: REVEALED };
export const fogStart: SceneFog = { enabled: true, revealed: [] };
export const fogOff: SceneFog = { enabled: false, revealed: REVEALED };

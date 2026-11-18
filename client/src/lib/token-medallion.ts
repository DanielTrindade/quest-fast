import type { TokenKind } from '@quest-fast/shared';

type Point = { x: number; y: number };
type Rgb = readonly [number, number, number];

/**
 * The silhouette says the origin before the colour does: round for a
 * character, toothed for a creature in the fight, octagonal for a free token.
 */
export type MedallionShape = 'round' | 'toothed' | 'octagon';

export const SHAPE: Record<TokenKind, MedallionShape> = {
  character: 'round',
  combatant: 'toothed',
  free: 'octagon',
};

/** Fewer teeth when small: 14 at table size would blur into a ring. */
const SMALL_TEETH_RADIUS = 18;

/**
 * The corners of a silhouette of `radius` around (0, 0), starting at the top;
 * null for the round one, which is an arc.
 */
export function shapeVertices(shape: MedallionShape, radius: number): Point[] | null {
  if (shape === 'round') return null;
  if (shape === 'octagon') {
    return Array.from({ length: 8 }, (_, index) => polar(Math.PI / 8 + (index / 8) * Math.PI * 2, radius));
  }
  const small = radius < SMALL_TEETH_RADIUS;
  const teeth = small ? 8 : 14;
  const valley = radius * (small ? 0.84 : 0.87);
  return Array.from({ length: teeth * 2 }, (_, index) =>
    polar(-Math.PI / 2 + (index / (teeth * 2)) * Math.PI * 2, index % 2 === 0 ? radius : valley));
}

function polar(angle: number, radius: number): Point {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/**
 * How much of the medallion fits at a radius on screen: 0 is the metal and
 * the face, 1 adds the coloured band (and pearls or rivets on the octagon), 2
 * adds everything. Zoomed out, the detail would only be noise.
 */
export function detailLevel(radius: number): 0 | 1 | 2 {
  if (radius >= 22) return 2;
  if (radius >= 14) return 1;
  return 0;
}

/** Raised it grows 4%; landing it sinks to 97%, the press scale of the buttons. */
export function liftScale(lift: number): number {
  return lift >= 0 ? 1 + lift * 0.04 : 1 + Math.max(-0.03, lift * 0.6);
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** Reads a `#rrggbb` (what a canvas normalises an opaque colour to). */
export function parseHex(colour: string): Rgb | null {
  const match = /^#([\da-f]{6})$/i.exec(colour.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(colour: Rgb): string {
  return `#${colour.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  const channel = (index: 0 | 1 | 2) => from[index] + (to[index] - from[index]) * amount;
  return [channel(0), channel(1), channel(2)];
}

// The canvas asks for the same few shades on every piece of every frame.
const shades = new Map<string, string>();

function shade(colour: string, toward: Rgb, amount: number): string {
  const key = `${colour}|${toward[0]}|${amount}`;
  let result = shades.get(key);
  if (result === undefined) {
    const rgb = parseHex(colour);
    result = rgb ? toHex(mix(rgb, toward, amount)) : colour;
    if (shades.size > 256) shades.clear();
    shades.set(key, result);
  }
  return result;
}

/** Toward white by `amount` (0 to 1). */
export function lighten(colour: string, amount: number): string {
  return shade(colour, WHITE, amount);
}

/** Toward black by `amount` (0 to 1). */
export function darken(colour: string, amount: number): string {
  return shade(colour, BLACK, amount);
}

/**
 * The matte metal of each origin, all from `border-control`, the grey of
 * the controls: no new colour. Silver for a character, iron for a creature,
 * plain pewter for a free token.
 */
export function metalOf(kind: TokenKind, control: string): string {
  if (kind === 'character') return lighten(control, 0.3);
  if (kind === 'combatant') return darken(control, 0.35);
  return control;
}

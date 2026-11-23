/**
 * An attack's range as the map reads it. The sheet keeps the range as text
 * ("1,5 m", "18 m", "6/18 m"); only a text that is just a distance turns
 * into metres. "Toque", "Pessoal (cone de 4,5 m)" or "Visão" stay text: the
 * map has nothing to draw for them.
 */

/** In metres; `long` only when the text gives a second, longer distance (a thrown or ranged weapon). */
export type AttackRange = { normal: number; long: number | null };

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const RANGE = new RegExp(String.raw`^\s*${NUMBER}\s*(?:/\s*${NUMBER}\s*)?(m|metros?|ft|p[ée]s)?\s*$`, 'i');
/**
 * The same distance in metres and in squares, as the table writes it:
 * "36m/24q", "18 m / 12 quadrados", "9 m (6 casas)". The metres decide.
 */
const WITH_SQUARES = new RegExp(String.raw`^\s*${NUMBER}\s*(?:m|metros?)\s*(?:/|\()\s*\d+\s*(?:q|quadrados?|casas?)\s*\)?\s*$`, 'i');

/** Feet as the rules convert them: 5 feet is a square of 1,5 m. */
const METERS_PER_FOOT = 0.3;

function decimal(text: string): number {
  return Number(text.replace(',', '.'));
}

/**
 * The distances in a range written as one ("18 m", "1,5 metro", "30 ft"),
 * as one in metres and squares ("36m/24q"), or as normal and long ("6/18 m",
 * "24 / 96 m"); a number alone reads as metres.
 * Null for anything else, a zero distance, or a long range shorter than the
 * normal one.
 */
export function parseRange(text: string): AttackRange | null {
  const squared = WITH_SQUARES.exec(text);
  if (squared) {
    const meters = decimal(squared[1]!);
    return meters > 0 ? { normal: meters, long: null } : null;
  }
  const match = RANGE.exec(text);
  if (!match) return null;
  const [, first, second, unit] = match;
  const scale = unit && /^(ft|p)/i.test(unit) ? METERS_PER_FOOT : 1;
  const normal = decimal(first!) * scale;
  const long = second === undefined ? null : decimal(second) * scale;
  if (!(normal > 0) || (long !== null && long < normal)) return null;
  return { normal, long: long === normal ? null : long };
}

/**
 * Casting a prepared spell from the sheet: which circles it may take, and
 * what spending one leaves. The slots are the sheet's own totals; nothing
 * here derives them from class and level.
 */
import type { Spell, SpellSlot } from './sheet.ts';

/** A slot of a circle (1 to 9), or the ritual version, which spends none. */
export type CastChoice = { circle: number } | { ritual: true };

export const MAX_SPELL_CIRCLE = 9;

/** "3º círculo". */
export function circleLabel(circle: number): string {
  return `${circle}º círculo`;
}

function slotsLeft(slot: SpellSlot | undefined): number {
  return slot ? Math.max(0, slot.total - slot.spent) : 0;
}

/** The circles with a free slot this spell may be cast with, lowest first. */
export function castCircles(spell: Pick<Spell, 'level'>, slots: readonly SpellSlot[]): number[] {
  if (spell.level < 1) return [];
  const circles: number[] = [];
  for (let circle = spell.level; circle <= MAX_SPELL_CIRCLE; circle += 1) {
    if (slotsLeft(slots[circle - 1]) > 0) circles.push(circle);
  }
  return circles;
}

/** A ritual spends no slot; only a spell of 1st circle or higher marked as ritual. */
export function canCastAsRitual(spell: Pick<Spell, 'level' | 'ritual'>): boolean {
  return spell.level >= 1 && spell.ritual;
}

/** Why the spell cannot be cast now, or null when it can. */
export function castBlockedReason(spell: Pick<Spell, 'level' | 'ritual'>, slots: readonly SpellSlot[]): string | null {
  if (spell.level < 1) return 'Truques não gastam espaço de magia.';
  if (castCircles(spell, slots).length > 0 || canCastAsRitual(spell)) return null;
  return spell.level === MAX_SPELL_CIRCLE
    ? `Sem espaços do ${circleLabel(MAX_SPELL_CIRCLE)}.`
    : `Sem espaços do ${circleLabel(spell.level)} ou acima.`;
}

export type CastResult =
  | { ok: true; slots: SpellSlot[]; circle: number | null }
  | { ok: false; error: string };

/**
 * Spends what the choice takes: a slot of a circle no lower than the spell's,
 * with one free, or nothing for a ritual. `circle` is null for a ritual.
 */
export function castSpell(spell: Pick<Spell, 'level' | 'ritual'>, slots: readonly SpellSlot[], choice: CastChoice): CastResult {
  if (spell.level < 1) return { ok: false, error: 'Truques não gastam espaço de magia.' };
  if ('ritual' in choice) {
    if (!canCastAsRitual(spell)) return { ok: false, error: 'Esta magia não pode ser conjurada como ritual.' };
    return { ok: true, slots: slots.map((slot) => ({ ...slot })), circle: null };
  }
  const { circle } = choice;
  if (!Number.isInteger(circle) || circle < 1 || circle > MAX_SPELL_CIRCLE) return { ok: false, error: 'Círculo inválido.' };
  if (circle < spell.level) return { ok: false, error: `Esta magia precisa de um espaço do ${circleLabel(spell.level)} ou acima.` };
  if (slotsLeft(slots[circle - 1]) === 0) return { ok: false, error: `Sem espaços livres do ${circleLabel(circle)}.` };
  return {
    ok: true,
    circle,
    slots: slots.map((slot, index) => (index === circle - 1 ? { ...slot, spent: slot.spent + 1 } : { ...slot })),
  };
}

import { parseEffectInput, type DamageType, type EffectDuration, type EffectModifiers, type EffectRequest } from '@quest-fast/shared';

export const DAMAGE_RELATIONS = ['resistances', 'immunities', 'vulnerabilities'] as const;
export type DamageRelation = (typeof DAMAGE_RELATIONS)[number];

export const DAMAGE_RELATION_LABELS: Record<DamageRelation, string> = {
  resistances: 'Resistência',
  immunities: 'Imunidade',
  vulnerabilities: 'Vulnerabilidade',
};

/**
 * The effect form as typed: text fields stay text until sent. One relation
 * to damage per effect (Stoneskin resists three types; none of the common
 * spells mixes resistance and vulnerability).
 */
export type EffectDraft = {
  name: string;
  acMode: '' | 'add' | 'set';
  acValue: string;
  speedMode: '' | 'add' | 'set' | 'half';
  speedValue: string;
  hpMax: string;
  damageRelation: '' | DamageRelation;
  damageTypes: DamageType[];
  duration: EffectDuration;
  rounds: string;
  concentration: boolean;
};

export function emptyEffectDraft(): EffectDraft {
  return {
    name: '',
    acMode: '',
    acValue: '',
    speedMode: '',
    speedValue: '',
    hpMax: '',
    damageRelation: '',
    damageTypes: [],
    duration: 'encounter',
    rounds: '',
    concentration: false,
  };
}

/** A typed number, or NaN: an empty field the form asked for is refused, not read as 0. */
function number(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text.replace(',', '.'));
}

/**
 * What the form sends, checked by the same rules the server applies, so a
 * mistake shows before the request. The source is the combatant whose panel
 * it is: the cleric putting Shield of Faith on the fighter.
 */
export function effectRequest(draft: EffectDraft, sourceCombatantId: string): { ok: true; request: EffectRequest } | { ok: false; error: string } {
  const modifiers: Record<string, unknown> = {};
  if (draft.acMode) modifiers.ac = { mode: draft.acMode, value: number(draft.acValue) };
  if (draft.speedMode === 'half') modifiers.speed = { mode: 'half' };
  else if (draft.speedMode) modifiers.speed = { mode: draft.speedMode, value: number(draft.speedValue) };
  if (draft.hpMax.trim() !== '') modifiers.hpMax = number(draft.hpMax);
  if (draft.damageRelation) {
    if (draft.damageTypes.length === 0) return { ok: false, error: 'Escolha ao menos um tipo de dano.' };
    modifiers[draft.damageRelation] = draft.damageTypes;
  }
  const parsed = parseEffectInput({
    name: draft.name,
    modifiers: modifiers as EffectModifiers,
    duration: draft.duration,
    ...(draft.duration === 'rounds' ? { roundsLeft: number(draft.rounds) } : {}),
    sourceCombatantId,
    concentration: draft.concentration,
  });
  return parsed.ok ? { ok: true, request: parsed.effect } : parsed;
}

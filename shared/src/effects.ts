/**
 * Temporary effects of a fight (D&D 2024): what a spell or a feature changes
 * for a while — armor class, speed, hit point maximum and damage resistances.
 * An effect lives on the combatant, never on the sheet nor the statblock: the
 * effective numbers are the base plus the effects, worked out here. The server
 * applies them inside a transaction; the client only displays the result.
 */
import { COMBAT_LIMITS } from './combat.ts';

// --- Damage types ----------------------------------------------------------------

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export function isDamageType(value: unknown): value is DamageType {
  return typeof value === 'string' && (DAMAGE_TYPES as readonly string[]).includes(value);
}

/**
 * How an attack row writes each type: the English name and the Portuguese
 * ones the books and the table use, lower case and without accents.
 */
const DAMAGE_TYPE_WORDS: Record<DamageType, readonly string[]> = {
  acid: ['acid', 'acido'],
  bludgeoning: ['bludgeoning', 'concussao', 'contundente', 'impacto'],
  cold: ['cold', 'frio', 'gelido', 'gelo'],
  fire: ['fire', 'fogo', 'igneo'],
  force: ['force', 'energia', 'forca', 'energetico'],
  lightning: ['lightning', 'eletrico', 'eletrica', 'eletricidade', 'relampago', 'raio'],
  necrotic: ['necrotic', 'necrotico'],
  piercing: ['piercing', 'perfurante', 'perfuracao'],
  poison: ['poison', 'veneno', 'venenoso'],
  psychic: ['psychic', 'psiquico'],
  radiant: ['radiant', 'radiante'],
  slashing: ['slashing', 'cortante', 'corte'],
  thunder: ['thunder', 'trovao', 'trovejante', 'sonico'],
};

const WORD_TO_TYPE = new Map<string, DamageType>(
  DAMAGE_TYPES.flatMap((type) => DAMAGE_TYPE_WORDS[type].map((word) => [word, type] as const)),
);

function normalise(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * The damage type an attack row names ("Cortante", "fogo mágico", "Fire"),
 * or null when it names none or more than one: a row of two types is not
 * split, so the master adjusts it by hand.
 */
export function damageTypeFromText(text: string): DamageType | null {
  const found = new Set<DamageType>();
  for (const word of normalise(text).split(/[^a-z]+/)) {
    const type = WORD_TO_TYPE.get(word);
    if (type) found.add(type);
  }
  return found.size === 1 ? [...found][0]! : null;
}

// --- The effect --------------------------------------------------------------------

/**
 * - `encounter`: until the fight ends.
 * - `rounds`: loses one round at the end of the bearer's turn, like a condition.
 * - `untilTurnStart`: ends when the bearer's next turn begins (Shield).
 * - `none`: until someone removes it — or the fight ends, since it lives there.
 */
export const EFFECT_DURATIONS = ['encounter', 'rounds', 'untilTurnStart', 'none'] as const;
export type EffectDuration = (typeof EFFECT_DURATIONS)[number];

export const AC_MODES = ['add', 'set'] as const;
export type AcMode = (typeof AC_MODES)[number];
/** `half` takes no value: it halves the speed (Slow). */
export const SPEED_MODES = ['add', 'set', 'half'] as const;
export type SpeedMode = (typeof SPEED_MODES)[number];

export type EffectModifiers = {
  ac?: { mode: AcMode; value: number };
  speed?: { mode: 'add' | 'set'; value: number } | { mode: 'half' };
  /** Raises the hit point maximum, and the current hit points with it (Aid). */
  hpMax?: number;
  resistances?: DamageType[];
  immunities?: DamageType[];
  vulnerabilities?: DamageType[];
};

export type CombatEffect = {
  id: string;
  /** e.g. "Escudo da Fé"; one per name on a combatant. */
  name: string;
  modifiers: EffectModifiers;
  duration: EffectDuration;
  /** Only for `rounds`: what is left. */
  roundsLeft?: number;
  /** The combatant whose spell or feature it is, when someone says. */
  sourceCombatantId?: string;
  /** Ends when the source's concentration ends; needs a source. */
  concentration: boolean;
};

/** What a player sees of an effect on a creature of the master: its name. */
export type CombatEffectSummary = Pick<CombatEffect, 'id' | 'name'>;

/** An effect not yet stored: the server gives it its id. */
export type CombatEffectInput = Omit<CombatEffect, 'id'>;

/** Bounds shared by the server and the editor. */
export const EFFECT_LIMITS = {
  name: 60,
  /** Effects on one combatant at once. */
  perCombatant: 20,
  rounds: COMBAT_LIMITS.conditionRounds,
  acAdd: { min: -10, max: 10 },
  acSet: { min: 1, max: 40 },
  /** Metres. */
  speedAdd: { min: -60, max: 60 },
  speedSet: { min: 0, max: 60 },
  hpMax: { min: 1, max: 999 },
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerIn(value: unknown, range: { min: number; max: number }): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max;
}

/** Speeds are whole squares of 1.5 m. */
function isSpeedIn(value: unknown, range: { min: number; max: number }): value is number {
  return typeof value === 'number' && value >= range.min && value <= range.max && Number.isInteger(value / 1.5);
}

function damageList(value: unknown): DamageType[] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every(isDamageType) || new Set(value).size !== value.length) return null;
  return value.length > 0 ? value : undefined;
}

const DAMAGE_LISTS = ['resistances', 'immunities', 'vulnerabilities'] as const;

/**
 * Reads what a client sent as a new effect: the normalised effect, or the
 * reason it is refused (in Portuguese, for the API's `error`).
 */
export function parseEffectInput(value: unknown): { ok: true; effect: CombatEffectInput } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!isObject(value)) return fail('Efeito inválido.');
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (name.length === 0 || name.length > EFFECT_LIMITS.name) return fail(`Dê um nome ao efeito, com até ${EFFECT_LIMITS.name} caracteres.`);

  const raw = value.modifiers;
  if (!isObject(raw)) return fail('Modificadores do efeito inválidos.');
  const modifiers: EffectModifiers = {};

  if (raw.ac !== undefined) {
    if (!isObject(raw.ac)) return fail('CA do efeito inválida.');
    const { mode, value: ac } = raw.ac;
    if (mode === 'add' && isIntegerIn(ac, EFFECT_LIMITS.acAdd) && ac !== 0) modifiers.ac = { mode, value: ac };
    else if (mode === 'set' && isIntegerIn(ac, EFFECT_LIMITS.acSet)) modifiers.ac = { mode, value: ac };
    else return fail(`A CA soma de ${EFFECT_LIMITS.acAdd.min} a ${EFFECT_LIMITS.acAdd.max} (sem 0) ou fixa de ${EFFECT_LIMITS.acSet.min} a ${EFFECT_LIMITS.acSet.max}.`);
  }

  if (raw.speed !== undefined) {
    if (!isObject(raw.speed)) return fail('Deslocamento do efeito inválido.');
    const { mode, value: speed } = raw.speed;
    if (mode === 'half' && speed === undefined) modifiers.speed = { mode };
    else if (mode === 'add' && isSpeedIn(speed, EFFECT_LIMITS.speedAdd) && speed !== 0) modifiers.speed = { mode, value: speed };
    else if (mode === 'set' && isSpeedIn(speed, EFFECT_LIMITS.speedSet)) modifiers.speed = { mode, value: speed };
    else return fail('O deslocamento soma ou fixa em quadrados de 1,5 m, até 60 m, ou cai pela metade.');
  }

  if (raw.hpMax !== undefined) {
    if (!isIntegerIn(raw.hpMax, EFFECT_LIMITS.hpMax)) return fail(`O PV máximo sobe de ${EFFECT_LIMITS.hpMax.min} a ${EFFECT_LIMITS.hpMax.max}.`);
    modifiers.hpMax = raw.hpMax;
  }

  for (const key of DAMAGE_LISTS) {
    const list = damageList(raw[key]);
    if (list === null) return fail('Tipos de dano do efeito inválidos.');
    if (list) modifiers[key] = list;
  }

  if (Object.keys(modifiers).length === 0) return fail('O efeito precisa mudar alguma coisa.');

  const { duration, roundsLeft, sourceCombatantId, concentration } = value;
  if (!(EFFECT_DURATIONS as readonly unknown[]).includes(duration)) return fail('Duração do efeito inválida.');
  const effect: CombatEffectInput = { name, modifiers, duration: duration as EffectDuration, concentration: concentration === true };
  if (duration === 'rounds') {
    if (!isIntegerIn(roundsLeft, EFFECT_LIMITS.rounds)) return fail(`A duração vai de ${EFFECT_LIMITS.rounds.min} a ${EFFECT_LIMITS.rounds.max} rodadas.`);
    effect.roundsLeft = roundsLeft;
  } else if (roundsLeft !== undefined) {
    return fail('Só a duração em rodadas leva número de rodadas.');
  }
  if (concentration !== undefined && typeof concentration !== 'boolean') return fail('Concentração do efeito inválida.');
  if (sourceCombatantId !== undefined) {
    if (typeof sourceCombatantId !== 'string' || sourceCombatantId.length === 0) return fail('Origem do efeito inválida.');
    effect.sourceCombatantId = sourceCombatantId;
  }
  if (effect.concentration && !effect.sourceCombatantId) return fail('Um efeito de concentração precisa de quem conjurou.');
  return { ok: true, effect };
}

// --- The list on a combatant ----------------------------------------------------------

function sameName(a: string, b: string): boolean {
  return normalise(a.trim()) === normalise(b.trim());
}

/**
 * A combatant has each effect once: two castings of one spell do not stack,
 * so applying a name again replaces the old one, which is returned.
 */
export function setEffect(
  effects: readonly CombatEffect[],
  effect: CombatEffect,
): { effects: CombatEffect[]; replaced: CombatEffect | null } {
  const replaced = effects.find((current) => sameName(current.name, effect.name)) ?? null;
  if (!replaced) return { effects: [...effects, effect], replaced };
  return { effects: effects.map((current) => (current === replaced ? effect : current)), replaced };
}

/** Splits a list into what stays and what leaves. */
function split(
  effects: readonly CombatEffect[],
  leaves: (effect: CombatEffect) => boolean,
): { remaining: CombatEffect[]; expired: CombatEffect[] } {
  const remaining: CombatEffect[] = [];
  const expired: CombatEffect[] = [];
  for (const effect of effects) (leaves(effect) ? expired : remaining).push(effect);
  return { remaining, expired };
}

/** Runs when the bearer's turn begins: what lasted until then ends. */
export function startTurnEffects(effects: readonly CombatEffect[]) {
  return split(effects, (effect) => effect.duration === 'untilTurnStart');
}

/**
 * Runs at the end of the bearer's turn: durations in rounds lose one and the
 * ones that reach zero expire.
 */
export function tickEffects(effects: readonly CombatEffect[]): { remaining: CombatEffect[]; expired: CombatEffect[] } {
  const { remaining, expired } = split(effects, (effect) => effect.duration === 'rounds' && (effect.roundsLeft ?? 1) <= 1);
  return {
    remaining: remaining.map((effect) =>
      effect.duration === 'rounds' && effect.roundsLeft !== undefined ? { ...effect, roundsLeft: effect.roundsLeft - 1 } : effect,
    ),
    expired,
  };
}

/** Runs when a combatant's concentration ends: what it held up ends for good. */
export function dropConcentration(effects: readonly CombatEffect[], sourceCombatantId: string) {
  return split(effects, (effect) => effect.concentration && effect.sourceCombatantId === sourceCombatantId);
}

// --- Effective numbers ------------------------------------------------------------------

/**
 * Armor class under the effects: the highest value an effect sets (or the
 * base, when higher), plus every bonus (Shield of Faith +2, Shield +5).
 */
export function effectiveAc(base: number, effects: readonly CombatEffect[]): number {
  let ac = base;
  let bonus = 0;
  for (const { modifiers } of effects) {
    if (modifiers.ac?.mode === 'set') ac = Math.max(ac, modifiers.ac.value);
    else if (modifiers.ac?.mode === 'add') bonus += modifiers.ac.value;
  }
  return Math.max(0, ac + bonus);
}

/**
 * Speed under the effects, before the conditions: the highest value an
 * effect sets (or the base), plus every bonus, halved once when any effect
 * halves it (Slow does not stack).
 */
export function speedUnderEffects(base: number, effects: readonly CombatEffect[]): number {
  let speed: number | null = null;
  let bonus = 0;
  let half = false;
  for (const { modifiers } of effects) {
    const modifier = modifiers.speed;
    if (modifier?.mode === 'set') speed = Math.max(speed ?? 0, modifier.value);
    else if (modifier?.mode === 'add') bonus += modifier.value;
    else if (modifier?.mode === 'half') half = true;
  }
  const total = Math.max(0, (speed ?? base) + bonus);
  return half ? total / 2 : total;
}

/** The hit point maximum under the effects. */
export function effectiveHpMax(base: number, effects: readonly CombatEffect[]): number {
  return base + effects.reduce((sum, { modifiers }) => sum + (modifiers.hpMax ?? 0), 0);
}

/**
 * The current hit points after the maximum changed: a higher maximum raises
 * them by the same amount (Aid, 2024); a lower one only cuts what is above it.
 */
export function hpAfterMaxChange(hpCurrent: number, maxBefore: number, maxAfter: number): number {
  if (maxAfter > maxBefore) return hpCurrent + (maxAfter - maxBefore);
  return Math.min(hpCurrent, maxAfter);
}

export const DAMAGE_ADJUSTMENTS = ['immune', 'resistant', 'vulnerable', 'resistantVulnerable'] as const;
export type DamageAdjustment = (typeof DAMAGE_ADJUSTMENTS)[number];

/**
 * The damage a combatant takes under its effects, as a suggestion for the
 * master: immunity takes it to 0, resistance halves it (rounded down) and
 * vulnerability doubles it. With both, resistance comes first and then
 * vulnerability (2024: 25 becomes 12, then 24). An unknown type (or none)
 * leaves the amount as rolled.
 */
export function damageUnderEffects(
  amount: number,
  damageType: string,
  effects: readonly CombatEffect[],
): { amount: number; adjustment: DamageAdjustment | null; damageType: DamageType | null } {
  const type = damageTypeFromText(damageType);
  if (!type) return { amount, adjustment: null, damageType: null };
  const has = (key: (typeof DAMAGE_LISTS)[number]) => effects.some(({ modifiers }) => modifiers[key]?.includes(type));
  if (has('immunities')) return { amount: 0, adjustment: 'immune', damageType: type };
  const resistant = has('resistances');
  const vulnerable = has('vulnerabilities');
  const halved = resistant ? Math.floor(amount / 2) : amount;
  if (vulnerable) return { amount: halved * 2, adjustment: resistant ? 'resistantVulnerable' : 'vulnerable', damageType: type };
  if (resistant) return { amount: halved, adjustment: 'resistant', damageType: type };
  return { amount, adjustment: null, damageType: type };
}

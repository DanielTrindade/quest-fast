import type { ActiveCondition, CombatantView, Condition, EncounterStatus, HealthBand } from '@quest-fast/shared';

/** Visible labels of the combat, in Portuguese (D&D 2024). */

export const HEALTH_BAND_LABELS: Record<HealthBand, string> = {
  unhurt: 'Ileso',
  wounded: 'Ferido',
  bloodied: 'Muito ferido',
  defeated: 'Derrotado',
};

export const ENCOUNTER_STATUS_LABELS: Record<EncounterStatus, string> = {
  preparing: 'Em preparação',
  active: 'Em andamento',
  ended: 'Encerrado',
};

export const CONDITION_LABELS: Record<Condition, string> = {
  blinded: 'Cego',
  charmed: 'Enfeitiçado',
  deafened: 'Surdo',
  exhaustion: 'Exaustão',
  frightened: 'Amedrontado',
  grappled: 'Agarrado',
  incapacitated: 'Incapacitado',
  invisible: 'Invisível',
  paralyzed: 'Paralisado',
  petrified: 'Petrificado',
  poisoned: 'Envenenado',
  prone: 'Caído',
  restrained: 'Impedido',
  stunned: 'Atordoado',
  unconscious: 'Inconsciente',
};

/** "Envenenado (2 rodadas)", "Exaustão 3". */
export function conditionLabel({ condition, level, roundsLeft }: ActiveCondition): string {
  const name = level ? `${CONDITION_LABELS[condition]} ${level}` : CONDITION_LABELS[condition];
  if (roundsLeft === undefined) return name;
  return `${name} (${roundsLeft} ${roundsLeft === 1 ? 'rodada' : 'rodadas'})`;
}

/**
 * Combatants the master may reorder against each other: same initiative and
 * same Dexterity, so only the manual order tells them apart.
 */
export function tiedWith(combatants: CombatantView[], index: number): { up: boolean; down: boolean } {
  const tied = (a?: CombatantView, b?: CombatantView) =>
    !!a && !!b && a.initiative !== null && a.initiative === b.initiative && a.dexModifier === b.dexModifier;
  return { up: tied(combatants[index], combatants[index - 1]), down: tied(combatants[index], combatants[index + 1]) };
}

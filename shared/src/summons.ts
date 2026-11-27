/**
 * Summons and other combatants a player controls (#114). A combatant that is
 * not a character may have a controller, a player of the campaign: it is then
 * an ally, open to the whole table like a character, and only its controller
 * and the master act with it. A summon may also be tied to its summoner: it
 * acts right after it, it ends when the summoner's concentration ends, or
 * after a number of rounds.
 */

export const SUMMON_INITIATIVE_MODES = ['withSummoner', 'own'] as const;
/** `withSummoner`: the summoner's count, right after it (2024 Summon spells); `own`: rolled apart. */
export type SummonInitiativeMode = (typeof SUMMON_INITIATIVE_MODES)[number];

export function isSummonInitiativeMode(value: unknown): value is SummonInitiativeMode {
  return typeof value === 'string' && (SUMMON_INITIATIVE_MODES as readonly string[]).includes(value);
}

export const SUMMON_LIMITS = {
  /** Summons one summoner keeps at once (Animate Dead adds a few each cast). */
  perSummoner: 12,
  /** A duration in rounds: 10 is one minute. */
  rounds: { min: 1, max: 100 },
} as const;

/** How a summon is tied to its summoner, as the encounter forms send it. */
export type SummonLinkInput = {
  /** A combatant of the same encounter; null for none. */
  summonerId: string | null;
  initiativeMode: SummonInitiativeMode;
  /** Ends when the summoner's concentration ends. */
  concentration: boolean;
  /** Ends after this many of its own turns; null for no limit. */
  rounds: number | null;
};

/** The link a combatant gets when nothing is said: acting on its own, for good. */
export const NO_SUMMON_LINK: SummonLinkInput = { summonerId: null, initiativeMode: 'own', concentration: false, rounds: null };

/** A player-facing error, or `undefined` when the link holds together. */
export function summonLinkError(link: SummonLinkInput): string | undefined {
  if (!isSummonInitiativeMode(link.initiativeMode)) return 'Escolha se a invocação age junto com quem a invocou ou na própria vez.';
  if (link.initiativeMode === 'withSummoner' && !link.summonerId) return 'Para agir junto, informe quem fez a invocação.';
  if (link.concentration && !link.summonerId) return 'Uma invocação de concentração precisa de quem a invocou.';
  const { min, max } = SUMMON_LIMITS.rounds;
  if (link.rounds !== null && !(Number.isInteger(link.rounds) && link.rounds >= min && link.rounds <= max)) {
    return `A duração deve ser um número de rounds entre ${min} e ${max}.`;
  }
  return undefined;
}

/**
 * Who the table sees whole: a character, or a creature a player controls.
 * Everyone else's numbers (AC, attacks, initiative) are the master's.
 */
export function isOpenToTable(combatant: { source: string; controllerId: string | null }): boolean {
  return combatant.source === 'character' || combatant.controllerId !== null;
}

/**
 * The end of a summon's own turn: a duration in rounds counts down, and at
 * 0 the summon leaves. Without a duration nothing changes.
 */
export function tickSummonRounds(roundsLeft: number | null): { roundsLeft: number | null; expired: boolean } {
  if (roundsLeft === null) return { roundsLeft: null, expired: false };
  const left = roundsLeft - 1;
  return { roundsLeft: Math.max(0, left), expired: left <= 0 };
}

/** What `summonsEnding` reads of each combatant. */
export type SummonState = {
  id: string;
  summonerId: string | null;
  concentration: boolean;
  concentrating: boolean;
};

/**
 * The summons whose concentration is gone: their summoner stopped
 * concentrating (by the button, by falling, on the sheet) or left the fight.
 * A summon whose summoner is itself leaving goes with it, so the result
 * already includes the whole chain.
 */
export function summonsEnding(combatants: readonly SummonState[]): string[] {
  const byId = new Map(combatants.map((combatant) => [combatant.id, combatant]));
  const ending = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const combatant of combatants) {
      if (ending.has(combatant.id) || !combatant.concentration) continue;
      const summoner = combatant.summonerId ? byId.get(combatant.summonerId) : undefined;
      if (!summoner || !summoner.concentrating || ending.has(summoner.id)) {
        ending.add(combatant.id);
        grew = true;
      }
    }
  }
  return combatants.filter((combatant) => ending.has(combatant.id)).map((combatant) => combatant.id);
}

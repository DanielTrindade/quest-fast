import type { CombatantView, EncounterView, HealthBand, TokenView } from '@quest-fast/shared';
import { canMoveToken } from './token-labels';

/** How much of a living combatant's health its token shows, and in which band. */
export type TokenHealth = { band: Exclude<HealthBand, 'defeated'>; fraction: number };

/** What the running fight adds to a token on the map. */
export type TokenFightMark = {
  /** The combatant behind it has the turn. */
  turn: boolean;
  /** Null when there is nothing left to show: at 0 hit points the token already says so. */
  health: TokenHealth | null;
};

export type FightMarks = ReadonlyMap<string, TokenFightMark>;

/** The running fight as the marks read it: what the encounter's view already tells this viewer. */
export type MarkedFight = Pick<EncounterView, 'activeCombatantId' | 'combatants'>;

/** The combatant behind a token: its character's, or its own. */
export function fighterOf(encounter: Pick<EncounterView, 'combatants'>, token: Pick<TokenView, 'characterId' | 'combatantId'>): CombatantView | null {
  return encounter.combatants.find((combatant) =>
    (token.characterId !== null && combatant.characterId === token.characterId) || combatant.id === token.combatantId) ?? null;
}

/** Where the band puts the arc when the hit points are not known. */
const BAND_FRACTION: Record<TokenHealth['band'], number> = { unhurt: 1, wounded: 2 / 3, bloodied: 1 / 3 };

/** How full the arc is: the hit points when the viewer has them, the band otherwise. */
export function healthOf(combatant: Pick<CombatantView, 'healthBand' | 'hpCurrent' | 'hpMax'>): TokenHealth | null {
  const band = combatant.healthBand;
  if (band === 'defeated') return null;
  const { hpCurrent, hpMax } = combatant;
  if (hpCurrent === null || hpMax === null || hpMax <= 0) return { band, fraction: BAND_FRACTION[band] };
  return { band, fraction: Math.min(1, Math.max(0, hpCurrent / hpMax)) };
}

/**
 * The turn and the health of each token whose combatant is in the running
 * fight, keyed by token id. Outside a fight there are none. Everything comes
 * from the encounter as the server projected it for this viewer: a player
 * whose turn the server hides (`activeCombatantId` null) sees no turn.
 */
export function fightMarks(tokens: readonly TokenView[], fight: MarkedFight | null): FightMarks {
  const marks = new Map<string, TokenFightMark>();
  if (!fight) return marks;
  const active = fight.activeCombatantId;
  for (const token of tokens) {
    const fighter = fighterOf(fight, token);
    if (!fighter) continue;
    marks.set(token.id, { turn: active !== null && fighter.id === active, health: healthOf(fighter) });
  }
  return marks;
}

/** The name of whoever has the turn on the map, for the accessible summary. */
export function turnName(tokens: readonly TokenView[], marks: FightMarks | undefined): string | null {
  if (!marks) return null;
  return tokens.find((token) => marks.get(token.id)?.turn)?.name ?? null;
}

/** A token of a character or of a combatant may be in a fight; a free one never is. */
export function mayFight(token: Pick<TokenView, 'characterId' | 'combatantId'>): boolean {
  return token.characterId !== null || token.combatantId !== null;
}

/**
 * Why a token cannot be picked up now, or null when it can:
 * - `not-yours`: a player moves only their own character's;
 * - `settling`: its last drop is still unanswered, and a new drag would be saved over;
 * - `fight-unknown`: whether a fight runs is not known yet, and its move could spend a turn unasked;
 * - `not-your-turn`: in a fight a player moves their own only on its turn (the server says the same).
 * `fight` is the running fight, null outside one, undefined while not known.
 */
export type MoveRefusal = 'not-yours' | 'settling' | 'fight-unknown' | 'not-your-turn';

export function moveRefusal(token: TokenView, { viewerId, master, settling, fight }: {
  viewerId: string | null; master: boolean; settling: boolean; fight: MarkedFight | null | undefined;
}): MoveRefusal | null {
  if (!canMoveToken(token, viewerId, master)) return 'not-yours';
  if (settling) return 'settling';
  if (fight === undefined) return mayFight(token) ? 'fight-unknown' : null;
  if (master || !fight) return null;
  const fighter = fighterOf(fight, token);
  return !fighter || fighter.id === fight.activeCombatantId ? null : 'not-your-turn';
}

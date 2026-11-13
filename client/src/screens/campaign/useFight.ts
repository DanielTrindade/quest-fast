import { useQuery } from '@tanstack/react-query';
import type { CombatantView, EncounterView, TokenView } from '@quest-fast/shared';
import { encounterQuery, encountersQuery } from '../../lib/combat-cache';

export type Fight = {
  encounter: EncounterView;
  /** The combatant behind a token: its character's, or its own. */
  fighterOf: (token: Pick<TokenView, 'characterId' | 'combatantId'>) => CombatantView | null;
  /** The combatant whose turn it is, as this viewer may know it. */
  active: CombatantView | null;
};

/**
 * The campaign's running fight as the map reads it, once round 1 began:
 * before that, and outside a fight, the table moves its tokens freely (null).
 * `undefined` while that is not known yet — the encounters, or the running
 * one, still loading or failed: a move then could spend a turn without being
 * asked. The same queries the combat screens use, so the socket keeps both
 * in step.
 */
export function useFight(campaignId: string): Fight | null | undefined {
  const list = useQuery(encountersQuery(campaignId));
  const runningId = list.data?.encounters.find((encounter) => encounter.status === 'active')?.id;
  const detail = useQuery({ ...encounterQuery(campaignId, runningId ?? ''), enabled: runningId !== undefined });
  if (list.data === undefined) return undefined;
  if (runningId === undefined) return null;
  const encounter = detail.data?.encounter;
  if (!encounter) return undefined;
  if (encounter.status !== 'active' || encounter.round === 0) return null;

  const fighterOf: Fight['fighterOf'] = (token) =>
    encounter.combatants.find((combatant) =>
      (token.characterId !== null && combatant.characterId === token.characterId) || combatant.id === token.combatantId) ?? null;
  const active = encounter.combatants.find((combatant) => combatant.id === encounter.activeCombatantId) ?? null;
  return { encounter, fighterOf, active };
}

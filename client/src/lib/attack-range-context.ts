import { createContext } from 'react';
import type { AttackRange, TokenView } from '@quest-fast/shared';

/** Whose attack it is: a character's (their token) or a combatant's (its own token). */
export type RangeOwner = { characterId: string | null; combatantId: string | null };

/** The one attack range shown on the map, and whose it is. */
export type ShownAttackRange = { owner: RangeOwner; attackKey: string; range: AttackRange };

/**
 * What the Mesa shares between the attacks in the Ações tab and the map: the
 * range asked for, whether an attacker has a token on the open scene, and the
 * way to show or clear it. Without a provider (outside the Mesa) attacks
 * offer no "Ver alcance".
 */
export type AttackRangeChannel = {
  shown: ShownAttackRange | null;
  show: (next: ShownAttackRange | null) => void;
  /** Clears the range shown only if it is this owner's. */
  clear: (owner: RangeOwner) => void;
  /** Whether the attacker has a token on the scene open for the table. */
  onMap: (owner: RangeOwner) => boolean;
};

export const AttackRangeContext = createContext<AttackRangeChannel | null>(null);

export function sameOwner(a: RangeOwner, b: RangeOwner): boolean {
  return a.characterId === b.characterId && a.combatantId === b.combatantId;
}

/** The token an attacker attacks from: their character's, or the combatant's own. */
export function tokenOf(tokens: readonly TokenView[], owner: RangeOwner): TokenView | undefined {
  return tokens.find((token) =>
    (owner.characterId !== null && token.characterId === owner.characterId) || (owner.combatantId !== null && token.combatantId === owner.combatantId));
}

/**
 * Whether a panel of the Mesa no longer shows its Ações tab, so the range
 * asked for there leaves the map. The tab changes in many ways (the panel's
 * own tabs, the map's grid, tokens and fog buttons, the chat's toast), and
 * the Ações tab stays mounted while hidden: the state is what decides, not
 * the way it changed. The full screen's panel left it when it shows another
 * tab or is folded; the page's panel only while it is the one in sight
 * (under the full screen it sleeps, and decides nothing).
 */
export function leftActions(panel: { tab: string; staged: boolean; collapsed: boolean; inSight: boolean }): boolean {
  if (panel.staged) return panel.collapsed || panel.tab !== 'actions';
  return panel.inSight && panel.tab !== 'actions';
}

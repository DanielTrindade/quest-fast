import { createContext, useContext } from 'react';
import type { RollBonusInput } from '@quest-fast/shared';
import type { RollBonusDraft } from './roll-bonus-draft';

/**
 * The Mesa's situational modifiers: the bar where they are typed and every
 * roll that sends them. Outside the Mesa there is no provider and no roll
 * carries one.
 */
export type RollBonusChannel = { draft: RollBonusDraft; setDraft: (next: RollBonusDraft) => void };

export const RollBonusContext = createContext<RollBonusChannel | null>(null);

/** The text to send with a roll: only what was typed, as typed. The server checks it. */
export function bonusOf(draft: RollBonusDraft | undefined): RollBonusInput | undefined {
  if (!draft) return undefined;
  const roll = draft.roll.trim();
  const damage = draft.damage.trim();
  if (!roll && !damage) return undefined;
  return { ...(roll ? { roll } : {}), ...(damage ? { damage } : {}) };
}

/** What a roll made now carries: the modifiers in the bar, if any. */
export function useRollBonus(): RollBonusInput | undefined {
  return bonusOf(useContext(RollBonusContext)?.draft);
}

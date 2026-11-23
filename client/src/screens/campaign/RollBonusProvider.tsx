import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RollBonusBar } from '../../components/RollBonusBar';
import { RollBonusContext, type RollBonusChannel } from '../../lib/roll-bonus-context';
import { NO_ROLL_BONUS, type RollBonusDraft } from '../../lib/roll-bonus-draft';

const key = (campaignId: string) => `quest-fast:roll-bonus:${campaignId}`;

/** What this tab last had in the bar: a reload keeps a Bênção that still lasts. */
function stored(campaignId: string): RollBonusDraft {
  try {
    const raw = window.sessionStorage.getItem(key(campaignId));
    const value = raw ? (JSON.parse(raw) as Partial<RollBonusDraft>) : null;
    return { roll: typeof value?.roll === 'string' ? value.roll : '', damage: typeof value?.damage === 'string' ? value.damage : '' };
  } catch {
    // Blocked storage: the bar starts empty.
    return NO_ROLL_BONUS;
  }
}

/**
 * The Mesa's situational modifiers, kept in this browser tab until cleared:
 * the bar shows them, every roll at the Mesa sends them.
 */
export function RollBonusProvider({ campaignId, children }: { campaignId: string; children: ReactNode }) {
  const [draft, setDraft] = useState(() => stored(campaignId));
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key(campaignId), JSON.stringify(draft));
    } catch {
      // Blocked storage: the modifiers last while the page is open.
    }
  }, [campaignId, draft]);
  const channel = useMemo<RollBonusChannel>(() => ({ draft, setDraft }), [draft]);
  return <RollBonusContext value={channel}>{children}</RollBonusContext>;
}

/** The bar, wired to the Mesa's modifiers; nothing outside the Mesa. */
export function TableRollBonusBar() {
  const channel = useContext(RollBonusContext);
  if (!channel) return null;
  return <RollBonusBar value={channel.draft} onChange={channel.setDraft} />;
}

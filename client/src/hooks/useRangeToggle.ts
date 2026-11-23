import { useContext, useEffect, useRef } from 'react';
import { parseRange } from '@quest-fast/shared';
import { AttackRangeContext, sameOwner, type RangeOwner } from '../lib/attack-range-context';

/**
 * "Ver alcance" for one attacker's rows. `offer` says whether a row gets the
 * button: inside the Mesa, with the attacker on the map and a range the map
 * can draw. Leaving (another combatant picked, the list gone) clears the
 * range this attacker had on the map.
 */
export function useRangeToggle(owner: RangeOwner | null) {
  const channel = useContext(AttackRangeContext);
  const onMap = channel !== null && owner !== null && channel.onMap(owner);
  const mine = channel?.shown && owner && sameOwner(channel.shown.owner, owner) ? channel.shown : null;

  // The cleanup reads the channel and the owner of the last render, not of the first.
  const latest = useRef({ channel, owner });
  useEffect(() => {
    latest.current = { channel, owner };
  });
  const ownerKey = owner ? `${owner.characterId ?? ''}|${owner.combatantId ?? ''}` : '';
  useEffect(() => () => {
    const { channel: last, owner: leaving } = latest.current;
    if (last && leaving) last.clear(leaving);
  }, [ownerKey]);

  return {
    /** The toggle for a row, or nothing when it cannot show its range. */
    offer: (attackKey: string, rangeText: string) => {
      const range = parseRange(rangeText);
      if (!channel || !owner || !onMap || !range) return null;
      const shown = mine?.attackKey === attackKey;
      return { shown, toggle: () => channel.show(shown ? null : { owner, attackKey, range }) };
    },
    /** After an attack the range has done its job. */
    clear: () => {
      if (channel && owner) channel.clear(owner);
    },
  };
}

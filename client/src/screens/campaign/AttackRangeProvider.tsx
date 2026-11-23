import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AttackRangeContext, sameOwner, tokenOf, type AttackRangeChannel, type ShownAttackRange } from '../../lib/attack-range-context';
import { activeSceneQuery } from '../../lib/scene-cache';

/**
 * The Mesa's one attack range on the map: the Ações tab asks for it, the map
 * draws it around the attacker's token on the scene open for the table.
 */
export function AttackRangeProvider({ campaignId, children }: { campaignId: string; children: ReactNode }) {
  const [shown, setShown] = useState<ShownAttackRange | null>(null);
  const scene = useQuery(activeSceneQuery(campaignId));
  const tokens = scene.data?.tokens;
  const channel = useMemo<AttackRangeChannel>(() => ({
    shown,
    show: setShown,
    clear: (owner) => setShown((current) => (current && sameOwner(current.owner, owner) ? null : current)),
    onMap: (owner) => tokens !== undefined && tokenOf(tokens, owner) !== undefined,
  }), [shown, tokens]);
  return <AttackRangeContext value={channel}>{children}</AttackRangeContext>;
}

import type { CombatantView } from '@quest-fast/shared';
import { masterCombatants, playerCombatants } from './encounters';

/**
 * Round 3 of "Emboscada na estrada" with hits waiting on the master: Hazin's
 * greataxe on Goblin 1 (a critical) and a goblin's scimitar on Hazin.
 */
function withHits(combatant: CombatantView): CombatantView {
  if (combatant.id === 'g1') {
    return {
      ...combatant,
      reminders: [{ id: 'd-g1', kind: 'pendingDamage', amount: 19, damageType: 'Cortante', critical: true, attackerName: 'Hazin Dan', attackName: 'Machado Grande', eventId: 'e1', secret: false }],
    };
  }
  if (combatant.id === 'c-hazin') {
    return {
      ...combatant,
      reminders: [{ id: 'd-hazin', kind: 'pendingDamage', amount: 5, damageType: 'Cortante', critical: false, attackerName: 'Goblin 2', attackName: 'Cimitarra', eventId: 'e2', secret: false }],
    };
  }
  return combatant;
}

export const masterWithHits: CombatantView[] = masterCombatants.map(withHits);
export const playerWithHits: CombatantView[] = playerCombatants.map(withHits);

/**
 * The card the server renders for link previews, drawn in code: the real one
 * comes from `/api/invites/:code/card.png`, which Storybook does not serve.
 */
export const inviteCard = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><rect width='1200' height='630' opacity='.12'/><rect x='64' y='64' width='96' height='96' rx='20' opacity='.5'/><text x='64' y='300' font-family='sans-serif' font-size='72' font-weight='700' opacity='.8'>Ecos de Phandalin</text><text x='64' y='380' font-family='sans-serif' font-size='36' opacity='.6'>Lia está reunindo o grupo.</text></svg>",
)}`;

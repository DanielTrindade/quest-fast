import type {
  CombatConditionPayload,
  CombatDeathSavePayload,
  CombatHitPointsPayload,
  DeathSaves,
  HealthBand,
} from '@quest-fast/shared';
import { CONDITION_LABELS, conditionLabel } from './combat-labels';

/** What happens to a combatant, as one sentence of the feed. */
export type FightPayload = CombatHitPointsPayload | CombatConditionPayload | CombatDeathSavePayload;

const BAND_PHRASE: Record<HealthBand, string> = {
  unhurt: 'está ileso',
  wounded: 'está ferido',
  bloodied: 'está muito ferido',
  defeated: 'foi derrotado',
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function counts({ successes, failures }: DeathSaves): string {
  return `${plural(successes, 'sucesso', 'sucessos')}, ${plural(failures, 'falha', 'falhas')}`;
}

/**
 * The numbers come only when the server left them in: the master always,
 * a player only for a character. Without them, the band says it.
 */
function hitPointsText({ kind, name, source, amount, hpCurrent, hpMax, band }: CombatHitPointsPayload): string {
  if (amount === undefined) return `${name} ${kind === 'combat.defeated' ? 'foi derrotado' : BAND_PHRASE[band]}.`;
  if (kind === 'combat.heal') return `${name} recuperou ${amount} PV (${hpCurrent}/${hpMax}).`;
  if (kind === 'combat.defeated') return `${name} sofreu ${amount} de dano e foi derrotado.`;
  if (source === 'character' && hpCurrent === 0) return `${name} sofreu ${amount} de dano e caiu (${hpCurrent}/${hpMax}).`;
  return `${name} sofreu ${amount} de dano (${hpCurrent}/${hpMax}).`;
}

function conditionText({ name, action, condition }: CombatConditionPayload): string {
  if (action === 'applied') return `${name} está com a condição ${conditionLabel(condition)}.`;
  if (action === 'removed') return `${name} não está mais com a condição ${CONDITION_LABELS[condition.condition]}.`;
  return `A condição ${CONDITION_LABELS[condition.condition]} de ${name} acabou.`;
}

function deathSaveText({ name, d20, failures, saves, outcome }: CombatDeathSavePayload): string {
  if (outcome === 'revived') return `${name} tirou 20 no teste contra a morte e voltou com 1 PV.`;
  const ending = outcome === 'stable' ? '. Está estável.' : outcome === 'dead' ? '. Morreu.' : ` (${counts(saves)}).`;
  if (d20 === undefined) {
    return `${name} sofreu dano caído: ${failures === 2 ? 'duas falhas' : 'uma falha'} no teste contra a morte${ending}`;
  }
  const result = d20 === 1 ? 'duas falhas' : d20 >= 10 ? 'sucesso' : 'falha';
  return `${name} tirou ${d20} no teste contra a morte: ${result}${ending}`;
}

export function combatEventText(payload: FightPayload): string {
  if (payload.kind === 'combat.condition') return conditionText(payload);
  if (payload.kind === 'combat.deathSave') return deathSaveText(payload);
  return hitPointsText(payload);
}

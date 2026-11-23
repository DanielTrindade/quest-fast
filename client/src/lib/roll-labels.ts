import type { RollPayload } from '@quest-fast/shared';
import { ABILITY_LABELS, SKILL_LABELS } from './5e';

/** "Teste de Atletismo", "Ataque (Machado Grande)": what a linked roll was. */
export function rollActionLabel(payload: RollPayload): string {
  if (payload.rollKind === 'attack') return `Ataque (${payload.attackName})`;
  if (payload.rollKind === 'skill') return `Teste de ${payload.skill ? SKILL_LABELS[payload.skill] : ''}`;
  if (payload.rollKind === 'check') return `Teste de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  if (payload.rollKind === 'save') return `Salvaguarda de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  if (payload.rollKind === 'initiative') return 'Iniciativa';
  if (payload.rollKind === 'spellAttack') return 'Ataque mágico';
  return 'Rolagem';
}

/** The kept dice and the modifier: "14 + 5". */
export function rollDecomposition(payload: Pick<RollPayload, 'dice' | 'modifier' | 'bonus'>): string {
  let text = payload.dice.filter((die) => !die.discarded).map((die) => `${die.value}`).join(' + ');
  if (payload.modifier !== 0) text += ` ${payload.modifier > 0 ? '+' : '−'} ${Math.abs(payload.modifier)}`;
  // The situational modifier comes apart, with what was typed: "14 + 5 + 3 (+1d4)".
  if (payload.bonus) text += ` ${payload.bonus.total < 0 ? '−' : '+'} ${Math.abs(payload.bonus.total)} (${payload.bonus.expression})`;
  return text;
}

/** Every die of a roll, the situational modifier's after the roll's own. */
export function rolledDice(payload: Pick<RollPayload, 'dice' | 'bonus'>) {
  return payload.bonus ? [...payload.dice, ...payload.bonus.dice] : payload.dice;
}

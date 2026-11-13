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
export function rollDecomposition(payload: RollPayload): string {
  const kept = payload.dice.filter((die) => !die.discarded).map((die) => `${die.value}`).join(' + ');
  if (payload.modifier === 0) return kept;
  return `${kept} ${payload.modifier > 0 ? '+' : '−'} ${Math.abs(payload.modifier)}`;
}

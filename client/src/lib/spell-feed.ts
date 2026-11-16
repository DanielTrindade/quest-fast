import type { SpellCastPayload } from '@quest-fast/shared';
import { circleLabel } from './sheet-labels';

/**
 * How a cast reads in the feed: "Lyra conjurou Bola de Fogo no 4º círculo.",
 * "… como ritual.", and a note when it asks for concentration.
 */
export function spellCastText(payload: SpellCastPayload): string {
  const how = payload.circle === null ? 'como ritual' : `no ${circleLabel(payload.circle)}`;
  const concentration = payload.concentration ? ' Concentrando-se.' : '';
  return `${payload.characterName} conjurou ${payload.spellName} ${how}.${concentration}`;
}

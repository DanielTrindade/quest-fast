import { formatMeters, type CombatEffect, type CombatEffectView, type DamageAdjustment, type DamageType, type EffectDuration, type PendingDamage } from '@quest-fast/shared';

/** Visible labels of the temporary effects, in Portuguese (D&D 2024). */

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  acid: 'ácido',
  bludgeoning: 'concussão',
  cold: 'frio',
  fire: 'fogo',
  force: 'energia',
  lightning: 'elétrico',
  necrotic: 'necrótico',
  piercing: 'perfurante',
  poison: 'veneno',
  psychic: 'psíquico',
  radiant: 'radiante',
  slashing: 'cortante',
  thunder: 'trovão',
};

export const EFFECT_DURATION_LABELS: Record<EffectDuration, string> = {
  encounter: 'Até o fim do combate',
  rounds: 'Por rodadas',
  untilTurnStart: 'Até o início do próximo turno',
  none: 'Sem prazo',
};

/** Whether the viewer got the effect whole, or only its name (a monster's, for a player). */
export function isWholeEffect(effect: CombatEffectView): effect is CombatEffect {
  return 'modifiers' in effect;
}

function signed(value: number, unit = ''): string {
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}${unit}`;
}

function damageList(label: string, types: readonly DamageType[] | undefined): string | null {
  return types?.length ? `${label}: ${types.map((type) => DAMAGE_TYPE_LABELS[type]).join(', ')}` : null;
}

/** "CA +2", "Deslocamento pela metade", "Resistência: fogo": what the effect changes, one part each. */
export function effectParts({ modifiers }: CombatEffect): string[] {
  const { ac, speed, hpMax } = modifiers;
  return [
    ac ? (ac.mode === 'add' ? `CA ${signed(ac.value)}` : `CA ${ac.value}`) : null,
    speed
      ? speed.mode === 'half'
        ? 'Deslocamento pela metade'
        : speed.mode === 'add'
          ? `Deslocamento ${signed(speed.value, ' m').replace('.', ',')}`
          : `Deslocamento ${formatMeters(speed.value)}`
      : null,
    hpMax ? `PV máx. +${hpMax}` : null,
    damageList('Resistência', modifiers.resistances),
    damageList('Imunidade', modifiers.immunities),
    damageList('Vulnerabilidade', modifiers.vulnerabilities),
  ].filter((part): part is string => part !== null);
}

/** "2 rod.", "até o próximo turno": the chip's duration; nothing for one that lasts the fight. */
export function effectDurationShort(effect: CombatEffect): string | null {
  if (effect.duration === 'rounds') return `${effect.roundsLeft ?? 1} rod.`;
  if (effect.duration === 'untilTurnStart') return 'até o próximo turno';
  return null;
}

/** "Escudo da Fé: CA +2, 3 rodadas, concentração": the whole effect, for a screen reader. */
export function effectLabel(effect: CombatEffectView): string {
  if (!isWholeEffect(effect)) return effect.name;
  const rounds = effect.duration === 'rounds' ? `${effect.roundsLeft ?? 1} ${effect.roundsLeft === 1 ? 'rodada' : 'rodadas'}` : null;
  const lasts = effect.duration === 'untilTurnStart' ? 'até o início do próximo turno' : rounds;
  const parts = [...effectParts(effect), lasts, effect.concentration ? 'concentração' : null].filter(Boolean);
  return parts.length > 0 ? `${effect.name}: ${parts.join(', ')}` : effect.name;
}

const ADJUSTMENT_LABELS: Record<DamageAdjustment, string> = {
  immune: 'Imune',
  resistant: 'Resistência',
  vulnerable: 'Vulnerabilidade',
  resistantVulnerable: 'Resistência e vulnerabilidade',
};

/** "Resistência a cortante: rolou 19": why the pending damage is not what was rolled. */
export function damageAdjustmentText(damage: Pick<PendingDamage, 'adjustment' | 'rolled' | 'damageType'>): string | null {
  if (!damage.adjustment || damage.rolled === undefined) return null;
  const type = damage.damageType.trim().toLowerCase();
  const label = ADJUSTMENT_LABELS[damage.adjustment];
  return `${type ? `${label} a ${type}` : label}: rolou ${damage.rolled}`;
}

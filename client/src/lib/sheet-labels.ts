import type { ArmorTraining, Coin, ProficiencyLevel, Size } from '@quest-fast/shared';

/** Visible labels of the official D&D 2024 sheet, in Portuguese. */

export const SIZE_LABELS: Record<Size, string> = {
  tiny: 'Minúsculo',
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
  huge: 'Enorme',
  gargantuan: 'Imenso',
};

export const ARMOR_TRAINING_LABELS: Record<ArmorTraining, string> = {
  light: 'Leve',
  medium: 'Média',
  heavy: 'Pesada',
  shields: 'Escudos',
};

export const COIN_LABELS: Record<Coin, { short: string; name: string }> = {
  cp: { short: 'PC', name: 'Cobre (PC)' },
  sp: { short: 'PP', name: 'Prata (PP)' },
  ep: { short: 'PE', name: 'Electro (PE)' },
  gp: { short: 'PO', name: 'Ouro (PO)' },
  pp: { short: 'PL', name: 'Platina (PL)' },
};

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  none: 'Nenhuma',
  proficient: 'Proficiente',
  expert: 'Especialista',
};

/** 0 is a cantrip; the rest read "1º círculo". */
export function circleLabel(level: number): string {
  return level === 0 ? 'Truque' : `${level}º círculo`;
}

export function formatSpeed(meters: number): string {
  return `${meters.toLocaleString('pt-BR')} m`;
}

/** "+4", "+0" and "−1", with a real minus sign so columns of bonuses align. */
export function signedBonus(value: number): string {
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

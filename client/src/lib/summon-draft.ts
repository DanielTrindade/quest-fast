import {
  summonLinkError,
  validateSummonSheet,
  type AttackInput,
  type Size,
  type SummonFieldErrors,
  type SummonInitiativeMode,
  type SummonInput,
  type SummonLinkInput,
} from '@quest-fast/shared';

/** One attack row of the simple sheet, as typed; `key` tells the rows apart while they are edited. */
export type SummonAttackDraft = { key: string; name: string; bonus: string; damage: string; damageType: string };

/** The "Invocar" form as typed: every number still text, so a field can be empty. */
export type SummonDraft = {
  name: string;
  size: Size;
  ac: string;
  hp: string;
  speed: string;
  initiativeBonus: string;
  attacks: SummonAttackDraft[];
  initiativeMode: SummonInitiativeMode;
  concentration: boolean;
  /** Empty for no limit. */
  rounds: string;
};

let rows = 0;

/** A new, empty attack row. */
export function emptySummonAttack(): SummonAttackDraft {
  rows += 1;
  return { key: `attack-${rows}`, name: '', bonus: '', damage: '', damageType: '' };
}

export function emptySummonDraft(): SummonDraft {
  return {
    name: '',
    size: 'medium',
    ac: '',
    hp: '',
    speed: '9',
    initiativeBonus: '0',
    attacks: [],
    initiativeMode: 'withSummoner',
    concentration: false,
    rounds: '',
  };
}

/** A number as typed: comma or dot for the decimals, NaN when it is not one. */
function numberOf(value: string): number {
  const clean = value.trim().replace(',', '.');
  return clean === '' ? Number.NaN : Number(clean);
}

export type SummonDraftErrors = SummonFieldErrors & { rounds?: string; link?: string };

/**
 * The request the draft makes, or what is wrong with it, field by field. The
 * same rules the server checks, so a refusal is rare and points at a field.
 */
export function summonRequest(
  draft: SummonDraft,
  summonerId: string,
): { ok: true; request: SummonInput } | { ok: false; errors: SummonDraftErrors } {
  const attacks: AttackInput[] = draft.attacks.map((attack) => ({
    kind: 'attack',
    name: attack.name.trim(),
    bonus: numberOf(attack.bonus),
    damage: attack.damage.trim(),
    damageType: attack.damageType.trim(),
  }));
  const sheet = {
    name: draft.name.trim(),
    size: draft.size,
    ac: numberOf(draft.ac),
    hp: numberOf(draft.hp),
    speed: numberOf(draft.speed),
    initiativeBonus: numberOf(draft.initiativeBonus),
    attacks,
  };
  const rounds = draft.rounds.trim() === '' ? null : numberOf(draft.rounds);
  const summon: SummonLinkInput = { summonerId, initiativeMode: draft.initiativeMode, concentration: draft.concentration, rounds };
  const errors: SummonDraftErrors = { ...validateSummonSheet(sheet) };
  const linkError = summonLinkError(summon);
  if (linkError) {
    if (rounds !== null && /rounds/.test(linkError)) errors.rounds = linkError;
    else errors.link = linkError;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, request: { source: 'summon', sheet, summon } };
}

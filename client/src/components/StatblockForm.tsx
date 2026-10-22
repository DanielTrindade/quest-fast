import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  ABILITIES,
  CHALLENGE_RATINGS,
  SIZES,
  STATBLOCK_LIMITS as S,
  validateStatblockInput,
  type Ability,
  type Size,
  type Statblock,
  type StatblockFieldErrors,
  type StatblockInput,
} from '@quest-fast/shared';
import { AbilityInput } from './AbilityInput';
import { AttackListEditor } from './AttackListEditor';
import { Field } from './Field';
import { FormFooter } from './FormFooter';
import { SelectField } from './SelectField';
import { numberValue, toAttackInputs, toFormAttacks } from '../lib/form-attacks';
import { SIZE_LABELS } from '../lib/sheet-labels';

function freshState(statblock: Statblock | null) {
  return {
    name: statblock?.name ?? '',
    size: (statblock?.size ?? 'medium') as Size,
    creatureType: statblock?.creatureType ?? '',
    challengeRating: statblock?.challengeRating ?? '',
    ac: statblock ? String(statblock.ac) : '10',
    hpAverage: statblock ? String(statblock.hpAverage) : '',
    hpFormula: statblock?.hpFormula ?? '',
    speed: statblock?.speed ?? '9 m',
    initiativeBonus: String(statblock?.initiativeBonus ?? 0),
    abilityScores: Object.fromEntries(
      ABILITIES.map((ability) => [ability, String(statblock?.abilityScores[ability] ?? 10)]),
    ) as Record<Ability, string>,
    attacks: toFormAttacks(statblock?.attacks ?? []),
    traits: statblock?.traits ?? '',
    actions: statblock?.actions ?? '',
    reactions: statblock?.reactions ?? '',
  };
}

type FormState = ReturnType<typeof freshState>;

function toInput(state: FormState): StatblockInput {
  return {
    name: state.name.trim(),
    size: state.size,
    creatureType: state.creatureType.trim(),
    challengeRating: state.challengeRating,
    ac: numberValue(state.ac),
    hpAverage: numberValue(state.hpAverage),
    hpFormula: state.hpFormula.trim(),
    speed: state.speed.trim(),
    initiativeBonus: numberValue(state.initiativeBonus),
    abilityScores: Object.fromEntries(
      ABILITIES.map((ability) => [ability, numberValue(state.abilityScores[ability])]),
    ) as StatblockInput['abilityScores'],
    attacks: toAttackInputs(state.attacks),
    traits: state.traits.trim(),
    actions: state.actions.trim(),
    reactions: state.reactions.trim(),
  };
}

function isScore(value: string) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 30;
}

export type StatblockFormHandle = { requestClose: () => void };

/**
 * The bestiary editor, for creation and editing. Presentational: it owns the
 * field state, the per-field validation and the discard guard, and hands a
 * valid `StatblockInput` to `onSubmit`; saving is the consumer's job. The
 * dialog shell calls `requestClose` for every close attempt.
 */
export function StatblockForm({ statblock, onSubmit, onRequestClose, pending = false, submitError, ref }: {
  statblock: Statblock | null;
  onSubmit: (input: StatblockInput) => void;
  onRequestClose: () => void;
  pending?: boolean;
  submitError?: string;
  ref?: Ref<StatblockFormHandle>;
}) {
  const [state, setState] = useState(() => freshState(statblock));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const [initialSnapshot] = useState(() => JSON.stringify(state));
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const dirty = JSON.stringify(state) !== initialSnapshot;

  const [errors, setErrors] = useState<StatblockFieldErrors>({});
  const clearError = (key: keyof StatblockFieldErrors) =>
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  const edit = <K extends keyof FormState & keyof StatblockFieldErrors>(key: K, value: FormState[K]) => {
    set(key, value);
    clearError(key);
  };

  // A rejected submit moves focus (and the scroll) to the first invalid field.
  const formRef = useRef<HTMLFormElement>(null);
  const [rejectedSubmits, setRejectedSubmits] = useState(0);
  useEffect(() => {
    if (rejectedSubmits === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [rejectedSubmits]);

  const submit = () => {
    const input = toInput(state);
    const fieldErrors = validateStatblockInput(input);
    if (Object.values(fieldErrors).some(Boolean)) {
      setErrors(fieldErrors);
      setRejectedSubmits((count) => count + 1);
      return;
    }
    setErrors({});
    onSubmit(input);
  };

  const requestClose = () => {
    if (dirty) setConfirmingDiscard(true);
    else onRequestClose();
  };
  useImperativeHandle(ref, () => ({ requestClose }));

  return (
    // noValidate: the browser's own bubble would block the per-field errors.
    <form
      ref={formRef}
      noValidate
      className="sheet-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset className="sheet-form__fieldset">
        <legend>Identidade</legend>
        <Field label="Nome" required maxLength={S.name} value={state.name} error={errors.name}
          onChange={(e) => edit('name', e.target.value)} />
        <div className="sheet-form__grid--three sheet-form__grid">
          <SelectField label="Tamanho" value={state.size} onChange={(value) => set('size', value as Size)}>
            {SIZES.map((size) => <option key={size} value={size}>{SIZE_LABELS[size]}</option>)}
          </SelectField>
          <Field label="Tipo" hint="Ex.: Humanoide (goblinoide)" maxLength={S.creatureType} value={state.creatureType}
            error={errors.creatureType} onChange={(e) => edit('creatureType', e.target.value)} />
          <SelectField label="Nível de desafio" value={state.challengeRating}
            onChange={(value) => edit('challengeRating', value)}>
            <option value="">Sem ND</option>
            {CHALLENGE_RATINGS.map((rating) => <option key={rating} value={rating}>ND {rating}</option>)}
          </SelectField>
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Defesa e movimento</legend>
        <div className="sheet-form__grid--three sheet-form__grid">
          <Field label="CA" type="number" inputMode="numeric" required min={S.ac.min} max={S.ac.max} value={state.ac}
            error={errors.ac} onChange={(e) => edit('ac', e.target.value)} />
          <Field label="PV médio" type="number" inputMode="numeric" required min={S.hp.min} max={S.hp.max}
            value={state.hpAverage} error={errors.hpAverage} onChange={(e) => edit('hpAverage', e.target.value)} />
          <Field label="Fórmula de PV" hint="Ex.: 2d6. Usada para rolar o PV de cada cópia no encontro."
            autoComplete="off" spellCheck={false} maxLength={S.hpFormula} value={state.hpFormula}
            error={errors.hpFormula} onChange={(e) => edit('hpFormula', e.target.value)} />
          <Field label="Bônus de iniciativa" hint="Somado ao modificador de Destreza." type="number"
            min={S.initiativeBonus.min} max={S.initiativeBonus.max} value={state.initiativeBonus}
            error={errors.initiativeBonus} onChange={(e) => edit('initiativeBonus', e.target.value)} />
          <Field label="Deslocamento" hint="Ex.: 9 m, escalada 6 m" maxLength={S.speed} value={state.speed}
            error={errors.speed} onChange={(e) => edit('speed', e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Atributos</legend>
        {errors.abilityScores && <p role="alert" className="text-small text-danger-text">{errors.abilityScores}</p>}
        <div className="sheet-form__abilities">
          {ABILITIES.map((ability) => (
            <AbilityInput key={ability} ability={ability} value={state.abilityScores[ability]}
              invalid={Boolean(errors.abilityScores) && !isScore(state.abilityScores[ability])}
              onChange={(value) => edit('abilityScores', { ...state.abilityScores, [ability]: value })} />
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Ataques</legend>
        <AttackListEditor attacks={state.attacks} error={errors.attacks} notesHint="Ex.: alcance 1,5 m, um alvo"
          onChange={(attacks) => edit('attacks', attacks)} />
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Traços, ações e reações</legend>
        <Field label="Traços" hint="Ex.: Fuga Ágil. O goblin pode Desengajar ou Esconder como ação bônus."
          asTextarea maxLength={S.text} value={state.traits} error={errors.traits}
          onChange={(e) => edit('traits', e.target.value)} />
        <Field label="Outras ações" hint="O que não é um ataque com rolagem: magias, multiataque, sopro."
          asTextarea maxLength={S.text} value={state.actions} error={errors.actions}
          onChange={(e) => edit('actions', e.target.value)} />
        <Field label="Reações" asTextarea maxLength={S.text} value={state.reactions} error={errors.reactions}
          onChange={(e) => edit('reactions', e.target.value)} />
      </fieldset>

      <FormFooter
        error={submitError}
        confirmingDiscard={confirmingDiscard}
        onKeepEditing={() => setConfirmingDiscard(false)}
        onDiscard={onRequestClose}
        onCancel={requestClose}
        submitLabel={statblock ? 'Salvar alterações' : 'Adicionar ao bestiário'}
        pending={pending}
      />
    </form>
  );
}

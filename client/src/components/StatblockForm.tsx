import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  ABILITIES,
  CHALLENGE_RATINGS,
  SIZES,
  STATBLOCK_LIMITS as S,
  statblockFromSheet,
  validateStatblockInput,
  type Ability,
  type Attack,
  type ImportedAttack,
  type SheetImportResult,
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
import { SheetImport, type SheetImportStatus } from './SheetImport';
import { ABILITY_LABELS, SKILL_LABELS } from '../lib/5e';
import { numberValue, toAttackInputs, toFormAttacks } from '../lib/form-attacks';
import { UnreadableSheetError, readSheetPdf } from '../lib/sheet-pdf';
import { SIZE_LABELS } from '../lib/sheet-labels';

/** A saved statblock, or one imported from an NPC sheet whose attacks may still have blanks. */
type StatblockDraft = Omit<StatblockInput, 'attacks'> & { attacks: ReadonlyArray<Attack | ImportedAttack> };

function freshState(statblock: StatblockDraft | null) {
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
export function StatblockForm({ statblock, onSubmit, onRequestClose, pending = false, submitError, ref, readSheet = readSheetPdf }: {
  statblock: Statblock | null;
  onSubmit: (input: StatblockInput) => void;
  onRequestClose: () => void;
  pending?: boolean;
  submitError?: string;
  ref?: Ref<StatblockFormHandle>;
  /** Reads an imported PDF; replaceable so stories can hold the read open. */
  readSheet?: (file: File) => Promise<SheetImportResult | null>;
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

  // An NPC written on the official sheet fills a new creature. While the PDF
  // is read, the fields and the submit stay closed: a save would send the old
  // values and an edit would be overwritten.
  const [importStatus, setImportStatus] = useState<SheetImportStatus>({ kind: 'idle' });
  const importing = importStatus.kind === 'reading';
  const importPdf = async (file: File) => {
    setImportStatus({ kind: 'reading' });
    try {
      const sheet = await readSheet(file);
      if (!sheet) {
        setImportStatus({ kind: 'error', message: 'Este PDF não é a ficha oficial de D&D 2024 em português.' });
        return;
      }
      const { input, warnings } = statblockFromSheet(sheet, { abilities: ABILITY_LABELS, skills: SKILL_LABELS });
      setState(freshState(input));
      // What the bestiary would refuse is marked now, not only on submit.
      setErrors(validateStatblockInput(input));
      setImportStatus({ kind: 'done', fileName: file.name, warnings });
    } catch (error) {
      setImportStatus({
        kind: 'error',
        message: error instanceof UnreadableSheetError
          ? 'Não foi possível ler nenhum campo desta ficha.'
          : 'Não foi possível ler este arquivo como PDF.',
      });
    }
  };

  const submit = () => {
    // Guarded here and not only on the button: Enter in a field submits too.
    if (importing) return;
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
      {/* Only offered while creating: importing over a saved creature would replace it. */}
      {!statblock && (
        <SheetImport status={importStatus} onPick={(file) => void importPdf(file)}
          title="O NPC está numa ficha?"
          description="Importe o PDF da ficha oficial de D&D 2024 em português. Os números, ataques e características viram a criatura, e nada é salvo antes de você conferir." />
      )}

      <fieldset className="sheet-form__lock" disabled={importing}>
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
      </fieldset>

      <FormFooter
        error={submitError}
        confirmingDiscard={confirmingDiscard}
        onKeepEditing={() => setConfirmingDiscard(false)}
        onDiscard={onRequestClose}
        onCancel={requestClose}
        submitLabel={statblock ? 'Salvar alterações' : 'Adicionar ao bestiário'}
        pending={pending}
        busyMessage={importing ? 'Importando ficha…' : undefined}
      />
    </form>
  );
}

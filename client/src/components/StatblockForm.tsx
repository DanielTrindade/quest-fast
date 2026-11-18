import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  ABILITIES,
  CHALLENGE_RATINGS,
  SIZES,
  STATBLOCK_LIMITS as S,
  TURN_LIMITS,
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
import { ImageSquare } from '@phosphor-icons/react';
import { AbilityInput } from './AbilityInput';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { AttackListEditor } from './AttackListEditor';
import { SaveBonusFields } from './SaveBonusFields';
import { Field } from './Field';
import { FormFooter } from './FormFooter';
import { SelectField } from './SelectField';
import { SheetImport, type SheetImportStatus } from './SheetImport';
import { ABILITY_LABELS, SKILL_LABELS } from '../lib/5e';
import { numberValue, toAttackInputs, toFormAttacks } from '../lib/form-attacks';
import { UnreadableSheetError, readSheetPdf } from '../lib/sheet-pdf';
import { SIZE_LABELS } from '../lib/sheet-labels';
import { abilitiesGrid, fieldset, fileButton, form, grid3, lock } from './form-styles';

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
    attacksPerAction: String(statblock?.attacksPerAction ?? 1),
    initiativeBonus: String(statblock?.initiativeBonus ?? 0),
    abilityScores: Object.fromEntries(
      ABILITIES.map((ability) => [ability, String(statblock?.abilityScores[ability] ?? 10)]),
    ) as Record<Ability, string>,
    // Empty: the save rolls the ability modifier.
    saveBonuses: Object.fromEntries(
      ABILITIES.map((ability) => {
        const bonus = statblock?.saveBonuses?.[ability];
        return [ability, bonus === undefined ? '' : String(bonus)];
      }),
    ) as Record<Ability, string>,
    attacks: toFormAttacks(statblock?.attacks ?? []),
    traits: statblock?.traits ?? '',
    actions: statblock?.actions ?? '',
    reactions: statblock?.reactions ?? '',
    imageAssetId: (statblock?.imageAssetId ?? null) as string | null,
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
    attacksPerAction: numberValue(state.attacksPerAction),
    initiativeBonus: numberValue(state.initiativeBonus),
    abilityScores: Object.fromEntries(
      ABILITIES.map((ability) => [ability, numberValue(state.abilityScores[ability])]),
    ) as StatblockInput['abilityScores'],
    saveBonuses: Object.fromEntries(
      ABILITIES.filter((ability) => state.saveBonuses[ability].trim() !== '')
        .map((ability) => [ability, numberValue(state.saveBonuses[ability])]),
    ),
    attacks: toAttackInputs(state.attacks),
    traits: state.traits.trim(),
    actions: state.actions.trim(),
    reactions: state.reactions.trim(),
    imageAssetId: state.imageAssetId,
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
export function StatblockForm({ statblock, onSubmit, onRequestClose, pending = false, submitError, ref, readSheet = readSheetPdf, uploadImage }: {
  statblock: Statblock | null;
  onSubmit: (input: StatblockInput) => void;
  onRequestClose: () => void;
  pending?: boolean;
  submitError?: string;
  ref?: Ref<StatblockFormHandle>;
  /** Reads an imported PDF; replaceable so stories can hold the read open. */
  readSheet?: (file: File) => Promise<SheetImportResult | null>;
  /**
   * Uploads the creature's image and answers with its asset; without it the
   * image is kept as it is and not offered.
   */
  uploadImage?: (file: File) => Promise<{ id: string; url: string }>;
}) {
  const [state, setState] = useState(() => freshState(statblock));
  const [imageUrl, setImageUrl] = useState<string | null>(statblock?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pickImage = async (file: File) => {
    if (!uploadImage) return;
    setUploading(true);
    setUploadError(null);
    try {
      const asset = await uploadImage(file);
      set('imageAssetId', asset.id);
      setImageUrl(asset.url);
    } catch (error) {
      setUploadError(error instanceof Error && error.message ? error.message : 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
    }
  };
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
      // The picture is not on the sheet: one already sent stays.
      setState((current) => ({ ...freshState(input), imageAssetId: current.imageAssetId }));
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
    // An image still on its way would be saved as the old one.
    if (importing || uploading) return;
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
      className={form}
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

      <fieldset className={lock} disabled={importing}>
        <fieldset className={fieldset}>
          <legend>Identidade</legend>
          {uploadImage && (
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={state.name || '?'} src={state.imageAssetId ? imageUrl ?? undefined : undefined} loading={uploading} variant="character" size="lg" />
              <div className="flex flex-wrap items-center gap-2">
                <label className={fileButton} aria-disabled={uploading || undefined}>
                  <ImageSquare size={18} aria-hidden="true" />
                  {state.imageAssetId ? 'Trocar imagem' : 'Enviar imagem'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void pickImage(file);
                    }} />
                </label>
                {state.imageAssetId && (
                  <Button variant="ghost" type="button" disabled={uploading} onClick={() => set('imageAssetId', null)}>
                    Remover imagem
                  </Button>
                )}
              </div>
              <p className="m-0 basis-full text-small text-text-secondary">Os tokens da criatura no mapa mostram esta imagem.</p>
              {uploadError && <p role="alert" className="m-0 basis-full text-small text-danger-text">{uploadError}</p>}
            </div>
          )}
          <Field label="Nome" required maxLength={S.name} value={state.name} error={errors.name}
            onChange={(e) => edit('name', e.target.value)} />
          <div className={grid3}>
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

        <fieldset className={fieldset}>
          <legend>Defesa e movimento</legend>
          <div className={grid3}>
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
            <Field label="Deslocamento" hint="Ex.: 9 m, escalada 6 m. O primeiro número é o deslocamento no mapa." maxLength={S.speed}
              value={state.speed} error={errors.speed} onChange={(e) => edit('speed', e.target.value)} />
            <Field label="Ataques por ação" hint="Ataques Múltiplos: quantos ataques uma ação Atacar faz." type="number"
              min={TURN_LIMITS.attacksPerAction.min} max={TURN_LIMITS.attacksPerAction.max} value={state.attacksPerAction}
              error={errors.attacksPerAction} onChange={(e) => edit('attacksPerAction', e.target.value)} />
          </div>
        </fieldset>

        <fieldset className={fieldset}>
          <legend>Atributos</legend>
          {errors.abilityScores && <p role="alert" className="text-small text-danger-text">{errors.abilityScores}</p>}
          <div className={abilitiesGrid}>
            {ABILITIES.map((ability) => (
              <AbilityInput key={ability} ability={ability} value={state.abilityScores[ability]}
                invalid={Boolean(errors.abilityScores) && !isScore(state.abilityScores[ability])}
                onChange={(value) => edit('abilityScores', { ...state.abilityScores, [ability]: value })} />
            ))}
          </div>
        </fieldset>

        <SaveBonusFields bonuses={state.saveBonuses} scores={state.abilityScores} error={errors.saveBonuses}
          onChange={(saveBonuses) => edit('saveBonuses', saveBonuses)} />

        <fieldset className={fieldset}>
          <legend>Ataques</legend>
          <AttackListEditor attacks={state.attacks} error={errors.attacks} notesHint="Ex.: alcance 1,5 m, um alvo"
            onChange={(attacks) => edit('attacks', attacks)} />
        </fieldset>

        <fieldset className={fieldset}>
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
        busyMessage={importing ? 'Importando ficha…' : uploading ? 'Enviando a imagem…' : undefined}
      />
    </form>
  );
}

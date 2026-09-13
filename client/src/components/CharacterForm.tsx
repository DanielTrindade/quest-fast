import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ImageSquare, Plus, Trash, Warning } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import {
  ABILITIES,
  SKILL_ABILITIES,
  abilityModifier,
  parseDiceExpression,
  validateCharacterInput,
  type Ability,
  type CharacterFieldErrors,
  type CharacterInput,
  type CharacterSheet,
  type Skill,
} from '@quest-fast/shared';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Field } from './Field';
import { ApiError, api } from '../lib/api';
import { ABILITY_LABELS, SKILL_LABELS, signed } from '../lib/5e';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

const SKILLS_GROUPED = (Object.keys(SKILL_ABILITIES) as Skill[]).reduce<Record<Ability, Skill[]>>(
  (groups, skill) => {
    groups[SKILL_ABILITIES[skill]].push(skill);
    return groups;
  },
  { strength: [], dexterity: [], constitution: [], intelligence: [], wisdom: [], charisma: [] },
);

/**
 * The bonus stays text while it is typed: a number state turns the "-" of
 * "-2" into NaN and a cleared field into an undeletable 0.
 */
type FormAttack = { name: string; bonus: string; damage: string };

/** An empty bonus is invalid, not a silent zero. */
function bonusValue(bonus: string) {
  return bonus.trim() === '' ? Number.NaN : Number(bonus);
}

function isScore(value: string) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 30;
}

function freshState(character: CharacterSheet | null) {
  return {
    name: character?.name ?? '',
    race: character?.race ?? '',
    className: character?.class ?? '',
    level: character ? String(character.level) : '1',
    abilityScores: Object.fromEntries(ABILITIES.map((ability) => [ability, String(character?.abilityScores[ability] ?? 10)])) as Record<Ability, string>,
    hp: character ? String(character.hp) : '10',
    ac: character ? String(character.ac) : '10',
    skills: character?.skills ?? [],
    saves: character?.saves ?? [],
    attacks: (character?.attacks ?? []).map((attack): FormAttack => ({ ...attack, bonus: String(attack.bonus) })),
    featuresText: character?.features.join('\n') ?? '',
    description: character?.description ?? '',
    avatarAssetId: character?.avatarAssetId ?? null,
  };
}

function AbilityInput({
  ability,
  value,
  invalid,
  onChange,
}: {
  ability: Ability;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const modifier = abilityModifier(Number(value));
  return (
    <div className="qf-ability-input">
      <label>
        <span>{ABILITY_LABELS[ability]}</span>
        <input
          type="number"
          min={1}
          max={30}
          inputMode="numeric"
          value={value}
          aria-invalid={invalid || undefined}
          aria-label={`${ABILITY_LABELS[ability]} (modificador ${modifier === undefined ? '—' : signed(modifier)})`}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <output aria-hidden="true">{modifier === undefined ? '—' : signed(modifier)}</output>
    </div>
  );
}

export type CharacterFormHandle = { requestClose: () => void };

/**
 * The sheet editor, reusable for creation and editing. Owns the field state,
 * the avatar upload, the per-field validation and the discard guard; the
 * dialog shell stays with the consumer, which calls `requestClose` whenever
 * Radix funnels a close attempt (Escape, click outside, close button).
 */
export function CharacterForm({ campaignId, character, onSaved, onRequestClose, ref }: {
  campaignId: string;
  character: CharacterSheet | null;
  onSaved: () => void;
  onRequestClose: () => void;
  ref?: Ref<CharacterFormHandle>;
}) {
  const [state, setState] = useState(() => freshState(character));
  const set = <K extends keyof ReturnType<typeof freshState>>(key: K, value: ReturnType<typeof freshState>[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  // A long form must not lose work to a stray Escape or click outside. The
  // snapshot is taken once, so reopening an untouched form still closes free.
  const [initialSnapshot] = useState(() => JSON.stringify(freshState(character)));
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const dirty = JSON.stringify(state) !== initialSnapshot;

  const [errors, setErrors] = useState<CharacterFieldErrors>({});
  const clearError = (key: keyof CharacterFieldErrors) =>
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  // In a long dialog the first error can sit far above the save button, so a
  // rejected submit moves focus (and the scroll) to the first invalid field.
  const formRef = useRef<HTMLFormElement>(null);
  const [rejectedSubmits, setRejectedSubmits] = useState(0);
  useEffect(() => {
    if (rejectedSubmits === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [rejectedSubmits]);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(character?.avatarUrl ?? null);
  const avatarUpload = useMutation({
    mutationFn: (file: File) => api.uploadAsset(campaignId, file),
    onSuccess: ({ asset }) => {
      set('avatarAssetId', asset.id);
      setAvatarUrl(asset.url);
    },
  });

  const buildInput = (): CharacterInput => ({
    name: state.name.trim(),
    race: state.race.trim(),
    class: state.className.trim(),
    level: Number(state.level),
    abilityScores: Object.fromEntries(
      ABILITIES.map((ability) => [ability, Number(state.abilityScores[ability])]),
    ) as CharacterInput['abilityScores'],
    hp: Number(state.hp),
    ac: Number(state.ac),
    skills: state.skills,
    saves: state.saves,
    attacks: state.attacks.map((attack) => ({ ...attack, bonus: bonusValue(attack.bonus) })),
    features: state.featuresText.split('\n').map((line) => line.trim()).filter(Boolean),
    description: state.description.trim(),
    avatarAssetId: state.avatarAssetId,
  });

  const save = useMutation({
    mutationFn: () =>
      character
        ? api.updateCharacter(campaignId, character.id, buildInput())
        : api.createCharacter(campaignId, buildInput()),
    onSuccess: () => {
      onSaved();
      onRequestClose();
    },
  });

  const toggleSkill = (skill: Skill) =>
    set('skills', state.skills.includes(skill) ? state.skills.filter((s) => s !== skill) : [...state.skills, skill]);

  const toggleSave = (ability: Ability) =>
    set('saves', state.saves.includes(ability) ? state.saves.filter((a) => a !== ability) : [...state.saves, ability]);

  const updateAttack = (index: number, patch: Partial<FormAttack>) =>
    set('attacks', state.attacks.map((attack, i) => (i === index ? { ...attack, ...patch } : attack)));

  const submit = () => {
    const fieldErrors = validateCharacterInput(buildInput());
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setRejectedSubmits((count) => count + 1);
      return;
    }
    setErrors({});
    save.mutate();
  };

  // Radix funnels Cancelar, Escape and the click outside through here, so one
  // guard covers every way out of the editor.
  const requestClose = () => {
    if (dirty) setConfirmingDiscard(true);
    else onRequestClose();
  };
  useImperativeHandle(ref, () => ({ requestClose }));

  return (
    // noValidate: `required`/`min`/`max` stay for semantics, but the browser's
    // own bubble would block the submit before the per-field errors render.
    <form
      ref={formRef}
      noValidate
      className="sheet-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="sheet-form__identity">
        <Avatar name={state.name || '?'} src={avatarUrl ?? undefined} variant="character" size="lg" />
        <div className="sheet-form__avatar-actions">
          <label className="qf-file-button">
            <ImageSquare size={18} aria-hidden="true" />
            {state.avatarAssetId ? 'Trocar avatar' : 'Enviar avatar'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) avatarUpload.mutate(file);
              }}
            />
          </label>
          {state.avatarAssetId && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                set('avatarAssetId', null);
                setAvatarUrl(null);
              }}
            >
              Remover
            </Button>
          )}
          {avatarUpload.isError && (
            <p role="alert" className="text-small text-danger-text">
              {errorMessage(avatarUpload.error)}
            </p>
          )}
        </div>
      </div>

      <div className="sheet-form__grid">
        <Field label="Nome" required maxLength={80} value={state.name} error={errors.name}
          onChange={(e) => { set('name', e.target.value); clearError('name'); }} />
        <Field label="Raça" required maxLength={60} value={state.race} error={errors.race}
          onChange={(e) => { set('race', e.target.value); clearError('race'); }} />
        <Field
          label="Classe"
          required
          maxLength={60}
          value={state.className}
          error={errors.class}
          onChange={(e) => { set('className', e.target.value); clearError('class'); }}
        />
        <Field
          label="Nível"
          required
          type="number"
          min={1}
          max={20}
          value={state.level}
          error={errors.level}
          onChange={(e) => { set('level', e.target.value); clearError('level'); }}
        />
        <Field
          label="HP"
          required
          type="number"
          min={1}
          max={999}
          value={state.hp}
          error={errors.hp}
          onChange={(e) => { set('hp', e.target.value); clearError('hp'); }}
        />
        <Field
          label="CA"
          required
          type="number"
          min={0}
          max={40}
          value={state.ac}
          error={errors.ac}
          onChange={(e) => { set('ac', e.target.value); clearError('ac'); }}
        />
      </div>

      <fieldset className="sheet-form__fieldset">
        <legend>Atributos</legend>
        {errors.abilityScores && <p role="alert" className="text-small text-danger-text">{errors.abilityScores}</p>}
        <div className="sheet-form__abilities">
          {ABILITIES.map((ability) => (
            <AbilityInput
              key={ability}
              ability={ability}
              value={state.abilityScores[ability]}
              invalid={Boolean(errors.abilityScores) && !isScore(state.abilityScores[ability])}
              onChange={(value) => {
                set('abilityScores', { ...state.abilityScores, [ability]: value });
                clearError('abilityScores');
              }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Perícias treinadas</legend>
        <div className="sheet-form__skills">
          {ABILITIES.filter((ability) => SKILLS_GROUPED[ability].length > 0).map((ability) => (
            <div key={ability} className="sheet-form__skill-group">
              <p>{ABILITY_LABELS[ability]}</p>
              {SKILLS_GROUPED[ability].map((skill) => (
                <label key={skill} className={state.skills.includes(skill) ? 'is-active' : ''}>
                  <input
                    type="checkbox"
                    checked={state.skills.includes(skill)}
                    onChange={() => toggleSkill(skill)}
                  />
                  <span>{SKILL_LABELS[skill]}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Resistências (saves proficientes)</legend>
        <div className="sheet-form__saves">
          {ABILITIES.map((ability) => (
            <label key={ability} className={state.saves.includes(ability) ? 'is-active' : ''}>
              <input type="checkbox" checked={state.saves.includes(ability)} onChange={() => toggleSave(ability)} />
              <span>{ABILITY_LABELS[ability]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Ataques</legend>
        {errors.attacks && <p role="alert" className="text-small text-danger-text">{errors.attacks}</p>}
        <div className="qf-stack">
          {state.attacks.map((attack, index) => {
            const position = index + 1;
            const bonus = bonusValue(attack.bonus);
            return (
              <div key={index} className="sheet-form__attack" role="group" aria-label={`Ataque ${position}`}>
                <div className="sheet-form__attack-head">
                  <span>Ataque {position}</span>
                  <Button
                    variant="ghost"
                    type="button"
                    aria-label={`Remover ataque ${attack.name.trim() || position}`}
                    onClick={() => {
                      set('attacks', state.attacks.filter((_, i) => i !== index));
                      // The removed attack may be the one the message was about.
                      clearError('attacks');
                    }}
                  >
                    <Trash size={18} aria-hidden="true" />
                  </Button>
                </div>
                <div className="sheet-form__attack-fields">
                  <Field
                    className="sheet-form__attack-name"
                    label="Nome"
                    value={attack.name}
                    aria-invalid={Boolean(errors.attacks) && attack.name.trim().length === 0}
                    onChange={(e) => {
                      updateAttack(index, { name: e.target.value });
                      clearError('attacks');
                    }}
                  />
                  <Field
                    label="Bônus"
                    type="number"
                    min={-20}
                    max={20}
                    value={attack.bonus}
                    aria-invalid={Boolean(errors.attacks) && (!Number.isInteger(bonus) || Math.abs(bonus) > 20)}
                    onChange={(e) => {
                      updateAttack(index, { bonus: e.target.value });
                      clearError('attacks');
                    }}
                  />
                  <Field
                    label="Dano"
                    hint="Ex.: 1d8+3"
                    autoComplete="off"
                    spellCheck={false}
                    value={attack.damage}
                    aria-invalid={Boolean(errors.attacks) && !parseDiceExpression(attack.damage)}
                    onChange={(e) => {
                      updateAttack(index, { damage: e.target.value });
                      clearError('attacks');
                    }}
                  />
                </div>
              </div>
            );
          })}
          <div>
            <Button
              variant="secondary"
              type="button"
              onClick={() => set('attacks', [...state.attacks, { name: '', bonus: '0', damage: '' }])}
            >
              <Plus size={18} aria-hidden="true" /> Adicionar ataque
            </Button>
          </div>
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Características</legend>
        <Field
          label="Uma por linha"
          hint="Ex.: Ataque Furtivo 2d6"
          value={state.featuresText}
          onChange={(e) => set('featuresText', e.target.value)}
          asTextarea
        />
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Descrição</legend>
        <Field
          label="Descrição pública"
          hint="Aparência e história que a mesa toda lê na ficha."
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          asTextarea
        />
      </fieldset>

      {/* Pinned to the bottom of the dialog: on a phone the save action has
          to stay reachable while the form scrolls under the keyboard. */}
      <div className="sheet-form__footer">
        {save.isError && (
          <p role="alert" className="text-small text-danger-text">
            {errorMessage(save.error)}
          </p>
        )}

        {confirmingDiscard ? (
          <div role="group" aria-label="Alterações não salvas">
            <p className="sheet-form__discard">
              <Warning size={18} weight="fill" aria-hidden="true" />
              Há alterações que ainda não foram salvas.
            </p>
            <div className="qf-dialog__actions">
              <Button variant="secondary" type="button" onClick={() => setConfirmingDiscard(false)}>
                Continuar editando
              </Button>
              <Button variant="danger" type="button" onClick={onRequestClose}>
                Descartar alterações
              </Button>
            </div>
          </div>
        ) : (
          <div className="qf-dialog__actions">
            <Button variant="secondary" type="button" onClick={requestClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending || avatarUpload.isPending}>
              {character ? 'Salvar alterações' : 'Criar personagem'}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
import { useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { ImageSquare, Plus, Trash, Warning } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import {
  ABILITIES,
  ARMOR_TRAINING,
  COINS,
  HIT_DICE,
  SIZES,
  SKILLS,
  SKILL_ABILITIES,
  SPELL_SLOT_CAPS,
  abilityModifier,
  parseDiceExpression,
  skillBonus,
  skillProficiency,
  validateCharacterInput,
  type Ability,
  type ArmorTraining,
  type CharacterFieldErrors,
  type CharacterInput,
  type CharacterSheet,
  type Coin,
  type Coins,
  type HitDie,
  type ProficiencyLevel,
  type Size,
  type Skill,
} from '@quest-fast/shared';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Field } from './Field';
import { ProficiencyToggle } from './ProficiencyToggle';
import { SheetTabPanel, SheetTabs } from './SheetTabs';
import { ApiError, api } from '../lib/api';
import { ABILITY_LABELS, SKILL_LABELS, signed } from '../lib/5e';
import { ARMOR_TRAINING_LABELS, COIN_LABELS, SIZE_LABELS, circleLabel, signedBonus } from '../lib/sheet-labels';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

const SKILLS_GROUPED = ABILITIES.reduce<Record<Ability, Skill[]>>(
  (groups, ability) => {
    groups[ability] = SKILLS.filter((skill) => SKILL_ABILITIES[skill] === ability)
      .sort((a, b) => SKILL_LABELS[a].localeCompare(SKILL_LABELS[b], 'pt-BR'));
    return groups;
  },
  { strength: [], dexterity: [], constitution: [], intelligence: [], wisdom: [], charisma: [] },
);

/** The sections of the official sheet, in its order. */
const TABS = [
  { id: 'identity', label: 'Identidade e combate' },
  { id: 'abilities', label: 'Atributos e perícias' },
  { id: 'attacks', label: 'Ataques e características' },
  { id: 'spells', label: 'Magias' },
  { id: 'inventory', label: 'Inventário e história' },
] as const;
type FormTab = (typeof TABS)[number]['id'];

const ERROR_TAB: Record<keyof CharacterFieldErrors, FormTab> = {
  name: 'identity',
  race: 'identity',
  class: 'identity',
  subclass: 'identity',
  // "background" é o antecedente da ficha, não uma cor.
  // eslint-disable-next-line local/no-raw-color
  background: 'identity',
  alignment: 'identity',
  level: 'identity',
  experience: 'identity',
  hp: 'identity',
  ac: 'identity',
  speed: 'identity',
  initiativeBonus: 'identity',
  passivePerceptionBonus: 'identity',
  abilityScores: 'abilities',
  expertise: 'abilities',
  weaponProficiencies: 'abilities',
  toolProficiencies: 'abilities',
  attacks: 'attacks',
  features: 'attacks',
  speciesTraits: 'attacks',
  feats: 'attacks',
  spellBonus: 'spells',
  spellSlotTotals: 'spells',
  spells: 'spells',
  appearance: 'inventory',
  description: 'inventory',
  languages: 'inventory',
  equipment: 'inventory',
  attunedItems: 'inventory',
  coins: 'inventory',
};

/**
 * Numbers stay text while they are typed: a number state turns the "-" of
 * "-2" into NaN and a cleared field into an undeletable 0.
 */
type FormAttack = { rowId: string; name: string; bonus: string; damage: string; damageType: string; notes: string };
type FormSpell = {
  rowId: string;
  level: string;
  name: string;
  castingTime: string;
  range: string;
  concentration: boolean;
  ritual: boolean;
  material: boolean;
  notes: string;
};

/**
 * Identity for the editable lists: rows are added and removed, so the array
 * position is not a stable key. The counter is module-wide because the key
 * only has to be unique among the siblings of one list.
 */
let rowSeq = 0;
function newRowId(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

/** An empty field is invalid, not a silent zero. */
function numberValue(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text);
}

function isScore(value: string) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 30;
}

function lines(text: string) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** The three fixed attunement slots of the official sheet. */
const ATTUNED_SLOTS = ['attuned-1', 'attuned-2', 'attuned-3'] as const;

function freshState(character: CharacterSheet | null) {
  return {
    name: character?.name ?? '',
    race: character?.race ?? '',
    className: character?.class ?? '',
    subclass: character?.subclass ?? '',
    background: character?.background ?? '',
    alignment: character?.alignment ?? '',
    level: character ? String(character.level) : '1',
    experience: character ? String(character.experience) : '0',
    size: (character?.size ?? 'medium') as Size,
    hp: character ? String(character.hp) : '10',
    ac: character ? String(character.ac) : '10',
    shield: character?.shield ?? false,
    speed: character ? String(character.speed) : '9',
    hitDie: String(character?.hitDie ?? 8),
    initiativeBonus: String(character?.initiativeBonus ?? 0),
    passivePerceptionBonus: String(character?.passivePerceptionBonus ?? 0),
    abilityScores: Object.fromEntries(ABILITIES.map((ability) => [ability, String(character?.abilityScores[ability] ?? 10)])) as Record<Ability, string>,
    saves: character?.saves ?? [],
    proficiency: Object.fromEntries(
      SKILLS.map((skill) => [skill, character ? skillProficiency(character, skill) : 'none']),
    ) as Record<Skill, ProficiencyLevel>,
    armorTraining: character?.armorTraining ?? [],
    weaponProficiencies: character?.weaponProficiencies ?? '',
    toolProficiencies: character?.toolProficiencies ?? '',
    attacks: (character?.attacks ?? []).map((attack): FormAttack => ({
      rowId: newRowId(),
      name: attack.name,
      bonus: String(attack.bonus),
      damage: attack.damage,
      damageType: attack.damageType,
      notes: attack.notes,
    })),
    featuresText: character?.features.join('\n') ?? '',
    speciesTraitsText: character?.speciesTraits.join('\n') ?? '',
    featsText: character?.feats.join('\n') ?? '',
    spellcastingAbility: (character?.spellcastingAbility ?? '') as Ability | '',
    spellBonus: String(character?.spellBonus ?? 0),
    spellSlotTotals: SPELL_SLOT_CAPS.map((_, circle) => String(character?.spellSlots[circle]?.total ?? 0)),
    spells: (character?.spells ?? []).map((spell): FormSpell => ({ rowId: newRowId(), ...spell, level: String(spell.level) })),
    appearance: character?.appearance ?? '',
    description: character?.description ?? '',
    languages: character?.languages ?? '',
    equipment: character?.equipment ?? '',
    attunedItems: [0, 1, 2].map((index) => character?.attunedItems[index] ?? ''),
    coins: Object.fromEntries(COINS.map((coin) => [coin, String(character?.coins[coin] ?? 0)])) as Record<Coin, string>,
    avatarAssetId: character?.avatarAssetId ?? null,
  };
}

type FormState = ReturnType<typeof freshState>;
type FormSet = <K extends keyof FormState>(key: K, value: FormState[K]) => void;
type ClearFieldError = (key: keyof CharacterFieldErrors) => void;

type PanelProps = {
  /** The id of the selected tab, as `SheetTabPanel` expects. */
  idPrefix: string;
  active: string;
  state: FormState;
  set: FormSet;
  errors: CharacterFieldErrors;
  clearError: ClearFieldError;
};

function SelectField({ label, value, onChange, className = '', children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`qf-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className="qf-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="qf-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function AbilityInput({ ability, value, invalid, onChange }: {
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
          aria-label={`${ABILITY_LABELS[ability]} (modificador ${modifier === undefined ? 'indefinido' : signed(modifier)})`}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <output aria-hidden="true">{modifier === undefined ? '?' : signed(modifier)}</output>
    </div>
  );
}

function IdentityPanel({
  idPrefix,
  active,
  state,
  set,
  errors,
  clearError,
  avatarUrl,
  uploadError,
  onAvatarPick,
  onAvatarRemove,
}: PanelProps & {
  avatarUrl: string | null;
  uploadError: string | null;
  onAvatarPick: (file: File) => void;
  onAvatarRemove: () => void;
}) {
  return (
    <SheetTabPanel idPrefix={idPrefix} id="identity" active={active}>
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
                if (file) onAvatarPick(file);
              }}
            />
          </label>
          {state.avatarAssetId && (
            <Button variant="ghost" type="button" onClick={onAvatarRemove}>
              Remover
            </Button>
          )}
          {uploadError && (
            <p role="alert" className="text-small text-danger-text">
              {uploadError}
            </p>
          )}
        </div>
      </div>

      <fieldset className="sheet-form__fieldset">
        <legend>Identidade</legend>
        <div className="sheet-form__grid">
          <Field label="Nome do personagem" required maxLength={80} value={state.name} error={errors.name}
            onChange={(e) => { set('name', e.target.value); clearError('name'); }} />
          <Field label="Espécie" required maxLength={60} value={state.race} error={errors.race}
            onChange={(e) => { set('race', e.target.value); clearError('race'); }} />
          <Field label="Classe" required maxLength={60} value={state.className} error={errors.class}
            onChange={(e) => { set('className', e.target.value); clearError('class'); }} />
          <Field label="Subclasse" maxLength={60} value={state.subclass} error={errors.subclass}
            onChange={(e) => { set('subclass', e.target.value); clearError('subclass'); }} />
          <Field label="Antecedente" maxLength={60} value={state.background} error={errors.background}
            onChange={(e) => { set('background', e.target.value); clearError('background'); }} />
          <Field label="Alinhamento" maxLength={60} value={state.alignment} error={errors.alignment}
            hint="Ex.: Caótico e Neutro"
            onChange={(e) => { set('alignment', e.target.value); clearError('alignment'); }} />
          <Field label="Nível" required type="number" min={1} max={20} value={state.level} error={errors.level}
            onChange={(e) => { set('level', e.target.value); clearError('level'); }} />
          <Field label="XP" type="number" min={0} max={355000} value={state.experience} error={errors.experience}
            onChange={(e) => { set('experience', e.target.value); clearError('experience'); }} />
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Combate</legend>
        <div className="sheet-form__grid sheet-form__grid--three">
          <Field label="PV máximo" required type="number" min={1} max={999} value={state.hp} error={errors.hp}
            onChange={(e) => { set('hp', e.target.value); clearError('hp'); }} />
          <Field label="Classe de armadura" required type="number" min={0} max={40} value={state.ac} error={errors.ac}
            onChange={(e) => { set('ac', e.target.value); clearError('ac'); }} />
          <SelectField label="Dado de vida" value={state.hitDie} onChange={(value) => set('hitDie', value)}>
            {HIT_DICE.map((die) => <option key={die} value={die}>d{die}</option>)}
          </SelectField>
          <Field label="Deslocamento (m)" type="number" min={0} max={60} step={1.5} value={state.speed} error={errors.speed}
            onChange={(e) => { set('speed', e.target.value); clearError('speed'); }} />
          <SelectField label="Tamanho" value={state.size} onChange={(value) => set('size', value as Size)}>
            {SIZES.map((size) => <option key={size} value={size}>{SIZE_LABELS[size]}</option>)}
          </SelectField>
          <Field label="Ajuste de iniciativa" type="number" min={-10} max={10} value={state.initiativeBonus}
            error={errors.initiativeBonus} hint="Somado à Destreza (talentos, itens)"
            onChange={(e) => { set('initiativeBonus', e.target.value); clearError('initiativeBonus'); }} />
          <Field label="Ajuste de percepção passiva" type="number" min={-10} max={10} value={state.passivePerceptionBonus}
            error={errors.passivePerceptionBonus} hint="Somado a 10 + Percepção"
            onChange={(e) => { set('passivePerceptionBonus', e.target.value); clearError('passivePerceptionBonus'); }} />
        </div>
        <Check label="Usa escudo" checked={state.shield} onChange={(checked) => set('shield', checked)} />
      </fieldset>
    </SheetTabPanel>
  );
}

function AbilitiesPanel({ idPrefix, active, state, set, errors, clearError, rules }: PanelProps & { rules: CharacterInput & { expertise: readonly Skill[] } }) {
  const toggle = <T,>(list: readonly T[], item: T, on: boolean) => (on ? [...list, item] : list.filter((entry) => entry !== item));
  return (
    <SheetTabPanel idPrefix={idPrefix} id="abilities" active={active}>
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
        <legend>Salvaguardas proficientes</legend>
        <div className="sheet-form__saves">
          {ABILITIES.map((ability) => (
            <label key={ability} className={state.saves.includes(ability) ? 'is-active' : ''}>
              <input type="checkbox" checked={state.saves.includes(ability)}
                onChange={(event) => set('saves', toggle(state.saves, ability, event.target.checked))} />
              <span>{ABILITY_LABELS[ability]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Perícias</legend>
        <p className="sheet-form__legend-note">Nenhuma, proficiente ou especialista (dobro do bônus de proficiência).</p>
        {errors.expertise && <p role="alert" className="text-small text-danger-text">{errors.expertise}</p>}
        <div className="sheet-form__skill-groups">
          {ABILITIES.filter((ability) => SKILLS_GROUPED[ability].length > 0).map((ability) => (
            <div key={ability}>
              <p className="sheet-form__skill-group-title">{ABILITY_LABELS[ability]}</p>
              {SKILLS_GROUPED[ability].map((skill) => (
                <ProficiencyToggle
                  key={skill}
                  label={SKILL_LABELS[skill]}
                  detail={isScore(state.abilityScores[SKILL_ABILITIES[skill]]) ? signedBonus(skillBonus(rules, skill)) : undefined}
                  value={state.proficiency[skill]}
                  onChange={(level) => {
                    set('proficiency', { ...state.proficiency, [skill]: level });
                    clearError('expertise');
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Treinamento em equipamentos</legend>
        <div className="sheet-form__checks" role="group" aria-label="Treinamento em armaduras">
          {ARMOR_TRAINING.map((kind) => (
            <Check key={kind} label={ARMOR_TRAINING_LABELS[kind]} checked={state.armorTraining.includes(kind)}
              onChange={(checked) => set('armorTraining', toggle<ArmorTraining>(state.armorTraining, kind, checked))} />
          ))}
        </div>
        <div className="sheet-form__grid">
          <Field label="Armas" maxLength={200} value={state.weaponProficiencies} error={errors.weaponProficiencies}
            hint="Ex.: Armas Simples e Marciais"
            onChange={(e) => { set('weaponProficiencies', e.target.value); clearError('weaponProficiencies'); }} />
          <Field label="Ferramentas" maxLength={200} value={state.toolProficiencies} error={errors.toolProficiencies}
            hint="Ex.: Ferramentas de carpinteiro"
            onChange={(e) => { set('toolProficiencies', e.target.value); clearError('toolProficiencies'); }} />
        </div>
      </fieldset>
    </SheetTabPanel>
  );
}

function AttacksPanel({ idPrefix, active, state, set, errors, clearError }: PanelProps) {
  const updateAttack = (index: number, patch: Partial<FormAttack>) => {
    set('attacks', state.attacks.map((attack, i) => (i === index ? { ...attack, ...patch } : attack)));
    clearError('attacks');
  };
  return (
    <SheetTabPanel idPrefix={idPrefix} id="attacks" active={active}>
      <fieldset className="sheet-form__fieldset">
        <legend>Armas e truques de dano</legend>
        {errors.attacks && <p role="alert" className="text-small text-danger-text">{errors.attacks}</p>}
        <div className="qf-stack">
          {state.attacks.map((attack, index) => {
            const position = index + 1;
            const bonus = numberValue(attack.bonus);
            return (
              <div key={attack.rowId} className="sheet-form__attack" role="group" aria-label={`Ataque ${position}`}>
                <div className="sheet-form__attack-head">
                  <span>Ataque {position}</span>
                  <Button variant="ghost" type="button" aria-label={`Remover ataque ${attack.name.trim() || position}`}
                    onClick={() => {
                      set('attacks', state.attacks.filter((_, i) => i !== index));
                      // The removed attack may be the one the message was about.
                      clearError('attacks');
                    }}>
                    <Trash size={18} aria-hidden="true" />
                  </Button>
                </div>
                <div className="sheet-form__attack-fields">
                  <Field className="sheet-form__attack-name" label="Nome" value={attack.name}
                    aria-invalid={Boolean(errors.attacks) && attack.name.trim().length === 0}
                    onChange={(e) => updateAttack(index, { name: e.target.value })} />
                  <Field label="Bônus" type="number" min={-20} max={20} value={attack.bonus}
                    aria-invalid={Boolean(errors.attacks) && (!Number.isInteger(bonus) || Math.abs(bonus) > 20)}
                    onChange={(e) => updateAttack(index, { bonus: e.target.value })} />
                  <Field label="Dano" hint="Ex.: 1d8+3" autoComplete="off" spellCheck={false} value={attack.damage}
                    aria-invalid={Boolean(errors.attacks) && !parseDiceExpression(attack.damage)}
                    onChange={(e) => updateAttack(index, { damage: e.target.value })} />
                  <Field label="Tipo de dano" maxLength={30} value={attack.damageType} hint="Ex.: Cortante"
                    onChange={(e) => updateAttack(index, { damageType: e.target.value })} />
                  <Field className="sheet-form__attack-name" label="Notas" maxLength={120} value={attack.notes}
                    hint="Ex.: Pesada, duas mãos"
                    onChange={(e) => updateAttack(index, { notes: e.target.value })} />
                </div>
              </div>
            );
          })}
          <div>
            <Button variant="secondary" type="button"
              onClick={() => set('attacks', [...state.attacks, { rowId: newRowId(), name: '', bonus: '0', damage: '', damageType: '', notes: '' }])}>
              <Plus size={18} aria-hidden="true" /> Adicionar ataque
            </Button>
          </div>
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Características de classe</legend>
        <Field label="Uma por linha" hint="Ex.: Fúria" value={state.featuresText} error={errors.features} asTextarea
          onChange={(e) => { set('featuresText', e.target.value); clearError('features'); }} />
      </fieldset>
      <fieldset className="sheet-form__fieldset">
        <legend>Traços de espécie</legend>
        <Field label="Um por linha" hint="Ex.: Visão no Escuro" value={state.speciesTraitsText} error={errors.speciesTraits} asTextarea
          onChange={(e) => { set('speciesTraitsText', e.target.value); clearError('speciesTraits'); }} />
      </fieldset>
      <fieldset className="sheet-form__fieldset">
        <legend>Talentos</legend>
        <Field label="Um por linha" hint="Ex.: Robusto" value={state.featsText} error={errors.feats} asTextarea
          onChange={(e) => { set('featsText', e.target.value); clearError('feats'); }} />
      </fieldset>
    </SheetTabPanel>
  );
}

function SpellsPanel({ idPrefix, active, state, set, errors, clearError }: PanelProps) {
  const updateSpell = (index: number, patch: Partial<FormSpell>) => {
    set('spells', state.spells.map((spell, i) => (i === index ? { ...spell, ...patch } : spell)));
    clearError('spells');
  };
  return (
    <SheetTabPanel idPrefix={idPrefix} id="spells" active={active}>
      <fieldset className="sheet-form__fieldset">
        <legend>Conjuração</legend>
        <div className="sheet-form__grid">
          <SelectField label="Atributo de conjuração" value={state.spellcastingAbility}
            onChange={(value) => set('spellcastingAbility', value as Ability | '')}>
            <option value="">Não conjura</option>
            {ABILITIES.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}
          </SelectField>
          <Field label="Ajuste de conjuração" type="number" min={-10} max={10} value={state.spellBonus}
            error={errors.spellBonus} hint="Somado à CD e ao ataque mágico (itens)"
            onChange={(e) => { set('spellBonus', e.target.value); clearError('spellBonus'); }} />
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Espaços de magia</legend>
        {errors.spellSlotTotals && <p role="alert" className="text-small text-danger-text">{errors.spellSlotTotals}</p>}
        <div className="sheet-form__slots">
          {SPELL_SLOT_CAPS.map((cap, circle) => {
            const total = numberValue(state.spellSlotTotals[circle] ?? '');
            return (
              <Field key={circle} label={circleLabel(circle + 1)} type="number" min={0} max={cap} hint={`até ${cap}`}
                value={state.spellSlotTotals[circle] ?? ''}
                aria-invalid={Boolean(errors.spellSlotTotals) && !(Number.isInteger(total) && total >= 0 && total <= cap)}
                onChange={(e) => {
                  set('spellSlotTotals', state.spellSlotTotals.map((value, i) => (i === circle ? e.target.value : value)));
                  clearError('spellSlotTotals');
                }} />
            );
          })}
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Truques e magias preparadas</legend>
        {errors.spells && <p role="alert" className="text-small text-danger-text">{errors.spells}</p>}
        <div className="qf-stack">
          {state.spells.map((spell, index) => {
            const position = index + 1;
            return (
              <div key={spell.rowId} className="sheet-form__attack" role="group" aria-label={`Magia ${position}`}>
                <div className="sheet-form__attack-head">
                  <span>Magia {position}</span>
                  <Button variant="ghost" type="button" aria-label={`Remover magia ${spell.name.trim() || position}`}
                    onClick={() => {
                      set('spells', state.spells.filter((_, i) => i !== index));
                      clearError('spells');
                    }}>
                    <Trash size={18} aria-hidden="true" />
                  </Button>
                </div>
                <div className="sheet-form__spell-fields">
                  <SelectField className="sheet-form__spell-level" label="Círculo" value={spell.level}
                    onChange={(value) => updateSpell(index, { level: value })}>
                    {Array.from({ length: 10 }, (_, level) => <option key={level} value={level}>{circleLabel(level)}</option>)}
                  </SelectField>
                  <Field className="sheet-form__spell-name" label="Nome" maxLength={80} value={spell.name}
                    aria-invalid={Boolean(errors.spells) && spell.name.trim().length === 0}
                    onChange={(e) => updateSpell(index, { name: e.target.value })} />
                  <Field label="Tempo de conjuração" maxLength={30} value={spell.castingTime} hint="Ex.: 1 ação"
                    onChange={(e) => updateSpell(index, { castingTime: e.target.value })} />
                  <Field label="Alcance" maxLength={30} value={spell.range} hint="Ex.: 18 m"
                    onChange={(e) => updateSpell(index, { range: e.target.value })} />
                  <div className="sheet-form__spell-flags">
                    <Check label="Concentração" checked={spell.concentration} onChange={(checked) => updateSpell(index, { concentration: checked })} />
                    <Check label="Ritual" checked={spell.ritual} onChange={(checked) => updateSpell(index, { ritual: checked })} />
                    <Check label="Material requerido" checked={spell.material} onChange={(checked) => updateSpell(index, { material: checked })} />
                  </div>
                  <Field className="sheet-form__spell-notes" label="Notas" maxLength={120} value={spell.notes}
                    onChange={(e) => updateSpell(index, { notes: e.target.value })} />
                </div>
              </div>
            );
          })}
          <div>
            <Button variant="secondary" type="button"
              onClick={() => set('spells', [...state.spells, { rowId: newRowId(), level: '0', name: '', castingTime: '', range: '', concentration: false, ritual: false, material: false, notes: '' }])}>
              <Plus size={18} aria-hidden="true" /> Adicionar magia
            </Button>
          </div>
        </div>
      </fieldset>
    </SheetTabPanel>
  );
}

function InventoryPanel({ idPrefix, active, state, set, errors, clearError }: PanelProps) {
  return (
    <SheetTabPanel idPrefix={idPrefix} id="inventory" active={active}>
      <fieldset className="sheet-form__fieldset">
        <legend>Personalidade</legend>
        <Field label="Aparência" maxLength={1000} value={state.appearance} error={errors.appearance} asTextarea
          onChange={(e) => { set('appearance', e.target.value); clearError('appearance'); }} />
        <Field label="História e personalidade" hint="A mesa toda lê na ficha." value={state.description}
          error={errors.description} asTextarea
          onChange={(e) => { set('description', e.target.value); clearError('description'); }} />
        <Field label="Idiomas" maxLength={200} value={state.languages} error={errors.languages} hint="Ex.: Comum, Anão"
          onChange={(e) => { set('languages', e.target.value); clearError('languages'); }} />
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Equipamento</legend>
        <Field label="Um item por linha" value={state.equipment} error={errors.equipment} asTextarea
          onChange={(e) => { set('equipment', e.target.value); clearError('equipment'); }} />
        {errors.attunedItems && <p role="alert" className="text-small text-danger-text">{errors.attunedItems}</p>}
        <div className="sheet-form__grid sheet-form__grid--three">
          {ATTUNED_SLOTS.map((slot, position) => (
            <Field key={slot} label={`Item sintonizado ${position + 1}`} maxLength={80} value={state.attunedItems[position] ?? ''}
              onChange={(e) => {
                set('attunedItems', state.attunedItems.map((value, i) => (i === position ? e.target.value : value)));
                clearError('attunedItems');
              }} />
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-form__fieldset">
        <legend>Moedas</legend>
        {errors.coins && <p role="alert" className="text-small text-danger-text">{errors.coins}</p>}
        <div className="sheet-form__slots">
          {COINS.map((coin) => {
            const amount = numberValue(state.coins[coin]);
            return (
              <Field key={coin} label={COIN_LABELS[coin].name} type="number" min={0} max={999999} value={state.coins[coin]}
                aria-invalid={Boolean(errors.coins) && !(Number.isInteger(amount) && amount >= 0)}
                onChange={(e) => {
                  set('coins', { ...state.coins, [coin]: e.target.value });
                  clearError('coins');
                }} />
            );
          })}
        </div>
      </fieldset>
    </SheetTabPanel>
  );
}

export type CharacterFormHandle = { requestClose: () => void };

/**
 * The sheet editor, reusable for creation and editing, organized in the
 * sections of the official D&D 2024 sheet. Owns the field state, the avatar
 * upload, the per-field validation and the discard guard; the dialog shell
 * stays with the consumer, which calls `requestClose` whenever Radix funnels a
 * close attempt (Escape, click outside, close button).
 */
export function CharacterForm({ campaignId, character, onSaved, onRequestClose, ref }: {
  campaignId: string;
  character: CharacterSheet | null;
  onSaved: () => void;
  onRequestClose: () => void;
  ref?: Ref<CharacterFormHandle>;
}) {
  const [state, setState] = useState(() => freshState(character));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  // A long form must not lose work to a stray Escape or click outside. The
  // snapshot is taken once, so reopening an untouched form still closes free.
  const [initialSnapshot] = useState(() => JSON.stringify(state));
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const dirty = JSON.stringify(state) !== initialSnapshot;

  const tabsId = useId();
  const [tab, setTab] = useState<FormTab>('identity');

  const [errors, setErrors] = useState<CharacterFieldErrors>({});
  const clearError = (key: keyof CharacterFieldErrors) =>
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  const tabsWithErrors = new Set(
    (Object.keys(errors) as Array<keyof CharacterFieldErrors>).filter((key) => errors[key]).map((key) => ERROR_TAB[key]),
  );

  // A rejected submit opens the first section with an error and moves focus
  // (and the scroll) to its first invalid field.
  const formRef = useRef<HTMLFormElement>(null);
  const [rejectedSubmits, setRejectedSubmits] = useState(0);
  useEffect(() => {
    if (rejectedSubmits === 0) return;
    formRef.current?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) [aria-invalid="true"]')?.focus();
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
    subclass: state.subclass.trim(),
    background: state.background.trim(),
    alignment: state.alignment.trim(),
    level: Number(state.level),
    experience: numberValue(state.experience),
    size: state.size,
    abilityScores: Object.fromEntries(
      ABILITIES.map((ability) => [ability, Number(state.abilityScores[ability])]),
    ) as CharacterInput['abilityScores'],
    hp: Number(state.hp),
    ac: Number(state.ac),
    shield: state.shield,
    speed: numberValue(state.speed),
    hitDie: Number(state.hitDie) as HitDie,
    initiativeBonus: numberValue(state.initiativeBonus),
    passivePerceptionBonus: numberValue(state.passivePerceptionBonus),
    skills: SKILLS.filter((skill) => state.proficiency[skill] !== 'none'),
    expertise: SKILLS.filter((skill) => state.proficiency[skill] === 'expert'),
    saves: state.saves,
    armorTraining: state.armorTraining,
    weaponProficiencies: state.weaponProficiencies.trim(),
    toolProficiencies: state.toolProficiencies.trim(),
    attacks: state.attacks.map((attack) => ({
      name: attack.name,
      bonus: numberValue(attack.bonus),
      damage: attack.damage,
      damageType: attack.damageType.trim(),
      notes: attack.notes.trim(),
    })),
    features: lines(state.featuresText),
    speciesTraits: lines(state.speciesTraitsText),
    feats: lines(state.featsText),
    spellcastingAbility: state.spellcastingAbility || null,
    spellBonus: numberValue(state.spellBonus),
    spellSlotTotals: state.spellSlotTotals.map(numberValue),
    spells: state.spells.map((spell) => ({
      level: numberValue(spell.level),
      name: spell.name.trim(),
      castingTime: spell.castingTime.trim(),
      range: spell.range.trim(),
      concentration: spell.concentration,
      ritual: spell.ritual,
      material: spell.material,
      notes: spell.notes.trim(),
    })),
    appearance: state.appearance.trim(),
    description: state.description.trim(),
    languages: state.languages.trim(),
    equipment: state.equipment.trim(),
    attunedItems: state.attunedItems.map((item) => item.trim()).filter(Boolean),
    coins: Object.fromEntries(COINS.map((coin) => [coin, numberValue(state.coins[coin])])) as Coins,
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

  const submit = () => {
    const fieldErrors = validateCharacterInput(buildInput());
    const keys = (Object.keys(fieldErrors) as Array<keyof CharacterFieldErrors>).filter((key) => fieldErrors[key]);
    if (keys.length > 0) {
      setErrors(fieldErrors);
      const first = TABS.find((section) => keys.some((key) => ERROR_TAB[key] === section.id));
      if (first) setTab(first.id);
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

  // Bonuses shown next to each skill follow what is typed, like the sheet.
  const preview = buildInput();
  const previewRules = { ...preview, expertise: preview.expertise ?? [] };

  const panelProps = { idPrefix: tabsId, state, set, errors, clearError };

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
      <div className="sheet-form__tabs">
        <SheetTabs
          tabs={TABS.map((section) => ({ ...section, hasError: tabsWithErrors.has(section.id) }))}
          active={tab}
          onChange={(id) => setTab(id as FormTab)}
          idPrefix={tabsId}
          label="Seções da ficha"
        />
      </div>

      <IdentityPanel
        {...panelProps}
        active={tab}
        avatarUrl={avatarUrl}
        uploadError={avatarUpload.isError ? errorMessage(avatarUpload.error) : null}
        onAvatarPick={(file) => avatarUpload.mutate(file)}
        onAvatarRemove={() => {
          set('avatarAssetId', null);
          setAvatarUrl(null);
        }}
      />

      <AbilitiesPanel {...panelProps} active={tab} rules={previewRules} />

      <AttacksPanel {...panelProps} active={tab} />

      <SpellsPanel {...panelProps} active={tab} />

      <InventoryPanel {...panelProps} active={tab} />

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

import { useId, useState, type FormEvent } from 'react';
import { Plus } from '@phosphor-icons/react';
import {
  ENCOUNTER_LIMITS,
  SIZES,
  STATBLOCK_LIMITS as S,
  type CombatantInput,
  type HitPointMode,
  type Size,
  type StatblockSummary,
} from '@quest-fast/shared';
import { Button } from './Button';
import { Field } from './Field';
import { SelectField } from './SelectField';
import { SIZE_LABELS } from '../lib/sheet-labels';

type Source = CombatantInput['source'];
type Errors = Record<string, string>;
type Built = { input: CombatantInput } | { errors: Errors };

const SOURCE_LABELS: Record<Source, string> = {
  character: 'Personagem',
  statblock: 'Bestiário',
  manual: 'Manual',
};

export type SetupCharacter = { id: string; name: string; ownerName: string };

type ManualDraft = { name: string; ac: string; hp: string; size: Size; initiativeBonus: string; initiative: string };
const EMPTY_MANUAL: ManualDraft = { name: '', ac: '', hp: '', size: 'medium', initiativeBonus: '0', initiative: '' };

function integerIn(value: string, min: number, max: number): number | undefined {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

/** The same bounds the server checks, so a refusal is rare and points at a field. */
function buildManual(draft: ManualDraft, hidden: boolean): Built {
  const errors: Errors = {};
  const name = draft.name.trim();
  if (!name || name.length > S.name) errors.name = `Informe o nome, com até ${S.name} caracteres.`;
  const ac = integerIn(draft.ac, S.ac.min, S.ac.max);
  if (ac === undefined) errors.ac = `De ${S.ac.min} a ${S.ac.max}.`;
  const hp = integerIn(draft.hp, S.hp.min, S.hp.max);
  if (hp === undefined) errors.hp = `De ${S.hp.min} a ${S.hp.max}.`;
  const initiativeBonus = integerIn(draft.initiativeBonus, S.initiativeBonus.min, S.initiativeBonus.max);
  if (initiativeBonus === undefined) errors.initiativeBonus = `De ${S.initiativeBonus.min} a ${S.initiativeBonus.max}.`;
  const { min, max } = ENCOUNTER_LIMITS.initiative;
  const initiative = draft.initiative.trim() === '' ? null : integerIn(draft.initiative, min, max);
  if (initiative === undefined) errors.initiative = `Deixe vazio ou use de ${min} a ${max}.`;
  if (Object.keys(errors).length > 0) return { errors };
  return {
    input: { source: 'manual', name, ac: ac!, hp: hp!, size: draft.size, initiativeBonus: initiativeBonus!, initiative: initiative ?? null, hidden },
  };
}

function Segmented<T extends string>({ label, name, value, options, onChange }: {
  label: string;
  name: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="qf-segmented" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className={value === option.value ? 'is-active' : ''}>
          <input type="radio" name={name} value={option.value} checked={value === option.value}
            disabled={option.disabled} onChange={() => onChange(option.value)} />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function CharacterFields({ characters, chosen, onChoose }: {
  characters: SetupCharacter[];
  chosen: SetupCharacter | undefined;
  onChoose: (id: string) => void;
}) {
  if (characters.length === 0) {
    return <p className="qf-encounter-setup__note">Todos os personagens da campanha já estão no encontro.</p>;
  }
  return (
    <div data-field="character">
      <SelectField label="Personagem" value={chosen?.id ?? ''} onChange={onChoose}>
        {characters.map((character) => (
          <option key={character.id} value={character.id}>{character.name} ({character.ownerName})</option>
        ))}
      </SelectField>
    </div>
  );
}

function StatblockFields({ statblocks, chosen, onChoose, count, onCount, hpMode, onHpMode, error, groupName }: {
  statblocks: StatblockSummary[];
  chosen: StatblockSummary | undefined;
  onChoose: (id: string) => void;
  count: string;
  onCount: (count: string) => void;
  hpMode: HitPointMode;
  onHpMode: (mode: HitPointMode) => void;
  error?: string;
  groupName: string;
}) {
  if (!chosen) {
    return <p className="qf-encounter-setup__note">O bestiário está vazio. Cadastre uma criatura para usar quantas cópias quiser.</p>;
  }
  const canRoll = !!chosen.hpFormula;
  return (
    <div className="qf-encounter-setup__grid">
      <div data-field="statblock" className="qf-encounter-setup__wide">
        <SelectField label="Criatura" value={chosen.id} onChange={onChoose}>
          {statblocks.map((statblock) => (
            <option key={statblock.id} value={statblock.id}>{statblock.name} (CA {statblock.ac}, PV {statblock.hpAverage})</option>
          ))}
        </SelectField>
      </div>
      <div data-field="count">
        <Field label="Quantidade" type="number" inputMode="numeric" min={1} max={ENCOUNTER_LIMITS.copies} value={count}
          error={error} onChange={(event) => onCount(event.target.value)} />
      </div>
      <div className="qf-encounter-setup__wide">
        <p className="qf-encounter-setup__label" aria-hidden="true">Pontos de vida de cada cópia</p>
        <Segmented label="Pontos de vida de cada cópia" name={groupName} value={canRoll ? hpMode : 'average'} onChange={onHpMode}
          options={[
            { value: 'average', label: `Média (${chosen.hpAverage})` },
            { value: 'rolled', label: canRoll ? `Rolados (${chosen.hpFormula})` : 'Rolados (sem fórmula)', disabled: !canRoll },
          ]} />
      </div>
    </div>
  );
}

function ManualFields({ draft, onChange, errors }: { draft: ManualDraft; onChange: (draft: ManualDraft) => void; errors: Errors }) {
  const field = (key: keyof ManualDraft) => ({
    value: draft[key],
    error: errors[key],
    onChange: (event: { target: { value: string } }) => onChange({ ...draft, [key]: event.target.value }),
  });
  return (
    <div className="qf-encounter-setup__grid">
      <div data-field="name" className="qf-encounter-setup__wide">
        <Field label="Nome" required maxLength={S.name} {...field('name')} />
      </div>
      <div data-field="ac"><Field label="CA" required type="number" inputMode="numeric" {...field('ac')} /></div>
      <div data-field="hp"><Field label="PV" required type="number" inputMode="numeric" {...field('hp')} /></div>
      <div data-field="size">
        <SelectField label="Tamanho" value={draft.size} onChange={(size) => onChange({ ...draft, size: size as Size })}>
          {SIZES.map((size) => <option key={size} value={size}>{SIZE_LABELS[size]}</option>)}
        </SelectField>
      </div>
      <div data-field="initiativeBonus">
        <Field label="Bônus de iniciativa" type="number" inputMode="numeric" {...field('initiativeBonus')} />
      </div>
      <div data-field="initiative">
        <Field label="Iniciativa (opcional)" type="number" inputMode="numeric" hint="Vazio: rolada depois." {...field('initiative')} />
      </div>
    </div>
  );
}

/**
 * Adds combatants to an encounter: a character of the campaign, copies of a
 * bestiary creature (average or rolled hit points) or a manual one. Also used
 * for reinforcements mid-fight. It only builds the request; the server
 * numbers the copies and rolls the hit points.
 */
export function EncounterSetup({ characters, statblocks, onAdd, pending = false, reinforcement = false }: {
  /** Characters not yet in the encounter. */
  characters: SetupCharacter[];
  statblocks: StatblockSummary[];
  /** Resolves when the server accepted; the form then clears. */
  onAdd: (input: CombatantInput) => Promise<unknown> | void;
  pending?: boolean;
  reinforcement?: boolean;
}) {
  // Radio groups are named per instance, or two forms on a page would share one.
  const uid = useId();
  const [source, setSource] = useState<Source>(statblocks.length > 0 ? 'statblock' : 'character');
  const [hidden, setHidden] = useState(false);
  const [characterId, setCharacterId] = useState('');
  const [statblockId, setStatblockId] = useState('');
  const [count, setCount] = useState('1');
  const [hpMode, setHpMode] = useState<HitPointMode>('average');
  const [manual, setManual] = useState<ManualDraft>(EMPTY_MANUAL);
  const [errors, setErrors] = useState<Errors>({});

  const chosenCharacter = characters.find((character) => character.id === characterId) ?? characters[0];
  const chosenStatblock = statblocks.find((statblock) => statblock.id === statblockId) ?? statblocks[0];
  const unavailable = (source === 'character' && !chosenCharacter) || (source === 'statblock' && !chosenStatblock);

  const build = (): Built => {
    if (source === 'manual') return buildManual(manual, hidden);
    if (source === 'character') return { input: { source, characterId: chosenCharacter!.id, hidden } };
    const amount = integerIn(count, 1, ENCOUNTER_LIMITS.copies);
    if (amount === undefined) return { errors: { count: `De 1 a ${ENCOUNTER_LIMITS.copies}.` } };
    const hp = chosenStatblock!.hpFormula ? hpMode : 'average';
    return { input: { source, statblockId: chosenStatblock!.id, count: amount, hp, hidden } };
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (unavailable) return;
    const result = build();
    if ('errors' in result) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      event.currentTarget.querySelector<HTMLElement>(`[data-field="${first}"] input`)?.focus();
      return;
    }
    setErrors({});
    try {
      await onAdd(result.input);
    } catch {
      // The screen shows the server's reason; keep what was typed.
      return;
    }
    setCount('1');
    setHidden(false);
    setManual((current) => ({ ...EMPTY_MANUAL, size: current.size }));
  };

  return (
    <form className="qf-encounter-setup" onSubmit={submit} noValidate aria-label={reinforcement ? 'Adicionar reforço' : 'Adicionar combatente'}>
      <Segmented label="Origem do combatente" name={`${uid}-source`} value={source} onChange={setSource}
        options={(['character', 'statblock', 'manual'] as Source[]).map((value) => ({ value, label: SOURCE_LABELS[value] }))} />

      {source === 'character' && <CharacterFields characters={characters} chosen={chosenCharacter} onChoose={setCharacterId} />}
      {source === 'statblock' && (
        <StatblockFields statblocks={statblocks} chosen={chosenStatblock} onChoose={setStatblockId} count={count} onCount={setCount}
          hpMode={hpMode} onHpMode={setHpMode} error={errors.count} groupName={`${uid}-hp`} />
      )}
      {source === 'manual' && <ManualFields draft={manual} onChange={setManual} errors={errors} />}

      <div className="qf-encounter-setup__footer">
        <label className="qf-check">
          <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
          Entra escondido dos jogadores
        </label>
        <Button type="submit" loading={pending} disabled={unavailable}>
          <Plus size={18} aria-hidden="true" /> {reinforcement ? 'Adicionar reforço' : 'Adicionar ao encontro'}
        </Button>
      </div>
    </form>
  );
}

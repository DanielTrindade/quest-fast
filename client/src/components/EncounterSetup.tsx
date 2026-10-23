import { useId, useState, type FormEvent } from 'react';
import { Plus } from '@phosphor-icons/react';
import {
  ENCOUNTER_LIMITS,
  SIZES,
  STATBLOCK_LIMITS,
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

const SOURCE_LABELS: Record<Source, string> = {
  character: 'Personagem',
  statblock: 'Bestiário',
  manual: 'Manual',
};

export type SetupCharacter = { id: string; name: string; ownerName: string };

function integerIn(value: string, min: number, max: number): number | undefined {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
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
  const [source, setSource] = useState<Source>(statblocks.length > 0 ? 'statblock' : 'character');
  const [hidden, setHidden] = useState(false);
  const [characterId, setCharacterId] = useState('');
  const [statblockId, setStatblockId] = useState('');
  const [count, setCount] = useState('1');
  const [hpMode, setHpMode] = useState<HitPointMode>('average');
  const [manual, setManual] = useState({ name: '', ac: '', hp: '', size: 'medium' as Size, initiativeBonus: '0', initiative: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Radio groups are named per instance, or two forms on a page would share one.
  const uid = useId();

  const chosenCharacter = characters.find((character) => character.id === characterId) ?? characters[0];
  const chosenStatblock = statblocks.find((statblock) => statblock.id === statblockId) ?? statblocks[0];
  const canRoll = !!chosenStatblock?.hpFormula;
  const { copies } = ENCOUNTER_LIMITS;
  const S = STATBLOCK_LIMITS;

  const build = (): { input: CombatantInput } | { errors: Record<string, string> } => {
    if (source === 'character') {
      if (!chosenCharacter) return { errors: { character: 'Todos os personagens já estão no encontro.' } };
      return { input: { source, characterId: chosenCharacter.id, hidden } };
    }
    if (source === 'statblock') {
      if (!chosenStatblock) return { errors: { statblock: 'Cadastre uma criatura no bestiário primeiro.' } };
      const amount = integerIn(count, 1, copies);
      if (amount === undefined) return { errors: { count: `De 1 a ${copies}.` } };
      return { input: { source, statblockId: chosenStatblock.id, count: amount, hp: canRoll ? hpMode : 'average', hidden } };
    }
    const found: Record<string, string> = {};
    const name = manual.name.trim();
    if (!name || name.length > S.name) found.name = `Informe o nome, com até ${S.name} caracteres.`;
    const ac = integerIn(manual.ac, S.ac.min, S.ac.max);
    if (ac === undefined) found.ac = `De ${S.ac.min} a ${S.ac.max}.`;
    const hp = integerIn(manual.hp, S.hp.min, S.hp.max);
    if (hp === undefined) found.hp = `De ${S.hp.min} a ${S.hp.max}.`;
    const bonus = integerIn(manual.initiativeBonus, S.initiativeBonus.min, S.initiativeBonus.max);
    if (bonus === undefined) found.initiativeBonus = `De ${S.initiativeBonus.min} a ${S.initiativeBonus.max}.`;
    const { min, max } = ENCOUNTER_LIMITS.initiative;
    const initiative = manual.initiative.trim() === '' ? null : integerIn(manual.initiative, min, max);
    if (initiative === undefined) found.initiative = `Deixe vazio ou use de ${min} a ${max}.`;
    if (Object.keys(found).length > 0) return { errors: found };
    return { input: { source, name, ac: ac!, hp: hp!, size: manual.size, initiativeBonus: bonus!, initiative: initiative ?? null, hidden } };
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = build();
    if ('errors' in result) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      event.currentTarget.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select`)?.focus();
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
    setManual((current) => ({ ...current, name: '', ac: '', hp: '', initiative: '' }));
  };

  return (
    <form className="qf-encounter-setup" onSubmit={submit} noValidate aria-label={reinforcement ? 'Adicionar reforço' : 'Adicionar combatente'}>
      <Segmented label="Origem do combatente" name={`${uid}-source`} value={source} onChange={setSource}
        options={(['character', 'statblock', 'manual'] as Source[]).map((value) => ({ value, label: SOURCE_LABELS[value] }))} />

      {source === 'character' && (
        characters.length === 0 ? (
          <p className="qf-encounter-setup__note" data-field="character">
            {errors.character ?? 'Todos os personagens da campanha já estão no encontro.'}
          </p>
        ) : (
          <div data-field="character">
            <SelectField label="Personagem" value={chosenCharacter?.id ?? ''} onChange={setCharacterId}>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>{character.name} ({character.ownerName})</option>
              ))}
            </SelectField>
          </div>
        )
      )}

      {source === 'statblock' && (
        statblocks.length === 0 ? (
          <p className="qf-encounter-setup__note" data-field="statblock">
            O bestiário está vazio. Cadastre uma criatura para usar quantas cópias quiser.
          </p>
        ) : (
          <div className="qf-encounter-setup__grid">
            <div data-field="statblock" className="qf-encounter-setup__wide">
              <SelectField label="Criatura" value={chosenStatblock?.id ?? ''} onChange={setStatblockId}>
                {statblocks.map((statblock) => (
                  <option key={statblock.id} value={statblock.id}>
                    {statblock.name} (CA {statblock.ac}, PV {statblock.hpAverage})
                  </option>
                ))}
              </SelectField>
            </div>
            <div data-field="count">
              <Field label="Quantidade" type="number" inputMode="numeric" min={1} max={copies} value={count}
                error={errors.count} onChange={(event) => setCount(event.target.value)} />
            </div>
            <div className="qf-encounter-setup__wide">
              <p className="qf-encounter-setup__label" aria-hidden="true">Pontos de vida de cada cópia</p>
              <Segmented label="Pontos de vida de cada cópia" name={`${uid}-hp`} value={canRoll ? hpMode : 'average'} onChange={setHpMode}
                options={[
                  { value: 'average', label: `Média (${chosenStatblock?.hpAverage ?? 0})` },
                  { value: 'rolled', label: canRoll ? `Rolados (${chosenStatblock!.hpFormula})` : 'Rolados (sem fórmula)', disabled: !canRoll },
                ]} />
            </div>
          </div>
        )
      )}

      {source === 'manual' && (
        <div className="qf-encounter-setup__grid">
          <div data-field="name" className="qf-encounter-setup__wide">
            <Field label="Nome" required maxLength={S.name} value={manual.name} error={errors.name}
              onChange={(event) => setManual({ ...manual, name: event.target.value })} />
          </div>
          <div data-field="ac">
            <Field label="CA" required type="number" inputMode="numeric" value={manual.ac} error={errors.ac}
              onChange={(event) => setManual({ ...manual, ac: event.target.value })} />
          </div>
          <div data-field="hp">
            <Field label="PV" required type="number" inputMode="numeric" value={manual.hp} error={errors.hp}
              onChange={(event) => setManual({ ...manual, hp: event.target.value })} />
          </div>
          <div data-field="size">
            <SelectField label="Tamanho" value={manual.size} onChange={(size) => setManual({ ...manual, size: size as Size })}>
              {SIZES.map((size) => <option key={size} value={size}>{SIZE_LABELS[size]}</option>)}
            </SelectField>
          </div>
          <div data-field="initiativeBonus">
            <Field label="Bônus de iniciativa" type="number" inputMode="numeric" value={manual.initiativeBonus}
              error={errors.initiativeBonus} onChange={(event) => setManual({ ...manual, initiativeBonus: event.target.value })} />
          </div>
          <div data-field="initiative">
            <Field label="Iniciativa (opcional)" type="number" inputMode="numeric" value={manual.initiative}
              hint="Vazio: rolada depois." error={errors.initiative}
              onChange={(event) => setManual({ ...manual, initiative: event.target.value })} />
          </div>
        </div>
      )}

      <div className="qf-encounter-setup__footer">
        <label className="qf-check">
          <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
          Entra escondido dos jogadores
        </label>
        <Button type="submit" loading={pending}
          disabled={(source === 'character' && characters.length === 0) || (source === 'statblock' && statblocks.length === 0)}>
          <Plus size={18} aria-hidden="true" /> {reinforcement ? 'Adicionar reforço' : 'Adicionar ao encontro'}
        </Button>
      </div>
    </form>
  );
}

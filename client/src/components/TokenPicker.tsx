import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { MapPin, UsersThree } from '@phosphor-icons/react';
import { SIZES, TOKEN_LIMITS, type Size, type TokenKind } from '@quest-fast/shared';
import { SIZE_LABELS } from '../lib/sheet-labels';
import { initials } from '../lib/initials';
import { Button } from './Button';
import { Field } from './Field';
import { SelectField } from './SelectField';
import { TokenDisc } from './TokenDisc';
import { segmentedGroup, segmentedRadio } from './ui/segmented';

export type PickerCharacter = { id: string; name: string; ownerName: string; avatarUrl: string | null; onScene: boolean };
export type PickerCombatant = { id: string; name: string; hidden: boolean; character: boolean; onScene: boolean };
export type PickerEncounter = { id: string; name: string; active: boolean; combatants: PickerCombatant[] };
export type PickerStatblock = { id: string; name: string; size: Size };

type Origin = 'character' | 'encounter' | 'statblock' | 'free';

const ORIGIN_LABELS: Record<Origin, string> = {
  character: 'Personagens',
  encounter: 'Encontro',
  statblock: 'Bestiário',
  free: 'Livre',
};

export type TokenPickerProps = {
  characters: PickerCharacter[];
  /** Encounters in preparation or running; ended ones are history. */
  encounters: PickerEncounter[];
  statblocks: PickerStatblock[];
  onAddCharacter: (characterId: string) => void;
  onAddCombatant: (combatantId: string) => void;
  /** Every combatant of the encounter not yet on the map. */
  onPlaceEncounter: (encounterId: string) => void;
  onAddStatblock: (statblockId: string) => void;
  onAddFree: (token: { label: string; size: Size }) => void;
  /** The scene is full (`TOKEN_LIMITS.perScene`). */
  full?: boolean;
  busy?: boolean;
};

function PlaceButton({ name, onScene, disabled, onPlace }: { name: string; onScene: boolean; disabled: boolean; onPlace: () => void }) {
  if (onScene) return <span className="px-3 text-small text-text-secondary">No mapa</span>;
  return (
    <Button variant="secondary" disabled={disabled} onClick={onPlace}>
      <MapPin size={18} aria-hidden="true" /> Pôr no mapa<span className="sr-only"> {name}</span>
    </Button>
  );
}

function Row({ kind, name, detail, avatarUrl = null, hidden = false, children }: {
  kind: TokenKind; name: string; detail?: string; avatarUrl?: string | null; hidden?: boolean; children: ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
      <span className="flex min-w-0 items-center gap-3">
        <TokenDisc token={{ kind, avatarUrl, initials: initials(name), hidden }} className="size-9" />
        <span className="grid min-w-0">
          <span className="font-semibold [overflow-wrap:anywhere]">{name}</span>
          {detail && <span className="text-small text-text-secondary [overflow-wrap:anywhere]">{detail}</span>}
        </span>
      </span>
      {children}
    </li>
  );
}

function Characters({ characters, disabled, onAdd }: { characters: PickerCharacter[]; disabled: boolean; onAdd: (id: string) => void }) {
  if (characters.length === 0) return <p className="m-0 text-text-secondary">A campanha ainda não tem personagens.</p>;
  return (
    <ul className="m-0 grid list-none divide-y divide-border-subtle p-0">
      {characters.map((character) => (
        <Row key={character.id} kind="character" name={character.name} detail={character.ownerName} avatarUrl={character.avatarUrl}>
          <PlaceButton name={character.name} onScene={character.onScene} disabled={disabled} onPlace={() => onAdd(character.id)} />
        </Row>
      ))}
    </ul>
  );
}

function Encounter({ encounters, disabled, onAddCombatant, onPlace }: {
  encounters: PickerEncounter[];
  disabled: boolean;
  onAddCombatant: (id: string) => void;
  onPlace: (encounterId: string) => void;
}) {
  const [chosenId, setChosenId] = useState(() => (encounters.find((encounter) => encounter.active) ?? encounters[0])?.id ?? '');
  const chosen = encounters.find((encounter) => encounter.id === chosenId) ?? encounters[0];
  if (!chosen) return <p className="m-0 text-text-secondary">Nenhum encontro em preparação ou em andamento.</p>;
  const missing = chosen.combatants.filter((combatant) => !combatant.onScene).length;

  return (
    <div className="grid min-w-0 gap-3">
      {encounters.length > 1 && (
        <SelectField label="Qual encontro" value={chosen.id} onChange={setChosenId}>
          {encounters.map((encounter) => (
            <option key={encounter.id} value={encounter.id}>{encounter.name}{encounter.active ? ' (em andamento)' : ''}</option>
          ))}
        </SelectField>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={disabled || missing === 0} onClick={() => onPlace(chosen.id)}>
          <UsersThree size={18} aria-hidden="true" />
          {missing === 0 ? 'Todos já estão no mapa' : missing === 1 ? 'Colocar 1 combatente' : `Colocar ${missing} combatentes`}
        </Button>
        <span className="text-small text-text-secondary">Entram em fileiras a partir do centro da sua vista.</span>
      </div>
      <ul className="m-0 grid list-none divide-y divide-border-subtle p-0">
        {chosen.combatants.map((combatant) => (
          <Row key={combatant.id} kind={combatant.character ? 'character' : 'combatant'} name={combatant.name} hidden={combatant.hidden}
            detail={combatant.hidden ? 'Escondido dos jogadores' : combatant.character ? 'Personagem' : undefined}>
            <PlaceButton name={combatant.name} onScene={combatant.onScene} disabled={disabled} onPlace={() => onAddCombatant(combatant.id)} />
          </Row>
        ))}
      </ul>
    </div>
  );
}

function Statblocks({ statblocks, disabled, onAdd }: { statblocks: PickerStatblock[]; disabled: boolean; onAdd: (id: string) => void }) {
  const [chosenId, setChosenId] = useState(statblocks[0]?.id ?? '');
  const chosen = statblocks.find((statblock) => statblock.id === chosenId) ?? statblocks[0];
  if (!chosen) return <p className="m-0 text-text-secondary">O bestiário está vazio. Cadastre uma criatura no Preparo.</p>;
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-3">
      <SelectField className="min-w-[min(100%,14rem)] flex-1" label="Criatura" value={chosen.id} onChange={setChosenId}>
        {statblocks.map((statblock) => (
          <option key={statblock.id} value={statblock.id}>{statblock.name} ({SIZE_LABELS[statblock.size]})</option>
        ))}
      </SelectField>
      <PlaceButton name={chosen.name} onScene={false} disabled={disabled} onPlace={() => onAdd(chosen.id)} />
    </div>
  );
}

function FreeToken({ disabled, onAdd }: { disabled: boolean; onAdd: TokenPickerProps['onAddFree'] }) {
  const [label, setLabel] = useState('');
  const [size, setSize] = useState<Size>('medium');
  const [error, setError] = useState<string | undefined>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = label.trim();
    if (!clean || clean.length > TOKEN_LIMITS.label) {
      setError(`Dê um nome ao token, com até ${TOKEN_LIMITS.label} caracteres.`);
      return;
    }
    setError(undefined);
    onAdd({ label: clean, size });
    setLabel('');
  };
  return (
    <form noValidate className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] items-start gap-3" onSubmit={submit}>
      <Field label="Nome" value={label} maxLength={TOKEN_LIMITS.label} error={error} hint="Um barril, uma armadilha, um aliado sem ficha."
        onChange={(event) => setLabel(event.target.value)} />
      <SelectField label="Tamanho" value={size} onChange={(value) => setSize(value as Size)}>
        {SIZES.map((option) => <option key={option} value={option}>{SIZE_LABELS[option]}</option>)}
      </SelectField>
      <div className="col-span-full">
        <Button type="submit" variant="secondary" disabled={disabled}>
          <MapPin size={18} aria-hidden="true" /> Pôr no mapa
        </Button>
      </div>
    </form>
  );
}

/**
 * What the master puts on the map: a character of the campaign, combatants of
 * an encounter (one by one or all at once), a creature of the bestiary or a
 * free token with a name and a size. New tokens land at the centre of the
 * area the master is viewing. Presentational: the screen does the requests.
 */
export function TokenPicker({
  characters, encounters, statblocks, onAddCharacter, onAddCombatant, onPlaceEncounter, onAddStatblock, onAddFree, full = false, busy = false,
}: TokenPickerProps) {
  const [origin, setOrigin] = useState<Origin>('character');
  const name = useId();
  const disabled = busy || full;
  return (
    <div className="grid min-w-0 gap-4">
      <fieldset className={segmentedGroup} aria-label="Origem do token">
        {(Object.keys(ORIGIN_LABELS) as Origin[]).map((option) => (
          <label key={option} className={segmentedRadio}>
            <input type="radio" name={name} value={option} checked={origin === option} onChange={() => setOrigin(option)} />
            <span>{ORIGIN_LABELS[option]}</span>
          </label>
        ))}
      </fieldset>
      {full && (
        <p role="status" className="m-0 text-small text-danger-text">
          A cena já tem {TOKEN_LIMITS.perScene} tokens, o máximo. Remova algum para pôr outro.
        </p>
      )}
      {origin === 'character' && <Characters characters={characters} disabled={disabled} onAdd={onAddCharacter} />}
      {origin === 'encounter' && (
        <Encounter encounters={encounters} disabled={disabled} onAddCombatant={onAddCombatant} onPlace={onPlaceEncounter} />
      )}
      {origin === 'statblock' && <Statblocks statblocks={statblocks} disabled={disabled} onAdd={onAddStatblock} />}
      {origin === 'free' && <FreeToken disabled={disabled} onAdd={onAddFree} />}
    </div>
  );
}

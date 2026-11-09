import { useState, type FormEvent } from 'react';
import { Plus, Sword } from '@phosphor-icons/react';
import { ENCOUNTER_LIMITS, type EncounterListItem } from '@quest-fast/shared';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Field } from './Field';
import { ENCOUNTER_STATUS_LABELS } from '../lib/combat-labels';
import { cn } from '../lib/utils';
import { cardRow, cardRowTitle } from './sheet-styles';

function detail(encounter: EncounterListItem): string {
  const combatants = encounter.combatantCount === 1 ? '1 combatente' : `${encounter.combatantCount} combatentes`;
  if (encounter.status === 'active' && encounter.round > 0) return `Round ${encounter.round} · ${combatants}`;
  if (encounter.status === 'ended') {
    return `${encounter.round} ${encounter.round === 1 ? 'round' : 'rounds'} · ${combatants}`;
  }
  return combatants;
}

/**
 * The encounters of a campaign, newest first, as the server listed them for
 * the viewer (a player's list has no encounter in preparation). The master
 * also gets the field to create one; `onCreate` resolves once it exists.
 */
export function EncounterList({ encounters, onOpen, onCreate, creating = false }: {
  encounters: EncounterListItem[];
  onOpen: (encounterId: string) => void;
  /** Only for the master. */
  onCreate?: (name: string) => Promise<unknown> | void;
  creating?: boolean;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || clean.length > ENCOUNTER_LIMITS.name) {
      setError(`Dê um nome ao encontro, com até ${ENCOUNTER_LIMITS.name} caracteres.`);
      return;
    }
    setError(undefined);
    try {
      await onCreate?.(clean);
      setName('');
    } catch {
      // The screen shows the server's reason; the name stays to try again.
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      {onCreate && (
        <form className="flex flex-wrap items-end gap-3" onSubmit={submit} noValidate>
          <Field className="flex-[1_1_14rem]" label="Nome do novo encontro" placeholder="Emboscada na estrada"
            maxLength={ENCOUNTER_LIMITS.name} value={name} error={error} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" loading={creating}><Plus size={18} aria-hidden="true" /> Preparar encontro</Button>
        </form>
      )}

      {encounters.length === 0 ? (
        onCreate ? (
          <p className="text-text-secondary">Nenhum encontro ainda. Prepare um antes da sessão: os jogadores só o veem quando o combate começa.</p>
        ) : (
          <EmptyState icon={Sword} title="Nenhum combate por aqui" description="Quando o mestre iniciar um combate, ele aparece nesta seção."
            action={null} />
        )
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0 *:min-w-0" aria-label="Encontros">
          {encounters.map((encounter) => (
            <li key={encounter.id}>
              <button type="button" className={cn(cardRow, 'group data-[status=active]:border-accent-text data-[status=active]:shadow-[inset_3px_0_0_var(--color-accent-text)]')} data-status={encounter.status} onClick={() => onOpen(encounter.id)}>
                <span className="grid min-w-0 flex-[1_1_12rem] gap-1">
                  <span className={cardRowTitle}>{encounter.name}</span>
                  <span className="text-small text-text-secondary">{detail(encounter)}</span>
                </span>
                <span className="text-small text-text-secondary group-data-[status=active]:font-semibold group-data-[status=active]:text-accent-text">{ENCOUNTER_STATUS_LABELS[encounter.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

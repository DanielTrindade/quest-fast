import { useState } from 'react';
import { PawPrint, Plus } from '@phosphor-icons/react';
import type { StatblockSummary } from '@quest-fast/shared';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Field } from './Field';
import { SIZE_LABELS } from '../lib/sheet-labels';
import { cardRow, cardRowTitle } from './sheet-styles';

/** Accents and case do not matter when searching for "dragao". */
function normalized(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}

/**
 * The campaign's bestiary as a searchable list. Each row opens the creature;
 * the list does not fetch nor decide who may see it.
 */
export function BestiaryList({ statblocks, onOpen, onCreate }: {
  statblocks: StatblockSummary[];
  onOpen: (statblockId: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState('');

  if (statblocks.length === 0) {
    return (
      <EmptyState
        icon={PawPrint}
        title="O bestiário está vazio"
        description="Cadastre uma criatura uma vez e use quantas cópias quiser nos encontros, sem redigitar."
        action={<Button onClick={onCreate}><Plus size={18} aria-hidden="true" /> Adicionar criatura</Button>}
      />
    );
  }

  const term = normalized(query.trim());
  const visible = term ? statblocks.filter((statblock) => normalized(statblock.name).includes(term)) : statblocks;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="flex-[1_1_14rem]" label="Buscar criatura" type="search" value={query}
          onChange={(event) => setQuery(event.target.value)} />
        <Button onClick={onCreate}><Plus size={18} aria-hidden="true" /> Adicionar criatura</Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-text-secondary" role="status">Nenhuma criatura com “{query.trim()}” no nome.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0 *:min-w-0" aria-label="Criaturas do bestiário">
          {visible.map((statblock) => (
            <li key={statblock.id}>
              <button type="button" className={cardRow} onClick={() => onOpen(statblock.id)}>
                <span className="grid min-w-0 flex-[1_1_12rem] gap-1">
                  <span className={cardRowTitle}>{statblock.name}</span>
                  <span className="text-small text-text-secondary italic [overflow-wrap:anywhere]">
                    {[SIZE_LABELS[statblock.size], statblock.creatureType].filter(Boolean).join(', ')}
                  </span>
                </span>
                <dl className="m-0 flex gap-4 *:grid *:min-w-10 *:justify-items-end [&_dd]:m-0 [&_dd]:font-mono [&_dd]:tabular-nums [&_dt]:text-micro [&_dt]:text-text-secondary">
                  {statblock.challengeRating && <div><dt>ND</dt><dd>{statblock.challengeRating}</dd></div>}
                  <div><dt>CA</dt><dd>{statblock.ac}</dd></div>
                  <div><dt>PV</dt><dd>{statblock.hpAverage}</dd></div>
                </dl>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

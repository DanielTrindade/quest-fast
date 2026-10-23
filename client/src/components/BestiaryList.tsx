import { useState } from 'react';
import { PawPrint, Plus } from '@phosphor-icons/react';
import type { StatblockSummary } from '@quest-fast/shared';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Field } from './Field';
import { SIZE_LABELS } from '../lib/sheet-labels';

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
    <div className="qf-bestiary">
      <div className="qf-bestiary__toolbar">
        <Field className="qf-bestiary__search" label="Buscar criatura" type="search" value={query}
          onChange={(event) => setQuery(event.target.value)} />
        <Button onClick={onCreate}><Plus size={18} aria-hidden="true" /> Adicionar criatura</Button>
      </div>

      {visible.length === 0 ? (
        <p className="qf-bestiary__none" role="status">Nenhuma criatura com “{query.trim()}” no nome.</p>
      ) : (
        <ul className="qf-bestiary__list" aria-label="Criaturas do bestiário">
          {visible.map((statblock) => (
            <li key={statblock.id}>
              <button type="button" className="qf-bestiary__row" onClick={() => onOpen(statblock.id)}>
                <span className="qf-bestiary__identity">
                  <span className="qf-bestiary__name">{statblock.name}</span>
                  <span className="qf-bestiary__kind">
                    {[SIZE_LABELS[statblock.size], statblock.creatureType].filter(Boolean).join(', ')}
                  </span>
                </span>
                <dl className="qf-bestiary__stats">
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

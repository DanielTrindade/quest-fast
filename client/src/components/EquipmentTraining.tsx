import { CheckSquare, Square } from '@phosphor-icons/react';
import { ARMOR_TRAINING, type ArmorTraining } from '@quest-fast/shared';
import { ARMOR_TRAINING_LABELS } from '../lib/sheet-labels';
import { sheetEmpty } from './layout-styles';

/** "Treinamento em equipamentos e proficiências" of the official sheet. */
export function EquipmentTraining({ armorTraining, weapons, tools }: {
  armorTraining: readonly ArmorTraining[];
  weapons: string;
  tools: string;
}) {
  return (
    <div className="grid gap-3">
      <ul aria-label="Treinamento em armaduras" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {ARMOR_TRAINING.map((kind) => {
          const trained = armorTraining.includes(kind);
          return (
            <li key={kind} data-trained={trained || undefined} className="inline-flex items-center gap-1 rounded-control border border-border px-2 py-1 text-small text-text-muted data-trained:border-input data-trained:text-foreground [&>svg]:shrink-0 data-trained:[&>svg]:text-accent-text">
              {trained ? <CheckSquare size={16} weight="fill" aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
              {ARMOR_TRAINING_LABELS[kind]}
              <span className="sr-only">{trained ? ': treinado' : ': sem treinamento'}</span>
            </li>
          );
        })}
      </ul>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3 [&_dd]:mt-1 [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-small [&_dt]:text-text-secondary">
        <div>
          <dt>Armas</dt>
          <dd>{weapons || <span className={sheetEmpty}>Nenhuma informada</span>}</dd>
        </div>
        <div>
          <dt>Ferramentas</dt>
          <dd>{tools || <span className={sheetEmpty}>Nenhuma informada</span>}</dd>
        </div>
      </dl>
    </div>
  );
}

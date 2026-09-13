import { CheckSquare, Square } from '@phosphor-icons/react';
import { ARMOR_TRAINING, type ArmorTraining } from '@quest-fast/shared';
import { ARMOR_TRAINING_LABELS } from '../lib/sheet-labels';

/** "Treinamento em equipamentos e proficiências" of the official sheet. */
export function EquipmentTraining({ armorTraining, weapons, tools }: {
  armorTraining: readonly ArmorTraining[];
  weapons: string;
  tools: string;
}) {
  return (
    <div className="qf-training">
      <ul className="qf-training__armor" aria-label="Treinamento em armaduras">
        {ARMOR_TRAINING.map((kind) => {
          const trained = armorTraining.includes(kind);
          return (
            <li key={kind} data-trained={trained || undefined}>
              {trained ? <CheckSquare size={16} weight="fill" aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
              {ARMOR_TRAINING_LABELS[kind]}
              <span className="sr-only">{trained ? ': treinado' : ': sem treinamento'}</span>
            </li>
          );
        })}
      </ul>
      <dl className="qf-training__text">
        <div>
          <dt>Armas</dt>
          <dd>{weapons || <span className="qf-sheet-empty">Nenhuma informada</span>}</dd>
        </div>
        <div>
          <dt>Ferramentas</dt>
          <dd>{tools || <span className="qf-sheet-empty">Nenhuma informada</span>}</dd>
        </div>
      </dl>
    </div>
  );
}

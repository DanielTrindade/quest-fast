import { Minus, Plus } from '@phosphor-icons/react';
import { Button } from './Button';
import { trackerLabel, trackerPanel } from './sheet-styles';

/** Hit dice: one per level, of the class die, spent during short rests. */
export function HitDiceTracker({ hitDie, level, spent, editable = false, pending = false, onChange }: {
  hitDie: number;
  level: number;
  spent: number;
  editable?: boolean;
  pending?: boolean;
  onChange?: (spent: number) => void;
}) {
  return (
    <section className={trackerPanel} aria-label="Dados de vida">
      <p className={trackerLabel}>Dados de vida</p>
      <p className="m-0 flex flex-wrap items-baseline gap-2">
        <strong className="font-mono text-h1 font-semibold tabular-nums">{level - spent}</strong>
        <span className="text-small text-text-secondary">de {level} d{hitDie}</span>
      </p>
      <p className="m-0 text-small text-text-secondary">{spent === 1 ? '1 gasto' : `${spent} gastos`}</p>
      {editable && (
        <div className="flex gap-2 *:flex-1 *:px-2">
          <Button variant="secondary" disabled={pending || spent >= level} onClick={() => onChange?.(spent + 1)}
            aria-label="Gastar um dado de vida">
            <Minus size={16} aria-hidden="true" />
          </Button>
          <Button variant="secondary" disabled={pending || spent <= 0} onClick={() => onChange?.(spent - 1)}
            aria-label="Recuperar um dado de vida">
            <Plus size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </section>
  );
}

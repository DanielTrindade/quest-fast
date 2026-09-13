import { Minus, Plus } from '@phosphor-icons/react';
import { Button } from './Button';

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
    <section className="qf-counter" aria-label="Dados de vida">
      <p className="qf-counter__label">Dados de vida</p>
      <p className="qf-counter__value">
        <strong>{level - spent}</strong>
        <span>de {level} d{hitDie}</span>
      </p>
      <p className="qf-counter__detail">{spent === 1 ? '1 gasto' : `${spent} gastos`}</p>
      {editable && (
        <div className="qf-counter__controls">
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

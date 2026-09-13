import { useState } from 'react';
import { applyDamage, applyHealing, type HitPoints } from '@quest-fast/shared';
import { Button } from './Button';

/**
 * Current, temporary and maximum hit points. The owner types an amount and
 * applies damage (temporary points soak it first), healing (up to the
 * maximum) or new temporary points; the rules live in `shared/`.
 */
export function HitPointsTracker({ hpCurrent, hpTemp, hpMax, editable = false, pending = false, onChange }: {
  hpCurrent: number;
  hpTemp: number;
  hpMax: number;
  editable?: boolean;
  pending?: boolean;
  onChange?: (next: HitPoints) => void;
}) {
  const [amount, setAmount] = useState('');
  const value = Number(amount);
  const valid = amount.trim() !== '' && Number.isInteger(value) && value > 0 && value <= 999;
  const apply = (next: HitPoints) => {
    onChange?.(next);
    setAmount('');
  };

  return (
    <section className="qf-hp" aria-label="Pontos de vida" data-down={hpCurrent === 0 || undefined}>
      <div className="qf-hp__values">
        <p className="qf-hp__current">
          <span className="qf-hp__label">PV atual</span>
          <span className="qf-hp__number">
            <strong>{hpCurrent}</strong>
            <span className="qf-hp__max">
              <span aria-hidden="true">/ </span>
              <span className="sr-only">de </span>
              {hpMax}
            </span>
          </span>
        </p>
        <p className="qf-hp__temp">
          <span className="qf-hp__label">Temporários</span>
          <strong>{hpTemp}</strong>
        </p>
      </div>
      {hpCurrent === 0 && <p className="qf-hp__down">Caído: role as salvaguardas contra a morte.</p>}
      {editable && (
        <div className="qf-hp__controls">
          <label className="qf-hp__amount">
            Quantidade
            <input className="qf-input" type="number" min={1} max={999} inputMode="numeric" value={amount}
              disabled={pending} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <Button variant="secondary" disabled={!valid || pending}
            onClick={() => apply(applyDamage({ hpCurrent, hpTemp }, value))}>
            Dano
          </Button>
          <Button variant="secondary" disabled={!valid || pending || hpCurrent >= hpMax}
            onClick={() => apply(applyHealing({ hpCurrent, hpTemp }, value, hpMax))}>
            Cura
          </Button>
          <Button variant="ghost" disabled={!valid || pending} onClick={() => apply({ hpCurrent, hpTemp: value })}>
            Definir temporários
          </Button>
        </div>
      )}
    </section>
  );
}

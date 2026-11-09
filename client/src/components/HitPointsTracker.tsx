import { useState } from 'react';
import { applyDamage, applyHealing, type HitPoints } from '@quest-fast/shared';
import { Button } from './Button';
import { trackerLabel, trackerPanel } from './sheet-styles';
import { cn } from '../lib/utils';
import { Input } from './ui/input';

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
    <section data-slot="hit-points" className={trackerPanel} aria-label="Pontos de vida" data-down={hpCurrent === 0 || undefined}>
      <div className="flex flex-wrap items-end gap-4">
        <p className="m-0 grid">
          <span className={trackerLabel}>PV atual</span>
          <span className="flex items-baseline gap-1">
            <strong className={cn('font-mono text-display font-semibold tracking-[-0.04em] tabular-nums', hpCurrent === 0 && 'text-danger-text')}>{hpCurrent}</strong>
            <span className="font-mono text-text-secondary tabular-nums">
              <span aria-hidden="true">/ </span>
              <span className="sr-only">de </span>
              {hpMax}
            </span>
          </span>
        </p>
        <p className="m-0 grid">
          <span className={trackerLabel}>Temporários</span>
          <strong className="font-mono text-h1 font-medium tabular-nums">{hpTemp}</strong>
        </p>
      </div>
      {hpCurrent === 0 && <p className="m-0 text-small text-danger-text">Caído: role as salvaguardas contra a morte.</p>}
      {editable && (
        <div className="flex flex-wrap items-end gap-2 [&>[data-slot=button]]:flex-auto">
          <label className="grid flex-[0_0_6rem] gap-1 text-small text-text-secondary">
            Quantidade
            <Input type="number" min={1} max={999} inputMode="numeric" value={amount}
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

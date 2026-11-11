import { useId, useState } from 'react';
import { FirstAidKit, ShieldPlus, Sword } from '@phosphor-icons/react';
import { COMBAT_LIMITS, type HpOperation } from '@quest-fast/shared';
import { Button } from './Button';
import { Input } from './ui/input';

/**
 * An amount and what to do with it. It only asks: the server applies the
 * change by amount, so the master's and the player's hits both count.
 */
export function HpAdjuster({ name, full = false, pending = false, onApply }: {
  /** Whose hit points: names the controls for screen readers. */
  name: string;
  /** Already at maximum: healing would change nothing. */
  full?: boolean;
  pending?: boolean;
  onApply: (operation: HpOperation, amount: number) => void;
}) {
  const id = useId();
  const [amount, setAmount] = useState('');
  const { min, max } = COMBAT_LIMITS.hpAmount;
  const value = Number(amount);
  const valid = amount.trim() !== '' && Number.isInteger(value) && value >= min && value <= max;

  const apply = (operation: HpOperation) => {
    onApply(operation, value);
    setAmount('');
  };

  return (
    <div role="group" aria-label={`Pontos de vida de ${name}`}
      className="flex min-w-0 flex-wrap items-end gap-2 [&>[data-slot=button]]:flex-auto">
      <label htmlFor={id} className="grid flex-[0_0_6rem] gap-1 text-small text-text-secondary">
        Quantidade
        <Input id={id} type="number" inputMode="numeric" min={min} max={max} value={amount}
          disabled={pending} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <Button variant="secondary" disabled={!valid || pending} onClick={() => apply('damage')}>
        <Sword size={18} aria-hidden="true" /> Dano<span className="sr-only"> em {name}</span>
      </Button>
      <Button variant="secondary" disabled={!valid || pending || full} onClick={() => apply('heal')}>
        <FirstAidKit size={18} aria-hidden="true" /> Cura<span className="sr-only"> em {name}</span>
      </Button>
      <Button variant="ghost" disabled={!valid || pending} onClick={() => apply('temp')}>
        <ShieldPlus size={18} aria-hidden="true" /> Temporários<span className="sr-only"> para {name}</span>
      </Button>
    </div>
  );
}

import { useState } from 'react';
import { CHARACTER_LIMITS, COINS, type Coins } from '@quest-fast/shared';
import { COIN_LABELS } from '../lib/sheet-labels';
import { Button } from './Button';
import { Input } from './ui/input';

const coinGrid = 'm-0 grid grid-cols-5 gap-2 max-[479px]:grid-cols-3';
const coinCell = 'grid min-w-0 justify-items-center gap-1 rounded-control border border-border bg-background p-2 text-center';
const coinLabel = 'font-mono text-small font-semibold text-text-secondary';

function toDraft(coins: Coins) {
  return Object.fromEntries(COINS.map((coin) => [coin, String(coins[coin])])) as Record<keyof Coins, string>;
}

/**
 * The five coins of the official sheet. The owner edits a draft and saves it
 * at once; remount with a `key` derived from `coins` to reset after saving.
 */
export function CoinPurse({ coins, editable = false, pending = false, onSave }: {
  coins: Coins;
  editable?: boolean;
  pending?: boolean;
  onSave?: (coins: Coins) => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(coins));
  const parsed = Object.fromEntries(COINS.map((coin) => [coin, draft[coin].trim() === '' ? Number.NaN : Number(draft[coin])])) as Coins;
  const valid = COINS.every((coin) => Number.isInteger(parsed[coin]) && parsed[coin] >= 0 && parsed[coin] <= CHARACTER_LIMITS.coins);
  const dirty = COINS.some((coin) => parsed[coin] !== coins[coin]);

  if (!editable) {
    return (
      <dl className={coinGrid}>
        {COINS.map((coin) => (
          <div key={coin} className={coinCell}>
            <dt className={coinLabel}>
              <abbr title={COIN_LABELS[coin].name} className="no-underline">{COIN_LABELS[coin].short}</abbr>
            </dt>
            <dd className="m-0 font-mono font-semibold tabular-nums [overflow-wrap:anywhere]">{coins[coin].toLocaleString('pt-BR')}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="grid gap-2">
      <div className={coinGrid} role="group" aria-label="Moedas">
        {COINS.map((coin) => (
          <div key={coin} className={coinCell}>
            <label className="grid w-full justify-items-center gap-1">
              <span aria-hidden="true" className={coinLabel}>{COIN_LABELS[coin].short}</span>
              <Input className="px-1 text-center" type="number" min={0} max={CHARACTER_LIMITS.coins} inputMode="numeric"
                aria-label={COIN_LABELS[coin].name} value={draft[coin]} disabled={pending}
                aria-invalid={!(Number.isInteger(parsed[coin]) && parsed[coin] >= 0) || undefined}
                onChange={(event) => setDraft((current) => ({ ...current, [coin]: event.target.value }))} />
            </label>
          </div>
        ))}
      </div>
      {dirty && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => setDraft(toDraft(coins))}>Desfazer</Button>
          <Button variant="secondary" loading={pending} disabled={!valid} onClick={() => onSave?.(parsed)}>
            Salvar moedas
          </Button>
        </div>
      )}
    </div>
  );
}

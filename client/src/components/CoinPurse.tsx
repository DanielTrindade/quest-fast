import { useState } from 'react';
import { CHARACTER_LIMITS, COINS, type Coins } from '@quest-fast/shared';
import { COIN_LABELS } from '../lib/sheet-labels';
import { Button } from './Button';

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
      <dl className="qf-coins">
        {COINS.map((coin) => (
          <div key={coin} className="qf-coins__coin">
            <dt>
              <abbr title={COIN_LABELS[coin].name}>{COIN_LABELS[coin].short}</abbr>
            </dt>
            <dd>{coins[coin].toLocaleString('pt-BR')}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="qf-coin-purse">
      <div className="qf-coins" role="group" aria-label="Moedas">
        {COINS.map((coin) => (
          <div key={coin} className="qf-coins__coin">
            <label>
              <span aria-hidden="true">{COIN_LABELS[coin].short}</span>
              <input className="qf-input" type="number" min={0} max={CHARACTER_LIMITS.coins} inputMode="numeric"
                aria-label={COIN_LABELS[coin].name} value={draft[coin]} disabled={pending}
                aria-invalid={!(Number.isInteger(parsed[coin]) && parsed[coin] >= 0) || undefined}
                onChange={(event) => setDraft((current) => ({ ...current, [coin]: event.target.value }))} />
            </label>
          </div>
        ))}
      </div>
      {dirty && (
        <div className="qf-coin-purse__actions">
          <Button variant="ghost" disabled={pending} onClick={() => setDraft(toDraft(coins))}>Desfazer</Button>
          <Button variant="secondary" loading={pending} disabled={!valid} onClick={() => onSave?.(parsed)}>
            Salvar moedas
          </Button>
        </div>
      )}
    </div>
  );
}

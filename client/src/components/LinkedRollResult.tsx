import { ShieldWarning } from '@phosphor-icons/react';
import type { RollPayload } from '@quest-fast/shared';
import { ABILITY_LABELS } from '../lib/5e';
import { isSaveCall } from '../lib/attack-feed';
import { rollActionLabel, rollDecomposition } from '../lib/roll-labels';
import { DiceResult } from './DiceResult';

/**
 * The answer to a roll from the sheet. A save without damage (Graxa) rolled
 * nothing: it shows the DC the target has to beat, not a total of 0.
 */
export function LinkedRollResult({ payload, name }: { payload: RollPayload; name: string }) {
  if (isSaveCall(payload) && payload.save) {
    return (
      <div className="grid min-w-0 justify-items-center gap-2 rounded-control border border-border-strong bg-card p-6 text-center">
        <p className="m-0 flex max-w-full items-center gap-2 text-small text-text-secondary">
          <ShieldWarning size={18} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{payload.attackName} de {name}</span>
        </p>
        <p className="m-0 font-display text-h2 font-semibold">
          Salvaguarda de {ABILITY_LABELS[payload.save.ability]}
        </p>
        <p className="m-0 font-mono text-h1 font-semibold tabular-nums">CD {payload.save.dc}</p>
        <p className="m-0 text-small text-text-secondary">Sem dano: o alvo rola e sofre o efeito se falhar.</p>
      </div>
    );
  }
  return (
    <DiceResult label={`${rollActionLabel(payload)} de ${name}`} total={payload.total}
      decomposition={rollDecomposition(payload)} dice={payload.dice} mode={payload.mode} natural={payload.natural} />
  );
}

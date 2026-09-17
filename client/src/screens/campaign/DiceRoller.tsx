import { useState } from 'react';
import { EyeSlash, DiceFive } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseDiceExpression, type RollMode } from '@quest-fast/shared';
import { Button } from '../../components/Button';
import { DiceResult } from '../../components/DiceResult';
import { Field } from '../../components/Field';
import { QuickDice } from '../../components/QuickDice';
import { RollModeControl } from '../../components/RollModeControl';
import { Surface } from '../../components/Surface';
import { ApiError, api } from '../../lib/api';
import { mergeFeedEvent } from '../../lib/feed-cache';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

export function DiceRoller({ campaignId, isMaster }: { campaignId: string; isMaster: boolean }) {
  const [expression, setExpression] = useState('');
  const [mode, setMode] = useState<RollMode>('normal');
  const [secret, setSecret] = useState(false);
  const [lastExpression, setLastExpression] = useState<string | null>(null);

  const parsed = parseDiceExpression(expression);
  const modeMismatch = mode !== 'normal' && parsed && (parsed.count !== 1 || parsed.sides !== 20);

  const queryClient = useQueryClient();
  const roll = useMutation({
    mutationFn: () => api.roll(campaignId, { expression, mode, secret }),
    onSuccess: ({ event }) => {
      setExpression('');
      setLastExpression(event.payload.expression);
      // The just-created event belongs to the session feed for the table.
      mergeFeedEvent(queryClient, campaignId, event);
    },
  });

  return (
    <section className="dice-panel" aria-labelledby="dice-title">
      <div className="campaign-section-heading">
        <h2 id="dice-title">
          <DiceFive size={20} weight="duotone" aria-hidden="true" /> Dados
        </h2>
      </div>

      <Surface>
        <form
          className="qf-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (parsed) roll.mutate();
          }}
        >
          <QuickDice onPick={setExpression} lastExpression={lastExpression} disabled={roll.isPending} />

          <Field
            label="Expressão"
            hint="Ex.: 1d20+5, 2d6+3"
            placeholder="1d20+5"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            error={
              modeMismatch
                ? 'Vantagem e desvantagem valem apenas para um d20.'
                : roll.isError
                  ? errorMessage(roll.error)
                  : undefined
            }
            aria-label="Expressão de dados"
          />

          <RollModeControl value={mode} onChange={setMode} disabled={roll.isPending} />

          {isMaster && (
            <label className="qf-check">
              <input
                type="checkbox"
                checked={secret}
                onChange={(event) => setSecret(event.target.checked)}
              />
              <EyeSlash size={16} aria-hidden="true" />
              <span>Rolar em segredo (só você vê)</span>
            </label>
          )}

          <Button type="submit" loading={roll.isPending} disabled={!parsed || modeMismatch}>
            <DiceFive size={18} aria-hidden="true" />
            Rolar
          </Button>
        </form>

        {roll.isSuccess && (
          <div className="qf-dice-result">
            <DiceResult
              label={`${roll.data.event.userName} rolou ${roll.data.event.payload.expression}`}
              total={roll.data.event.payload.total}
              decomposition={`${roll.data.event.payload.dice.filter((d) => !d.discarded).map((d) => d.value).join(' + ')}${roll.data.event.payload.modifier !== 0 ? ` ${roll.data.event.payload.modifier > 0 ? '+' : '−'} ${Math.abs(roll.data.event.payload.modifier)}` : ''}`}
              dice={roll.data.event.payload.dice}
              mode={roll.data.event.payload.mode}
              natural={roll.data.event.payload.natural}
            />
          </div>
        )}
      </Surface>
    </section>
  );
}
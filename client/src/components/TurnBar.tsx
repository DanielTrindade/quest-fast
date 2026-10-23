import { useId, useState } from 'react';
import { ArrowCounterClockwise, ArrowRight, DiceFive, FlagCheckered, Play, Sword } from '@phosphor-icons/react';
import type { EncounterStatus } from '@quest-fast/shared';
import { Button } from './Button';
import { ENCOUNTER_STATUS_LABELS } from '../lib/combat-labels';

export type TurnAction = 'start' | 'rollMonsters' | 'next' | 'previous' | 'end';

/** What the announcement says; the same sentence goes to screen readers. */
function turnMessage({ status, round, activeName, activeHidden, ownTurn }: {
  status: EncounterStatus;
  round: number;
  activeName: string | null;
  activeHidden: boolean;
  ownTurn: boolean;
}): string {
  if (status === 'preparing') return 'Encontro em preparação: só você vê.';
  if (status === 'ended') return `Combate encerrado após ${round} ${round === 1 ? 'round' : 'rounds'}.`;
  if (round === 0) return 'Rolando iniciativa.';
  if (ownTurn) return 'É a sua vez.';
  if (activeHidden || !activeName) return 'Vez de outro combatente.';
  return `Vez de ${activeName}.`;
}

/**
 * The bar on top of the encounter: round, whose turn it is and the turn
 * controls each viewer may use. A player gets "Encerrar meu turno" only on
 * their own turn; going back is the master's. The bar only asks — `pending`
 * keeps a turn button busy until the server confirms.
 */
export function TurnBar({
  status,
  round,
  activeName,
  activeHidden = false,
  master,
  ownTurn = false,
  missingInitiative = 0,
  monstersWithoutInitiative = 0,
  pending = null,
  onAction,
}: {
  status: EncounterStatus;
  round: number;
  activeName: string | null;
  activeHidden?: boolean;
  master: boolean;
  ownTurn?: boolean;
  /** Combatants still without initiative; round 1 waits for all of them. */
  missingInitiative?: number;
  /** The ones the master may roll in one go (characters roll their own). */
  monstersWithoutInitiative?: number;
  pending?: TurnAction | null;
  onAction: (action: TurnAction) => void;
}) {
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const missingId = useId();
  const message = turnMessage({ status, round, activeName, activeHidden, ownTurn });
  const busy = pending !== null;
  const classes = ['qf-turn-bar'];
  if (ownTurn && status === 'active' && round > 0) classes.push('is-own-turn');

  return (
    <div className={classes.join(' ')}>
      <div className="qf-turn-bar__status">
        <p className="qf-turn-bar__round">
          {status === 'active' && round > 0 ? `Round ${round}` : ENCOUNTER_STATUS_LABELS[status]}
        </p>
        {/* Announced on every change of turn; respects reduced motion by having none. */}
        <p className="qf-turn-bar__turn" role="status" aria-live="polite">
          {ownTurn && status === 'active' && round > 0 && <Sword size={18} aria-hidden="true" />}
          {message}
        </p>
      </div>

      <div className="qf-turn-bar__actions">
        {master && status === 'preparing' && (
          <Button loading={pending === 'start'} disabled={busy} onClick={() => onAction('start')}>
            <Play size={18} aria-hidden="true" /> Iniciar combate
          </Button>
        )}

        {master && status === 'active' && round === 0 && (
          <>
            {monstersWithoutInitiative > 0 && (
              <Button variant="secondary" loading={pending === 'rollMonsters'} disabled={busy} onClick={() => onAction('rollMonsters')}>
                <DiceFive size={18} aria-hidden="true" /> Rolar iniciativa das criaturas
              </Button>
            )}
            <Button
              loading={pending === 'next'}
              disabled={busy || missingInitiative > 0}
              aria-describedby={missingInitiative > 0 ? missingId : undefined}
              onClick={() => onAction('next')}
            >
              <Play size={18} aria-hidden="true" /> Começar round 1
            </Button>
          </>
        )}

        {master && status === 'active' && round > 0 && (
          <>
            <Button variant="secondary" loading={pending === 'previous'} disabled={busy} onClick={() => onAction('previous')}>
              <ArrowCounterClockwise size={18} aria-hidden="true" /> Voltar turno
            </Button>
            <Button loading={pending === 'next'} disabled={busy} onClick={() => onAction('next')}>
              Próximo turno <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </>
        )}

        {!master && ownTurn && status === 'active' && round > 0 && (
          <Button loading={pending === 'next'} disabled={busy} onClick={() => onAction('next')}>
            Encerrar meu turno <ArrowRight size={18} aria-hidden="true" />
          </Button>
        )}

        {master && status === 'active' && !confirmingEnd && (
          <Button variant="ghost" disabled={busy} onClick={() => setConfirmingEnd(true)}>
            <FlagCheckered size={18} aria-hidden="true" /> Encerrar combate
          </Button>
        )}
        {master && status === 'active' && confirmingEnd && (
          <span className="qf-turn-bar__confirm" role="group" aria-label="Encerrar o combate?">
            <Button variant="danger" loading={pending === 'end'} disabled={busy} onClick={() => onAction('end')}>
              Encerrar e registrar resumo
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingEnd(false)}>Continuar combate</Button>
          </span>
        )}
      </div>

      {master && status === 'active' && round === 0 && missingInitiative > 0 && (
        <p id={missingId} className="qf-turn-bar__hint">
          {missingInitiative === 1 ? 'Falta a iniciativa de 1 combatente.' : `Falta a iniciativa de ${missingInitiative} combatentes.`}
        </p>
      )}
    </div>
  );
}

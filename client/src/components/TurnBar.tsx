import { useId, useState } from 'react';
import { ArrowCounterClockwise, ArrowRight, DiceFive, FlagCheckered, Play, Sword } from '@phosphor-icons/react';
import type { EncounterStatus } from '@quest-fast/shared';
import { Button } from './Button';
import { ENCOUNTER_STATUS_LABELS } from '../lib/combat-labels';

export type TurnAction = 'start' | 'rollMonsters' | 'next' | 'previous' | 'end';

type TurnState = {
  status: EncounterStatus;
  round: number;
  activeName: string | null;
  activeHidden: boolean;
  ownTurn: boolean;
};

type ActionProps = {
  pending: TurnAction | null;
  onAction: (action: TurnAction) => void;
};

/** What the announcement says; the same sentence goes to screen readers. */
function turnMessage({ status, round, activeName, activeHidden, ownTurn }: TurnState): string {
  if (status === 'preparing') return 'Encontro em preparação: só você vê.';
  if (status === 'ended') return `Combate encerrado após ${round} ${round === 1 ? 'round' : 'rounds'}.`;
  if (round === 0) return 'Rolando iniciativa.';
  if (ownTurn) return 'É a sua vez.';
  if (activeHidden || !activeName) return 'Vez de outro combatente.';
  return `Vez de ${activeName}.`;
}

/** Round 0: monsters roll, characters roll their own, then round 1 opens. */
function InitiativeActions({ missingInitiative, monstersWithoutInitiative, pending, onAction }: ActionProps & {
  missingInitiative: number;
  monstersWithoutInitiative: number;
}) {
  const missingId = useId();
  const busy = pending !== null;
  return (
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
      {missingInitiative > 0 && (
        <p id={missingId} className="qf-turn-bar__hint">
          {missingInitiative === 1 ? 'Falta a iniciativa de 1 combatente.' : `Falta a iniciativa de ${missingInitiative} combatentes.`}
        </p>
      )}
    </>
  );
}

function RoundActions({ pending, onAction }: ActionProps) {
  const busy = pending !== null;
  return (
    <>
      <Button variant="secondary" loading={pending === 'previous'} disabled={busy} onClick={() => onAction('previous')}>
        <ArrowCounterClockwise size={18} aria-hidden="true" /> Voltar turno
      </Button>
      <Button loading={pending === 'next'} disabled={busy} onClick={() => onAction('next')}>
        Próximo turno <ArrowRight size={18} aria-hidden="true" />
      </Button>
    </>
  );
}

/** Ending writes the summary to the feed and cannot be undone: two steps. */
function EndCombat({ pending, onAction }: ActionProps) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" disabled={pending !== null} onClick={() => setConfirming(true)}>
        <FlagCheckered size={18} aria-hidden="true" /> Encerrar combate
      </Button>
    );
  }
  return (
    <span className="qf-turn-bar__confirm" role="group" aria-label="Encerrar o combate?">
      <Button variant="danger" loading={pending === 'end'} disabled={pending !== null} onClick={() => onAction('end')}>
        Encerrar e registrar resumo
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>Continuar combate</Button>
    </span>
  );
}

function MasterActions({ status, round, missingInitiative, monstersWithoutInitiative, pending, onAction }: ActionProps & {
  status: EncounterStatus;
  round: number;
  missingInitiative: number;
  monstersWithoutInitiative: number;
}) {
  if (status === 'preparing') {
    return (
      <Button loading={pending === 'start'} disabled={pending !== null} onClick={() => onAction('start')}>
        <Play size={18} aria-hidden="true" /> Iniciar combate
      </Button>
    );
  }
  if (status === 'ended') return null;
  return (
    <>
      {round === 0 ? (
        <InitiativeActions missingInitiative={missingInitiative} monstersWithoutInitiative={monstersWithoutInitiative}
          pending={pending} onAction={onAction} />
      ) : (
        <RoundActions pending={pending} onAction={onAction} />
      )}
      <EndCombat pending={pending} onAction={onAction} />
    </>
  );
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
  const playing = status === 'active' && round > 0;
  const yourTurn = playing && ownTurn;

  return (
    <div className={yourTurn ? 'qf-turn-bar is-own-turn' : 'qf-turn-bar'}>
      <div className="qf-turn-bar__status">
        <p className="qf-turn-bar__round">{playing ? `Round ${round}` : ENCOUNTER_STATUS_LABELS[status]}</p>
        {/* Announced on every change of turn. */}
        <p className="qf-turn-bar__turn" role="status" aria-live="polite">
          {yourTurn && <Sword size={18} aria-hidden="true" />}
          {turnMessage({ status, round, activeName, activeHidden, ownTurn })}
        </p>
      </div>

      <div className="qf-turn-bar__actions">
        {master ? (
          <MasterActions status={status} round={round} missingInitiative={missingInitiative}
            monstersWithoutInitiative={monstersWithoutInitiative} pending={pending} onAction={onAction} />
        ) : (
          yourTurn && (
            <Button loading={pending === 'next'} disabled={pending !== null} onClick={() => onAction('next')}>
              Encerrar meu turno <ArrowRight size={18} aria-hidden="true" />
            </Button>
          )
        )}
      </div>
    </div>
  );
}

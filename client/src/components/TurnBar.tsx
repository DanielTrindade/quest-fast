import { useId, useState, type ReactNode } from 'react';
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

/**
 * The buttons in a row with a hint under them, both at the edge. The hint is
 * a line of its own, not a flex item: as one it would widen the row and push
 * the buttons under the title.
 */
function ActionRow({ hint, hintId, children }: { hint: string | null; hintId: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 justify-items-end gap-1">
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{children}</div>
      {hint && <p id={hintId} className="m-0 text-end text-small text-text-secondary">{hint}</p>}
    </div>
  );
}

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
function InitiativeActions({ missingInitiative, monstersWithoutInitiative, pending, onAction, leading }: ActionProps & {
  missingInitiative: number;
  monstersWithoutInitiative: number;
  leading: ReactNode;
}) {
  const missingId = useId();
  const busy = pending !== null;
  const hint = missingInitiative === 0
    ? null
    : missingInitiative === 1 ? 'Falta a iniciativa de 1 combatente.' : `Falta a iniciativa de ${missingInitiative} combatentes.`;
  return (
    <ActionRow hint={hint} hintId={missingId}>
      {leading}
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
    </ActionRow>
  );
}

/** The first turn of round 1 has nothing before it: going back stays off, with the reason. */
function RoundActions({ canGoBack, pending, onAction, leading }: ActionProps & { canGoBack: boolean; leading: ReactNode }) {
  const noPreviousId = useId();
  const busy = pending !== null;
  return (
    <ActionRow hint={canGoBack ? null : 'Ainda não há turno anterior.'} hintId={noPreviousId}>
      {leading}
      <Button
        variant="secondary"
        loading={pending === 'previous'}
        disabled={busy || !canGoBack}
        aria-describedby={canGoBack ? undefined : noPreviousId}
        onClick={() => onAction('previous')}
      >
        <ArrowCounterClockwise size={18} aria-hidden="true" /> Voltar turno
      </Button>
      <Button loading={pending === 'next'} disabled={busy} onClick={() => onAction('next')}>
        Próximo turno <ArrowRight size={18} aria-hidden="true" />
      </Button>
    </ActionRow>
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
    <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Encerrar o combate?">
      <Button variant="danger" loading={pending === 'end'} disabled={pending !== null} onClick={() => onAction('end')}>
        Encerrar e registrar resumo
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>Continuar combate</Button>
    </span>
  );
}

function MasterActions({ status, round, canGoBack, missingInitiative, monstersWithoutInitiative, pending, onAction }: ActionProps & {
  status: EncounterStatus;
  round: number;
  canGoBack: boolean;
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
  // Ending comes first, so "Próximo turno" stays the last, at the edge.
  const end = <EndCombat pending={pending} onAction={onAction} />;
  return round === 0 ? (
    <InitiativeActions missingInitiative={missingInitiative} monstersWithoutInitiative={monstersWithoutInitiative}
      pending={pending} onAction={onAction} leading={end} />
  ) : (
    <RoundActions canGoBack={canGoBack} pending={pending} onAction={onAction} leading={end} />
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
  canGoBack = true,
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
  /** False on the first turn of round 1, when there is no turn to go back to. */
  canGoBack?: boolean;
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
    <div data-own-turn={yourTurn || undefined} className="group flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-panel border border-border-strong bg-popover px-4 py-3 edge-raised transition-[border-color,box-shadow] duration-(--duration-settle) ease-settle data-own-turn:border-accent-text data-own-turn:shadow-[inset_0_-3px_0_var(--color-accent-text),inset_0_1px_0_var(--color-edge-light)]">
      <div className="grid min-w-0 flex-[1_1_12rem] gap-1">
        <p className="m-0 text-small font-semibold text-text-secondary">{playing ? `Round ${round}` : ENCOUNTER_STATUS_LABELS[status]}</p>
        {/* Announced on every change of turn. */}
        <p className="m-0 flex items-center gap-2 font-display text-h2 font-semibold [overflow-wrap:anywhere] group-data-own-turn:text-accent-text" role="status" aria-live="polite">
          {yourTurn && <Sword size={18} aria-hidden="true" />}
          {turnMessage({ status, round, activeName, activeHidden, ownTurn })}
        </p>
      </div>

      <div className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
        {master ? (
          <MasterActions status={status} round={round} canGoBack={canGoBack} missingInitiative={missingInitiative}
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

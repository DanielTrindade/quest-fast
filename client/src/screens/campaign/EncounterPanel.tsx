import { useState } from 'react';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hasPreviousTurn, type CombatantInput, type EncounterResponse, type EncounterSummaryView, type EncounterView } from '@quest-fast/shared';
import { Button } from '../../components/Button';
import { EncounterSetup } from '../../components/EncounterSetup';
import { InitiativeList } from '../../components/InitiativeList';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { TurnBar, type TurnAction } from '../../components/TurnBar';
import { ApiError, api } from '../../lib/api';
import { encounterQuery, mergeEncounter } from '../../lib/combat-cache';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

/** The combatants sharing a tie with `id`, in queue order, with `id` moved one step. */
function reorderedTie(encounter: EncounterView, id: string, direction: 'up' | 'down'): string[] {
  const target = encounter.combatants.find((combatant) => combatant.id === id)!;
  const ids = encounter.combatants
    .filter((combatant) => combatant.initiative === target.initiative && combatant.dexModifier === target.dexModifier)
    .map((combatant) => combatant.id);
  const from = ids.indexOf(id);
  const to = direction === 'up' ? from - 1 : from + 1;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  return ids;
}

/**
 * The server's rule for "Voltar turno", on what the master sees: the
 * combatants come in queue order, and a monster's band says whether it fell.
 */
function canGoBack(encounter: EncounterView): boolean {
  const order = encounter.combatants
    .filter((combatant) => combatant.hasInitiative)
    .map((combatant) => ({ id: combatant.id, defeated: combatant.source !== 'character' && combatant.healthBand === 'defeated' }));
  return hasPreviousTurn(order, encounter.activeCombatantId, encounter.round);
}

function turnRequest(campaignId: string, encounter: EncounterView, action: TurnAction) {
  if (action === 'start' || action === 'end') return api.encounterAction(campaignId, encounter.id, action);
  if (action === 'rollMonsters') return api.encounterAction(campaignId, encounter.id, 'initiative', {});
  return api.encounterAction(campaignId, encounter.id, 'turn', {
    direction: action,
    // The turn the screen shows; the server answers 409 if it already moved.
    expectedActiveCombatantId: encounter.activeCombatantId,
    expectedRound: encounter.round,
  });
}

function Summary({ summary }: { summary: EncounterSummaryView }) {
  const rounds = `${summary.rounds} ${summary.rounds === 1 ? 'round' : 'rounds'}`;
  const defeated = summary.defeated.length > 0 ? `Derrotados: ${summary.defeated.join(', ')}.` : 'Nenhum derrotado.';
  return (
    <Surface variant="base" className="qf-encounter-panel__summary">
      <p>Encerrado após {rounds}. {defeated}</p>
    </Surface>
  );
}

/** The master's form for combatants: preparation first, reinforcements mid-fight. */
function SetupPanel({ campaignId, encounter, onAdd, pending }: {
  campaignId: string;
  encounter: EncounterView;
  onAdd: (input: CombatantInput) => Promise<unknown>;
  pending: boolean;
}) {
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => api.characters(campaignId) });
  const statblocks = useQuery({ queryKey: ['statblocks', campaignId], queryFn: () => api.statblocks(campaignId) });
  const inEncounter = new Set(encounter.combatants.map((combatant) => combatant.characterId));
  const available = (characters.data?.characters ?? [])
    .filter((character) => !inEncounter.has(character.id))
    .map(({ id, name, ownerName }) => ({ id, name, ownerName }));

  return (
    <Surface className="qf-encounter-panel__setup">
      <h4 className="qf-encounter-panel__subtitle">{encounter.status === 'preparing' ? 'Adicionar combatentes' : 'Reforços'}</h4>
      {characters.isPending || statblocks.isPending ? (
        <Skeleton shape="panel" />
      ) : (
        <EncounterSetup characters={available} statblocks={statblocks.data?.statblocks ?? []}
          reinforcement={encounter.status === 'active'} pending={pending} onAdd={onAdd} />
      )}
    </Surface>
  );
}

function DeleteEncounter({ name, pending, onDelete }: { name: string; pending: boolean; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="qf-encounter-panel__danger">
      {confirming ? (
        <span role="group" aria-label={`Excluir ${name}?`} className="qf-encounter-panel__confirm">
          <Button variant="danger" loading={pending} onClick={onDelete}>Excluir {name}</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Manter</Button>
        </span>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          <Trash size={18} aria-hidden="true" /> Excluir encontro
        </Button>
      )}
    </div>
  );
}

function BackButton({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null;
  return (
    <Button variant="ghost" onClick={onBack}>
      <ArrowLeft size={18} aria-hidden="true" /> Encontros
    </Button>
  );
}

/**
 * Every change the encounter screen asks for. The server answers with the
 * encounter as this viewer may see it; the socket pushes everyone else's
 * changes; both go through `mergeEncounter`, which keeps the newest version.
 * A refusal (a 409 on a turn that already moved, say) refetches the truth
 * instead of guessing.
 */
function useEncounterActions(campaignId: string, encounterId: string) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingTurn, setPendingTurn] = useState<TurnAction | null>(null);

  const apply = (response: EncounterResponse) => {
    setError(null);
    mergeEncounter(queryClient, campaignId, response.encounter);
  };
  const fail = (failure: unknown) => {
    setError(errorMessage(failure));
    void queryClient.invalidateQueries({ queryKey: ['encounter', campaignId, encounterId] });
  };

  const combatant = useMutation({
    mutationFn: ({ run }: { id: string; run: () => Promise<EncounterResponse> }) => run(),
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: apply,
    onError: fail,
    onSettled: () => setBusyId(null),
  });
  const turn = useMutation({
    mutationFn: ({ encounter, action }: { encounter: EncounterView; action: TurnAction }) => turnRequest(campaignId, encounter, action),
    onMutate: ({ action }) => setPendingTurn(action),
    onSuccess: apply,
    onError: fail,
    onSettled: () => setPendingTurn(null),
  });
  const add = useMutation({
    mutationFn: (input: CombatantInput) => api.addCombatant(campaignId, encounterId, input),
    onSuccess: apply,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteEncounter(campaignId, encounterId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['encounter', campaignId, encounterId] });
      void queryClient.invalidateQueries({ queryKey: ['encounters', campaignId] });
    },
    onError: fail,
  });

  return {
    error,
    busyId,
    pendingTurn,
    run: (id: string, request: () => Promise<EncounterResponse>) => combatant.mutate({ id, run: request }),
    turn: (encounter: EncounterView, action: TurnAction) => turn.mutate({ encounter, action }),
    add,
    remove,
  };
}

/** One encounter, live: the turn bar, the queue and, for the master, the setup. */
export function EncounterPanel({ campaignId, encounterId, isMaster, currentUserId, onBack, onDeleted }: {
  campaignId: string;
  encounterId: string;
  isMaster: boolean;
  currentUserId: string;
  onBack?: () => void;
  onDeleted: (name: string) => void;
}) {
  const query = useQuery(encounterQuery(campaignId, encounterId));
  const actions = useEncounterActions(campaignId, encounterId);
  const encounter = query.data?.encounter;

  if (query.isPending) {
    return (
      <div className="qf-stack" role="region" aria-label="Carregando encontro" aria-busy="true">
        <Skeleton width="40%" />
        <Skeleton shape="panel" />
      </div>
    );
  }
  if (!encounter) {
    return (
      <div className="qf-stack">
        <p role="alert" className="text-body text-danger-text">{errorMessage(query.error)}</p>
        <div className="qf-encounter-panel__toolbar">
          <BackButton onBack={onBack} />
          <Button variant="secondary" onClick={() => query.refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const { combatants } = encounter;
  const active = combatants.find((combatant) => combatant.id === encounter.activeCombatantId);
  const path = [campaignId, encounterId] as const;

  return (
    <div className="qf-encounter-panel">
      <div className="qf-encounter-panel__toolbar">
        <BackButton onBack={onBack} />
        <h3 className="qf-encounter-panel__title">{encounter.name}</h3>
      </div>

      <div className="qf-encounter-panel__bar">
        <TurnBar
          status={encounter.status}
          round={encounter.round}
          activeName={active?.name ?? null}
          activeHidden={encounter.activeHidden}
          master={isMaster}
          ownTurn={active?.ownerId === currentUserId}
          canGoBack={canGoBack(encounter)}
          missingInitiative={combatants.filter((combatant) => !combatant.hasInitiative).length}
          monstersWithoutInitiative={combatants.filter((combatant) => combatant.source !== 'character' && !combatant.hasInitiative).length}
          pending={actions.pendingTurn}
          onAction={(action) => actions.turn(encounter, action)}
        />
      </div>

      {actions.error && <p role="alert" className="text-body text-danger-text">{actions.error}</p>}
      {encounter.summary && <Summary summary={encounter.summary} />}

      <InitiativeList
        combatants={combatants}
        activeCombatantId={encounter.activeCombatantId}
        viewerId={currentUserId}
        master={isMaster}
        editable={encounter.status !== 'ended'}
        busyId={actions.busyId}
        onRoll={(id) => actions.run(id, () => api.combatantInitiative(...path, id, {}))}
        onAssign={(id, value) => actions.run(id, () => api.combatantInitiative(...path, id, { value }))}
        onToggleHidden={(id, hidden) => actions.run(id, () => api.updateCombatant(...path, id, { hidden }))}
        onRemove={(id) => actions.run(id, () => api.removeCombatant(...path, id))}
        onMoveTie={(id, direction) => actions.run(id, () => api.setTieOrder(...path, reorderedTie(encounter, id, direction)))}
      />

      {isMaster && encounter.status !== 'ended' && (
        <SetupPanel campaignId={campaignId} encounter={encounter} pending={actions.add.isPending}
          onAdd={(input) => actions.add.mutateAsync(input)} />
      )}
      {isMaster && encounter.status !== 'active' && (
        <DeleteEncounter name={encounter.name} pending={actions.remove.isPending}
          onDelete={() => actions.remove.mutate(undefined, { onSuccess: () => onDeleted(encounter.name) })} />
      )}
    </div>
  );
}

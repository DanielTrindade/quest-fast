import { useState } from 'react';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { CombatantInput, EncounterSummaryView, EncounterView } from '@quest-fast/shared';
import { Button } from '../../components/Button';
import { EncounterSetup } from '../../components/EncounterSetup';
import { InitiativeList } from '../../components/InitiativeList';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { TurnBar } from '../../components/TurnBar';
import { ApiError, api } from '../../lib/api';
import { encounterQuery } from '../../lib/combat-cache';
import { stack } from '../../components/layout-styles';
import { canGoBack, fightActions, useEncounterActions, type EncounterActions } from './encounter-actions';

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

function Summary({ summary }: { summary: EncounterSummaryView }) {
  const rounds = `${summary.rounds} ${summary.rounds === 1 ? 'round' : 'rounds'}`;
  const defeated = summary.defeated.length > 0 ? `Derrotados: ${summary.defeated.join(', ')}.` : 'Nenhum derrotado.';
  return (
    <Surface variant="base" className="[&_p]:m-0">
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
    <Surface className="grid gap-3">
      <h4 className="m-0 font-display text-h2 font-semibold">{encounter.status === 'preparing' ? 'Adicionar combatentes' : 'Reforços'}</h4>
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
    <div className="flex flex-wrap gap-2">
      {confirming ? (
        <span role="group" aria-label={`Excluir ${name}?`} className="flex flex-wrap gap-2">
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

/** The turn bar of one encounter, fed from what the viewer received. */
export function EncounterTurnBar({ encounter, isMaster, currentUserId, actions }: {
  encounter: EncounterView;
  isMaster: boolean;
  currentUserId: string;
  actions: EncounterActions;
}) {
  const { combatants } = encounter;
  const active = combatants.find((combatant) => combatant.id === encounter.activeCombatantId);
  return (
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
  );
}

/**
 * One encounter, live: the turn bar, the queue and, for the master, the
 * setup. On the table (`onTable`) the turn bar and what each one does in the
 * fight live on the action panel, so the queue here is for reading, plus the
 * master's corrections: initiative, ties, hiding and removing.
 */
export function EncounterPanel({ campaignId, encounterId, isMaster, currentUserId, onTable = false, onBack, onDeleted }: {
  campaignId: string;
  encounterId: string;
  isMaster: boolean;
  currentUserId: string;
  onTable?: boolean;
  onBack?: () => void;
  onDeleted: (name: string) => void;
}) {
  const query = useQuery(encounterQuery(campaignId, encounterId));
  const actions = useEncounterActions(campaignId, encounterId);
  const encounter = query.data?.encounter;

  if (query.isPending) {
    return (
      <div className={stack} role="region" aria-label="Carregando encontro" aria-busy="true">
        <Skeleton width="40%" />
        <Skeleton shape="panel" />
      </div>
    );
  }
  if (!encounter) {
    return (
      <div className={stack}>
        <p role="alert" className="text-body text-danger-text">{errorMessage(query.error)}</p>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <BackButton onBack={onBack} />
          <Button variant="secondary" onClick={() => query.refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const { combatants } = encounter;
  const path = [campaignId, encounterId] as const;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <BackButton onBack={onBack} />
        <h3 className="m-0 min-w-0 font-display text-h1 font-semibold [overflow-wrap:anywhere]">{encounter.name}</h3>
      </div>

      {!onTable && (
        <div className="sticky top-2 z-2">
          <EncounterTurnBar encounter={encounter} isMaster={isMaster} currentUserId={currentUserId} actions={actions} />
        </div>
      )}

      {actions.error && <p role="alert" className="text-body text-danger-text">{actions.error}</p>}
      {encounter.summary && <Summary summary={encounter.summary} />}

      <InitiativeList
        combatants={combatants}
        activeCombatantId={encounter.activeCombatantId}
        viewerId={currentUserId}
        master={isMaster}
        editable={encounter.status !== 'ended'}
        busyIds={actions.busyIds}
        onRoll={!onTable || isMaster ? (id) => actions.run(id, () => api.combatantInitiative(...path, id, {})) : undefined}
        onAssign={(id, value) => actions.run(id, () => api.combatantInitiative(...path, id, { value }))}
        onToggleHidden={(id, hidden) => actions.run(id, () => api.updateCombatant(...path, id, { hidden }))}
        onRemove={(id) => actions.run(id, () => api.removeCombatant(...path, id))}
        onMoveTie={(id, direction) => actions.run(id, () => api.setTieOrder(...path, reorderedTie(encounter, id, direction)))}
        {...(onTable ? {} : fightActions(campaignId, encounter, actions))}
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

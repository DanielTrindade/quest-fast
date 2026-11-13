import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hasPreviousTurn, type CombatantInput, type CombatantView, type EncounterResponse, type EncounterView, type HpOperation } from '@quest-fast/shared';
import type { InitiativeActions } from '../../components/InitiativeList';
import type { TurnAction } from '../../components/TurnBar';
import { ApiError, api } from '../../lib/api';
import { mergeEncounter, removeEncounter, settleRequest, startRequest, withHitPoints, type InFlight } from '../../lib/combat-cache';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

/**
 * The server's rule for "Voltar turno", on what the master sees: the
 * combatants come in queue order, and a monster's band says whether it fell.
 */
export function canGoBack(encounter: EncounterView): boolean {
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

/**
 * Every change an encounter screen asks for. The server answers with the
 * encounter as this viewer may see it; the socket pushes everyone else's
 * changes; both go through `mergeEncounter`, which keeps the newest version.
 * A refusal (a 409 on a turn that already moved, say) refetches the truth
 * instead of guessing. The encounter lives in the query cache, so the queue
 * and the table's action panel can each hold one of these without two
 * copies of the fight.
 */
export function useEncounterActions(campaignId: string, encounterId: string) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<InFlight>({});
  const start = (id: string) => setInFlight((current) => startRequest(current, id));
  const settle = (id: string) => setInFlight((current) => settleRequest(current, id));
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
    onMutate: ({ id }) => start(id),
    onSuccess: apply,
    onError: fail,
    onSettled: (_data, _error, { id }) => settle(id),
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
    onSuccess: () => removeEncounter(queryClient, campaignId, encounterId),
    onError: fail,
  });
  // Hit points change on screen at once; a refusal refetches the truth.
  const hitPoints = useMutation({
    mutationFn: ({ id, operation, amount }: { id: string; operation: HpOperation; amount: number; characterId: string | null }) =>
      api.combatantAction(campaignId, encounterId, id, 'hp', 'POST', { operation, amount }),
    onMutate: async ({ id, operation, amount }) => {
      start(id);
      const key = ['encounter', campaignId, encounterId];
      // An answer already on its way must not undo what the screen shows.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<EncounterResponse>(key, (current) =>
        current && { encounter: withHitPoints(current.encounter, id, operation, amount) },
      );
    },
    onSuccess: (response, { characterId }) => {
      apply(response);
      // The screen already showed the change, so the comparison in
      // `mergeEncounter` sees none: the sheet is told here.
      if (characterId) {
        void queryClient.invalidateQueries({ queryKey: ['character', campaignId, characterId] });
        void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
      }
    },
    onError: fail,
    onSettled: (_data, _error, { id }) => settle(id),
  });

  return {
    error,
    busyIds: Object.keys(inFlight),
    pendingTurn,
    run: (id: string, request: () => Promise<EncounterResponse>) => combatant.mutate({ id, run: request }),
    turn: (encounter: EncounterView, action: TurnAction) => turn.mutate({ encounter, action }),
    hitPoints: (target: CombatantView, operation: HpOperation, amount: number) =>
      hitPoints.mutate({ id: target.id, operation, amount, characterId: target.characterId }),
    add,
    remove,
  };
}

export type EncounterActions = ReturnType<typeof useEncounterActions>;

/**
 * What happens to one combatant during the fight. Only while it runs: the
 * server refuses these before the first round and after the end.
 */
export function fightActions(campaignId: string, encounter: EncounterView, actions: EncounterActions): InitiativeActions {
  if (encounter.status !== 'active') return {};
  const act = (id: string, path: string, method: 'POST' | 'PUT' | 'DELETE', body?: Parameters<typeof api.combatantAction>[5]) =>
    actions.run(id, () => api.combatantAction(campaignId, encounter.id, id, path, method, body));
  return {
    onHitPoints: (id, operation, amount) => {
      const target = encounter.combatants.find((combatant) => combatant.id === id);
      if (target) actions.hitPoints(target, operation, amount);
    },
    onApplyCondition: (id, { condition, ...rest }) => act(id, `conditions/${condition}`, 'PUT', rest),
    onRemoveCondition: (id, condition) => act(id, `conditions/${condition}`, 'DELETE'),
    onConcentration: (id, concentrating) => act(id, 'concentration', 'PUT', { concentrating }),
    onDeathSave: (id, mode) => act(id, 'death-save', 'POST', mode === 'normal' ? {} : { mode }),
    onRecordFailure: (id, failures, reminderId) => act(id, 'death-save', 'POST', { failures, reminderId }),
    onConcentrationSave: (id, reminderId) => act(id, 'concentration-save', 'POST', { reminderId }),
    onDismissReminder: (id, reminderId) => act(id, `reminders/${reminderId}`, 'DELETE'),
    // The roll reaches the feed over the socket; a hit leaves its damage pending on the target.
    // `secret` always travels: left out, a monster's attack would fall back to secret.
    onAttack: (id, attackIndex, { targetId, mode, secret }) => act(id, 'attack', 'POST', { attackIndex, targetId, mode, secret }),
    // The target's card is the busy one: that is where the damage lands.
    onApplyDamage: (id, reminderId, amount) =>
      act(id, `reminders/${reminderId}/apply`, 'POST', amount === undefined ? {} : { amount }),
  };
}

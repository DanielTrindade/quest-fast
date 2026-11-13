import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CombatantView, EncounterResponse, TurnEconomyRequest } from '@quest-fast/shared';
import { Surface } from '../../components/Surface';
import { TurnPanel } from '../../components/TurnPanel';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { mergeEncounter } from '../../lib/combat-cache';
import { errorMessage } from './campaign-screen';
import type { Fight } from './useFight';

/**
 * The turn beside the map in a fight: for a player, their own character's;
 * for the master, the selected token's combatant, else the one whose turn it
 * is. Spending, giving back and granting go to the server, which answers
 * with the encounter; the socket brings the rest of the table along.
 */
export function FightTurn({ campaignId, fight, focus, viewerId, isMaster }: {
  campaignId: string;
  fight: Fight;
  /** The combatant of the selected token, if any. */
  focus: CombatantView | null;
  viewerId: string | null;
  isMaster: boolean;
}) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { encounter } = fight;
  const own = encounter.combatants.find((combatant) => combatant.ownerId !== null && combatant.ownerId === viewerId && combatant.turn);
  const combatant = isMaster ? (focus ?? fight.active) : own ?? null;

  const apply = ({ encounter: saved }: EncounterResponse) => mergeEncounter(queryClient, campaignId, saved);
  const fail = (title: string) => (error: unknown) => notify({ title, description: errorMessage(error), variant: 'error' });
  const economy = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TurnEconomyRequest }) => api.combatantEconomy(campaignId, encounter.id, id, body),
    onSuccess: apply,
    onError: fail('Não foi possível mudar o turno'),
  });
  const adjust = useMutation({
    mutationFn: ({ id, speed, attacksPerAction }: { id: string; speed: number; attacksPerAction: number }) =>
      api.updateCombatant(campaignId, encounter.id, id, { speed, attacksPerAction }),
    onSuccess: apply,
    onError: fail('Não foi possível ajustar o combatente'),
  });

  if (!combatant?.turn) return null;
  const { id } = combatant;
  const pending = economy.isPending
    ? ('spend' in economy.variables.body ? economy.variables.body.spend : 'grant' in economy.variables.body ? 'grant' : 'refund')
    : adjust.isPending ? 'adjust' : null;

  return (
    <Surface className="min-w-0">
      <TurnPanel name={combatant.name} turn={combatant.turn} ownTurn={encounter.activeCombatantId === id}
        canAct={isMaster || combatant.ownerId === viewerId} master={isMaster} pending={pending}
        onSpend={(spend) => economy.mutate({ id, body: { spend } })}
        onRefund={(refund) => economy.mutate({ id, body: { refund } })}
        onGrant={() => economy.mutate({ id, body: { grant: 'action' } })}
        adjust={isMaster && combatant.source !== 'character' && combatant.speed !== null && combatant.attacksPerAction !== null
          ? { speed: combatant.speed, attacksPerAction: combatant.attacksPerAction, onSave: (values) => adjust.mutate({ id, ...values }) }
          : undefined} />
    </Surface>
  );
}

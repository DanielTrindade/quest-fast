import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CombatantView, EncounterView, HitPointMode, TokenView } from '@quest-fast/shared';
import { TokenVitals } from '../../components/TokenVitals';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { encounterQuery, encountersQuery, mergeEncounter } from '../../lib/combat-cache';
import { errorMessage } from './campaign-screen';
import { useEncounterActions, type EncounterActions } from './encounter-actions';

/**
 * Where a token is read from, and where a free one would join. A combatant's
 * token reads its own encounter (the master knows which, in preparation or
 * ended too); a character's, the running one. A free token joins the running
 * encounter or, for the master, the one in preparation. The same queries the
 * combat screens use, so the socket keeps them in step.
 */
function useTokenEncounter(campaignId: string, token: TokenView | undefined, isMaster: boolean) {
  const list = useQuery(encountersQuery(campaignId));
  const encounters = list.data?.encounters ?? [];
  const open = encounters.find((encounter) => encounter.status === 'active')
    ?? (isMaster ? encounters.find((encounter) => encounter.status === 'preparing') : undefined);
  const readId = token?.encounterId ?? open?.id;
  const detail = useQuery({ ...encounterQuery(campaignId, readId ?? ''), enabled: readId !== undefined });
  return { open, encounter: detail.data?.encounter };
}

function combatantOf(encounter: EncounterView | undefined, token: TokenView): CombatantView | null {
  return encounter?.combatants.find((candidate) =>
    (token.characterId !== null && candidate.characterId === token.characterId) || candidate.id === token.combatantId) ?? null;
}

/** The server changes hit points only while the fight runs, for the master or the owner of the character. */
function adjustOf(encounter: EncounterView | undefined, combatant: CombatantView | null, actions: EncounterActions, isMaster: boolean, viewerId: string | null) {
  if (!combatant || encounter?.status !== 'active') return undefined;
  if (!isMaster && (combatant.ownerId === null || combatant.ownerId !== viewerId)) return undefined;
  return {
    pending: actions.busyIds.includes(combatant.id),
    // A refused change is undone on the screen: it says why.
    error: actions.error,
    onApply: (operation: Parameters<EncounterActions['hitPoints']>[1], amount: number) => actions.hitPoints(combatant, operation, amount),
  };
}

/**
 * The selected token's hit points beside the map. A free token from the
 * bestiary is put in the open encounter by the master; the server answers
 * with it and the scene follows by the socket. Nothing without a selection.
 */
export function TokenVitalsPanel({ campaignId, tokens, selectedId, isMaster, viewerId }: {
  campaignId: string;
  tokens: TokenView[];
  selectedId: string | null;
  isMaster: boolean;
  viewerId: string | null;
}) {
  const token = tokens.find((candidate) => candidate.id === selectedId);
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { open, encounter } = useTokenEncounter(campaignId, token, isMaster);
  const actions = useEncounterActions(campaignId, encounter?.id ?? '');
  const statblockId = token?.kind === 'free' ? token.statblockId : null;
  const statblock = useQuery({
    queryKey: ['statblock', campaignId, statblockId],
    queryFn: () => api.statblock(campaignId, statblockId!),
    enabled: isMaster && statblockId !== null,
  });
  const join = useMutation({
    mutationFn: ({ tokenId, hp }: { tokenId: string; hp: HitPointMode }) =>
      api.addCombatant(campaignId, open!.id, { source: 'token', tokenId, hp }),
    onSuccess: ({ encounter: saved }) => mergeEncounter(queryClient, campaignId, saved),
    onError: (error) => notify({ title: 'Não foi possível pôr o token no combate', description: errorMessage(error), variant: 'error' }),
  });
  if (!token) return null;

  const combatant = combatantOf(encounter, token);
  const joinable = isMaster && statblockId !== null && !combatant;
  return (
    <TokenVitals name={combatant?.name ?? token.name} vitals={combatant}
      adjust={adjustOf(encounter, combatant, actions, isMaster, viewerId)}
      join={joinable
        ? {
          encounterName: open?.name ?? null,
          hasFormula: Boolean(statblock.data?.statblock.hpFormula),
          pending: join.isPending,
          onJoin: (hp) => join.mutate({ tokenId: token.id, hp }),
        }
        : undefined} />
  );
}

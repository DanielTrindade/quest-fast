import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { CastChoice, CharacterResponse, CombatantView, EncounterView, LinkedRollRequest, RollPayload } from '@quest-fast/shared';
import { ActionPanel, type ActionPanelSignal, type ActionPanelTab } from '../../components/ActionPanel';
import type { InitiativeActions } from '../../components/InitiativeList';
import { Button as ActionButton } from '../../components/Button';
import { MasterActions } from '../../components/MasterActions';
import { pendingDamageCount } from '../../lib/combatant-state';
import { PlayerActions } from '../../components/PlayerActions';
import { Skeleton } from '../../components/Skeleton';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { encounterQuery, encountersQuery } from '../../lib/combat-cache';
import { mergeFeedEvent } from '../../lib/feed-cache';
import { errorMessage } from './campaign-screen';
import { CharacterSheetDialog } from './CharacterSheetDialog';
import { DiceRoller } from './DiceRoller';
import { fightActions, useEncounterActions } from './encounter-actions';
import { EncounterTurnBar } from './EncounterPanel';
import { SessionFeed } from './SessionFeed';
import { TableChat } from './TableChat';
import { useChatUnread } from './useChatUnread';

/** What the panel may do in the fight in progress, with the queue's own requests. */
function useFight(campaignId: string) {
  const encounters = useQuery(encountersQuery(campaignId));
  const activeId = encounters.data?.encounters.find((encounter) => encounter.status === 'active')?.id ?? null;
  const query = useQuery({ ...encounterQuery(campaignId, activeId ?? ''), enabled: activeId !== null });
  const actions = useEncounterActions(campaignId, activeId ?? '');
  const encounter: EncounterView | null = activeId && query.data?.encounter.id === activeId ? query.data.encounter : null;
  const handlers: InitiativeActions = encounter
    ? {
        ...fightActions(campaignId, encounter, actions),
        onRoll: (id) => actions.run(id, () => api.combatantInitiative(campaignId, encounter.id, id, {})),
        onToggleHidden: (id, hidden) => actions.run(id, () => api.updateCombatant(campaignId, encounter.id, id, { hidden })),
      }
    : {};
  return { encounter, actions, handlers };
}

/** The player's active character in this campaign, its sheet and its linked rolls. */
function useOwnCharacter(campaignId: string, currentUserId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => api.characters(campaignId), enabled });
  const own = characters.data?.characters.find((character) => character.ownerId === currentUserId && character.active) ?? null;
  const sheet = useQuery({
    queryKey: ['character', campaignId, own?.id ?? ''],
    queryFn: () => api.character(campaignId, own!.id),
    enabled: enabled && own !== null,
  });
  const [lastRoll, setLastRoll] = useState<RollPayload | null>(null);
  const roll = useMutation({
    mutationFn: (request: LinkedRollRequest) => api.characterRoll(campaignId, own!.id, request),
    onSuccess: ({ event }) => {
      setLastRoll(event.payload);
      // The roll belongs to the whole table's feed; the socket brings it to everyone else.
      mergeFeedEvent(queryClient, campaignId, event);
    },
  });
  // The answer is the whole sheet: it replaces the cached one under its own
  // id, never the character active now (another tab may have switched it),
  // and the roster and the fight refresh from the socket like any change.
  const keepSheet = (response: CharacterResponse) => {
    queryClient.setQueryData(['character', response.character.campaignId, response.character.id], { character: response.character });
  };
  const slots = useMutation({
    mutationFn: ({ characterId, spent }: { characterId: string; spent: number[] }) =>
      api.updateCharacterState(campaignId, characterId, { spellSlotsSpent: spent }),
    onSuccess: keepSheet,
  });
  const cast = useMutation({
    mutationFn: ({ characterId, spellIndex, spellName, choice }: { characterId: string; spellIndex: number; spellName: string; choice: CastChoice }) =>
      api.castSpell(campaignId, characterId, { spellIndex, spellName, ...choice }),
    onSuccess: (response) => {
      keepSheet(response);
      mergeFeedEvent(queryClient, campaignId, response.event);
    },
  });
  return { characters, own, sheet, roll, lastRoll, slots, cast };
}

function LoadFailure({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div className="grid justify-items-start gap-3">
      <p role="alert" className="m-0 text-body text-danger-text">{message}</p>
      <ActionButton variant="secondary" loading={retrying} onClick={onRetry}>Tentar novamente</ActionButton>
    </div>
  );
}

type Fight = ReturnType<typeof useFight>;
type OwnCharacter = ReturnType<typeof useOwnCharacter>;

function ownCombatantOf(encounter: EncounterView | null, own: OwnCharacter['own']): CombatantView | null {
  if (!encounter || !own) return null;
  return encounter.combatants.find((combatant) => combatant.characterId === own.id) ?? null;
}

/** The master's dot: hits waiting to be applied. The player's: their own turn. */
function panelSignal(isMaster: boolean, encounter: EncounterView | null, ownCombatant: CombatantView | null): ActionPanelSignal | null {
  if (!encounter) return null;
  if (isMaster) {
    const pending = pendingDamageCount(encounter.combatants);
    if (pending === 0) return null;
    return { tone: 'alert', count: pending, label: pending === 1 ? '1 dano pendente' : `${pending} danos pendentes` };
  }
  const ownTurn = ownCombatant !== null && encounter.round > 0 && encounter.activeCombatantId === ownCombatant.id;
  return ownTurn ? { tone: 'turn', label: 'sua vez' } : null;
}

function TurnHeader({ fight, isMaster, currentUserId }: { fight: Fight; isMaster: boolean; currentUserId: string }) {
  const { encounter, actions } = fight;
  if (!encounter) return null;
  return (
    <div className="grid min-w-0 gap-2 [&_[data-slot=turn-message]]:line-clamp-2">
      <p className="m-0 text-small text-text-secondary [overflow-wrap:anywhere]">{encounter.name}</p>
      <EncounterTurnBar encounter={encounter} isMaster={isMaster} currentUserId={currentUserId} actions={actions} />
      {actions.error && <p role="alert" className="m-0 text-small text-danger-text">{actions.error}</p>}
    </div>
  );
}

function MasterPanel({ campaignId, fight }: { campaignId: string; fight: Fight }) {
  const { encounter, actions, handlers } = fight;
  return (
    <MasterActions
      emptyAction={(
        <Button asChild variant="secondary">
          <Link to="/campaigns/$campaignId/prep" params={{ campaignId }}>Ir para o Preparo</Link>
        </Button>
      )}
      fight={encounter && { name: encounter.name, combatants: encounter.combatants, activeCombatantId: encounter.activeCombatantId, busyIds: actions.busyIds, actions: handlers }} />
  );
}

function PlayerPanel({ campaignId, currentUserId, fight, player, ownCombatant }: {
  campaignId: string;
  currentUserId: string;
  fight: Fight;
  player: OwnCharacter;
  ownCombatant: CombatantView | null;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { encounter, actions, handlers } = fight;
  const { characters, own, sheet, roll, slots, cast } = player;
  const spellError = cast.isError ? errorMessage(cast.error) : slots.isError ? errorMessage(slots.error) : null;
  if (characters.isPending) return <Skeleton shape="panel" label="Carregando seu personagem…" />;
  if (characters.isError) {
    return <LoadFailure message="Não foi possível carregar seu personagem." retrying={characters.isFetching} onRetry={() => { void characters.refetch(); }} />;
  }
  return (
    <>
      <PlayerActions
        character={own}
        sheet={sheet.data?.character}
        sheetError={sheet.isError ? errorMessage(sheet.error) : null}
        retryingSheet={sheet.isFetching}
        onRetrySheet={() => { void sheet.refetch(); }}
        fight={ownCombatant && encounter ? {
          combatant: ownCombatant,
          targets: encounter.combatants.filter((combatant) => combatant.id !== ownCombatant.id),
          active: encounter.activeCombatantId === ownCombatant.id,
          busy: actions.busyIds.includes(ownCombatant.id),
          actions: handlers,
        } : null}
        inOtherFight={encounter !== null && ownCombatant === null}
        rolling={roll.isPending}
        rollError={roll.isError ? errorMessage(roll.error) : null}
        lastRoll={player.lastRoll}
        onRoll={(request) => roll.mutate(request)}
        onOpenSheet={() => setSheetOpen(true)}
        spellcasting={{
          pending: slots.isPending || cast.isPending,
          error: spellError,
          onChangeSlots: (spent) => { if (!own) return; cast.reset(); slots.mutate({ characterId: own.id, spent }); },
          onCast: (spellIndex, spellName, choice) => {
            if (!own) return;
            slots.reset();
            cast.mutate({ characterId: own.id, spellIndex, spellName, choice });
          },
        }}
        galleryAction={(
          <Button asChild variant="secondary">
            <Link to="/characters">Meus personagens</Link>
          </Button>
        )} />
      {own && sheetOpen && (
        <CharacterSheetDialog campaignId={campaignId} characterId={own.id} currentUserId={currentUserId} isMaster={false}
          open onOpenChange={setSheetOpen} onDeleted={() => setSheetOpen(false)} />
      )}
    </>
  );
}

/**
 * The table's side panel, wired: the turn on top, then the role's actions,
 * the free dice, while a map takes the middle the feed, and the table chat. Every request
 * goes through the same mutations as the queue, and the encounter is the one
 * in the query cache: nothing about the fight is held twice.
 */
export function TableActionPanel({ campaignId, isMaster, currentUserId, withFeed, className }: {
  campaignId: string;
  isMaster: boolean;
  currentUserId: string;
  /** False while the feed sits in the middle of the table, with no map open. */
  withFeed: boolean;
  className?: string;
}) {
  const [tab, setTab] = useState<ActionPanelTab>('actions');
  const fight = useFight(campaignId);
  const player = useOwnCharacter(campaignId, currentUserId, !isMaster);
  const ownCombatant = ownCombatantOf(fight.encounter, player.own);
  const chatUnread = useChatUnread(campaignId, currentUserId, tab === 'chat');

  return (
    <ActionPanel className={className} tab={tab} onTabChange={setTab}
      actionsSignal={panelSignal(isMaster, fight.encounter, ownCombatant)}
      header={<TurnHeader fight={fight} isMaster={isMaster} currentUserId={currentUserId} />}
      actions={isMaster
        ? <MasterPanel campaignId={campaignId} fight={fight} />
        : <PlayerPanel campaignId={campaignId} currentUserId={currentUserId} fight={fight} player={player} ownCombatant={ownCombatant} />}
      dice={<DiceRoller campaignId={campaignId} isMaster={isMaster} framed={false} />}
      feed={withFeed ? <SessionFeed campaignId={campaignId} currentUserId={currentUserId} framed={false} /> : undefined}
      chat={<TableChat campaignId={campaignId} viewerId={currentUserId} isMaster={isMaster} />}
      chatUnread={chatUnread} />
  );
}

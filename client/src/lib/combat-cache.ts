import type { QueryClient } from '@tanstack/react-query';
import type { EncounterListItem, EncounterListResponse, EncounterResponse, EncounterView } from '@quest-fast/shared';
import { api } from './api';

const encounterKey = (campaignId: string, encounterId: string) => ['encounter', campaignId, encounterId] as const;

function knownEncounter(queryClient: QueryClient, campaignId: string, encounterId: string): EncounterView | undefined {
  return queryClient.getQueryData<EncounterResponse>(encounterKey(campaignId, encounterId))?.encounter;
}

/** A detail invalidated on reconnect may have missed updates; only a live one beats the list. */
function liveEncounter(queryClient: QueryClient, campaignId: string, encounterId: string): EncounterView | undefined {
  const key = encounterKey(campaignId, encounterId);
  return queryClient.getQueryState(key)?.isInvalidated ? undefined : knownEncounter(queryClient, campaignId, encounterId);
}

function listItem(item: EncounterListItem, encounter: EncounterView): EncounterListItem {
  return {
    ...item,
    name: encounter.name,
    status: encounter.status,
    round: encounter.round,
    endedAt: encounter.endedAt,
    combatantCount: encounter.combatants.length,
  };
}

/**
 * Shared by the section and the navigation: a player sees combat once there
 * is one. The list carries no version, so an answer that left before a live
 * update takes each encounter's state from the detail the socket keeps fresh.
 */
export const encountersQuery = (campaignId: string) => ({
  queryKey: ['encounters', campaignId],
  queryFn: async ({ client }: { client: QueryClient }): Promise<EncounterListResponse> => {
    const { encounters } = await api.encounters(campaignId);
    return {
      encounters: encounters.map((item) => {
        const known = liveEncounter(client, campaignId, item.id);
        return known ? listItem(item, known) : item;
      }),
    };
  },
});

/** One encounter; a GET answered after a newer live update keeps the update. */
export const encounterQuery = (campaignId: string, encounterId: string) => ({
  queryKey: encounterKey(campaignId, encounterId),
  queryFn: async ({ client }: { client: QueryClient }): Promise<EncounterResponse> => {
    const fresh = await api.encounter(campaignId, encounterId);
    const known = knownEncounter(client, campaignId, encounterId);
    return known && known.version > fresh.encounter.version ? { encounter: known } : fresh;
  },
});

/**
 * Takes an encounter from the socket or from a mutation's answer. Messages can
 * cross on the wire, so one older than the `version` already held is dropped
 * whole, from the detail and from the list: the screen never steps back to a
 * turn that has passed.
 */
export function mergeEncounter(queryClient: QueryClient, campaignId: string, encounter: EncounterView): void {
  const known = knownEncounter(queryClient, campaignId, encounter.id);
  if (known && known.version > encounter.version) return;
  queryClient.setQueryData<EncounterResponse>(encounterKey(campaignId, encounter.id), { encounter });

  const list = queryClient.getQueryData<EncounterListResponse>(['encounters', campaignId]);
  if (!list?.encounters.some((item) => item.id === encounter.id)) {
    // A combat that just started is news to a player: the list learns it from the server.
    void queryClient.invalidateQueries({ queryKey: ['encounters', campaignId] });
    return;
  }
  queryClient.setQueryData<EncounterListResponse>(['encounters', campaignId], {
    encounters: list.encounters.map((item) => (item.id === encounter.id ? listItem(item, encounter) : item)),
  });
}

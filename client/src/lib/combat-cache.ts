import type { QueryClient } from '@tanstack/react-query';
import type { EncounterListItem, EncounterListResponse, EncounterResponse, EncounterView } from '@quest-fast/shared';
import { api } from './api';

const encounterKey = (campaignId: string, encounterId: string) => ['encounter', campaignId, encounterId] as const;

/**
 * Encounters deleted while this tab was open. A deletion is final, so the ids
 * outlive the cache: no answer that left before it may bring one back.
 */
const deletedEncounters = new Set<string>();

export function isDeletedEncounter(encounterId: string): boolean {
  return deletedEncounters.has(encounterId);
}

function knownEncounter(queryClient: QueryClient, campaignId: string, encounterId: string): EncounterView | undefined {
  return queryClient.getQueryData<EncounterResponse>(encounterKey(campaignId, encounterId))?.encounter;
}

/**
 * The detail, if it changed after `since`. A detail from an earlier visit may
 * have missed updates while the socket was closed: only one that arrived
 * during the list's GET is newer than its answer.
 */
function updatedSince(queryClient: QueryClient, campaignId: string, encounterId: string, since: number): EncounterView | undefined {
  const updatedAt = queryClient.getQueryState(encounterKey(campaignId, encounterId))?.dataUpdatedAt ?? 0;
  return updatedAt > since ? knownEncounter(queryClient, campaignId, encounterId) : undefined;
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
 * is one. The list carries no version, so an encounter updated live while
 * the GET was out keeps that update.
 */
export const encountersQuery = (campaignId: string) => ({
  queryKey: ['encounters', campaignId],
  queryFn: async ({ client }: { client: QueryClient }): Promise<EncounterListResponse> => {
    const startedAt = Date.now();
    const { encounters } = await api.encounters(campaignId);
    return {
      // A GET sent before a deletion still lists the encounter; it stays gone.
      encounters: encounters.filter((item) => !isDeletedEncounter(item.id)).map((item) => {
        const known = updatedSince(client, campaignId, item.id, startedAt);
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
  if (isDeletedEncounter(encounter.id) || (known && known.version > encounter.version)) return;
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

/**
 * Drops an encounter the master deleted. The list goes first: the section
 * leaves the encounter before its detail is gone, so the open panel never
 * asks the server for it again.
 */
export function removeEncounter(queryClient: QueryClient, campaignId: string, encounterId: string): void {
  deletedEncounters.add(encounterId);
  const list = queryClient.getQueryData<EncounterListResponse>(['encounters', campaignId]);
  if (list) {
    queryClient.setQueryData<EncounterListResponse>(['encounters', campaignId], {
      encounters: list.encounters.filter((item) => item.id !== encounterId),
    });
  }
  queryClient.removeQueries({ queryKey: encounterKey(campaignId, encounterId) });
}

import type { QueryClient } from '@tanstack/react-query';
import type { EncounterListResponse, EncounterResponse, EncounterView } from '@quest-fast/shared';
import { api } from './api';

/** Shared by the section and the navigation: a player sees combat once there is one. */
export const encountersQuery = (campaignId: string) => ({
  queryKey: ['encounters', campaignId],
  queryFn: () => api.encounters(campaignId),
});

/**
 * Takes an encounter from the socket or from a mutation's answer. Messages can
 * cross on the wire, so one older than the `version` already held is dropped:
 * the screen never steps back to a turn that has passed.
 */
export function mergeEncounter(queryClient: QueryClient, campaignId: string, encounter: EncounterView): void {
  queryClient.setQueryData<EncounterResponse>(['encounter', campaignId, encounter.id], (current) =>
    current && current.encounter.version > encounter.version ? current : { encounter },
  );

  const list = queryClient.getQueryData<EncounterListResponse>(['encounters', campaignId]);
  const listed = list?.encounters.some((item) => item.id === encounter.id);
  if (!list || !listed) {
    // A combat that just started is news to a player: the list learns it from the server.
    void queryClient.invalidateQueries({ queryKey: ['encounters', campaignId] });
    return;
  }
  queryClient.setQueryData<EncounterListResponse>(['encounters', campaignId], {
    encounters: list.encounters.map((item) =>
      item.id === encounter.id
        ? {
            ...item,
            name: encounter.name,
            status: encounter.status,
            round: encounter.round,
            endedAt: encounter.endedAt,
            combatantCount: encounter.combatants.length,
          }
        : item,
    ),
  });
}

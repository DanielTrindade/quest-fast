import { useMemo, type RefObject } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKEN_LIMITS, type SceneView, type Size } from '@quest-fast/shared';
import { Button } from '../../components/Button';
import type { MapCanvasHandle } from '../../components/MapCanvas';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { TokenPicker, type PickerEncounter } from '../../components/TokenPicker';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { encounterQuery, encountersQuery } from '../../lib/combat-cache';
import { mergeScene } from '../../lib/scene-cache';
import { errorMessage } from './campaign-screen';

type Placement =
  | { kind: 'character'; characterId: string }
  | { kind: 'combatant'; combatantId: string }
  | { kind: 'statblock'; statblockId: string }
  | { kind: 'free'; label: string; size: Size }
  | { kind: 'encounter'; encounterId: string };

/**
 * The master's picker beside the map, fed by the campaign's characters, the
 * encounters not yet over and the bestiary. What it puts lands at the centre
 * of the area the master is viewing; the server snaps it to the grid.
 */
export function TokenPickerPanel({ id, campaignId, scene, mapRef }: {
  id: string;
  campaignId: string;
  scene: SceneView;
  mapRef: RefObject<MapCanvasHandle | null>;
}) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => api.characters(campaignId) });
  const statblocks = useQuery({ queryKey: ['statblocks', campaignId], queryFn: () => api.statblocks(campaignId) });
  const encounterList = useQuery(encountersQuery(campaignId));
  const open = (encounterList.data?.encounters ?? []).filter((encounter) => encounter.status !== 'ended');
  const details = useQueries({ queries: open.map((encounter) => encounterQuery(campaignId, encounter.id)) });

  const place = useMutation({
    mutationFn: (placement: Placement) => {
      const centre = mapRef.current?.viewCentre() ?? { x: scene.mapWidth / 2, y: scene.mapHeight / 2 };
      return placement.kind === 'encounter'
        ? api.placeEncounter(campaignId, scene.id, { encounterId: placement.encounterId, ...centre })
        : api.createToken(campaignId, scene.id, { ...placement, ...centre });
    },
    onSuccess: ({ scene: saved }) => mergeScene(queryClient, campaignId, saved),
    onError: (error) => notify({ title: 'Não foi possível pôr no mapa', description: errorMessage(error), variant: 'error' }),
  });

  const onSceneCharacters = useMemo(() => new Set(scene.tokens.flatMap((token) => (token.characterId ? [token.characterId] : []))), [scene.tokens]);
  const onSceneCombatants = useMemo(() => new Set(scene.tokens.flatMap((token) => (token.combatantId ? [token.combatantId] : []))), [scene.tokens]);

  const encounters: PickerEncounter[] = open.map((summary, index) => ({
    id: summary.id,
    name: summary.name,
    active: summary.status === 'active',
    combatants: (details[index]?.data?.encounter.combatants ?? []).map((combatant) => ({
      id: combatant.id,
      name: combatant.name,
      hidden: combatant.hidden,
      character: combatant.source === 'character',
      // A character in the fight is drawn by its own token.
      onScene: combatant.characterId ? onSceneCharacters.has(combatant.characterId) : onSceneCombatants.has(combatant.id),
    })),
  }));

  // The combatants come from each encounter's detail: one still loading or
  // failed must not read as "all of them are on the map".
  const sources = [characters, statblocks, encounterList, ...details];
  const loading = sources.some((query) => query.isPending);
  // Only a first load that failed: a failed refresh keeps what it had.
  const failedQueries = sources.filter((query) => query.isLoadingError);
  const failed = !loading && failedQueries.length > 0;

  return (
    <Surface id={id} className="min-w-0 self-start">
      <h3 className="mb-4 font-display text-h2 font-semibold">Pôr no mapa</h3>
      {loading && <Skeleton shape="panel" label="Carregando personagens, encontros e bestiário…" />}
      {failed && (
        <div className="grid justify-items-start gap-3">
          <p role="alert" className="m-0 text-small text-danger-text">{errorMessage(failedQueries[0].error)}</p>
          <Button variant="secondary" loading={failedQueries.some((query) => query.isFetching)}
            onClick={() => { for (const query of failedQueries) void query.refetch(); }}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!loading && !failed && (
        <TokenPicker
          characters={(characters.data?.characters ?? []).map((character) => ({
            id: character.id,
            name: character.name,
            ownerName: character.ownerName,
            avatarUrl: character.avatarUrl,
            onScene: onSceneCharacters.has(character.id),
          }))}
          encounters={encounters}
          statblocks={(statblocks.data?.statblocks ?? []).map(({ id: statblockId, name, size }) => ({ id: statblockId, name, size }))}
          onAddCharacter={(characterId) => place.mutate({ kind: 'character', characterId })}
          onAddCombatant={(combatantId) => place.mutate({ kind: 'combatant', combatantId })}
          onPlaceEncounter={(encounterId) => place.mutate({ kind: 'encounter', encounterId })}
          onAddStatblock={(statblockId) => place.mutate({ kind: 'statblock', statblockId })}
          onAddFree={(token) => place.mutate({ kind: 'free', ...token })}
          full={scene.tokens.length >= TOKEN_LIMITS.perScene}
          busy={place.isPending}
        />
      )}
    </Surface>
  );
}

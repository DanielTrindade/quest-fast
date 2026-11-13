import type { QueryClient } from '@tanstack/react-query';
import type { SceneListResponse, SceneResponse, SceneSummary, SceneView } from '@quest-fast/shared';
import { ApiError, api } from './api';

/** Everything about the campaign's scenes, so a reconnect asks for it all again. */
export const scenesKey = (campaignId: string) => ['scenes', campaignId] as const;
const listKey = (campaignId: string) => ['scenes', campaignId, 'list'] as const;
const activeKey = (campaignId: string) => ['scenes', campaignId, 'active'] as const;
const detailKey = (campaignId: string, sceneId: string) => ['scenes', campaignId, 'detail', sceneId] as const;

/*
 * Answers and pushes cross on the way: a GET sent before a change may land
 * after it. What this tab learned last always wins, so a late answer never
 * brings back a closed map, an older version or a deleted scene. Versions only
 * grow and deletions are final, so this record outlives the cache.
 */

/** A counter, not the clock: two changes in the same millisecond still have an order. */
let clock = 0;
/** The newest version seen of each scene, from a push or an answer. */
const seen = new Map<string, number>();
/** Scenes deleted while this tab was open. */
const deleted = new Set<string>();
/**
 * When each scene last arrived here whole, by a push or a mutation's answer.
 * Only a scene that arrived can be kept over an answer that lacks it; one
 * merely closed (`scene.closed`) may have been deleted elsewhere.
 */
const mergedAt = new Map<string, number>();
/** When the scene open for each campaign's table last changed here. */
const tableChangedAt = new Map<string, number>();

const changedSince = (map: Map<string, number>, key: string, asked: number) => (map.get(key) ?? 0) > asked;

function see(scene: SceneView): void {
  seen.set(scene.id, Math.max(seen.get(scene.id) ?? -1, scene.version));
}

/** The master's list of scenes. */
export const sceneListQuery = (campaignId: string) => ({
  queryKey: listKey(campaignId),
  queryFn: async ({ client }: { client: QueryClient }): Promise<SceneListResponse> => {
    const asked = clock;
    const fresh = await api.scenes(campaignId);
    const known = client.getQueryData<SceneListResponse>(listKey(campaignId))?.scenes ?? [];
    const knownRow = (id: string) => known.find((row) => row.id === id);
    const changed = (id: string) => changedSince(mergedAt, id, asked);
    // Arrived while the GET was out (created, say): the answer does not have it yet.
    const added = known.filter((row) => changed(row.id) && !fresh.scenes.some((item) => item.id === row.id));
    let scenes = [...added, ...fresh.scenes]
      .filter((row) => !deleted.has(row.id))
      .map((row) => (changed(row.id) ? (knownRow(row.id) ?? row) : row));
    if (changedSince(tableChangedAt, campaignId, asked)) {
      const open = client.getQueryData<SceneView | null>(activeKey(campaignId));
      scenes = scenes.map((row) => ({ ...row, active: row.id === open?.id }));
    }
    return { scenes };
  },
});

/** The scene open for the table, or null; the same for master and players. */
export const activeSceneQuery = (campaignId: string) => ({
  queryKey: activeKey(campaignId),
  queryFn: async ({ client }: { client: QueryClient }): Promise<SceneView | null> => {
    const asked = clock;
    const fresh = await api.activeScene(campaignId);
    const known = client.getQueryData<SceneView | null>(activeKey(campaignId));
    if (known !== undefined && changedSince(tableChangedAt, campaignId, asked)) return known;
    if (!fresh) return null;
    if (deleted.has(fresh.id)) return null;
    if (known?.id === fresh.id && known.version > fresh.version) return known;
    see(fresh);
    return fresh;
  },
});

/** One scene: any of them for the master, only the open one for a player. */
export const sceneQuery = (campaignId: string, sceneId: string) => ({
  queryKey: detailKey(campaignId, sceneId),
  queryFn: async ({ client }: { client: QueryClient }): Promise<SceneResponse> => {
    const asked = clock;
    const fresh = await api.scene(campaignId, sceneId);
    if (deleted.has(sceneId)) throw new ApiError(404, 'Cena não encontrada.');
    const known = client.getQueryData<SceneResponse>(detailKey(campaignId, sceneId))?.scene;
    if (known && (changedSince(mergedAt, sceneId, asked) || known.version > fresh.scene.version)) return { scene: known };
    see(fresh.scene);
    return fresh;
  },
});

function summarise(scene: SceneView): SceneSummary {
  const { id, name, mapUrl, mapWidth, mapHeight, active, createdAt } = scene;
  return { id, name, mapUrl, mapWidth, mapHeight, active, createdAt };
}

/**
 * A scene from an answer or the socket, into every place that shows it: its
 * detail, the open scene and the master's list (newest first, as the server
 * sends it). An older version than one already seen is dropped.
 */
export function mergeScene(queryClient: QueryClient, campaignId: string, scene: SceneView): void {
  if (deleted.has(scene.id) || (seen.get(scene.id) ?? -1) > scene.version) return;
  see(scene);
  mergedAt.set(scene.id, ++clock);

  queryClient.setQueryData<SceneResponse>(detailKey(campaignId, scene.id), { scene });

  const open = queryClient.getQueryData<SceneView | null>(activeKey(campaignId));
  // Closed: it leaves the table only if it was the one there.
  if (scene.active || open?.id === scene.id) {
    tableChangedAt.set(campaignId, clock);
    queryClient.setQueryData<SceneView | null>(activeKey(campaignId), scene.active ? scene : null);
  }

  queryClient.setQueryData<SceneListResponse>(listKey(campaignId), (current) => {
    if (!current) return current;
    const row = summarise(scene);
    const known = current.scenes.some((item) => item.id === scene.id);
    const scenes = known
      ? current.scenes.map((item) => (item.id === scene.id ? row : item))
      : [row, ...current.scenes];
    // Opening one closes the other: the server sends both, but not always in
    // the order that keeps a single row marked while they cross.
    return { scenes: scene.active ? scenes.map((item) => (item.id === scene.id ? item : { ...item, active: false })) : scenes };
  });
}

/**
 * The map left the table: closed, or its scene deleted (by this master in
 * another tab, say). Nothing is open now, whatever the cache held, so even a
 * first GET still on its way answers null. The detail and the list are asked
 * again: a player's screen learns it may no longer see the scene (404), and
 * the master's list learns whether it still exists.
 */
export function closeScene(queryClient: QueryClient, campaignId: string, sceneId: string): void {
  const open = queryClient.getQueryData<SceneView | null>(activeKey(campaignId));
  if (open === undefined || open?.id === sceneId) {
    tableChangedAt.set(campaignId, ++clock);
    queryClient.setQueryData<SceneView | null>(activeKey(campaignId), null);
  }
  void queryClient.invalidateQueries({ queryKey: detailKey(campaignId, sceneId) });
  void queryClient.invalidateQueries({ queryKey: listKey(campaignId) });
}

/** The master deleted a scene: it leaves the list, the table and its detail, for good. */
export function removeScene(queryClient: QueryClient, campaignId: string, sceneId: string): void {
  // Final: no answer, late or not, brings it back.
  deleted.add(sceneId);
  queryClient.setQueryData<SceneListResponse>(listKey(campaignId), (current) =>
    current && { scenes: current.scenes.filter((item) => item.id !== sceneId) });
  if (queryClient.getQueryData<SceneView | null>(activeKey(campaignId))?.id === sceneId) {
    tableChangedAt.set(campaignId, ++clock);
    queryClient.setQueryData<SceneView | null>(activeKey(campaignId), null);
  }
  queryClient.removeQueries({ queryKey: detailKey(campaignId, sceneId), exact: true });
}

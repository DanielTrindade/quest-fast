import type { QueryClient } from '@tanstack/react-query';
import type { SceneListResponse, SceneResponse, SceneSummary, SceneView } from '@quest-fast/shared';
import { api } from './api';

/** Everything about the campaign's scenes, so a reconnect asks for it all again. */
export const scenesKey = (campaignId: string) => ['scenes', campaignId] as const;
const listKey = (campaignId: string) => ['scenes', campaignId, 'list'] as const;
const activeKey = (campaignId: string) => ['scenes', campaignId, 'active'] as const;
const detailKey = (campaignId: string, sceneId: string) => ['scenes', campaignId, 'detail', sceneId] as const;

/** The master's list of scenes. */
export const sceneListQuery = (campaignId: string) => ({
  queryKey: listKey(campaignId),
  queryFn: () => api.scenes(campaignId),
});

/** The scene open for the table, or null; the same for master and players. */
export const activeSceneQuery = (campaignId: string) => ({
  queryKey: activeKey(campaignId),
  queryFn: () => api.activeScene(campaignId),
});

/** One scene: any of them for the master, only the open one for a player. */
export const sceneQuery = (campaignId: string, sceneId: string) => ({
  queryKey: detailKey(campaignId, sceneId),
  queryFn: () => api.scene(campaignId, sceneId),
});

/**
 * The newest version seen of each scene. Answers and pushes can cross on the
 * way: one older than what is already known never replaces it. Versions only
 * grow, so the record outlives the cache.
 */
const seen = new Map<string, number>();

function summarise(scene: SceneView): SceneSummary {
  const { id, name, mapUrl, mapWidth, mapHeight, active, createdAt } = scene;
  return { id, name, mapUrl, mapWidth, mapHeight, active, createdAt };
}

/**
 * A scene from an answer or the socket, into every place that shows it: its
 * detail, the open scene and the master's list (newest first, as the server
 * sends it). An older version than one already merged is dropped.
 */
export function mergeScene(queryClient: QueryClient, campaignId: string, scene: SceneView): void {
  if ((seen.get(scene.id) ?? -1) > scene.version) return;
  seen.set(scene.id, scene.version);

  queryClient.setQueryData<SceneResponse>(detailKey(campaignId, scene.id), { scene });

  queryClient.setQueryData<SceneView | null>(activeKey(campaignId), (current) => {
    if (scene.active) return scene;
    // Closed: it leaves the table only if it was the one there.
    return current?.id === scene.id ? null : current;
  });

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
 * The map left the table: closed, or its scene deleted. The detail is asked
 * again, so a player's screen learns it may no longer see it (404) and the
 * master's learns whether it still exists.
 */
export function closeScene(queryClient: QueryClient, campaignId: string, sceneId: string): void {
  queryClient.setQueryData<SceneView | null>(activeKey(campaignId), (current) => (current?.id === sceneId ? null : current));
  void queryClient.invalidateQueries({ queryKey: detailKey(campaignId, sceneId) });
}

/** The master deleted a scene: it leaves the list, the table and its detail. */
export function removeScene(queryClient: QueryClient, campaignId: string, sceneId: string): void {
  queryClient.setQueryData<SceneListResponse>(listKey(campaignId), (current) =>
    current && { scenes: current.scenes.filter((item) => item.id !== sceneId) });
  queryClient.setQueryData<SceneView | null>(activeKey(campaignId), (current) => (current?.id === sceneId ? null : current));
  queryClient.removeQueries({ queryKey: detailKey(campaignId, sceneId), exact: true });
}

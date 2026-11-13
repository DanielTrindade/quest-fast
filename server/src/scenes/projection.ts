import type { SceneRow } from '@quest-fast/db';
import type { SceneSummary, SceneView } from '@quest-fast/shared';
import type { Viewer } from '../events/hub.ts';

/** A scene with what its projection needs from outside the row. */
export type LoadedScene = {
  scene: SceneRow;
  /** Where the browser loads the map from, built by the asset store. */
  mapUrl: string;
  /** Open for the table (`campaigns.active_scene_id`). */
  active: boolean;
};

/**
 * The scene as one viewer may see it — the only shape that leaves the server,
 * over REST and over the socket. A player sees only the scene open for the
 * table (`null` for any other). Tokens join the projection with their
 * routes; the fog in its own delivery.
 */
export function projectScene({ scene, mapUrl, active }: LoadedScene, viewer: Viewer): SceneView | null {
  if (viewer.role !== 'master' && !active) return null;
  return {
    id: scene.id,
    campaignId: scene.campaignId,
    name: scene.name,
    mapUrl,
    mapWidth: scene.mapWidth,
    mapHeight: scene.mapHeight,
    grid: {
      enabled: scene.gridEnabled,
      cellSize: scene.gridCellSize,
      offsetX: scene.gridOffsetX,
      offsetY: scene.gridOffsetY,
      snap: scene.snapToGrid,
    },
    active,
    tokens: [],
    version: scene.version,
    createdAt: scene.createdAt.toISOString(),
  };
}

/** A row of the master's list. */
export function summariseScene({ scene, mapUrl, active }: LoadedScene): SceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    mapUrl,
    mapWidth: scene.mapWidth,
    mapHeight: scene.mapHeight,
    active,
    createdAt: scene.createdAt.toISOString(),
  };
}

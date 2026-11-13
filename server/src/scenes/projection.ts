import type { SceneRow, TokenRow } from '@quest-fast/db';
import { initials, isTokenVisible, type SceneSummary, type SceneView, type Size, type TokenView } from '@quest-fast/shared';
import type { Viewer } from '../events/hub.ts';
import type { Fighter } from './fight.ts';

/** A token with what its projection reads from its origin and from the locks. */
export type LoadedToken = {
  row: TokenRow;
  /** The sheet's or the combatant's name; a free token's own label. */
  name: string;
  size: Size;
  avatarUrl: string | null;
  /** The character's owner, who may move it besides the master. */
  ownerId: string | null;
  /** The combatant behind the token is hidden in the encounter. */
  combatantHidden: boolean;
  movingBy: TokenView['movingBy'];
  /** Its combatant in the running fight, once round 1 began. */
  fighter: Fighter | null;
  /** How far it walks: what is left of its turn in a fight, its whole speed outside one. */
  reach: TokenView['reach'];
};

/** A scene with what its projection needs from outside the row. */
export type LoadedScene = {
  scene: SceneRow;
  /** Where the browser loads the map from, built by the asset store. */
  mapUrl: string;
  /** Open for the table (`campaigns.active_scene_id`). */
  active: boolean;
  /** Empty when only the summary was loaded. */
  tokens: LoadedToken[];
};

/** Whether a viewer receives this token at all, over REST or the socket. */
export function tokenVisibleTo(token: LoadedToken, viewer: Viewer): boolean {
  return isTokenVisible({ kind: token.row.kind, hidden: token.row.hidden, combatantHidden: token.combatantHidden }, viewer.role);
}

/** The reach of a creature tells a player its speed: only characters' reach the table. */
function reachFor(token: LoadedToken, viewer: Viewer): TokenView['reach'] {
  return viewer.role === 'master' || token.row.kind === 'character' ? token.reach : null;
}

export function projectToken(token: LoadedToken, viewer: Viewer): TokenView {
  const { row } = token;
  return {
    id: row.id,
    kind: row.kind,
    name: token.name,
    size: token.size,
    avatarUrl: token.avatarUrl,
    initials: initials(token.name),
    characterId: row.characterId,
    combatantId: row.combatantId,
    statblockId: row.statblockId,
    ownerId: token.ownerId,
    hidden: row.hidden,
    x: row.x,
    y: row.y,
    movingBy: token.movingBy,
    reach: reachFor(token, viewer),
  };
}

/**
 * The scene as one viewer may see it — the only shape that leaves the server,
 * over REST and over the socket. A player sees only the scene open for the
 * table (`null` for any other) and only the tokens `isTokenVisible` lets
 * through. The fog joins the projection in its own delivery.
 */
export function projectScene({ scene, mapUrl, active, tokens }: LoadedScene, viewer: Viewer): SceneView | null {
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
    tokens: tokens.filter((token) => tokenVisibleTo(token, viewer)).map((token) => projectToken(token, viewer)),
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

import type { SceneAreaRow, SceneRow, TokenRow } from '@quest-fast/db';
import {
  initials,
  isAreaVisible,
  isTokenVisible,
  type AreaView,
  type SceneFog,
  type SceneSummary,
  type SceneView,
  type Size,
  type TokenView,
} from '@quest-fast/shared';
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
  vitality: TokenView['vitality'];
  /** The combatant behind the token is hidden in the encounter. */
  combatantHidden: boolean;
  /** The encounter of a combatant's token. */
  encounterId: string | null;
  movingBy: TokenView['movingBy'];
  /** Its combatant in the running fight, once round 1 began. */
  fighter: Fighter | null;
  /** How far it walks: what is left of its turn in a fight, its whole speed outside one. */
  reach: TokenView['reach'];
};

/** An area with what its projection reads from its creator. */
export type LoadedArea = {
  row: SceneAreaRow;
  creatorName: string;
  /** Made by the master of the campaign: under the fog, it hides like a monster. */
  byMaster: boolean;
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
  /** Empty when only the summary was loaded. */
  areas: LoadedArea[];
};

/** The fog as it leaves the server, the same for every viewer. */
export function fogOf(scene: Pick<SceneRow, 'fogEnabled' | 'fogRevealed'>): SceneFog {
  return { enabled: scene.fogEnabled, revealed: scene.fogRevealed };
}

/**
 * Whether a player moves this token: their character's, or a creature they
 * control in the running fight (#114). A free token is the master's alone.
 */
export function ownsToken(token: Pick<LoadedToken, 'row' | 'ownerId'>, userId: string): boolean {
  return token.row.kind !== 'free' && token.ownerId === userId;
}

/** Whether a viewer receives this token at all, over REST or the socket, where it rests. */
export function tokenVisibleTo(token: LoadedToken, viewer: Viewer, fog: SceneFog): boolean {
  const { kind, hidden, x, y } = token.row;
  return isTokenVisible({ kind, hidden, combatantHidden: token.combatantHidden, x, y, ownerId: token.ownerId }, viewer.role, fog);
}

/** The token an area follows, if it follows one and the token is still on the scene. */
function anchorOf(area: LoadedArea, tokens: LoadedToken[]): LoadedToken | null {
  const { anchorTokenId } = area.row;
  return anchorTokenId ? (tokens.find((token) => token.row.id === anchorTokenId) ?? null) : null;
}

/**
 * Whether a viewer receives this area at all, over REST or the socket. One
 * following a token shows only with the token, where the token rests.
 */
export function areaVisibleTo(area: LoadedArea, tokens: LoadedToken[], viewer: Viewer, fog: SceneFog): boolean {
  const { row } = area;
  const anchor = anchorOf(area, tokens);
  // The anchor went with its own removal (cascade): an area left without one is not shown.
  if (row.anchorTokenId && !anchor) return viewer.role === 'master';
  return isAreaVisible(
    {
      hidden: row.hidden,
      byMaster: area.byMaster,
      anchor: anchor
        ? { kind: anchor.row.kind, hidden: anchor.row.hidden, combatantHidden: anchor.combatantHidden, x: anchor.row.x, y: anchor.row.y }
        : null,
      x: row.x,
      y: row.y,
    },
    viewer.role,
    fog,
  );
}

export function projectArea(area: LoadedArea, tokens: LoadedToken[]): AreaView {
  const { row } = area;
  const anchor = anchorOf(area, tokens);
  return {
    id: row.id,
    shape: row.shape,
    size: row.size,
    width: row.width,
    // Drawn where the token it follows rests.
    x: anchor ? anchor.row.x : row.x,
    y: anchor ? anchor.row.y : row.y,
    angle: row.angle,
    name: row.name,
    tint: row.tint,
    createdBy: { userId: row.createdBy, name: area.creatorName },
    hidden: row.hidden,
    anchorTokenId: row.anchorTokenId,
  };
}

/** The reach of a creature tells a player its speed: only allies' (characters', controlled creatures') reach the table. */
function reachFor(token: LoadedToken, viewer: Viewer): TokenView['reach'] {
  return viewer.role === 'master' || token.row.kind === 'character' || token.ownerId !== null ? token.reach : null;
}

export function projectToken(token: LoadedToken, viewer: Viewer): TokenView {
  const { row } = token;
  return {
    id: row.id,
    kind: row.kind,
    name: token.name,
    size: token.size,
    avatarUrl: token.avatarUrl,
    vitality: token.vitality,
    initials: initials(token.name),
    characterId: row.characterId,
    combatantId: row.combatantId,
    // A player learns nothing of an encounter in preparation, not even that it exists.
    encounterId: viewer.role === 'master' ? token.encounterId : null,
    statblockId: row.statblockId,
    ownerId: token.ownerId,
    hidden: row.hidden,
    // A player never receives such a token: on theirs it is always false.
    combatantHidden: viewer.role === 'master' && token.combatantHidden,
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
 * through: none hidden, and with the fog on, none but characters' under it.
 */
export function projectScene({ scene, mapUrl, active, tokens, areas }: LoadedScene, viewer: Viewer): SceneView | null {
  if (viewer.role !== 'master' && !active) return null;
  const fog = fogOf(scene);
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
      opacity: scene.gridOpacity,
    },
    active,
    fog,
    tokens: tokens.filter((token) => tokenVisibleTo(token, viewer, fog)).map((token) => projectToken(token, viewer)),
    areas: areas.filter((area) => areaVisibleTo(area, tokens, viewer, fog)).map((area) => projectArea(area, tokens)),
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

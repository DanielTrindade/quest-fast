import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { Context as HonoContext } from 'hono';
import { assets, campaigns, characters, combatants, scenes, tokens, type SceneRow } from '@quest-fast/db';
import { effectiveSpeed, type GridSettings, type SceneResponse } from '@quest-fast/shared';
import type { Context, Deps } from '../context.ts';
import type { Executor } from '../combat/state.ts';
import type { Viewer } from '../events/hub.ts';
import { fighterOf, runningFight } from './fight.ts';
import { projectScene, type LoadedScene, type LoadedToken } from './projection.ts';

/**
 * What the scene and token routes share: loading a scene with its tokens,
 * the 404/403 rule, the version bump and the publish.
 */

type Status = 403 | 404 | 409 | 413 | 422 | 502;

/** Why a scene request was refused. Thrown inside the transaction, so nothing it touched is kept. */
export class Refusal extends Error {
  readonly status: Status;
  /** Extra fields of the error body, such as who holds a lock. */
  readonly extra: Record<string, unknown>;

  constructor(status: Status, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function refuse(status: Status, message: string, extra?: Record<string, unknown>): never {
  throw new Refusal(status, message, extra);
}

export const MASTER_ONLY = 'Ação permitida apenas ao mestre.';
export const NOT_FOUND = 'Cena não encontrada.';

/** What loading needs from a request, or from a lock outside of one. */
export type SceneScope = { deps: Pick<Deps, 'assets' | 'locks'>; campaignId: string };

export function scopeOf(c: HonoContext<Context>): SceneScope {
  return { deps: c.var.deps, campaignId: c.var.campaignId };
}

export function viewerOf(c: HonoContext<Context>): Viewer {
  return { role: c.var.role, userId: c.var.user.id };
}

export function bodyOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function activeSceneId(db: Executor, campaignId: string): string | null {
  const campaign = db.select({ activeSceneId: campaigns.activeSceneId }).from(campaigns).where(eq(campaigns.id, campaignId)).get();
  return campaign?.activeSceneId ?? null;
}

export function gridOf(scene: SceneRow): GridSettings {
  return {
    enabled: scene.gridEnabled,
    cellSize: scene.gridCellSize,
    offsetX: scene.gridOffsetX,
    offsetY: scene.gridOffsetY,
    snap: scene.snapToGrid,
  };
}

const avatars = alias(assets, 'avatars');

/**
 * The tokens of a scene with their name, size and owner read from the origin,
 * and how far each walks: what is left of its turn in the running fight, its
 * whole speed outside one.
 */
function loadTokens({ deps, campaignId }: SceneScope, db: Executor, sceneId: string): LoadedToken[] {
  const fight = runningFight(db, campaignId);
  return db
    .select({
      row: tokens,
      characterName: characters.name,
      characterSize: characters.size,
      ownerId: characters.ownerId,
      avatarPath: avatars.path,
      combatantName: combatants.name,
      combatantSize: combatants.size,
      combatantHidden: combatants.hidden,
      characterSpeed: characters.speed,
      characterConditions: characters.conditions,
      combatantSpeed: combatants.speed,
      combatantConditions: combatants.conditions,
    })
    .from(tokens)
    .leftJoin(characters, eq(characters.id, tokens.characterId))
    .leftJoin(avatars, eq(avatars.id, characters.avatarAssetId))
    .leftJoin(combatants, eq(combatants.id, tokens.combatantId))
    .where(eq(tokens.sceneId, sceneId))
    .orderBy(asc(tokens.createdAt), asc(sql`${tokens}.rowid`))
    .all()
    .map((found) => {
      const { row } = found;
      const lock = deps.locks.holder(row.id);
      const fighter = fighterOf(fight, row);
      const speed = found.characterSpeed ?? found.combatantSpeed;
      const conditions = found.characterConditions ?? found.combatantConditions ?? [];
      const reach = fighter
        ? { speed: fighter.turn.speed, left: fighter.turn.movementLeft }
        : speed === null
          ? null
          : { speed: effectiveSpeed(speed, conditions), left: effectiveSpeed(speed, conditions) };
      return {
        fighter,
        reach,
        row,
        name: found.characterName ?? found.combatantName ?? row.label ?? '',
        size: found.characterSize ?? found.combatantSize ?? row.size ?? 'medium',
        avatarUrl: found.avatarPath ? deps.assets.urlFor(found.avatarPath) : null,
        ownerId: found.ownerId,
        combatantHidden: found.combatantHidden ?? false,
        movingBy: lock ? { userId: lock.userId, name: lock.userName } : null,
      };
    });
}

/** Scenes without their tokens: enough for the master's list. */
export function loadScenes(scope: SceneScope, db: Executor, where: ReturnType<typeof and>): LoadedScene[] {
  const active = activeSceneId(db, scope.campaignId);
  return db
    .select({ scene: scenes, path: assets.path })
    .from(scenes)
    .innerJoin(assets, eq(assets.id, scenes.mapAssetId))
    .where(where)
    .orderBy(desc(scenes.createdAt), desc(sql`${scenes}.rowid`))
    .all()
    .map(({ scene, path }) => ({ scene, mapUrl: scope.deps.assets.urlFor(path), active: scene.id === active, tokens: [] }));
}

/** One scene of the campaign, with its tokens. */
export function loadScene(scope: SceneScope, db: Executor, sceneId: string): LoadedScene | undefined {
  const loaded = loadScenes(scope, db, and(eq(scenes.campaignId, scope.campaignId), eq(scenes.id, sceneId)))[0];
  if (!loaded) return undefined;
  return { ...loaded, tokens: loadTokens(scope, db, sceneId) };
}

/**
 * The scene a request is about. A player cannot tell a scene that is not
 * open for the table from a missing one (404); on the open one, an action
 * reserved to the master is a 403.
 */
export function findScene(c: HonoContext<Context>, db: Executor, { masterOnly = false } = {}): LoadedScene {
  const loaded = loadScene(scopeOf(c), db, c.req.param('sceneId') ?? '');
  const master = c.var.role === 'master';
  if (!loaded || (!master && !loaded.active)) refuse(404, NOT_FOUND);
  if (masterOnly && !master) refuse(403, MASTER_ONLY);
  return loaded;
}

export function requireMaster(c: HonoContext<Context>) {
  if (c.var.role !== 'master') refuse(403, MASTER_ONLY);
}

export function bumpVersion(db: Executor, sceneId: string, changes: Partial<SceneRow> = {}) {
  db.update(scenes)
    .set({ ...changes, version: sql`${scenes.version} + 1` })
    .where(eq(scenes.id, sceneId))
    .run();
}

export function publishScene(deps: Pick<Deps, 'hub'>, campaignId: string, loaded: LoadedScene) {
  deps.hub.publishScene(campaignId, (viewer) => projectScene(loaded, viewer));
}

export function publish(c: HonoContext<Context>, loaded: LoadedScene) {
  publishScene(c.var.deps, c.var.campaignId, loaded);
}

export function answer(c: HonoContext<Context>, loaded: LoadedScene, status: 200 | 201 = 200) {
  const response: SceneResponse = { scene: projectScene(loaded, viewerOf(c))! };
  return c.json(response, status);
}

export function refused(c: HonoContext<Context>, error: unknown) {
  if (!(error instanceof Refusal)) throw error;
  return c.json({ ...error.extra, error: error.message }, error.status);
}

/**
 * The scenes that hold a token of these combatants or characters, read before
 * a change that may remove the token with its origin.
 */
export function scenesShowing(db: Executor, origin: { combatantIds?: string[]; characterId?: string }): string[] {
  const ids = new Set<string>();
  for (const combatantId of origin.combatantIds ?? []) {
    for (const { sceneId } of db.select({ sceneId: tokens.sceneId }).from(tokens).where(eq(tokens.combatantId, combatantId)).all()) {
      ids.add(sceneId);
    }
  }
  if (origin.characterId) {
    for (const { sceneId } of db.select({ sceneId: tokens.sceneId }).from(tokens).where(eq(tokens.characterId, origin.characterId)).all()) {
      ids.add(sceneId);
    }
  }
  return [...ids];
}

/** Bumps these scenes inside the transaction that changed their tokens. */
export function bumpScenes(db: Executor, sceneIds: string[]) {
  for (const sceneId of sceneIds) bumpVersion(db, sceneId);
}

/** Publishes these scenes after the commit; one deleted meanwhile is skipped. */
export function publishScenes(deps: Pick<Deps, 'db' | 'hub' | 'assets' | 'locks'>, campaignId: string, sceneIds: string[]) {
  for (const sceneId of sceneIds) {
    const loaded = loadScene({ deps, campaignId }, deps.db, sceneId);
    if (loaded) publishScene(deps, campaignId, loaded);
  }
}

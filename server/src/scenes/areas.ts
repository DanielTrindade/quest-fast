import { randomUUID } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { Hono, type Context as HonoContext } from 'hono';
import { sceneAreas, type SceneAreaRow, type SceneRow } from '@quest-fast/db';
import {
  AREA_LIMITS as A,
  clampToMap,
  snapAreaOrigin,
  validateAreaInput,
  validateAreaPatch,
} from '@quest-fast/shared';
import type { Context } from '../context.ts';
import type { Executor } from '../combat/state.ts';
import { areaVisibleTo, fogOf, ownsToken, tokenVisibleTo, type LoadedArea, type LoadedScene } from './projection.ts';
import { answer, bodyOf, bumpVersion, findScene, gridOf, loadScene, publish, refuse, refused, scopeOf, viewerOf } from './store.ts';

const AREA_NOT_FOUND = 'Área não encontrada.';
const FULL = `A cena já tem o máximo de ${A.perScene} áreas.`;

/** Where an origin rests: on a grid intersection, on the map. */
function restingOrigin(scene: SceneRow, x: number, y: number) {
  const snapped = snapAreaOrigin(x, y, gridOf(scene));
  return clampToMap(snapped.x, snapped.y, scene.mapWidth, scene.mapHeight);
}

function areaCount(db: Executor, sceneId: string): number {
  return db.select({ n: count() }).from(sceneAreas).where(eq(sceneAreas.sceneId, sceneId)).get()?.n ?? 0;
}

/**
 * The area a request is about, as the viewer may know it: a player cannot
 * tell an area they do not see from a missing one.
 */
function findArea(c: HonoContext<Context>, loaded: LoadedScene): LoadedArea {
  const area = loaded.areas.find((candidate) => candidate.row.id === c.req.param('areaId'));
  if (!area || !areaVisibleTo(area, loaded.tokens, viewerOf(c), fogOf(loaded.scene))) refuse(404, AREA_NOT_FOUND);
  return area;
}

/** The master changes any area; a player only the ones they made. */
function requireOwner(c: HonoContext<Context>, area: LoadedArea) {
  if (c.var.role !== 'master' && area.row.createdBy !== c.var.user.id) refuse(403, 'Você só muda as áreas que criou.');
}

/**
 * The token a new area follows. The master may anchor on any token of the
 * scene; a player only on their own character's or a creature they control.
 */
function anchorFor(c: HonoContext<Context>, loaded: LoadedScene, tokenId: string) {
  const token = loaded.tokens.find((candidate) => candidate.row.id === tokenId);
  if (!token || !tokenVisibleTo(token, viewerOf(c), fogOf(loaded.scene))) refuse(404, 'Token não encontrado.');
  if (c.var.role !== 'master' && !ownsToken(token, c.var.user.id)) {
    refuse(403, 'Você só ancora uma área no seu personagem ou numa criatura que controla.');
  }
  return token;
}

/** Runs a change to the scene's areas in one transaction, then publishes and answers with the scene. */
async function change(
  c: HonoContext<Context>,
  run: (tx: Executor, loaded: LoadedScene, body: Record<string, unknown>) => void,
  status: 200 | 201 = 200,
) {
  try {
    const body = bodyOf(await c.req.json().catch(() => ({})));
    const loaded = c.var.deps.db.transaction((tx) => {
      const current = findScene(c, tx);
      run(tx, current, body);
      bumpVersion(tx, current.scene.id);
      return loadScene(scopeOf(c), tx, current.scene.id)!;
    });
    publish(c, loaded);
    return answer(c, loaded, status);
  } catch (error) {
    return refused(c, error);
  }
}

/**
 * The persistent area templates of a scene (#113). Any member who sees the
 * scene adds one; whoever made it moves, renames and removes it, and the
 * master does all of that to any area. Only the master hides one.
 */
export function areaRoutes() {
  const routes = new Hono<Context>();

  routes.post('/', (c) =>
    change(
      c,
      (tx, loaded, body) => {
        const read = validateAreaInput(body);
        if ('error' in read) refuse(422, read.error);
        const { input } = read;
        if (input.hidden && c.var.role !== 'master') refuse(403, 'Só o mestre cria uma área oculta.');
        const anchor = input.anchorTokenId ? anchorFor(c, loaded, input.anchorTokenId) : null;
        if (areaCount(tx, loaded.scene.id) >= A.perScene) refuse(422, FULL);
        // An area following a token starts at its centre and keeps it; the projection reads it live.
        const origin = anchor ? { x: anchor.row.x, y: anchor.row.y } : restingOrigin(loaded.scene, input.x, input.y);
        tx.insert(sceneAreas)
          .values({
            id: randomUUID(),
            sceneId: loaded.scene.id,
            shape: input.shape,
            size: input.size,
            width: input.width,
            ...origin,
            angle: input.angle,
            name: input.name,
            tint: input.tint,
            createdBy: c.var.user.id,
            hidden: input.hidden ?? false,
            anchorTokenId: anchor?.row.id ?? null,
          })
          .run();
      },
      201,
    ),
  );

  routes.patch('/:areaId', (c) =>
    change(c, (tx, loaded, body) => {
      const area = findArea(c, loaded);
      requireOwner(c, area);
      const read = validateAreaPatch(body, area.row.shape);
      if ('error' in read) refuse(422, read.error);
      const { patch } = read;
      if (patch.hidden !== undefined && c.var.role !== 'master') refuse(403, 'Só o mestre esconde ou revela uma área.');
      const changes: Partial<SceneAreaRow> = {};
      if (patch.x !== undefined && patch.y !== undefined) {
        if (area.row.anchorTokenId) refuse(422, 'Esta área segue um token: mova o token.');
        Object.assign(changes, restingOrigin(loaded.scene, patch.x, patch.y));
      }
      if (patch.angle !== undefined) changes.angle = patch.angle;
      if (patch.name !== undefined) changes.name = patch.name;
      if (patch.tint !== undefined) changes.tint = patch.tint;
      if (patch.hidden !== undefined) changes.hidden = patch.hidden;
      tx.update(sceneAreas).set(changes).where(eq(sceneAreas.id, area.row.id)).run();
    }),
  );

  routes.delete('/:areaId', (c) =>
    change(c, (tx, loaded) => {
      const area = findArea(c, loaded);
      requireOwner(c, area);
      tx.delete(sceneAreas).where(eq(sceneAreas.id, area.row.id)).run();
    }),
  );

  return routes;
}

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Hono, type Context as HonoContext } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { assets, campaigns, scenes, tokens, type SceneRow } from '@quest-fast/db';
import {
  MAP_LIMITS as M,
  SCENE_LIMITS as S,
  clampToMap,
  defaultGrid,
  validateGrid,
  type GridSettings,
  type SceneListResponse,
} from '@quest-fast/shared';
import type { Context } from '../context.ts';
import type { Executor } from '../combat/state.ts';
import { normaliseMap, type NormalizedMap } from '../assets/maps.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { shortText } from '../validation.ts';
import { summariseScene } from './projection.ts';
import {
  MASTER_ONLY,
  NOT_FOUND,
  activeSceneId,
  answer,
  bodyOf,
  bumpVersion,
  findScene,
  gridOf,
  loadScene,
  loadScenes,
  publish,
  refuse,
  refused,
  requireMaster,
  scopeOf,
} from './store.ts';
import { tokenRoutes } from './tokens.ts';

const MAP_TOO_LARGE = `O mapa deve ter até ${M.maxBytes / (1024 * 1024)} MB.`;

function parseName(value: unknown): string {
  const name = shortText(value, S.name);
  if (!name) refuse(422, `Dê um nome à cena, com até ${S.name} caracteres.`);
  return name;
}

type GridColumns = Pick<SceneRow, 'gridEnabled' | 'gridCellSize' | 'gridOffsetX' | 'gridOffsetY' | 'snapToGrid'>;

function columnsOf(grid: GridSettings): GridColumns {
  return {
    gridEnabled: grid.enabled,
    gridCellSize: grid.cellSize,
    gridOffsetX: grid.offsetX,
    gridOffsetY: grid.offsetY,
    snapToGrid: grid.snap,
  };
}

/** Merges a partial grid into the stored one; the result must fit the map. */
function parseGrid(value: unknown, current: GridSettings, mapWidth: number): GridSettings {
  const source = bodyOf(value);
  const grid = { ...current };
  for (const key of ['enabled', 'snap'] as const) {
    if (source[key] === undefined) continue;
    if (typeof source[key] !== 'boolean') refuse(422, 'Configuração de grid inválida.');
    grid[key] = source[key];
  }
  for (const key of ['cellSize', 'offsetX', 'offsetY'] as const) {
    if (source[key] === undefined) continue;
    if (typeof source[key] !== 'number') refuse(422, 'Configuração de grid inválida.');
    grid[key] = source[key];
  }
  const errors = validateGrid(grid, mapWidth);
  const first = errors.cellSize ?? errors.offsetX ?? errors.offsetY;
  if (first) refuse(422, first);
  return grid;
}

/**
 * A new map keeps the grid where it was when the proportion allows: the
 * master usually swaps a map for a better copy of the same one. A grid that
 * no longer fits starts over.
 */
function regrid(current: GridSettings, oldWidth: number, newWidth: number): GridSettings {
  const ratio = newWidth / oldWidth;
  const scaled = {
    ...current,
    cellSize: current.cellSize * ratio,
    offsetX: current.offsetX * ratio,
    offsetY: current.offsetY * ratio,
  };
  if (Object.keys(validateGrid(scaled, newWidth)).length === 0) return scaled;
  return { ...defaultGrid(newWidth), enabled: current.enabled, snap: current.snap };
}

/** Reads the multipart `image`, normalises it and keeps the server's copy. */
async function receiveMap(c: HonoContext<Context>, form: FormData | null): Promise<{ map: NormalizedMap; path: string }> {
  const file = form?.get('image');
  if (!(file instanceof File)) refuse(422, 'Envie a imagem do mapa.');
  if (file.size === 0) refuse(422, 'A imagem do mapa está vazia.');
  if (file.size > M.maxBytes) refuse(413, MAP_TOO_LARGE);

  const normalised = await normaliseMap(new Uint8Array(await file.arrayBuffer()));
  if (!normalised.ok) refuse(422, normalised.error);
  const { map } = normalised;
  // The store may be a remote bucket: a failure there is reported, and no
  // row is written for a file that was never kept.
  try {
    const stored = await c.var.deps.assets.save(c.var.campaignId, map.buffer, map.mimeType);
    return { map, path: stored.path };
  } catch (error) {
    console.error('map upload failed', error);
    refuse(502, 'Não foi possível guardar o mapa. Tente novamente.');
  }
}

function insertAsset(c: HonoContext<Context>, db: Executor, map: NormalizedMap, path: string): string {
  const id = randomUUID();
  db.insert(assets)
    .values({ id, campaignId: c.var.campaignId, uploadedById: c.var.user.id, path, mimeType: map.mimeType, size: map.buffer.byteLength })
    .run();
  return id;
}

/**
 * Tokens follow a new map in proportion, as the grid does: the master usually
 * swaps a map for a better copy of the same one.
 */
function rescaleTokens(db: Executor, scene: SceneRow, map: NormalizedMap) {
  const ratioX = map.width / scene.mapWidth;
  const ratioY = map.height / scene.mapHeight;
  if (ratioX === 1 && ratioY === 1) return;
  for (const token of db.select({ id: tokens.id, x: tokens.x, y: tokens.y }).from(tokens).where(eq(tokens.sceneId, scene.id)).all()) {
    const position = clampToMap(token.x * ratioX, token.y * ratioY, map.width, map.height);
    db.update(tokens).set(position).where(eq(tokens.id, token.id)).run();
  }
}

/** The whole body is refused before it is read: a map is never larger than this. */
const mapBody = bodyLimit({
  // Room for the multipart envelope and the name around the file itself.
  maxSize: M.maxBytes + 64 * 1024,
  onError: (c) => c.json({ error: MAP_TOO_LARGE }, 413),
});

/**
 * The master's scenes and the one open for the table. Every change bumps the
 * scene's `version` inside one transaction and publishes the scene as each
 * viewer may see it, as in combat. The map files themselves stay in storage,
 * like replaced avatars; only their `assets` rows go.
 */
export function sceneRoutes() {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth, requireCampaignRole());
  routes.route('/:sceneId/tokens', tokenRoutes());

  routes.get('/', (c) => {
    try {
      requireMaster(c);
      const { db } = c.var.deps;
      const response: SceneListResponse = {
        scenes: loadScenes(scopeOf(c), db, eq(scenes.campaignId, c.var.campaignId)).map(summariseScene),
      };
      return c.json(response);
    } catch (error) {
      return refused(c, error);
    }
  });

  routes.post('/', async (c, next) => {
    // Checked before the body limit, so a player learns nothing from the size.
    if (c.var.role !== 'master') return c.json({ error: MASTER_ONLY }, 403);
    return mapBody(c, next);
  }, async (c) => {
    const { db } = c.var.deps;
    try {
      const form = await c.req.formData().catch(() => null);
      const name = parseName(form?.get('name'));
      const { map, path } = await receiveMap(c, form);
      const loaded = db.transaction((tx) => {
        const id = randomUUID();
        tx.insert(scenes)
          .values({
            id,
            campaignId: c.var.campaignId,
            name,
            mapAssetId: insertAsset(c, tx, map, path),
            mapWidth: map.width,
            mapHeight: map.height,
            ...columnsOf(defaultGrid(map.width)),
          })
          .run();
        return loadScene(scopeOf(c), tx, id)!;
      });
      // A new scene is closed: only the master's list changes.
      publish(c, loaded);
      return answer(c, loaded, 201);
    } catch (error) {
      return refused(c, error);
    }
  });

  routes.get('/active', (c) => {
    const { db } = c.var.deps;
    const active = activeSceneId(db, c.var.campaignId);
    const loaded = active ? loadScene(scopeOf(c), db, active) : undefined;
    if (!loaded) return c.body(null, 204);
    return answer(c, loaded);
  });

  /**
   * Opens a scene for the table, or closes the map with `null`. Both scenes
   * involved bump their version, so no client keeps the old `active`.
   */
  routes.put('/active', async (c) => {
    const { db, hub } = c.var.deps;
    try {
      requireMaster(c);
      const body = bodyOf(await c.req.json().catch(() => ({})));
      const sceneId = body.sceneId;
      if (sceneId !== null && typeof sceneId !== 'string') refuse(422, 'Informe a cena a abrir, ou nenhuma.');

      const { opened, closed } = db.transaction((tx) => {
        const previous = activeSceneId(tx, c.var.campaignId);
        if (sceneId !== null && !loadScene(scopeOf(c), tx, sceneId)) refuse(404, NOT_FOUND);
        if (previous === sceneId) {
          return { opened: sceneId ? loadScene(scopeOf(c), tx, sceneId)! : null, closed: null };
        }
        tx.update(campaigns).set({ activeSceneId: sceneId }).where(eq(campaigns.id, c.var.campaignId)).run();
        if (previous) bumpVersion(tx, previous);
        if (sceneId) bumpVersion(tx, sceneId);
        return {
          opened: sceneId ? loadScene(scopeOf(c), tx, sceneId)! : null,
          closed: previous ? (loadScene(scopeOf(c), tx, previous) ?? null) : null,
        };
      });

      // Closing without opening another takes the map off every screen;
      // opening another replaces it, and the master's list learns both.
      if (closed && !opened) hub.publishSceneClosed(c.var.campaignId, closed.scene.id);
      if (closed) publish(c, closed);
      if (opened) publish(c, opened);
      if (!opened) return c.body(null, 204);
      return answer(c, opened);
    } catch (error) {
      return refused(c, error);
    }
  });

  routes.get('/:sceneId', (c) => {
    try {
      return answer(c, findScene(c, c.var.deps.db));
    } catch (error) {
      return refused(c, error);
    }
  });

  routes.patch('/:sceneId', async (c) => {
    const { db } = c.var.deps;
    try {
      const body = bodyOf(await c.req.json().catch(() => ({})));
      const loaded = db.transaction((tx) => {
        const { scene } = findScene(c, tx, { masterOnly: true });
        const changes: Partial<SceneRow> = {};
        if (body.name !== undefined) changes.name = parseName(body.name);
        if (body.grid !== undefined) Object.assign(changes, columnsOf(parseGrid(body.grid, gridOf(scene), scene.mapWidth)));
        // An empty change would still bump the version and reach the whole table.
        if (Object.keys(changes).length === 0) refuse(422, 'Informe o nome ou o grid a alterar.');
        bumpVersion(tx, scene.id, changes);
        return loadScene(scopeOf(c), tx, scene.id)!;
      });
      publish(c, loaded);
      return answer(c, loaded);
    } catch (error) {
      return refused(c, error);
    }
  });

  routes.put('/:sceneId/map', async (c, next) => {
    try {
      findScene(c, c.var.deps.db, { masterOnly: true });
    } catch (error) {
      return refused(c, error);
    }
    return mapBody(c, next);
  }, async (c) => {
    const { db } = c.var.deps;
    try {
      const form = await c.req.formData().catch(() => null);
      const { map, path } = await receiveMap(c, form);
      // A drag in progress is in the old map's coordinates: it ends here.
      c.var.deps.locks.clearScene(c.req.param('sceneId') ?? '');
      const loaded = db.transaction((tx) => {
        // Looked up again: the scene may have gone while the map was decoded.
        const { scene } = findScene(c, tx, { masterOnly: true });
        bumpVersion(tx, scene.id, {
          mapAssetId: insertAsset(c, tx, map, path),
          mapWidth: map.width,
          mapHeight: map.height,
          ...columnsOf(regrid(gridOf(scene), scene.mapWidth, map.width)),
        });
        tx.delete(assets).where(eq(assets.id, scene.mapAssetId)).run();
        rescaleTokens(tx, scene, map);
        return loadScene(scopeOf(c), tx, scene.id)!;
      });
      publish(c, loaded);
      return answer(c, loaded);
    } catch (error) {
      return refused(c, error);
    }
  });

  routes.delete('/:sceneId', (c) => {
    const { db, hub } = c.var.deps;
    try {
      const { scene, active } = db.transaction((tx) => {
        const loaded = findScene(c, tx, { masterOnly: true });
        tx.delete(scenes).where(eq(scenes.id, loaded.scene.id)).run();
        tx.delete(assets).where(eq(assets.id, loaded.scene.mapAssetId)).run();
        if (loaded.active) {
          tx.update(campaigns).set({ activeSceneId: null }).where(eq(campaigns.id, c.var.campaignId)).run();
        }
        return loaded;
      });
      if (active) hub.publishSceneClosed(c.var.campaignId, scene.id);
      return c.body(null, 204);
    } catch (error) {
      return refused(c, error);
    }
  });

  return routes;
}
